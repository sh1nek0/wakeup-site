from fastapi import APIRouter, Depends, HTTPException,File, UploadFile, Query, Form
from sqlalchemy.orm import Session, selectinload, aliased
import json
import uuid
import random
import re
from typing import List, Dict, Tuple
from datetime import datetime, timezone  # Добавлено timezone для корректного получения UTC времени
import math
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from core.config import AVATAR_DIR
import logging
from sqlalchemy import distinct, func, or_
from pathlib import Path
from core.security import get_current_user, get_optional_current_user, get_db
from db.models import Event, Team, Registration, User, Notification, Game, event_judges
from schemas.main import CreateTeamRequest, ManageRegistrationRequest, TeamActionRequest, EventSetupRequest, GenerateSeatingRequest, CreateEventRequest, UpdateEventRequest
from api.notifications import create_notification
from collections import defaultdict
from typing import Optional


logger = logging.getLogger(__name__)

# Попытка импортировать pulp — если нет, будет fallback
try:
    import pulp
    HAS_PULP = True
except Exception:
    HAS_PULP = False


router = APIRouter()

async def manage_registration_logic(registration_id: str, action: str, current_user: User, db: Session):
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
        notification_message = f"Ваша заявка на участие в событии '{event.title}' отклонена."
        notification_type = "registration_rejected"
        # Если заявка отклонена, помечаем саму запись о регистрации для удаления
        db.delete(registration)
    else:
        raise HTTPException(status_code=400, detail="Недопустимое действие")

    # Помечаем для удаления уведомления у ВСЕХ админов, связанные с этим запросом
    db.query(Notification).filter(
        Notification.related_id == registration.id,
        Notification.type == "registration_request"
    ).delete(synchronize_session=False)

    # Уведомление для пользователя будет создано, но не закоммичено
    create_notification(
        db,
        recipient_id=target_user.id,
        type=notification_type,
        message=notification_message,
        sender_id=current_user.id,
        related_id=event.id,
        commit=False # <-- Важный флаг, чтобы не делать commit здесь
    )
    
    return {"message": f"Заявка успешно обработана: {action}"}

async def manage_team_invite_logic(team_id: str, action: str, current_user: User, db: Session):

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

