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
    # --- проверка прав ---
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администраторы могут генерировать рассадку.")

    # --- загрузка сущностей ---
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

    # сохраняем исключения
    event.seating_exclusions = request.exclusions_text
    db.commit()

    # --- вычисляем столы и раунды ---
    table_ids = sorted(list(set(g.gameId.split('_t')[1] for g in games if '_t' in g.gameId)))
    if not table_ids:
        raise HTTPException(status_code=400, detail="Не удалось определить столы из gameId.")
    num_tables = len(table_ids)

    max_round_num = 0
    for g in games:
        match = re.search(r'_r(\d+)', g.gameId)
        if match:
            max_round_num = max(max_round_num, int(match.group(1)))

    num_rounds = max_round_num
    if num_rounds == 0:
        if len(games) % num_tables == 0:
            num_rounds = len(games) // num_tables
        else:
            raise HTTPException(status_code=400, detail="Не удалось определить количество раундов из gameId.")

    if num_tables < 2:
        raise HTTPException(status_code=400, detail="Для парного турнира требуется минимум 2 стола.")

    # --- разворачиваем пары в игроков ---
    players: List[Dict] = []
    teams_dict: Dict[str, List[Dict]] = {}
    for team in pairs:
        try:
            members = json.loads(team.members)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Невалидный JSON в members для команды {team.id}")

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
        raise HTTPException(status_code=400, detail=f"Число игроков ({total_players}) превышает вместимость столов ({capacity}).")

    # --- загрузка пользователей в память для быстрого доступа ---
    user_ids = [p["id"] for p in players]
    db_users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {u.id: u for u in db_users}

    # --- целевые посещения (floor/ceil) для каждого игрока на каждый стол ---
    base = num_rounds // num_tables
    extra = num_rounds % num_tables
    # target_min[p][t], target_max[p][t]
    target_min = {}
    target_max = {}
    for p in players:
        pid = p["id"]
        target_min[pid] = {}
        target_max[pid] = {}
        for t in range(num_tables):
            # распределяем остаток extra по первым столам
            ideal = base + (1 if t < extra else 0)
            # делаем маленькое окно: [ideal-1, ideal+1], но не ниже 0
            # для жёсткой версии используем точное ideal, но это иногда даёт несовместимость,
            # поэтому позволяем +-1, но минимально 0 и максимально num_rounds
            low = max(0, ideal - 1)
            high = min(num_rounds, ideal + 1)
            target_min[pid][t] = low
            target_max[pid][t] = high

    # --- Попытаемся решить ILP (если доступен pulp) ---
    solution = None  # будет dict (pid -> {r -> table_index})
    if HAS_PULP:
        try:
            # создаём LpProblem
            prob = pulp.LpProblem("seating", pulp.LpMinimize)

            # переменные x_pid_t_r ∈ {0,1}
            x_vars = {}
            for p in players:
                pid = p["id"]
                for t in range(num_tables):
                    for r in range(num_rounds):
                        name = f"x_{pid}_{t}_{r}"
                        x_vars[(pid, t, r)] = pulp.LpVariable(name, cat="Binary")

            # каждый игрок в каждом раунде ровно в одном столе
            for p in players:
                pid = p["id"]
                for r in range(num_rounds):
                    prob.addConstraint(
                        pulp.lpSum(x_vars[(pid, t, r)] for t in range(num_tables)) == 1,
                        name=f"player_{pid}_round_{r}_one_table"
                    )

            # для каждого стола и раунда — не более 10 реальных игроков
            for t in range(num_tables):
                for r in range(num_rounds):
                    prob.addConstraint(
                        pulp.lpSum(x_vars[(p["id"], t, r)] for p in players) <= 10,
                        name=f"table_{t}_round_{r}_cap"
                    )

            # пары не сидят вместе: для каждой пары, таблицы и раунда — сумма <=1
            for team_id, members in teams_dict.items():
                a_id = members[0]["id"]
                b_id = members[1]["id"]
                for t in range(num_tables):
                    for r in range(num_rounds):
                        prob.addConstraint(
                            x_vars[(a_id, t, r)] + x_vars[(b_id, t, r)] <= 1,
                            name=f"pair_{team_id}_t{t}_r{r}"
                        )

            # ограничения на суммарные посещения (персональные цели)
            # используем target_min/target_max
            for p in players:
                pid = p["id"]
                for t in range(num_tables):
                    prob.addConstraint(
                        pulp.lpSum(x_vars[(pid, t, r)] for r in range(num_rounds)) >= target_min[pid][t],
                        name=f"min_visits_{pid}_t{t}"
                    )
                    prob.addConstraint(
                        pulp.lpSum(x_vars[(pid, t, r)] for r in range(num_rounds)) <= target_max[pid][t],
                        name=f"max_visits_{pid}_t{t}"
                    )

            # Целевая функция: минимизировать суммарное отклонение от идеала (чтобы отдавать предпочтение ближе к ideal)
            # Сначала подготавливаем идеал
            ideal_counts = {}
            for p in players:
                pid = p["id"]
                ideal_counts[pid] = {}
                for t in range(num_tables):
                    ideal = base + (1 if t < extra else 0)
                    ideal_counts[pid][t] = ideal

            # вводим вспомогательные непрерывные переменные dev_pos, dev_neg для абсолютной разницы
            dev_vars = {}
            for p in players:
                pid = p["id"]
                for t in range(num_tables):
                    name_pos = f"devpos_{pid}_{t}"
                    name_neg = f"devneg_{pid}_{t}"
                    dev_vars[(pid, t, "pos")] = pulp.LpVariable(name_pos, lowBound=0, cat="Integer")
                    dev_vars[(pid, t, "neg")] = pulp.LpVariable(name_neg, lowBound=0, cat="Integer")
                    # связать с суммой x
                    prob.addConstraint(
                        pulp.lpSum(x_vars[(pid, t, r)] for r in range(num_rounds)) - ideal_counts[pid][t]
                        == dev_vars[(pid, t, "pos")] - dev_vars[(pid, t, "neg")],
                        name=f"dev_balance_{pid}_{t}"
                    )

            # теперь целевая функция: минимизировать сум(dev_pos + dev_neg)
            prob += pulp.lpSum(dev_vars[(pid, t, k)] for (pid, t, k) in dev_vars)

            # решаем
            solver = pulp.PULP_CBC_CMD(msg=False, timeLimit=120)  # ограничим время 120s
            result_status = prob.solve(solver)

            if pulp.LpStatus[result_status] != "Optimal" and pulp.LpStatus[result_status] != "Not Solved" and pulp.LpStatus[result_status] != "Integer Feasible":
                # если не нашлось хорошего решения — упадём в fallback
                raise Exception(f"ILP status: {pulp.LpStatus[result_status]}")

            # собираем решение
            solution = {}
            for p in players:
                pid = p["id"]
                solution[pid] = {}
                for r in range(num_rounds):
                    assigned = None
                    for t in range(num_tables):
                        val = pulp.value(x_vars[(pid, t, r)])
                        if val is not None and round(val) == 1:
                            assigned = t
                            break
                    if assigned is None:
                        # если что-то пошло не так — попадание в fallback
                        raise Exception(f"No table assigned for player {pid} round {r}")
                    solution[pid][r] = assigned

        except Exception as e:
            # ILP не сработал — пометим и пойдем в fallback
            solution = None
            # (не бросаем, просто логично перейти к fallback)
            # В реальном приложении можно логировать e
            # print("ILP failed:", e)
    # --- конец попытки ILP ---

    # --- FALLBACK (жадный детерминированный алгоритм), если ILP не дал solution ---
    if solution is None:
        # Построим персональные расписания для каждого игрока: циклический список столов длины num_rounds,
        # в котором каждый стол встречается примерно ideal раз. Затем будем устраивать раунд за раундом,
        # пытаясь выполнять эти личные назначения и мягко откатывая при конфликтах.
        personal_schedule: Dict[str, List[int]] = {}
        for p in players:
            pid = p["id"]
            # формируем базовый список с ideal counts
            ideal = [base + (1 if t < extra else 0) for t in range(num_tables)]
            slots = []
            for t, cnt in enumerate(ideal):
                slots += [t] * cnt
            # если длина меньше num_rounds (из-за округлений) — докидываем случайные
            while len(slots) < num_rounds:
                slots.append(random.randrange(num_tables))
            # если длиннее (маловероятно) — обрезаем
            slots = slots[:num_rounds]
            random.Random(hash(pid) & 0xffffffff).shuffle(slots)
            personal_schedule[pid] = slots

        # теперь по раундам пытаемся "собирать" столы, учитывая парное ограничение
        all_round_tables = []
        # init counters
        player_counts = {p["id"]: {t: 0 for t in range(num_tables)} for p in players}

        for r in range(num_rounds):
            tables = [[] for _ in range(num_tables)]
            # пройдём пары в случайном порядке, но детерминированно по раунду
            team_ids = list(teams_dict.keys())
            random.Random(10000 + r).shuffle(team_ids)
            for team_id in team_ids:
                a, b = teams_dict[team_id]
                aid, bid = a["id"], b["id"]

                # предпочтительные столы из персонального расписания
                pref_a = personal_schedule[aid][r]
                pref_b = personal_schedule[bid][r]

                # функция выбора столов: сначала попытка на предпочтение, затем поиск любого с местом и не равным партнёру
                def pick_for_player(pid, forbidden_table=None):
                    # 1) предпочтительный, если есть место and not forbidden
                    pref = personal_schedule[pid][r]
                    if pref != forbidden_table and len(tables[pref]) < 10:
                        return pref
                    # 2) любой стол, где player hasn't exceeded ideal more than +1 and has space and != forbidden
                    for t in range(num_tables):
                        if t == forbidden_table:
                            continue
                        if len(tables[t]) >= 10:
                            continue
                        return t
                    # 3) если ничего — возвращаем None
                    return None

                t1 = pick_for_player(aid, forbidden_table=None)
                if t1 is None:
                    raise HTTPException(status_code=500, detail=f"Не удалось посадить игрока {aid} в раунде {r+1} (fallback).")

                tables[t1].append(a)
                player_counts[aid][t1] += 1

                # для b — исключаем t1
                t2 = pick_for_player(bid, forbidden_table=t1)
                if t2 is None:
                    # попытаемся переразместить a на другой стол, чтобы освободить место
                    alt_found = False
                    for alt_t in range(num_tables):
                        if alt_t == t1:
                            continue
                        if len(tables[alt_t]) < 10:
                            # можно перебросить a сюда, если это не повредит (мы просто переносим)
                            tables[t1].pop()  # убрать a
                            player_counts[aid][t1] -= 1
                            tables[alt_t].append(a)
                            player_counts[aid][alt_t] += 1
                            t1 = alt_t
                            alt_found = True
                            break
                    if alt_found:
                        # теперь попробуем взять место для b
                        t2 = pick_for_player(bid, forbidden_table=t1)
                    if t2 is None:
                        # как крайняя мера — найдём любой стол != t1 даже если переполнение (нежелательно)
                        other = [tt for tt in range(num_tables) if tt != t1]
                        if not other:
                            raise HTTPException(status_code=500, detail="Не удалось разделить пару (fallback critical).")
                        t2 = min(other, key=lambda tt: len(tables[tt]))
                        if len(tables[t2]) >= 10:
                            # если и тут нет места — это критическая ошибка (должно быть покрыто capacity проверкой выше)
                            raise HTTPException(status_code=500, detail="Нет свободного места для посадки B (fallback).")

                tables[t2].append(b)
                player_counts[bid][t2] += 1

            # докидываем placeholders до ровно 10
            for t in range(num_tables):
                while len(tables[t]) < 10:
                    placeholder_id = f"placeholder_r{r+1}_t{t+1}_{len(tables[t])+1}"
                    tables[t].append({"id": placeholder_id, "team_id": None})

            all_round_tables.append(tables)

        # сформирован результат в all_round_tables
    else:
        # если ILP дал solution → переводим в all_round_tables
        # solution[pid][r] = t
        all_round_tables = []
        # prepare map from pid to player object
        player_obj_map = {p["id"]: p for p in players}
        for r in range(num_rounds):
            tables = [[] for _ in range(num_tables)]
            for p in players:
                pid = p["id"]
                t = solution[pid][r]
                tables[t].append(player_obj_map[pid])
            # doc: возможно столы <10, докинем placeholders
            for t in range(num_tables):
                while len(tables[t]) < 10:
                    placeholder_id = f"placeholder_r{r+1}_t{t+1}_{len(tables[t])+1}"
                    tables[t].append({"id": placeholder_id, "team_id": None})
            all_round_tables.append(tables)

    # --- запись в games[].data ---
    game_map = {g.gameId: g for g in games}
    for r in range(1, num_rounds + 1):
        for t_index, table_label in enumerate(table_ids, start=1):
            game_id = f"{event_id}_r{r}_t{table_label}"
            game = game_map.get(game_id)
            if not game:
                # если game не найден — пропускаем
                continue
            table_players = all_round_tables[r-1][t_index-1]
            players_for_game = []
            for p in table_players:
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
                    u = user_map.get(p["id"])
                    players_for_game.append({
                        "id": p["id"],
                        "name": u.nickname if u else "",
                        "role": "мирный",
                        "plus": 2.5,
                        "sk": 0,
                        "jk": 0,
                        "best_move": ""
                    })
            data = json.loads(game.data) if game.data else {}
            data["players"] = players_for_game
            game.data = json.dumps(data, ensure_ascii=False)

    db.commit()
    return {"message": "Рассадка с ILP/fallback успешно сгенерирована и сохранена."}

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