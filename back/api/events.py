from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
import uuid

from core.security import get_current_user, get_optional_current_user, get_db
from db.models import Event, Team, Registration, User, Notification
from schemas.main import CreateTeamRequest, ManageRegistrationRequest, TeamActionRequest
from api.notifications import create_notification

router = APIRouter()

async def manage_registration_logic(registration_id: str, action: str, current_user: User, db: Session):
    # ... (код без изменений)
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия")
    registration = db.query(Registration).filter(Registration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    event = registration.event
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    target_user = registration.user
    notification_message = ""
    notification_type = ""
    if action == "approve":
        if registration.status == "approved":
            return {"message": "Заявка уже была одобрена"}
        if event.participants_count >= event.participants_limit:
            raise HTTPException(status_code=400, detail="Достигнут лимит участников")
        registration.status = "approved"
        event.participants_count += 1
        notification_message = f"Ваша заявка на участие в событии '{event.title}' одобрена."
        notification_type = "registration_approved"
    elif action == "reject":
        if registration.status == "approved":
            event.participants_count -= 1
        db.delete(registration)
        notification_message = f"Ваша заявка на участие в событии '{event.title}' отклонена."
        notification_type = "registration_rejected"
    else:
        raise HTTPException(status_code=400, detail="Недопустимое действие")
    db.query(Notification).filter(
        Notification.related_id == registration.id,
        Notification.type == "registration_request"
    ).delete(synchronize_session=False)
    db.commit()
    create_notification(
        db, recipient_id=target_user.id, type=notification_type,
        message=notification_message, sender_id=current_user.id, related_id=event.id
    )
    return {"message": f"Заявка успешно обработана: {action}"}

async def manage_team_invite_logic(team_id: str, action: str, current_user: User, db: Session):
    # ... (код без изменений)
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")
    members_data = json.loads(team.members)
    member_found = False
    for member in members_data:
        if member["user_id"] == current_user.id:
            member_found = True
            if member["status"] == "approved":
                raise HTTPException(status_code=400, detail="Вы уже приняли это приглашение.")
            if action == "accept":
                member["status"] = "approved"
            else: # decline
                create_notification(db, recipient_id=team.created_by, type="team_invite_declined",
                                  message=f"Пользователь {current_user.nickname} отклонил приглашение в команду '{team.name}'. Команда была расформирована.")
                db.query(Notification).filter(Notification.related_id == team.id).delete(synchronize_session=False)
                db.delete(team)
                db.commit()
                return {"message": "Вы отклонили приглашение. Команда расформирована."}
            break
    if not member_found:
        raise HTTPException(status_code=403, detail="Вы не были приглашены в эту команду")
    team.members = json.dumps(members_data)
    all_approved = all(m["status"] == "approved" for m in members_data)
    if all_approved:
        team.status = "approved"
        for member in members_data:
            if member["user_id"] != team.created_by:
                create_notification(db, recipient_id=member["user_id"], type="team_approved",
                                  message=f"Команда '{team.name}' успешно сформирована!", commit=False)
        create_notification(db, recipient_id=team.created_by, type="team_approved",
                              message=f"Ваша команда '{team.name}' успешно сформирована!")
    db.commit()
    return {"message": "Вы приняли приглашение в команду."}


@router.post("/createTeam")
async def create_team(request: CreateTeamRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # ... (код без изменений)
    if current_user.id not in request.members:
         raise HTTPException(status_code=400, detail="Вы должны включить себя в состав команды.")
    event = db.query(Event).filter(Event.id == request.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    team_size = 2 if event.type == "pair" else 5
    min_team_size = 2 if event.type == "pair" else (team_size // 2)
    if event.type == "pair" and len(request.members) != 2:
        raise HTTPException(status_code=400, detail="Для парного турнира требуется ровно 2 участника")
    elif event.type == "team" and not (min_team_size <= len(request.members) <= team_size):
        raise HTTPException(status_code=400, detail=f"Для командного турнира требуется от {min_team_size} до {team_size} участников")
    elif event.type == "solo":
        raise HTTPException(status_code=400, detail="Создание команд не поддерживается для личного турнира")
    approved_user_ids = {reg.user_id for reg in db.query(Registration).filter(
        Registration.event_id == request.event_id, Registration.status == "approved"
    ).all()}
    if not all(member_id in approved_user_ids for member_id in request.members):
        raise HTTPException(status_code=400, detail="Один или несколько выбранных участников не являются подтвержденными участниками турнира.")
    existing_teams = db.query(Team).filter(Team.event_id == request.event_id).all()
    assigned_ids = {
        mid['user_id'] 
        for t in existing_teams 
        for mid in json.loads(t.members) 
        if t.status == 'approved' or (t.status == 'pending' and mid['status'] == 'approved')
    }
    if any(mid in assigned_ids for mid in request.members):
        raise HTTPException(status_code=400, detail="Один или несколько участников уже состоят в другой команде или приняли приглашение.")
    team_id = f"team_{uuid.uuid4().hex[:12]}"
    members_data = []
    is_admin_creation = current_user.role == "admin"
    for member_id in request.members:
        status = "approved" if member_id == current_user.id or is_admin_creation else "pending"
        members_data.append({"user_id": member_id, "status": status})
    new_team = Team(
        id=team_id,
        event_id=request.event_id,
        name=request.name,
        members=json.dumps(members_data),
        created_by=current_user.id,
        status="approved" if is_admin_creation else "pending"
    )
    db.add(new_team)
    db.commit()
    if not is_admin_creation:
        for member in members_data:
            if member["status"] == "pending":
                create_notification(
                    db,
                    recipient_id=member["user_id"],
                    sender_id=current_user.id,
                    type="team_invite",
                    message=f"Пользователь {current_user.nickname} приглашает вас в команду '{request.name}' для участия в '{event.title}'.",
                    related_id=team_id,
                    actions=["accept_team_invite", "decline_team_invite"]
                )
    message = "Команда создана успешно" if is_admin_creation else "Приглашения в команду отправлены"
    return {"message": message, "team_id": team_id}

@router.post("/teams/{team_id}/invite", response_model=dict)
async def handle_team_invite(
    team_id: str,
    request: TeamActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return await manage_team_invite_logic(team_id, request.action, current_user, db)

@router.post("/events/{event_id}/register")
async def register_for_event(event_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # ... (код без изменений)
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    if event.participants_count >= event.participants_limit:
        raise HTTPException(status_code=400, detail="Регистрация закрыта, достигнут лимит")
    existing_registration = db.query(Registration).filter_by(event_id=event_id, user_id=current_user.id).first()
    if existing_registration:
        raise HTTPException(status_code=400, detail="Вы уже подали заявку")
    new_registration = Registration(id=f"reg_{uuid.uuid4().hex[:12]}", event_id=event_id, user_id=current_user.id, status="pending")
    db.add(new_registration)
    db.commit()
    db.refresh(new_registration)
    admin_users = db.query(User).filter(User.role == "admin").all()
    for admin in admin_users:
        create_notification(
            db,
            recipient_id=admin.id,
            type="registration_request",
            message=f"Новая заявка на '{event.title}' от '{current_user.nickname}'.",
            sender_id=current_user.id,
            related_id=new_registration.id,
            actions=["approve_registration", "reject_registration"]
        )
    return {"message": "Ваша заявка на участие успешно подана"}

@router.post("/registrations/{registration_id}/manage")
async def manage_registration(registration_id: str, request: ManageRegistrationRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await manage_registration_logic(registration_id, request.action, current_user, db)

@router.get("/events")
async def get_events(db: Session = Depends(get_db)):
    # ... (код без изменений)
    events = db.query(Event).order_by(Event.created_at.desc()).all()
    return {"events": [{
        "id": event.id, "title": event.title, "dates": event.dates,
        "location": event.location, "type": event.type,
        "participants_limit": event.participants_limit,
        "participants_count": event.participants_count,
    } for event in events]}

@router.get("/getEvent/{event_id}")
async def get_event(event_id: str, current_user: User = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    # ... (код без изменений)
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    registrations = db.query(Registration).filter(Registration.event_id == event_id).all()
    approved_regs = [reg for reg in registrations if reg.status == "approved"]
    participants_list = [{
        "id": reg.user.id, "nick": reg.user.nickname,
        "avatar": reg.user.avatar or "", "club": reg.user.club
    } for reg in approved_regs]
    pending_registrations_list = []
    if current_user and current_user.role == "admin":
        pending_regs = [reg for reg in registrations if reg.status == "pending"]
        pending_registrations_list = [{
            "registration_id": reg.id,
            "user": {
                "id": reg.user.id, "nick": reg.user.nickname,
                "avatar": reg.user.avatar or "", "club": reg.user.club
            }
        } for reg in pending_regs]
    user_registration_status = "none"
    if current_user:
        user_reg = next((reg for reg in registrations if reg.user_id == current_user.id), None)
        if user_reg:
            user_registration_status = user_reg.status
    teams_list = []
    teams = db.query(Team).filter(Team.event_id == event_id).all()
    all_users_in_event = {p['id']: p for p in participants_list}
    if current_user and current_user.id not in all_users_in_event:
        user_db = db.query(User).filter(User.id == current_user.id).first()
        if user_db:
            all_users_in_event[current_user.id] = {"id": user_db.id, "nick": user_db.nickname}
    for t in teams:
        members_data = json.loads(t.members)
        is_member = any(m['user_id'] == current_user.id for m in members_data) if current_user else False
        if t.status == 'approved' or is_member or (current_user and current_user.role == 'admin'):
            members_with_nicks = []
            for m in members_data:
                user_info = all_users_in_event.get(m['user_id'])
                if user_info:
                    members_with_nicks.append({
                        "id": m['user_id'],
                        "nick": user_info['nick'],
                        "status": m['status']
                    })
            teams_list.append({"id": t.id, "name": t.name, "members": members_with_nicks, "status": t.status})
    return {
        "title": event.title, "dates": event.dates, "location": event.location, "type": event.type,
        "participantsLimit": event.participants_limit, "participantsCount": event.participants_count,
        "fee": event.fee, "currency": event.currency,
        "gs": {"name": event.gs_name, "role": event.gs_role, "avatar": event.gs_avatar},
        "org": {"name": event.org_name, "role": event.org_role, "avatar": event.org_avatar},
        "participants": participants_list, "teams": teams_list,
        "pending_registrations": pending_registrations_list,
        "user_registration_status": user_registration_status
    }

# --- ИЗМЕНЕНИЕ: Логика удаления/выхода из команды ---
@router.delete("/deleteTeam/{team_id}")
async def leave_or_delete_team(team_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")

    members_data = json.loads(team.members)
    is_member = any(m['user_id'] == current_user.id for m in members_data)
    is_creator = team.created_by == current_user.id
    is_admin = current_user.role == "admin"

    # Админ может удалить любую команду
    if is_admin:
        db.query(Notification).filter(Notification.related_id == team.id).delete(synchronize_session=False)
        db.delete(team)
        db.commit()
        return {"message": f"Команда {team.name} удалена администратором."}

    # Создатель может расформировать свою команду в любом статусе
    if is_creator:
        db.query(Notification).filter(Notification.related_id == team.id).delete(synchronize_session=False)
        db.delete(team)
        db.commit()
        # Уведомить остальных участников
        for member in members_data:
            if member['user_id'] != current_user.id:
                create_notification(db, recipient_id=member['user_id'], type="team_disbanded",
                                  message=f"Команда '{team.name}' была расформирована ее создателем.")
        return {"message": f"Вы расформировали свою команду '{team.name}'."}
    
    # Обычный участник может покинуть команду
    if is_member:
        new_members_data = [m for m in members_data if m['user_id'] != current_user.id]
        
        # Если после выхода команда становится невалидной (меньше минимального размера), расформировываем
        event = db.query(Event).filter(Event.id == team.event_id).first()
        min_team_size = 2 if event.type == "pair" else (5 // 2)
        
        if len(new_members_data) < min_team_size:
            db.query(Notification).filter(Notification.related_id == team.id).delete(synchronize_session=False)
            db.delete(team)
            db.commit()
            # Уведомляем всех оставшихся
            for member in new_members_data:
                create_notification(db, recipient_id=member['user_id'], type="team_disbanded",
                                  message=f"Команда '{team.name}' была расформирована, так как ее покинул участник {current_user.nickname}.")
            return {"message": f"Вы покинули команду, и она была расформирована."}
        else:
            team.members = json.dumps(new_members_data)
            # Если команда была подтверждена, меняем статус на pending, так как состав изменился
            if team.status == 'approved':
                team.status = 'pending'
            
            # Уведомляем создателя и оставшихся участников
            for member in new_members_data:
                 create_notification(db, recipient_id=member['user_id'], type="team_member_left",
                                  message=f"Пользователь {current_user.nickname} покинул команду '{team.name}'.")
            db.commit()
            return {"message": f"Вы покинули команду {team.name}."}

    raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия.")