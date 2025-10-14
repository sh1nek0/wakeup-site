from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
import uuid

from core.security import get_current_user, get_optional_current_user, get_db
from db.models import Event, Team, Registration, User
from schemas.main import CreateTeamRequest, ManageRegistrationRequest

router = APIRouter()

@router.get("/events")
async def get_events(db: Session = Depends(get_db)):
    events = db.query(Event).order_by(Event.created_at.desc()).all()
    return {"events": [{
        "id": event.id, "title": event.title, "dates": event.dates,
        "location": event.location, "type": event.type,
        "participants_limit": event.participants_limit,
        "participants_count": event.participants_count,
    } for event in events]}

@router.get("/getEvent/{event_id}")
async def get_event(event_id: str, current_user: User = Depends(get_optional_current_user), db: Session = Depends(get_db)):
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
    approved_member_ids = {p["id"] for p in participants_list}
    for t in teams:
        members_ids = json.loads(t.members)
        if all(mid in approved_member_ids for mid in members_ids):
            members = [
                {"id": mid, "nick": p["nick"]}
                for mid in members_ids
                if (p := next((p_data for p_data in participants_list if p_data["id"] == mid), None))
            ]
            teams_list.append({"id": t.id, "name": t.name, "members": members})

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

@router.post("/createTeam")
async def create_team(request: CreateTeamRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администраторы могут создавать команды")

    event = db.query(Event).filter(Event.id == request.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")

    team_size = 2 if event.type == "pair" else 5
    min_team_size = team_size // 2 if event.type == "team" else team_size

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
        raise HTTPException(status_code=400, detail="Один или несколько участников не являются подтвержденными")

    existing_teams = db.query(Team).filter(Team.event_id == request.event_id).all()
    assigned_ids = {mid for t in existing_teams for mid in json.loads(t.members)}
    if any(mid in assigned_ids for mid in request.members):
        raise HTTPException(status_code=400, detail="Один или несколько участников уже в другой команде")

    team_id = f"team_{uuid.uuid4().hex[:8]}"
    new_team = Team(id=team_id, event_id=request.event_id, name=request.name, members=json.dumps(request.members))
    db.add(new_team)
    db.commit()
    return {"message": "Команда создана успешно", "team_id": team_id}

@router.delete("/deleteTeam/{team_id}")
async def delete_team(team_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия")
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")
    db.delete(team)
    db.commit()
    return {"message": f"Команда {team_id} удалена успешно"}

@router.post("/events/{event_id}/register")
async def register_for_event(event_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
    return {"message": "Ваша заявка на участие успешно подана"}

@router.post("/registrations/{registration_id}/manage")
async def manage_registration(registration_id: str, request: ManageRegistrationRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия")

    registration = db.query(Registration).filter(Registration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    
    event = registration.event
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")

    if request.action == "approve":
        if registration.status == "approved":
            return {"message": "Заявка уже была одобрена"}
        if event.participants_count >= event.participants_limit:
            raise HTTPException(status_code=400, detail="Достигнут лимит участников")
        registration.status = "approved"
        event.participants_count += 1
        db.commit()
        return {"message": "Заявка успешно одобрена"}
    elif request.action == "reject":
        if registration.status == "approved":
            event.participants_count -= 1
        db.delete(registration)
        db.commit()
        return {"message": "Заявка успешно отклонена"}
    else:
        raise HTTPException(status_code=400, detail="Недопустимое действие")