@router.delete("/deletePlayer/{user_id}/Event/{event_id}")
async def delete_player_from_event(
    user_id: str,
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Проверка прав: только админ может удалять игроков
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия")
    
    # Поиск регистрации по user_id и event_id
    registration = db.query(Registration).filter(
        Registration.user_id == user_id,
        Registration.event_id == event_id
    ).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Регистрация игрока на событие не найдена")
    
    # Получение события для уведомлений и обновления счетчика
    event = registration.event
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    
    # Если регистрация была одобрена, уменьшаем счетчик участников
    if registration.status == "approved":
        event.participants_count -= 1
    
    # Удаление уведомлений админов, связанных с этой регистрацией
    db.query(Notification).filter(
        Notification.related_id == registration.id,
        Notification.type == "registration_request"
    ).delete(synchronize_session=False)
    
    # Создание уведомления для удаленного пользователя
    create_notification(
        db,
        recipient_id=user_id,
        type="registration_removed",
        message=f"Вы были удалены из события '{event.title}' администратором.",
        sender_id=current_user.id,
        related_id=event.id,
        commit=False  # Не коммитим здесь, чтобы сделать все в одном транзакте
    )
    
    # Удаление самой регистрации
    db.delete(registration)
    
    # Коммит всех изменений
    db.commit()
    
    return {"message": "Игрок успешно удален из события"}

@router.post("/createTeam")
async def create_team(request: CreateTeamRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
   
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

def get_user_avatar(user_obj):
    return user_obj.avatar if user_obj else None

@router.get("/events")
async def get_events(db: Session = Depends(get_db)):

    # Загружаем события с judges без сортировки по position
    events_query = (
        db.query(Event)
        .options(selectinload(Event.judges))
        .order_by(Event.created_at.desc())
        .all()
    )

    events_list = []

    for event in events_query:

        # --- Безопасный парсинг дат ---
        try:
            dates_parsed = json.loads(event.dates) if event.dates else []
            if not isinstance(dates_parsed, list):
                dates_parsed = []
        except (json.JSONDecodeError, TypeError):
            dates_parsed = []

        # --- Судьи (могут быть пустыми) ---
        judges_data = []
        if event.judges:
            for j in event.judges:
                judges_data.append({
                    "user_id": j.id,
                    "nickname": j.nickname,
                    "avatar": get_user_avatar(j)
                })

        events_list.append({
            "id": event.id,
            "title": event.title,
            "dates": dates_parsed,
            "location": event.location,
            "type": event.type,
            "participants_limit": event.participants_limit,
            "participants_count": event.participants_count,
            "avatar": event.avatar,
            "judges": judges_data  # всегда список
        })

    return {"events": events_list}


@router.get("/getEvent/{event_id}")
async def get_event(
    event_id: str,
    current_user: User = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    # Подгружаем Event с games и judges
    event = db.query(Event).options(
        selectinload(Event.games),
        selectinload(Event.judges)
    ).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    
    # Десериализация dates
    try:
        dates_parsed = json.loads(event.dates) if event.dates else []
    except json.JSONDecodeError:
        dates_parsed = []

    # Подгружаем регистрации участников
    registrations = db.query(Registration).filter(Registration.event_id == event_id).all()
    approved_regs = [reg for reg in registrations if reg.status == "approved"]
    participants_list = [{
        "id": reg.user.id,
        "nick": reg.user.nickname,
        "avatar": get_user_avatar(reg.user),
        "club": reg.user.club
    } for reg in approved_regs]

    # Pending registrations для админа
    pending_registrations_list = []
    if current_user and current_user.role == "admin":
        pending_regs = [reg for reg in registrations if reg.status == "pending"]
        pending_registrations_list = [{
            "registration_id": reg.id,
            "user": {
                "id": reg.user.id,
                "nick": reg.user.nickname,
                "avatar": get_user_avatar(reg.user),
                "club": reg.user.club
            }
        } for reg in pending_regs]

    # Статус регистрации текущего пользователя
    user_registration_status = "none"
    if current_user:
        user_reg = next((reg for reg in registrations if reg.user_id == current_user.id), None)
        if user_reg:
            user_registration_status = user_reg.status

    # Подгружаем команды
    teams_list = []
    teams = db.query(Team).filter(Team.event_id == event_id).all()
    all_users_in_event = {p['id']: p for p in participants_list}
    if current_user and current_user.id not in all_users_in_event:
        user_db = db.query(User).filter(User.id == current_user.id).first()
        if user_db:
            all_users_in_event[current_user.id] = {"id": user_db.id, "nick": user_db.nickname}

    for t in teams:
        try:
            members_data = json.loads(t.members)
        except (json.JSONDecodeError, TypeError):
            members_data = []

        is_member = any(m.get('user_id') == current_user.id for m in members_data) if current_user else False
        if t.status == 'approved' or is_member or (current_user and current_user.role == 'admin'):
            members_with_nicks = []
            for m in members_data:
                user_info = all_users_in_event.get(m.get('user_id'))
                if user_info:
                    members_with_nicks.append({
                        "id": m['user_id'],
                        "nick": user_info['nick'],
                        "status": m.get('status')
                    })
            teams_list.append({
                "id": t.id,
                "name": t.name,
                "members": members_with_nicks,
                "status": t.status
            })

    # Подгружаем судей события
    judges_data = [
        {"id": j.id, "nickname": j.nickname, "avatar": get_user_avatar(j)}
        for j in event.judges or []
    ]

    # Игры
    games_list = []
    is_admin = current_user and current_user.role == "admin"

    if not event.games_are_hidden or is_admin:
        sorted_games = sorted(event.games, key=lambda g: g.gameId)
        all_users_in_db = db.query(User.id, User.nickname).all()
        nick_to_id_map = {nick: uid for uid, nick in all_users_in_db}

        # Можно вставить твою логику расчёта очков (total_plus_only, ci, bestMovesWithBlack и т.д.)
        for game in sorted_games:
            try:
                game_data = json.loads(game.data)
                players = game_data.get("players", [])
            except (json.JSONDecodeError, TypeError):
                players = []

            judge_nickname = game_data.get("gameInfo", {}).get("judgeNickname")
            round_match = re.search(r'_r(\d+)', game.gameId)
            round_number = int(round_match.group(1)) if round_match else None

            games_list.append({
                "id": game.gameId,
                "event_id": game.event_id,
                "players": players,  # сюда можно вставить обработку points, ci и т.д.
                "created_at": game.created_at,
                "badgeColor": game_data.get("badgeColor"),
                "judge_nickname": judge_nickname,
                "judge_id": nick_to_id_map.get(judge_nickname),
                "location": game_data.get("location"),
                "tableNumber": game_data.get("gameInfo", {}).get("tableNumber"),
                "roundNumber": round_number,
                "gameInfo": game_data.get("gameInfo", {})
            })

    return {
        "title": event.title,
        "dates": dates_parsed,
        "location": event.location,
        "type": event.type,
        "participantsLimit": event.participants_limit,
        "participantsCount": event.participants_count,
        "fee": event.fee,
        "currency": event.currency,
        "gs": {"name": event.gs_name, "role": event.gs_role, "avatar": event.gs_avatar},
        "org": {"name": event.org_name, "role": event.org_role, "avatar": event.org_avatar},
        "participants": participants_list,
        "judges": judges_data,  # <-- добавили судей
        "teams": teams_list,
        "pending_registrations": pending_registrations_list,
        "user_registration_status": user_registration_status,
        "games": games_list,
        "games_are_hidden": event.games_are_hidden,
        "seating_exclusions": event.seating_exclusions or "",
        "avatar": event.avatar
    }


@router.delete("/deleteTeam/{team_id}")
async def leave_or_delete_team(team_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")

    members_data = json.loads(team.members)
    is_member = any(m['user_id'] == current_user.id for m in members_data)
    is_creator = team.created_by == current_user.id
    is_admin = current_user.role == "admin"

    if is_admin:
        db.query(Notification).filter(Notification.related_id == team.id).delete(synchronize_session=False)
        db.delete(team)
        db.commit()
        return {"message": f"Команда {team.name} удалена администратором."}

    if is_creator:
        db.query(Notification).filter(Notification.related_id == team.id).delete(synchronize_session=False)
        db.delete(team)
        db.commit()
        for member in members_data:
            if member['user_id'] != current_user.id:
                create_notification(db, recipient_id=member['user_id'], type="team_disbanded",
                                  message=f"Команда '{team.name}' была расформирована ее создателем.")
        return {"message": f"Вы расформировали свою команду '{team.name}'."}
    
    if is_member:
        new_members_data = [m for m in members_data if m['user_id'] != current_user.id]
        
        event = db.query(Event).filter(Event.id == team.event_id).first()
        min_team_size = 2 if event.type == "pair" else (5 // 2)
        
        if len(new_members_data) < min_team_size:
            db.query(Notification).filter(Notification.related_id == team.id).delete(synchronize_session=False)
            db.delete(team)
            db.commit()
            for member in new_members_data:
                create_notification(db, recipient_id=member['user_id'], type="team_disbanded",
                                  message=f"Команда '{team.name}' была расформирована, так как ее покинул участник {current_user.nickname}.")
            return {"message": f"Вы покинули команду, и она была расформирована."}
        else:
            team.members = json.dumps(new_members_data)
            if team.status == 'approved':
                team.status = 'pending'
            
            for member in new_members_data:
                 create_notification(db, recipient_id=member['user_id'], type="team_member_left",
                                  message=f"Пользователь {current_user.nickname} покинул команду '{team.name}'.")
            db.commit()
            return {"message": f"Вы покинули команду {team.name}."}

    raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия.")

@router.post("/events/{event_id}/setup_games", status_code=201)
async def setup_event_games(event_id: str, request: EventSetupRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администраторы могут настраивать игры.")
    
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено.")

    db.query(Game).filter(Game.event_id == event_id).delete(synchronize_session=False)

    new_games = []
    for r in range(1, request.num_rounds + 1):
        for t in range(1, request.num_tables + 1):
            game_id = f"{event_id}_r{r}_t{t}"
            game_data = {
                "players": [],
                "gameInfo": {
                    "roundNumber": r,
                    "tableNumber": t
                }
            }
            game = Game(
                gameId=game_id,
                event_id=event_id,
                data=json.dumps(game_data)
            )
            new_games.append(game)
    
    db.add_all(new_games)
    db.commit()
    return {"message": f"Создано {len(new_games)} игр для события '{event.title}'."}


#Рассадка
@router.post("/events/{event_id}/generate_seating")
async def generate_event_seating(
    event_id: str,
    request: GenerateSeatingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # ============================================================
    # 0. Авторизация
    # ============================================================
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администраторы могут генерировать рассадку.")

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено.")

    games = db.query(Game).filter(Game.event_id == event_id).order_by(Game.gameId).all()
    if not games:
        raise HTTPException(status_code=400, detail="Сначала необходимо создать сетку игр.")

    if event.type not in ["pair", "solo"]:
        raise HTTPException(status_code=400, detail="Поддерживаются только pair и solo турниры.")

    event.seating_exclusions = json.dumps(request.exclusions_text)
    db.commit()

    # ============================================================
    # 1. Определяем столы и раунды
    # ============================================================
    table_labels = sorted(list(set(g.gameId.split('_t')[1] for g in games if '_t' in g.gameId)))
    num_tables = len(table_labels)

    max_round = 0
    for g in games:
        m = re.search(r'_r(\d+)', g.gameId)
        if m:
            max_round = max(max_round, int(m.group(1)))

    num_rounds = max_round

    if num_rounds == 0:
        if len(games) % num_tables == 0:
            num_rounds = len(games) // num_tables
        else:
            raise HTTPException(status_code=400, detail="Не удалось определить количество раундов.")

    def generate_slot_queue(num_rounds: int):
        """
        Генерирует список позиций 0..9 длиной num_rounds.
        До 10 игр — без повторений.
        После 10 — новый случайный цикл.
        """
        slots = []
        while len(slots) < num_rounds:
            block = list(range(10))
            random.shuffle(block)
            slots.extend(block)
        return slots[:num_rounds]

    # ============================================================
    # =================== SOLO ===================
    # ============================================================
    if event.type == "solo":

        participants = db.query(Registration).filter(
            Registration.event_id == event_id,
            Registration.status == "approved"
        ).all()

        players = [{"id": r.user_id, "nick": r.user.nickname} for r in participants]

        if not players:
            raise HTTPException(status_code=400, detail="Нет подтвержденных участников.")

        capacity = num_tables * 10
        if len(players) > capacity:
            raise HTTPException(status_code=400, detail="Игроков больше чем вместимость.")

        user_ids = [p["id"] for p in players]
        db_users = db.query(User).filter(User.id.in_(user_ids)).all()
        user_map = {u.id: u for u in db_users}

        # Персональная ротация мест
        player_slot_queue = {}
        for p in players:
            player_slot_queue[p["id"]] = generate_slot_queue(num_rounds)

        # Множество уже использованных слотов для каждого игрока
        player_used_slots = {pid: set() for pid in player_slot_queue}

        master_seed = random.randrange(1_000_000_000)
        all_round_tables = []

        for r in range(num_rounds):
            # При достижении нового цикла слоты сбрасываем
            if r % 10 == 0:
                for pid in player_used_slots:
                    player_used_slots[pid].clear()

            rnd = random.Random(master_seed + r)
            shuffled_players = players[:]
            rnd.shuffle(shuffled_players)

            tables = [[] for _ in range(num_tables)]

            for p in shuffled_players:
                for t in tables:
                    if len(t) < 10:
                        t.append(p)
                        break

            final_tables = []

            for t_i in range(num_tables):

                slots = [None] * 10

                for p in tables[t_i]:
                    pid = p["id"]
                    pref = player_slot_queue[pid][r]

                    placed = False
                    # 1) Пробуем желаемое место, если не использовано и свободно
                    if slots[pref] is None and pref not in player_used_slots[pid]:
                        slots[pref] = p
                        player_used_slots[pid].add(pref)
                        placed = True

                    # 2) Если занято, ищем свободное и не использованное
                    if not placed:
                        for i in range(10):
                            if slots[i] is None and i not in player_used_slots[pid]:
                                slots[i] = p
                                player_used_slots[pid].add(i)
                                placed = True
                                break

                    if not placed:
                        raise HTTPException(
                            status_code=500,
                            detail=f"Не удалось назначить уникальный слот игроку {p['nick']} в раунде {r+1}"
                        )

                for i in range(10):
                    if slots[i] is None:
                        slots[i] = {"id": f"placeholder_r{r+1}_t{t_i+1}_{i+1}", "nick": None}

                final_tables.append(slots)

            all_round_tables.append(final_tables)

    # ============================================================
    # =================== PAIR ===================
    # ============================================================
    else:

        teams = db.query(Team).filter(
            Team.event_id == event_id,
            Team.status == "approved"
        ).all()

        if not teams:
            raise HTTPException(status_code=400, detail="Нет подтвержденных команд.")

        participants = []
        for t in teams:
            participants.append({
                "team_id": t.id,
                "players": [
                    {"id": t.player1_id, "nick": t.player1_nickname},
                    {"id": t.player2_id, "nick": t.player2_nickname}
                ]
            })

        capacity = num_tables * 5
        if len(participants) > capacity:
            raise HTTPException(status_code=400, detail="Команд больше чем вместимость.")

        user_ids = []
        for part in participants:
            for p in part["players"]:
                user_ids.append(p["id"])

        db_users = db.query(User).filter(User.id.in_(user_ids)).all()
        user_map = {u.id: u for u in db_users}

        # Персональная ротация мест
        player_slot_queue = {}
        for part in participants:
            for p in part["players"]:
                if p["id"] not in player_slot_queue:
                    player_slot_queue[p["id"]] = generate_slot_queue(num_rounds)

        # Множество уже использованных слотов для каждого игрока
        player_used_slots = {pid: set() for pid in player_slot_queue}

        master_seed = random.randrange(1_000_000_000)
        all_round_tables = []

        for r in range(num_rounds):
            # Сброс слотов каждые 10 раундов
            if r % 10 == 0:
                for pid in player_used_slots:
                    player_used_slots[pid].clear()

            rnd = random.Random(master_seed + r)
            shuffled_teams = participants[:]
            rnd.shuffle(shuffled_teams)

            tables = [[] for _ in range(num_tables)]

            for team in shuffled_teams:
                for t in tables:
                    if len(t) < 5:
                        t.append(team)
                        break

            final_tables = []

            for t_i in range(num_tables):

                slots = [None] * 10

                for team in tables[t_i]:
                    for p in team["players"]:

                        pid = p["id"]
                        pref = player_slot_queue[pid][r]

                        placed = False
                        # 1) Пробуем желаемое место, если не использовано и свободно
                        if slots[pref] is None and pref not in player_used_slots[pid]:
                            slots[pref] = p
                            player_used_slots[pid].add(pref)
                            placed = True

                        # 2) Если занято, ищем свободное и не использованное
                        if not placed:
                            for i in range(10):
                                if slots[i] is None and i not in player_used_slots[pid]:
                                    slots[i] = p
                                    player_used_slots[pid].add(i)
                                    placed = True
                                    break

                        if not placed:
                            raise HTTPException(
                                status_code=500,
                                detail=f"Не удалось назначить уникальный слот игроку {p['nick']} в раунде {r+1}"
                            )

                for i in range(10):
                    if slots[i] is None:
                        slots[i] = {"id": f"placeholder_r{r+1}_t{t_i+1}_{i+1}", "nick": None}

                final_tables.append(slots)

            all_round_tables.append(final_tables)

    # ============================================================
    # 7. Запись в Game.data
    # ============================================================
    game_map = {g.gameId: g for g in games}

    for r in range(1, num_rounds + 1):
        for idx, label in enumerate(table_labels):

            game_id = f"{event_id}_r{r}_t{label}"
            game = game_map.get(game_id)
            if not game:
                continue

            slots = all_round_tables[r - 1][idx]

            players_list = []

            for p in slots:
                if p.get("nick") is None:
                    players_list.append({
                        "id": p["id"],
                        "name": "",
                        "role": "мирный",
                        "plus": 2.5,
                        "sk": 0,
                        "jk": 0,
                        "best_move": ""
                    })
                else:
                    user = user_map.get(p["id"])
                    players_list.append({
                        "id": p["id"],
                        "name": user.nickname if user else "",
                        "role": "мирный",
                        "plus": 2.5,
                        "sk": 0,
                        "jk": 0,
                        "best_move": ""
                    })

            data = json.loads(game.data) if game.data else {}
            data["players"] = players_list
            game.data = json.dumps(data, ensure_ascii=False)

    db.commit()

    return {"message": "Рассадка успешно сгенерирована."}

#Видимость
@router.post("/events/{event_id}/toggle_visibility")
async def toggle_games_visibility(event_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администраторы могут выполнять это действие.")
    
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено.")
        
    event.games_are_hidden = not event.games_are_hidden
    db.commit()
    
    status = "скрыты" if event.games_are_hidden else "показаны"
    return {"message": f"Игры турнира теперь {status} для обычных пользователей.", "games_are_hidden": event.games_are_hidden}

#Создание
@router.post("/event")
async def create_event(request: CreateEventRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администраторы могут создавать события.")
    
    event_id = f"event_{uuid.uuid4().hex[:12]}"
    new_event = Event(
        id=event_id,
        title=request.title,
        dates=json.dumps([d.isoformat() for d in request.dates]),  # Преобразуем datetime в ISO строки перед сериализацией
        location=request.location,
        type=request.type,
        participants_limit=request.participants_limit,
        participants_count=0,  # Начинаем с 0
        fee=request.fee,
        currency=request.currency,
        gs_name=request.gs_name,
        gs_role=request.gs_role,
        gs_avatar=request.gs_avatar,
        org_name=request.org_name,
        org_role=request.org_role,
        org_avatar=request.org_avatar,
        created_at=datetime.now(timezone.utc),  # Исправлено: вместо datetime.utcnow() используем datetime.now(timezone.utc)
        games_are_hidden=request.games_are_hidden,
        seating_exclusions=json.dumps(request.seating_exclusions)  # Сохраняем как JSON строку
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    
    # Десериализуем для возврата
    try:
        dates_parsed = json.loads(new_event.dates) if new_event.dates else []
    except json.JSONDecodeError:
        dates_parsed = request.dates  # Fallback на оригинал
    
    return {
        "message": "Событие успешно создано.",
        "event_id": event_id,
        "event": {
            "id": new_event.id,
            "title": new_event.title,
            "dates": dates_parsed,  # Возвращаем как список
            "location": new_event.location,
            "type": new_event.type,
            "participants_limit": new_event.participants_limit,
            "participants_count": new_event.participants_count,
            "fee": new_event.fee,
            "currency": new_event.currency,
            "gs_name": new_event.gs_name,
            "gs_role": new_event.gs_role,
            "gs_avatar": new_event.gs_avatar,
            "org_name": new_event.org_name,
            "org_role": new_event.org_role,
            "org_avatar": new_event.org_avatar,
            "created_at": new_event.created_at,
            "games_are_hidden": new_event.games_are_hidden,
            "seating_exclusions": request.seating_exclusions
        }
    }

@router.delete("/event/{event_id}")
async def delete_event(event_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администраторы могут удалять события.")
    
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено.")
    
    # Удаляем связанные записи
    db.query(Registration).filter(Registration.event_id == event_id).delete(synchronize_session=False)
    db.query(Team).filter(Team.event_id == event_id).delete(synchronize_session=False)
    db.query(Game).filter(Game.event_id == event_id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.related_id == event_id).delete(synchronize_session=False)
    
    db.delete(event)
    db.commit()
    
    return {"message": f"Событие '{event.title}' успешно удалено."}


# Статистика
def calculate_ci(x: int, n: int) -> float:
    if n <= 0 or x < 0 or x > n:
        return 0.0
    K = max(0, x - n / 10)
    if K == 0:
        return 0.0
    return K * (K + 1) / math.sqrt(n)


def calculate_location_rating(points: float, games: int) -> float:
    if games <= 0:
        return 0.0
    return points / math.sqrt(games)


@router.get("/events/{event_id}/player-stats")
async def get_player_stats(
    event_id: str,
    location: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    # ---------------------------
    # Получение игр
    # ---------------------------
    if event_id == "1":
        query = db.query(Game).filter(
            or_(Game.event_id == event_id, Game.event_id.is_(None))
        )
    else:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено.")
        query = db.query(Game).filter(Game.event_id == event_id)

    if location:
        loc_expr = func.trim(func.json_extract(Game.data, "$.location"), '"')
        query = query.filter(loc_expr == location)

    query = query.order_by(Game.created_at.asc())

    games = query.all()
    if not games:
        return {"players": [], "message": "Нет игр в событии."}

    # ---------------------------
    # Парсинг игр
    # ---------------------------
    parsed_games = []
    user_ids = set()

    for game in games:
        if not game.data:
            continue
        try:
            data = json.loads(game.data)
            parsed_games.append(data)

            for p in data.get("players", []):
                uid = p.get("userId")
                if uid:
                    user_ids.add(uid)

        except json.JSONDecodeError:
            continue

    # ---------------------------
    # Загрузка пользователей
    # ---------------------------
    db_users = db.query(User).filter(User.id.in_(user_ids)).all()

    user_info_map = {
        u.id: {
            "nickname": u.nickname or u.name,
            "club": u.club,
            "photoUrl": u.avatar,
        }
        for u in db_users
    }

    # ---------------------------
    # Структура статистики
    # ---------------------------
    role_mapping = {
        "шериф": "sheriff",
        "мирный": "citizen",
        "мафия": "mafia",
        "дон": "don"
    }

    player_totals = defaultdict(lambda: {
        "name": "",
        "club": None,
        "photoUrl": None,
        "total_plus": 0.0,
        "total_best_move_bonus": 0.0,
        "total_minus": 0.0,
        "ci_total": 0.0,
        "bestMovesWithBlack": 0,
        "jk_count": 0,
        "sk_count": 0,
        "games_count": 0,
        "wins": defaultdict(int),
        "gamesPlayed": defaultdict(int),
        "role_plus": defaultdict(list),
        "deaths": 0,
        "deathsWith1Black": 0,
        "deathsWith2Black": 0,
        "deathsWith3Black": 0,
        "games_miet": 0,
        "games_mipt": 0,
    })

    # ---------------------------
    # Основной цикл
    # ---------------------------
    for data in parsed_games:

        badge_color = data.get("badgeColor")
        location_lower = data.get("location", "").lower()

        player_roles = {
            str(p.get("id")): p.get("role")
            for p in data.get("players", [])
        }

        for p in data.get("players", []):

            name = p.get("name", "").strip()
            if not name:
                continue

            uid = p.get("userId")
            key = uid if uid else name
            stats = player_totals[key]

            if uid and uid in user_info_map:
                info = user_info_map[uid]
                stats["name"] = info["nickname"]
                stats["club"] = info["club"]
                stats["photoUrl"] = info["photoUrl"]
            else:
                stats["name"] = name

            stats["games_count"] += 1

            if "миэт" in location_lower:
                stats["games_miet"] += 1
            elif "мфти" in location_lower:
                stats["games_mipt"] += 1

            role = p.get("role")
            english_role = role_mapping.get(role)

            if english_role:
                stats["gamesPlayed"][english_role] += 1

                win_condition = (
                    (badge_color == "red" and role in ["мирный", "шериф"]) or
                    (badge_color == "black" and role in ["мафия", "дон"])
                )

                if win_condition:
                    stats["wins"][english_role] += 1

                plus = p.get("plus", 0)
                if isinstance(plus, (int, float)):
                    stats["total_plus"] += plus
                    stats["role_plus"][english_role].append(float(plus))

            sk = p.get("sk", 0)
            if isinstance(sk, (int, float)) and sk > 0:
                stats["sk_count"] += int(sk)
                stats["total_minus"] -= 0.5 * sk

            jk = p.get("jk", 0)
            if isinstance(jk, (int, float)) and jk > 0:
                stats["jk_count"] += int(jk)

            best_move = p.get("best_move", "").strip()
            if best_move:
                nominated = [s for s in best_move.split() if s.isdigit()]
                if len(nominated) == 3:

                    mafia_count = 0
                    for s in nominated:
                        idx = int(s) - 1
                        if 0 <= idx < len(data["players"]):
                            pid = data["players"][idx]["id"]
                            if player_roles.get(str(pid)) in ["мафия", "дон"]:
                                mafia_count += 1

                    bonus = {3: 1.5, 2: 1.0, 1: 0.0}.get(mafia_count, 0.0)
                    stats["total_best_move_bonus"] += bonus

                    if english_role and bonus > 0:
                        stats["role_plus"][english_role].append(bonus)

                    if mafia_count >= 1:
                        stats["bestMovesWithBlack"] += 1
                        current_x = stats["bestMovesWithBlack"]
                        current_n = stats["games_count"]
                        ci_value = calculate_ci(current_x, current_n)
                        stats["ci_total"] += ci_value

                    stats["deaths"] += 1
                    if mafia_count == 1:
                        stats["deathsWith1Black"] += 1
                    elif mafia_count == 2:
                        stats["deathsWith2Black"] += 1
                    elif mafia_count == 3:
                        stats["deathsWith3Black"] += 1

    if not player_totals:
        return {"players": [], "message": "Нет данных о игроках."}

    # ---------------------------
    # Формирование ответа
    # ---------------------------
    response_players = []

    for key, stats in player_totals.items():

        jk = stats["jk_count"]
        jk_penalty = 0.5 * jk * (jk + 1) if jk > 0 else 0.0

        total_points = (
            stats["total_plus"]
            + stats["total_best_move_bonus"]
            + stats["total_minus"]
            - jk_penalty
            + 2.5 * sum(stats["wins"].values())
            + stats["ci_total"]
        )

        wins_total = sum(stats["wins"].values())
        games_count = stats["games_count"]

        winrate = wins_total / games_count if games_count > 0 else 0
        p_value = total_points * winrate if wins_total > 0 else 0

        rating_miet = calculate_location_rating(total_points, stats["games_miet"])
        rating_mipt = calculate_location_rating(total_points, stats["games_mipt"])

        location_rating = None
        if location:
            location_rating = calculate_location_rating(total_points, games_count)

        response_players.append({
            "id": key if key in user_info_map else None,
            "name": stats["name"],
            "nickname": stats["name"],
            "club": stats["club"],
            "photoUrl": stats["photoUrl"],
            "totalPoints": round(total_points, 2),
            "locationRating": round(location_rating, 2) if location_rating else None,
            "rating_miet": round(rating_miet, 2),
            "rating_mipt": round(rating_mipt, 2),
            "winrate": round(winrate, 3),
            "wins": dict(stats["wins"]),
            "gamesPlayed": dict(stats["gamesPlayed"]),
            "role_plus": dict(stats["role_plus"]),
            "p": round(p_value, 2),
            "totalCb": round(stats["total_best_move_bonus"], 2),
            "totalCi": round(stats["ci_total"], 2),
            "total_sk_penalty": round(0.5 * stats["sk_count"], 2),
            "total_jk_penalty": round(jk_penalty, 2),
            "deaths": stats["deaths"],
            "deathsWith1Black": stats["deathsWith1Black"],
            "deathsWith2Black": stats["deathsWith2Black"],
            "deathsWith3Black": stats["deathsWith3Black"],
            "bestMovesWithBlack": stats["bestMovesWithBlack"],
            "games_miet": stats["games_miet"],
            "games_mipt": stats["games_mipt"],
        })

    response_players.sort(key=lambda x: x["totalPoints"], reverse=True)

    return {
        "players": response_players,
        "event_id": event_id,
        "total_games": len(parsed_games)
    }



#Локации для рейтинга
@router.get("/events/{event_id}/location")
async def get_location(event_id: str, db: Session = Depends(get_db)):
    # валидируем событие, если это не "1"
    if event_id != "1":
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено.")

    # строим фильтр
    base_filter = (
        or_(Game.event_id == event_id, Game.event_id.is_(None))
        if event_id == "1"
        else (Game.event_id == event_id)
    )

    rows = (
        db.query(
            distinct(func.json_extract(Game.data, "$.location")).label("location")
        )
        .filter(base_filter)   
        .all()
    )

    locations = []
    for r in rows:
        loc = r.location
        if loc in (None, "", "null"):
            continue
        if isinstance(loc, str):
            loc = loc.strip('"')
        locations.append(loc)

    return {"event_id": event_id, "locations": locations}


@router.patch("/event/{event_id}")
async def update_event(
    event_id: str,
    request: str = Form(...),
    avatar: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администраторы могут обновлять события.")
    
    

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено.")

    # ---- ПАРСИНГ JSON ----
    try:
        request_data = UpdateEventRequest.parse_raw(request)
        print(request_data)
        update_data = request_data.dict(exclude_unset=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка разбора данных: {str(e)}")

    # =====================================================
    # ---------------- ВАЛИДАЦИЯ ПОЛЕЙ --------------------
    # =====================================================

    if "dates" in update_data:
        if not isinstance(update_data["dates"], list) or not all(isinstance(d, str) for d in update_data["dates"]):
            raise HTTPException(status_code=400, detail="Поле 'dates' должно быть списком строк.")
        update_data["dates"] = json.dumps(update_data["dates"])

    if "seating_exclusions" in update_data:
        if not isinstance(update_data["seating_exclusions"], list) or not all(isinstance(se, str) for se in update_data["seating_exclusions"]):
            raise HTTPException(status_code=400, detail="Поле 'seating_exclusions' должно быть списком строк.")
        update_data["seating_exclusions"] = json.dumps(update_data["seating_exclusions"])

    if "participants_limit" in update_data:
        new_limit = update_data["participants_limit"]
        if not isinstance(new_limit, int) or new_limit < 0:
            raise HTTPException(status_code=400, detail="Лимит участников должен быть неотрицательным числом.")
        if event.participants_count > new_limit:
            raise HTTPException(
                status_code=400,
                detail="Невозможно установить лимит меньше текущего количества участников."
            )

    if "participants_count" in update_data:
        new_count = update_data["participants_count"]
        if not isinstance(new_count, int) or new_count < 0:
            raise HTTPException(status_code=400, detail="Количество участников должно быть неотрицательным.")
        if new_count > update_data.get("participants_limit", event.participants_limit):
            raise HTTPException(status_code=400, detail="Количество участников не может превышать лимит.")

    # =====================================================
    # ---------------- ОБРАБОТКА СУДЕЙ --------------------
    # =====================================================

    if "judge_ids" in update_data:

        if not isinstance(update_data["judge_ids"], list):
            raise HTTPException(status_code=400, detail="judge_ids должен быть списком.")

        # Удаляем дубли, сохраняем порядок
        judge_ids = list(dict.fromkeys(update_data["judge_ids"]))

        # Проверяем существование пользователей
        judges = db.query(User).filter(User.id.in_(judge_ids)).all()

        if len(judges) != len(judge_ids):
            raise HTTPException(status_code=400, detail="Один или несколько судей не найдены.")

        # Полностью очищаем старые связи
        db.execute(
            event_judges.delete().where(event_judges.c.event_id == event_id)
        )

        # Вставляем с сохранением порядка
        for index, judge_id in enumerate(judge_ids):
            db.execute(
                event_judges.insert().values(
                    event_id=event_id,
                    user_id=judge_id,
                    position=index
                )
            )

        # Удаляем из update_data, чтобы не setAttribute-ить
        update_data.pop("judge_ids")

    # =====================================================
    # ---------------- АВАТАР -----------------------------
    # =====================================================

    # Удаление аватара через JSON
    if "avatar" in update_data and update_data["avatar"] is None:
        event.avatar = None
        update_data.pop("avatar")

    # Загрузка нового PNG
    if avatar:

        if avatar.content_type != "image/png":
            raise HTTPException(status_code=400, detail="Допустим только PNG-файл")

        try:
            file_content = await avatar.read()
            if len(file_content) > 2 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Файл слишком большой (макс 2MB)")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Ошибка чтения файла: {str(e)}")

        file_path = AVATAR_DIR / "events" / f"{event_id}.png"

        try:
            with open(file_path, "wb") as buffer:
                buffer.write(file_content)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка сохранения файла: {str(e)}")

        event.avatar = f"/data/avatars/events/{event_id}.png"

    # =====================================================
    # ---------------- ПРИМЕНЯЕМ ИЗМЕНЕНИЯ ----------------
    # =====================================================

    try:
        for key, value in update_data.items():
            setattr(event, key, value)

        db.commit()
        db.refresh(event)

        logger.info(f"Event {event_id} updated successfully by user {current_user.id}")

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка базы данных при обновлении события.")

    # =====================================================
    # ---------------- БЕЗОПАСНЫЙ ВОЗВРАТ -----------------
    # =====================================================

    try:
        dates = json.loads(event.dates) if event.dates else []
    except json.JSONDecodeError:
        dates = []

    try:
        seating_exclusions = json.loads(event.seating_exclusions) if event.seating_exclusions else []
    except json.JSONDecodeError:
        seating_exclusions = []

    judges_data = [
        {
            "id": j.id,
            "nickname": j.nickname,
            "avatar": j.avatar,
            "club": j.club
        }
        for j in event.judges
    ]

    

    return {
        "message": "Событие успешно обновлено.",
        "event": {
            "id": event.id,
            "title": event.title,
            "dates": dates,
            "location": event.location,
            "type": event.type,
            "participants_limit": event.participants_limit,
            "participants_count": event.participants_count,
            "fee": event.fee,
            "currency": event.currency,
            "gs_name": event.gs_name,
            "gs_role": event.gs_role,
            "gs_avatar": event.gs_avatar,
            "org_name": event.org_name,
            "org_role": event.org_role,
            "org_avatar": event.org_avatar,
            "games_are_hidden": event.games_are_hidden,
            "seating_exclusions": seating_exclusions,
            "avatar": event.avatar,
            "judges": judges_data,
            "created_at": event.created_at
        }
    }

