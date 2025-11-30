from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
import json
import uuid
import random
import re
from typing import List, Dict, Tuple
from datetime import datetime, timezone  # Добавлено timezone для корректного получения UTC времени
import math
# Попытка импортировать pulp — если нет, будет fallback
try:
    import pulp
    HAS_PULP = True
except Exception:
    HAS_PULP = False


from core.security import get_current_user, get_optional_current_user, get_db
from db.models import Event, Team, Registration, User, Notification, Game
from schemas.main import CreateTeamRequest, ManageRegistrationRequest, TeamActionRequest, EventSetupRequest, GenerateSeatingRequest, CreateEventRequest, UpdateEventRequest
from api.notifications import create_notification
from collections import defaultdict

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

    events_list = []
    for event in events_query:
        try:
            dates_parsed = json.loads(event.dates) if event.dates else []
        except json.JSONDecodeError:
            dates_parsed = []  # Fallback на пустой список, если JSON повреждён
        
        events_list.append({
            "id": event.id,
            "title": event.title,
            "dates": dates_parsed,  # Возвращаем как список
            "location": event.location,
            "type": event.type,
            "participants_limit": event.participants_limit,
            "participants_count": event.participants_count,
        })
    
    return {"events": events_list}

@router.get("/getEvent/{event_id}")
async def get_event(event_id: str, current_user: User = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    event = db.query(Event).options(selectinload(Event.games)).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    
    # Десериализуем dates
    try:
        dates_parsed = json.loads(event.dates) if event.dates else []
    except json.JSONDecodeError:
        dates_parsed = []
    
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
        "title": event.title, "dates": dates_parsed, "location": event.location, "type": event.type,
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

@router.post("/events/{event_id}/generate_seating")
async def generate_event_seating(
    event_id: str,
    request: GenerateSeatingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ============================================================
    # 0. Авторизация и загрузка данных
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
        raise HTTPException(status_code=400, detail="Этот эндпоинт поддерживает только парные и личные турниры.")

    # сохраняем exclusions
    event.seating_exclusions = json.dumps(request.exclusions_text)
    db.commit()

    # ============================================================
    # 1. Определяем количество столов и раундов
    # ============================================================
    table_labels = sorted(list(set(g.gameId.split('_t')[1] for g in games if '_t' in g.gameId)))
    if not table_labels:
        raise HTTPException(status_code=400, detail="Не удалось определить метки столов из gameId.")
    num_tables = len(table_labels)

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
            raise HTTPException(status_code=400, detail="Не удалось определить количество раундов.")

    # ============================================================
    # 2. Различия по типу турнира
    # ============================================================
    if event.type == "pair":
        # Для парных турниров: участники - команды (пары)
        teams = db.query(Team).filter(Team.event_id == event_id, Team.status == "approved").all()
        if not teams:
            raise HTTPException(status_code=400, detail="Нет подтвержденных команд.")

        if num_tables < 2:
            raise HTTPException(status_code=400, detail="Парные турниры требуют минимум 2 стола.")

        # Разворачиваем команды в пары игроков
        participants = []
        for t in teams:
            p1 = {"id": t.player1_id, "nick": t.player1_nickname}
            p2 = {"id": t.player2_id, "nick": t.player2_nickname}
            participants.append({"team_id": t.id, "players": [p1, p2]})

        nick_to_id = {}
        for part in participants:
            for p in part["players"]:
                nick_to_id[p["nick"]] = p["id"]

        # Парсим exclusions: пары команд, которые не могут встречаться
        exclusions = set()
        for line in request.exclusions_text.strip().split('\n'):
            line = line.strip()
            if ',' in line:
                parts = [x.strip() for x in line.split(',', 1)]
                if len(parts) == 2:
                    n1, n2 = parts
                    if n1 in nick_to_id and n2 in nick_to_id:
                        exclusions.add(frozenset({nick_to_id[n1], nick_to_id[n2]}))

        total_teams = len(participants)
        capacity = num_tables * 5  # 5 команд на стол (10 игроков)
        if total_teams > capacity:
            raise HTTPException(
                status_code=400,
                detail=f"Команд ({total_teams}) больше чем вместимость ({capacity})."
            )

        # Сбор всех user_ids для загрузки пользователей
        user_ids = []
        for part in participants:
            for p in part["players"]:
                user_ids.append(p["id"])
        db_users = db.query(User).filter(User.id.in_(user_ids)).all()
        user_map = {u.id: u for u in db_users}

        # ============================================================
        # 3. Персональные очереди позиций (для игроков в парах)
        # ============================================================
        player_slot_queue = {}
        for part in participants:
            for p in part["players"]:
                pid = p["id"]
                if pid not in player_slot_queue:
                    base = list(range(10))  # 0..9
                    rnd = random.Random(hash(pid) & 0xffffffff)
                    rnd.shuffle(base)

                    slots = []
                    while len(slots) < num_rounds:
                        slots.extend(base)
                    slots = slots[:num_rounds]
                    player_slot_queue[pid] = slots

        # ============================================================
        # 4. master_seed
        # ============================================================
        master_seed = random.randrange(1_000_000_000)

        # ============================================================
        # 5. Основной цикл: распределение команд по столам
        # ============================================================
        all_round_tables = []
        team_visits = {part["team_id"]: [] for part in participants}  # Для учета повторных встреч

        for r in range(num_rounds):
            rnd = random.Random(master_seed + 777 * (r + 1))
            shuffled_teams = participants[:]
            rnd.shuffle(shuffled_teams)

            tables = [[] for _ in range(num_tables)]

            for part in shuffled_teams:
                placed = False
                # Сортируем столы по нагрузке
                sorted_tables = sorted(range(num_tables), key=lambda t: len(tables[t]))
                for t in sorted_tables:
                    if len(tables[t]) >= 5:  # 5 команд на стол
                        continue
                    # Проверяем exclusions и visits
                    violate_excl = any(
                        frozenset({p1["id"], p2["id"]}) in exclusions
                        for existing in tables[t]
                        for p1 in part["players"]
                        for p2 in existing["players"]
                    )
                    violate_visits = t in team_visits[part["team_id"]]
                    if not violate_excl and not violate_visits:
                        tables[t].append(part)
                        team_visits[part["team_id"]].append(t)
                        placed = True
                        break
                if not placed:
                    raise HTTPException(status_code=500, detail=f"Не удалось разместить команду {part['team_id']} без нарушения правил.")

            # ============================================================
            # 6. Распределение игроков по слотам 1..10
            # ============================================================
            final_tables = []

            for t_i in range(num_tables):
                assigned_teams = tables[t_i]

                slots = [None] * 10
                rnd_slots = random.Random(master_seed + 9999 + r * 31 + t_i)
                shuffled_teams_slots = assigned_teams[:]
                rnd_slots.shuffle(shuffled_teams_slots)

                for team in shuffled_teams_slots:
                    for p in team["players"]:
                        pid = p["id"]
                        pref = player_slot_queue[pid][r]

                        if slots[pref] is None:
                            slots[pref] = p
                        else:
                            placed_in_slot = False
                            for k in range(10):
                                if slots[k] is None:
                                    slots[k] = p
                                    placed_in_slot = True
                                    break
                            if not placed_in_slot:
                                raise HTTPException(status_code=500, detail="Слот не найден, что невозможно.")

                for s in range(10):
                    if slots[s] is None:
                        slots[s] = {"id": f"placeholder_r{r+1}_t{t_i+1}_{s+1}", "nick": None}

                final_tables.append(slots)

            all_round_tables.append(final_tables)

    elif event.type == "solo":
        # Для личных турниров: участники - индивидуалы
        participants = db.query(Registration).filter(Registration.event_id == event_id, Registration.status == "approved").all()
        if not participants:
            raise HTTPException(status_code=400, detail="Нет подтвержденных участников.")

        # Разворачиваем участников в игроков
        players = [{"id": reg.user_id, "nick": reg.user.nickname} for reg in participants]
        nick_to_id = {p["nick"]: p["id"] for p in players}

        # Парсим exclusions: пары игроков, которые не могут сидеть вместе
        exclusions = set()
        for line in request.exclusions_text.strip().split('\n'):
            line = line.strip()
            if ',' in line:
                parts = [x.strip() for x in line.split(',', 1)]
                if len(parts) == 2:
                    n1, n2 = parts
                    if n1 in nick_to_id and n2 in nick_to_id:
                        exclusions.add(frozenset({nick_to_id[n1], nick_to_id[n2]}))

        total_players = len(players)
        capacity = num_tables * 10
        if total_players > capacity:
            raise HTTPException(
                status_code=400,
                detail=f"Игроков ({total_players}) больше чем вместимость ({capacity})."
            )

        user_ids = [p["id"] for p in players]
        db_users = db.query(User).filter(User.id.in_(user_ids)).all()
        user_map = {u.id: u for u in db_users}

        # ============================================================
        # 3. Персональные очереди позиций (slots)
        # ============================================================
        player_slot_queue = {}
        for p in players:
            pid = p["id"]
            base = list(range(10))  # 0..9
            rnd = random.Random(hash(pid) & 0xffffffff)
            rnd.shuffle(base)

            slots = []
            while len(slots) < num_rounds:
                slots.extend(base)
            slots = slots[:num_rounds]
            player_slot_queue[pid] = slots

        # ============================================================
        # 4. master_seed
        # ============================================================
        master_seed = random.randrange(1_000_000_000)

        # ============================================================
        # 5. Основной цикл: распределение игроков по столам
        # ============================================================
        all_round_tables = []

        for r in range(num_rounds):
            rnd = random.Random(master_seed + 777 * (r + 1))
            shuffled_players = players[:]
            rnd.shuffle(shuffled_players)

            tables = [[] for _ in range(num_tables)]

            for p in shuffled_players:
                placed = False
                # Сортируем столы по нагрузке
                sorted_tables = sorted(range(num_tables), key=lambda t: len(tables[t]))
                for t in sorted_tables:
                    if len(tables[t]) >= 10:
                        continue
                    # Проверяем exclusions
                    violate = any(frozenset({p['id'], existing['id']}) in exclusions for existing in tables[t])
                    if not violate:
                        tables[t].append(p)
                        placed = True
                        break
                if not placed:
                    raise HTTPException(status_code=500, detail=f"Не удалось разместить игрока {p['nick']} без нарушения exclusions.")

            # ============================================================
            # 6. Распределение игроков по слотам 1..10
            # ============================================================
            final_tables = []

            for t_i in range(num_tables):
                assigned = tables[t_i]

                slots = [None] * 10
                rnd_slots = random.Random(master_seed + 9999 + r * 31 + t_i)
                shuffled_assigned = assigned[:]
                rnd_slots.shuffle(shuffled_assigned)

                for p in shuffled_assigned:
                    pid = p["id"]
                    pref = player_slot_queue[pid][r]

                    if slots[pref] is None:
                        slots[pref] = p
                    else:
                        placed_in_slot = False
                        for k in range(10):
                            if slots[k] is None:
                                slots[k] = p
                                placed_in_slot = True
                                break
                        if not placed_in_slot:
                            raise HTTPException(status_code=500, detail="Слот не найден, что невозможно.")

                for s in range(10):
                    if slots[s] is None:
                        slots[s] = {"id": f"placeholder_r{r+1}_t{t_i+1}_{s+1}", "nick": None}

                final_tables.append(slots)

            all_round_tables.append(final_tables)

    # ============================================================
    # 7. Запись в game.data (общая для обоих типов)
    # ============================================================
    game_map = {g.gameId: g for g in games}

    for r in range(1, num_rounds + 1):
        round_tables = all_round_tables[r - 1]

        for idx, label in enumerate(table_labels):
            game_id = f"{event_id}_r{r}_t{label}"
            game = game_map.get(game_id)
            if not game:
                continue

            slots = round_tables[idx]

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

@router.patch("/event/{event_id}")
async def update_event(
    event_id: str,
    request: UpdateEventRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администраторы могут обновлять события.")

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено.")

    # Получаем только те поля, которые реально пришли
    update_data = request.dict(exclude_unset=True)

    # Преобразуем даты и seating_exclusions
    if "dates" in update_data:
        update_data["dates"] = json.dumps(update_data["dates"])  # строки уже сериализуются без проблем

    if "seating_exclusions" in update_data:
        update_data["seating_exclusions"] = json.dumps(update_data["seating_exclusions"])

    # Применяем изменения
    for key, value in update_data.items():
        setattr(event, key, value)

    db.commit()
    db.refresh(event)

    return {
        "message": "Событие успешно обновлено.",
        "event": {
            "id": event.id,
            "title": event.title,
            "dates": json.loads(event.dates) if event.dates else [],
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
            "seating_exclusions": json.loads(event.seating_exclusions) if event.seating_exclusions else [],
            "created_at": event.created_at
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


def calculate_ci(x: int, n: int, confidence: float = 0.95) -> float:
    if n == 0 or x < 0 or x > n:
        return 0.0
    p_hat = x / n
    z = 1.96  # Для 95%
    se = math.sqrt(p_hat * (1 - p_hat) / n) if p_hat * (1 - p_hat) > 0 else 0
    ci_half_width = z * se
    return ci_half_width * 2  # Полная ширина

@router.get("/events/{event_id}/player-stats")
async def get_player_stats(
    event_id: str,
    db: Session = Depends(get_db)
):    
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено.")

    games = db.query(Game).filter(Game.event_id == event_id).all()
    if not games:
        return {"players": [], "message": "Нет игр в событии."}

    user_ids: set = set()
    for game in games:
        if game.data:
            try:
                data = json.loads(game.data)
                if "players" in data:
                    for p in data["players"]:
                        user_id = p.get("userId")
                        if user_id:  # Теперь поддерживаем строки и числа
                            if isinstance(user_id, str) and user_id.isdigit():
                                user_ids.add(int(user_id))
                            else:
                                # Если строка не цифры (e.g., "user_xxx"), добавляем как есть (адаптируйте под вашу БД)
                                user_ids.add(user_id)
            except json.JSONDecodeError:
                continue

    # Запрос пользователей: адаптируйте, если user.id строковый
    db_users_query = db.query(User).filter(
        # Для числовых: User.id.in_(числа)
        # Для строковых: используйте or_ или отдельный фильтр
        # Пример: предполагаем, что User.id может быть int или str; используйте raw SQL если нужно
        User.id.in_(user_ids)  # Если все int, ок; иначе скорректируйте
    )
    db_users = db_users_query.all()
    user_map: Dict[Any, User] = {u.id: u for u in db_users}  # Ключ может быть str или int

    # Маппинг ролей из данных (русские) в английские ключи для компонента
    role_mapping = {
        "шериф": "sheriff",
        "мирный": "citizen",
        "мафия": "mafia",
        "дон": "don"
    }

    player_totals: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        "total_plus_only": 0.0, 
        "games_count": 0, 
        "total_best_move_bonus": 0.0, 
        "total_minus": 0.0,
        "bestMovesWithBlack": 0,
        "jk_count": 0,
        "sk_count": 0,  # Добавлено для подсчёта sk
        "wins": defaultdict(int),  # wins по ролям
        "gamesPlayed": defaultdict(int),  # gamesPlayed по ролям
        "role_plus": defaultdict(list),  # списки плюсов по ролям
        "user_id": None
    })

    for game in games:
        if not game.data:
            continue
        try:
            data = json.loads(game.data)
            if "players" not in data:
                continue
            
            # Извлекаем badgeColor для всей игры
            badge_color = data.get("badgeColor", None)
            print(f"Game {game.gameId}: badgeColor = {badge_color}")  # Debug
            
            # player_roles: используем str(id) для ключей (поддержка str/int)
            player_roles: Dict[str, str] = {}
            for p in data["players"]:
                player_id = str(p.get("id", ""))  # str для consistency
                role = p.get("role", "")
                player_roles[player_id] = role
            
            for p in data["players"]:
                player_name = p.get("name", "").strip()
                if not player_name:
                    continue
                
                player_key = player_name
                
                user_id = p.get("userId")
                if user_id:
                    player_totals[player_key]["user_id"] = user_id  # Храним как есть (str или int)
                
                
                if player_totals[player_key]["user_id"] in user_map:
                    db_user = user_map[player_totals[player_key]["user_id"]]
                    db_name = (db_user.nickname or db_user.name or "").strip()
                    if db_name:
                        player_key = db_name
                        if player_name in player_totals:
                            player_totals[player_key] = player_totals.pop(player_name)
                
                player_totals[player_key]["name"] = player_key
                
                role = p.get("role", "")
                english_role = role_mapping.get(role, "")
                
                if english_role:
                    player_totals[player_key]["gamesPlayed"][english_role] += 1
                    
                    # Новая логика победы на основе badgeColor (для всей игры)
                    win_condition = False
                    if badge_color == "red" and role in ["мирный", "шериф"]:
                        win_condition = True
                    elif badge_color == "black" and role in ["мафия", "дон"]:
                        win_condition = True
                    
                    if win_condition:
                        player_totals[player_key]["wins"][english_role] += 1
                        print(f"Win for {player_key} as {english_role} in {game.gameId}")  # Debug
                    
                    plus_value = p.get("plus", 0.0)
                    if isinstance(plus_value, (int, float)):
                        player_totals[player_key]["role_plus"][english_role].append(plus_value)
                        player_totals[player_key]["total_plus_only"] += plus_value
                
                player_totals[player_key]["games_count"] += 1
                
                # Логика best_move (адаптирована для str id, с исправлением для индексов)
                best_move = p.get("best_move", "").strip()
                has_black_in_best_move = False
                if best_move:
                    try:
                        # Парсим nominated_strs из best_move (e.g., "1 2 3" → ['1','2','3'])
                        nominated_strs = [s.strip() for s in best_move.split() if s.strip().isdigit()]
                        if len(nominated_strs) != 3:
                            continue
                        # Исправление: предполагаем, что числа - 1-based индексы игроков в массиве players
                        nominated_ids = []
                        for s in nominated_strs:
                            try:
                                idx = int(s) - 1  # 1-based -> 0-based
                                if 0 <= idx < len(data["players"]):
                                    nominated_ids.append(data["players"][idx]["id"])  # Реальный id игрока
                            except ValueError:
                                continue
                        # Теперь nominated_ids содержит реальные id (str), как в player_roles
                        mafia_don_count = sum(1 for nid in nominated_ids if player_roles.get(str(nid), "") in ["мафия", "дон"])
                        bonus = 0.0
                        if mafia_don_count == 3:
                            bonus = 1.5
                        elif mafia_don_count == 2:
                            bonus = 1.0
                        elif mafia_don_count == 1:
                            bonus = 0.5
                        player_totals[player_key]["total_best_move_bonus"] += bonus
                        if mafia_don_count >= 1:
                            has_black_in_best_move = True
                    except ValueError:
                        continue
                
                sk_count = p.get("sk", 0)
                if isinstance(sk_count, (int, float)) and sk_count > 0:
                    player_totals[player_key]["sk_count"] += int(sk_count)
                    player_totals[player_key]["total_minus"] += -0.5 * sk_count
                
                jk_count = p.get("jk", 0)
                if isinstance(jk_count, (int, float)) and jk_count > 0:
                    player_totals[player_key]["jk_count"] += int(jk_count)
                
                if has_black_in_best_move:
                    player_totals[player_key]["bestMovesWithBlack"] += 1
        
        except json.JSONDecodeError:
            continue

    if not player_totals:
        return {"players": [], "message": "Нет данных о игроках."}

    response_players: List[Dict[str, Any]] = []
    for player_key, details in player_totals.items():
        total_plus = details["total_plus_only"]
        total_best_move_bonus = details["total_best_move_bonus"]
        total_minus = details["total_minus"]
        
        m = details["jk_count"]
        cy = 0.5 * m * (m + 1) if m > 0 else 0.0
        total_minus += -cy
        
        total_bonus = total_plus + total_best_move_bonus + total_minus
        
        x = details["bestMovesWithBlack"]
        n = details["games_count"]
        ci = calculate_ci(x, n)
        
        # Штрафы отдельно
        total_sk_penalty = 0.5 * details["sk_count"]
        total_jk_penalty = cy
        
        # Общее количество побед
        total_wins = sum(details["wins"].values())
        
        # Изменение: добавляем +2.5 за каждую победу и +ci к total_bonus
        total_bonus += 2.5 * total_wins + ci
        
        # Преобразуем defaultdict в обычные dict для JSON
        wins = dict(details["wins"])
        gamesPlayed = dict(details["gamesPlayed"])
        role_plus = {k: [float(v) for v in val] for k, val in details["role_plus"].items()}  # float для JSON
        
        response_players.append({
            "id": details["user_id"],  # Для handlePlayerClick (str или int)
            "name": details["name"],
            "nickname": details["name"],  # На случай, если компонент использует nickname
            "totalPoints": round(total_bonus, 2),
            "wins": wins,
            "gamesPlayed": gamesPlayed,
            "role_plus": role_plus,
            "totalCi": round(ci, 2),  # Предполагаем, что totalCi - это ci
            "totalCb": round(total_best_move_bonus, 2),  # Предполагаем, что totalCb - best_move_bonus
            "total_sk_penalty": round(total_sk_penalty, 2),
            "total_jk_penalty": round(total_jk_penalty, 2)
        })

    response_players.sort(key=lambda x: x["totalPoints"], reverse=True)

    return {
        "players": response_players,
        "event_id": event_id,
        "total_games": len(games)
    }



