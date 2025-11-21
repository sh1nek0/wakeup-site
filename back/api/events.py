from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
import json
import uuid
import random
import re

from core.security import get_current_user, get_optional_current_user, get_db
from db.models import Event, Team, Registration, User, Notification, Game
from schemas.main import CreateTeamRequest, ManageRegistrationRequest, TeamActionRequest, EventSetupRequest, GenerateSeatingRequest
from api.notifications import create_notification

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
    # Запрашиваем только нужные поля, чтобы избежать ошибок при добавлении новых колонок в модель
    events_query = db.query(
        Event.id,
        Event.title,
        Event.dates,
        Event.location,
        Event.type,
        Event.participants_limit,
        Event.participants_count,
        Event.created_at
    ).order_by(Event.created_at.desc()).all()

    return {"events": [{
        "id": event.id,
        "title": event.title,
        "dates": event.dates,
        "location": event.location,
        "type": event.type,
        "participants_limit": event.participants_limit,
        "participants_count": event.participants_count,
    } for event in events_query]}

@router.get("/getEvent/{event_id}")
async def get_event(event_id: str, current_user: User = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    event = db.query(Event).options(selectinload(Event.games)).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    
    # Логика получения участников и команд остается прежней
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

    games_list = []
    is_admin = current_user and current_user.role == "admin"
    
    all_users_in_db = db.query(User.id, User.nickname).all()
    nick_to_id_map = {nick: uid for uid, nick in all_users_in_db}

    if not event.games_are_hidden or is_admin:
        sorted_games = sorted(event.games, key=lambda g: g.gameId)
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
                "players": players,
                "created_at": game.created_at,
                "badgeColor": game_data.get("badgeColor"),
                "judge_nickname": judge_nickname,
                "judge_id": nick_to_id_map.get(judge_nickname),
                "location": game_data.get("location"),
                "tableNumber": game_data.get("gameInfo", {}).get("tableNumber"),
                "roundNumber": round_number,
            })

    return {
        "title": event.title, "dates": event.dates, "location": event.location, "type": event.type,
        "participantsLimit": event.participants_limit, "participantsCount": event.participants_count,
        "fee": event.fee, "currency": event.currency,
        "gs": {"name": event.gs_name, "role": event.gs_role, "avatar": event.gs_avatar},
        "org": {"name": event.org_name, "role": event.org_role, "avatar": event.org_avatar},
        "participants": participants_list, "teams": teams_list,
        "pending_registrations": pending_registrations_list,
        "user_registration_status": user_registration_status,
        "games": games_list,
        "games_are_hidden": event.games_are_hidden,
        "seating_exclusions": event.seating_exclusions or ""
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

import re
import json
import random

from fastapi import HTTPException
from sqlalchemy.orm import selectinload

import re
import json
import random
from math import floor, ceil

from fastapi import HTTPException
from sqlalchemy.orm import selectinload
from typing import List, Dict, Tuple

# Попытка импортировать pulp — если нет, будет fallback
try:
    import pulp
    HAS_PULP = True
except Exception:
    HAS_PULP = False


@router.post("/events/{event_id}/generate_seating")
async def generate_event_seating(
    event_id: str,
    request: GenerateSeatingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # -------------------------
    # 1) Авторизация и загрузка
    # -------------------------
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администраторы могут генерировать рассадку.")

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено.")

    games = db.query(Game).filter(Game.event_id == event_id).order_by(Game.gameId).all()
    if not games:
        raise HTTPException(status_code=400, detail="Сначала необходимо создать сетку игр.")

    if event.type != "pair":
        raise HTTPException(status_code=400, detail="Этот эндпоинт поддерживает только парные турниры (pair).")

    pairs = db.query(Team).filter(Team.event_id == event_id, Team.status == "approved").all()
    if not pairs:
        raise HTTPException(status_code=400, detail="Нет подтвержденных пар.")

    # сохраняем текст исключений
    event.seating_exclusions = request.exclusions_text
    db.commit()

    # -------------------------
    # 2) считываем метаданные
    # -------------------------
    # table ids извлекаем из gameId (они могут быть метками, поэтому храним порядок)
    table_labels = sorted(list(set(g.gameId.split('_t')[1] for g in games if '_t' in g.gameId)))
    if not table_labels:
        raise HTTPException(status_code=400, detail="Не удалось определить метки столов из gameId.")
    num_tables = len(table_labels)

    # number of rounds
    max_round_num = 0
    for g in games:
        m = re.search(r'_r(\d+)', g.gameId)
        if m:
            max_round_num = max(max_round_num, int(m.group(1)))

    num_rounds = max_round_num
    if num_rounds == 0:
        if len(games) % num_tables == 0:
            num_rounds = len(games) // num_tables
        else:
            raise HTTPException(status_code=400, detail="Не удалось определить количество раундов из gameId.")

    if num_tables < 2:
        raise HTTPException(status_code=400, detail="Для парного турнира требуется минимум 2 стола.")

    # -------------------------
    # 3) разворачиваем пары в игроков
    # -------------------------
    players = []  # list of player dicts {"id","team_id"}
    teams_dict = {}  # team_id -> [p1, p2]
    for team in pairs:
        try:
            members = json.loads(team.members)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Невалидный JSON members в команде {team.id}")

        if len(members) != 2:
            raise HTTPException(status_code=400, detail=f"Пара {team.id} должна содержать ровно 2 игрока.")

        p1 = {"id": members[0]["user_id"], "team_id": team.id}
        p2 = {"id": members[1]["user_id"], "team_id": team.id}
        teams_dict[team.id] = [p1, p2]
        players.append(p1)
        players.append(p2)

    total_players = len(players)
    capacity = num_tables * 10
    if total_players > capacity:
        raise HTTPException(
            status_code=400,
            detail=f"Число игроков ({total_players}) превышает общую вместимость столов ({capacity})."
        )

    # загружаем пользователей (никнеймы) одним запросом
    user_ids = [p["id"] for p in players]
    db_users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {u.id: u for u in db_users}

    # -------------------------
    # 4) подготовка персональных очередей слотов (позиции 0..9)
    #    если num_rounds >= 10, кажый игрок покроет все слоты
    # -------------------------
    player_slot_queue = {}  # pid -> list of preferred slot indices length num_rounds
    for p in players:
        pid = p["id"]
        base_slots = list(range(10))  # 0..9
        # чтобы не быть одинаковыми у всех — делаем псевдослучайную перестановку зависящую от pid
        rnd = random.Random(hash(pid) & 0xffffffff)
        rnd.shuffle(base_slots)
        slots = []
        # расширяем циклически до num_rounds
        while len(slots) < num_rounds:
            slots.extend(base_slots)
        slots = slots[:num_rounds]
        player_slot_queue[pid] = slots

    # -------------------------
    # 5) основной цикл по раундам:
    #    - для каждого раунда выбираем для каждой пары две разные таблицы
    #    - критерий выбора: наличие свободных слотов (len < 10), приоритет столам, где игрок ещё не сидел,
    #      и минимальная текущая загрузка (балансировка)
    # -------------------------
    # visited_tables[player_id] = set of table indices they've sat at (helps diversify)
    visited_tables = {p["id"]: set() for p in players}

    all_round_tables = []  # для каждого раунда: list[t] -> list of player dicts assigned to that table (unordered)
    team_ids = list(teams_dict.keys())

    for r in range(num_rounds):
        # детерминированная пермутация пар по раунду
        rnd = random.Random(1000 + r)
        rnd.shuffle(team_ids)

        tables = [[] for _ in range(num_tables)]  # will hold player dicts
        table_counts = [0] * num_tables

        # Для каждой пары — выбираем пару таблиц (t1 != t2)
        for tid in team_ids:
            a, b = teams_dict[tid]
            aid, bid = a["id"], b["id"]

            # Соберём все возмож пары таблиц, где есть место
            possible_pairs = []
            for t1 in range(num_tables):
                if table_counts[t1] >= 10:
                    continue
                for t2 in range(num_tables):
                    if t2 == t1:
                        continue
                    if table_counts[t2] >= 10:
                        continue
                    possible_pairs.append((t1, t2))

            if not possible_pairs:
                # это не должно случиться, так как проверили capacity выше
                raise HTTPException(status_code=500, detail=f"Нет доступных двух различных столов для пары {tid} в раунде {r+1}.")

            # Оцениваем кандидатов. Счёт = (load_t1 + load_t2) + w1*visited_penalty_a + w2*visited_penalty_b
            # visited_penalty = 0 если игрок ещё не сидел за этим столом (хочу новые столы), иначе 1
            # Также учитываем предпочтительный приоритет: если игрок ещё не сидел за столом, уменьшаем score
            best_pair = None
            best_score = None
            for (t1, t2) in possible_pairs:
                load = table_counts[t1] + table_counts[t2]
                visited_penalty = 0
                visited_penalty += (1 if t1 in visited_tables[aid] else 0)
                visited_penalty += (1 if t2 in visited_tables[bid] else 0)
                # небольшая случайная дробь, чтобы избегать одних и тех же выборов при равенстве
                tie_break = rnd.random() * 0.0001
                score = load + 2 * visited_penalty + tie_break
                if best_score is None or score < best_score:
                    best_score = score
                    best_pair = (t1, t2)

            # назначаем
            chosen_t1, chosen_t2 = best_pair
            tables[chosen_t1].append(a)
            tables[chosen_t2].append(b)
            table_counts[chosen_t1] += 1
            table_counts[chosen_t2] += 1
            visited_tables[aid].add(chosen_t1)
            visited_tables[bid].add(chosen_t2)

        # После распределения пар, докидываем placeholders до 10 и назначаем слоты (позиции)
        # Для корректной позиции нам нужен массив длиной 10 per table.
        final_tables_with_slots = []

        for t_index in range(num_tables):
            assigned = tables[t_index]  # list of player dicts (real only)
            # ensure not more than 10 real players (shouldn't happen)
            if len(assigned) > 10:
                # если вдруг >10 — обрезаем лишних (редкий fallback). Лучше логировать.
                assigned = assigned[:10]

            # create empty slots list
            slots = [None] * 10

            # First pass: try to place real players into their preferred slot for this round
            # collect real players
            real_players = assigned.copy()
            rnd = random.Random(2000 + r + t_index)
            rnd.shuffle(real_players)  # small shuffle so order isn't deterministic in collision resolution

            for p in real_players:
                pid = p["id"]
                preferred_slot = player_slot_queue[pid][r]  # 0..9
                # if preferred slot free, take it
                if slots[preferred_slot] is None:
                    slots[preferred_slot] = p
                else:
                    # try to find nearest free slot (linear scan)
                    placed = False
                    # first try forward
                    for off in range(1, 10):
                        s = (preferred_slot + off) % 10
                        if slots[s] is None:
                            slots[s] = p
                            placed = True
                            break
                    if not placed:
                        # try backward (shouldn't be necessary)
                        for off in range(1, 10):
                            s = (preferred_slot - off) % 10
                            if slots[s] is None:
                                slots[s] = p
                                placed = True
                                break
                    if not placed:
                        # as extreme fallback, find any free slot
                        for s in range(10):
                            if slots[s] is None:
                                slots[s] = p
                                placed = True
                                break
                    # placed guaranteed because capacity checked
            # Second pass: fill remaining slots with placeholders
            for s in range(10):
                if slots[s] is None:
                    placeholder_id = f"placeholder_r{r+1}_t{t_index+1}_{s+1}"
                    slots[s] = {"id": placeholder_id, "team_id": None}

            final_tables_with_slots.append(slots)

        # final verification: every table must have 10 slots
        for t_idx, sl in enumerate(final_tables_with_slots):
            if len(sl) != 10:
                raise HTTPException(status_code=500, detail=f"После формирования стол {t_idx+1} имеет {len(sl)} слотов (ожидалось 10).")

        all_round_tables.append(final_tables_with_slots)

    # -------------------------
    # 6) записываем в games[].data
    # -------------------------
    game_map = {g.gameId: g for g in games}

    for r in range(1, num_rounds + 1):
        round_tables = all_round_tables[r - 1]
        for t_i, label in enumerate(table_labels, start=1):
            game_id = f"{event_id}_r{r}_t{label}"
            game = game_map.get(game_id)
            if not game:
                # если нет такой игры — пропускаем
                continue

            table_slots = round_tables[t_i - 1]
            players_for_game = []
            for p in table_slots:
                if p.get("team_id") is None:
                    players_for_game.append({
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
                    players_for_game.append({
                        "id": p["id"],
                        "name": user.nickname if user else "",
                        "role": "мирный",
                        "plus": 2.5,
                        "sk": 0,
                        "jk": 0,
                        "best_move": ""
                    })

            game_data = json.loads(game.data) if game.data else {}
            game_data["players"] = players_for_game
            game.data = json.dumps(game_data, ensure_ascii=False)

    db.commit()
    return {"message": "Рассадка успешно сгенерирована: пары разделены, слоты распределены по очередям."}

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