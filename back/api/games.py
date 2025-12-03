from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
import json
import logging
import math
from collections import defaultdict


from core.security import get_current_user, get_db
from db.models import Game, User
from schemas.main import SaveGameData
from services.calculations import calculate_all_game_points, parse_best_move # --- ИЗМЕНЕНИЕ ---

router = APIRouter()

@router.post("/saveGameData")
async def save_game_data(data: SaveGameData, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия")
    player_roles = {player.get("id"): player.get("role", "").lower() for player in data.players}
    winning_roles = []
    if data.badgeColor == "red":
        winning_roles = ["мирный", "шериф"]
    elif data.badgeColor == "black":
        winning_roles = ["мафия", "дон"]

    game_info = data.gameInfo
    breakdown_source = game_info.get("breakdownSource", "none")
    breakdown_player_number = game_info.get("breakdownPlayerNumber")

    for player in data.players:
        role = player.get("role", "").lower()
        best_move_string = player.get("best_move", "")
        
        best_move_bonus = 0
        cb_bonus = 0

        is_broken_player = (
            breakdown_source != 'none' and
            breakdown_player_number is not None and
            player.get("id") == breakdown_player_number
        )

        if is_broken_player:
            best_move_numbers = parse_best_move(best_move_string)
            black_players_in_best_move = {p_num for p_num in best_move_numbers if player_roles.get(p_num) in ["мафия", "дон"]}
            count_black = len(black_players_in_best_move)

            if role in ["мирный", "шериф"]:
                if breakdown_source == 'black':
                    if count_black > 0: cb_bonus = 0.5
                    if count_black == 2: best_move_bonus = 0.5
                    elif count_black == 3: best_move_bonus = 1.0
                
                elif breakdown_source == 'red':
                    cb_bonus = 0.5
                    if count_black == 1: best_move_bonus = 0.5
                    elif count_black == 2: best_move_bonus = 1.0
                    elif count_black == 3: best_move_bonus = 1.5
            
            elif role in ["мафия", "дон"]:
                cb_bonus = 0.5
        
        elif best_move_string and not is_broken_player:
            if role in ["мирный", "шериф"]:
                best_move_numbers = parse_best_move(best_move_string)
                black_players_in_best_move = {p_num for p_num in best_move_numbers if player_roles.get(p_num) in ["мафия", "дон"]}
                count_black = len(black_players_in_best_move)
                if count_black == 2:
                    best_move_bonus = 0.5
                elif count_black == 3:
                    best_move_bonus = 1.0

        player["best_move_bonus"] = best_move_bonus
        player["cb_bonus"] = cb_bonus
        
        team_win_bonus = 2.5 if role in winning_roles else 0
        
        player["sum"] = player.get("plus", 0) + best_move_bonus + cb_bonus + team_win_bonus

    existing_game = db.query(Game).filter(Game.gameId == data.gameId).first()

    if existing_game:
        existing_data = json.loads(existing_game.data)
        existing_judge = existing_data.get("gameInfo", {}).get("judgeNickname")
        if not game_info.get("judgeNickname") and existing_judge:
            game_info["judgeNickname"] = existing_judge
    elif not game_info.get("judgeNickname"):
        game_info["judgeNickname"] = current_user.nickname

    if data.tableNumber is not None:
        game_info["tableNumber"] = data.tableNumber

    game_json = json.dumps({
        "players": data.players,
        "fouls": data.fouls,
        "gameInfo": game_info,
        "badgeColor": data.badgeColor,
        "location": data.location
    }, ensure_ascii=False)

    if existing_game:
        existing_game.data = game_json
        existing_game.event_id = data.eventId if data.eventId != '1' else None
    else:
        new_game = Game(
            gameId=data.gameId, 
            data=game_json, 
            event_id=data.eventId if data.eventId != '1' else None
        )
        db.add(new_game)
    
    db.commit()
    return {"message": "Данные игры сохранены успешно"}

@router.get("/getGameData/{gameId}")
async def get_game_data(gameId: str, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.gameId == gameId).first()
    if not game:
        raise HTTPException(status_code=404, detail="Игра не найдена")
    return json.loads(game.data)

@router.get("/checkGameExists/{gameId}")
async def check_game_exists(gameId: str, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.gameId == gameId).first()
    return {"exists": game is not None}

@router.delete("/deleteGame/{gameId}")
async def delete_game(gameId: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия")
    game = db.query(Game).filter(Game.gameId == gameId).first()
    if not game:
        raise HTTPException(status_code=404, detail="Игра не найдена")
    db.delete(game)
    db.commit()
    return {"message": f"Игра с ID {gameId} успешно удалена"}

@router.get("/getGames")
async def get_games(limit: int = 10, offset: int = 0, event_id: str = Query(None, description="ID события для фильтрации"), db: Session = Depends(get_db)):
    all_users = db.query(User).all()
    user_id_map = {user.nickname: user.id for user in all_users}

    base_query = db.query(Game)
    if event_id and event_id != 'all':
        base_query = base_query.filter(Game.event_id == event_id)
    else:
        base_query = base_query.filter(or_(Game.event_id.is_(None), Game.event_id == '1'))

    all_games_for_calc = base_query.order_by(Game.created_at.asc()).all()
    
    played_games_for_calc = [
        game for game in all_games_for_calc if json.loads(game.data).get("badgeColor")
    ]
    
    # --- ИЗМЕНЕНИЕ: Используем calculate_all_game_points для points ---
    all_points = calculate_all_game_points(played_games_for_calc)

    total_count = len(played_games_for_calc)
    paginated_games = sorted(played_games_for_calc, key=lambda g: g.created_at, reverse=True)[offset:offset+limit]
    
    games_list = []
    for game in paginated_games:
        data = json.loads(game.data)
        players = data.get("players", [])
        
        # Маппинг ролей (как в player-stats)
        role_mapping = {
            "шериф": "sheriff",
            "мирный": "citizen",
            "мафия": "mafia",
            "дон": "don"
        }
        
        # player_roles для игры
        player_roles: Dict[str, str] = {}
        for p in players:
            player_id = str(p.get("id", ""))
            role = p.get("role", "")
            player_roles[player_id] = role
        
        # Извлекаем badgeColor для всей игры
        badge_color = data.get("badgeColor", None)
        
        # Сбор user_ids для запроса пользователей (если нужно для замены имён)
        user_ids = set()
        for p in players:
            user_id = p.get("userId")
            if user_id:
                if isinstance(user_id, str) and user_id.isdigit():
                    user_ids.add(int(user_id))
                else:
                    user_ids.add(user_id)
        
        # Запрос пользователей
        db_users_query = db.query(User).filter(User.id.in_(user_ids))
        db_users = db_users_query.all()
        user_map: Dict[Any, User] = {u.id: u for u in db_users}
        
        # player_totals для этой конкретной игры (расчёты как в player-stats, но только для одной игры)
        player_totals: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "total_plus_only": 0.0,
            "games_count": 1,  # Всегда 1 для одной игры
            "total_best_move_bonus": 0.0,
            "total_minus": 0.0,
            "bestMovesWithBlack": 0,
            "jk_count": 0,
            "sk_count": 0,
            "wins": defaultdict(int),
            "gamesPlayed": defaultdict(int),
            "role_plus": defaultdict(list),
            "user_id": None
        })
        
        for p in players:
            player_name = p.get("name", "").strip()
            if not player_name:
                continue
            
            player_key = player_name
            user_id = p.get("userId")
            if user_id:
                player_totals[player_key]["user_id"] = user_id
            
            # Замена имени на DB-имя, если есть
            if player_totals[player_key]["user_id"] in user_map:
                db_user = user_map[player_totals[player_key]["user_id"]]
                db_name = (db_user.nickname or db_user.name or "").strip()
                if db_name:
                    player_key = db_name
            
            player_totals[player_key]["name"] = player_key
            
            role = p.get("role", "")
            english_role = role_mapping.get(role, "")
            
            if english_role:
                player_totals[player_key]["gamesPlayed"][english_role] += 1
                
                # Логика победы
                win_condition = False
                if badge_color == "red" and role in ["мирный", "шериф"]:
                    win_condition = True
                elif badge_color == "black" and role in ["мафия", "дон"]:
                    win_condition = True
                
                if win_condition:
                    player_totals[player_key]["wins"][english_role] += 1
                
                plus_value = p.get("plus", 0.0)
                if isinstance(plus_value, (int, float)):
                    player_totals[player_key]["role_plus"][english_role].append(plus_value)
                    player_totals[player_key]["total_plus_only"] += plus_value
            
            # best_move логика
            best_move = p.get("best_move", "").strip()
            has_black_in_best_move = False
            if best_move:
                try:
                    nominated_strs = [s.strip() for s in best_move.split() if s.strip().isdigit()]
                    if len(nominated_strs) != 3:
                        continue
                    nominated_ids = []
                    for s in nominated_strs:
                        try:
                            idx = int(s) - 1
                            if 0 <= idx < len(players):
                                nominated_ids.append(players[idx]["id"])
                        except ValueError:
                            continue
                    mafia_don_count = sum(1 for nid in nominated_ids if player_roles.get(str(nid), "") in ["мафия", "дон"])
                    bonus = 0.0
                    if mafia_don_count == 3:
                        bonus = 1.5
                    elif mafia_don_count == 2:
                        bonus = 1.0
                    elif mafia_don_count == 1:
                        bonus = 0.0
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
        
        processed_players = []
        for p in players:
            name = p.get("name")
            final_points = all_points.get(name, {}).get(game.gameId, 0)
            
            # Расчёт дополнительных значений для этого игрока в этой игре
            player_key = name.strip()
            if player_key in player_totals:
                details = player_totals[player_key]
                m = details["jk_count"]
                cy = 0.5 * m * (m + 1) if m > 0 else 0.0
                total_minus = details["total_minus"] - cy  # minuses = total_minus (уже включает sk и jk штрафы)
                x = details["bestMovesWithBlack"]
                n = details["games_count"]
                ci = calculate_ci(x, n)
                cb = details["total_best_move_bonus"]  # cb = total_best_move_bonus
                jk = details["jk_count"]  # jk = jk_count
            else:
                jk = 0
                ci = 0.0
                cb = 0.0
                total_minus = 0.0
            
            processed_players.append({
                "id": user_id_map.get(name), 
                "name": name,
                "role": p.get("role", ""),
                "points": final_points,
                "best_move": p.get("best_move", ""),
                # Новые поля с дополнительными значениями
                "jk": jk,
                "ci": round(ci, 2),
                "cb": round(cb, 2),
                "minuses": round(total_minus, 2)
            })
        
        game_info = data.get("gameInfo", {})
        judge_nickname = game_info.get("judgeNickname")
        games_list.append({
            "id": game.gameId,
            "date": game.created_at.strftime("%d.%m.%Y %H:%M"),
            "badgeColor": data.get("badgeColor", ""),
            "event_id": game.event_id,
            "players": processed_players,
            "judge_nickname": judge_nickname,
            "judge_id": user_id_map.get(judge_nickname),
            "location": data.get("location"),
            "tableNumber": game_info.get("tableNumber"),
            "gameInfo": game_info,
        })

    return {"games": games_list, "total_count": total_count}


def calculate_ci(x: int, n: int) -> float:
    if n <= 0 or x < 0 or x > n:
        return 0.0
    K = max(0, x - n / 10)
    if K == 0:
        return 0.0
    ci = K * (K + 1) / math.sqrt(n)
    return ci


@router.get("/getPlayerGames/{nickname}")
async def get_player_games(nickname: str, db: Session = Depends(get_db)):
    all_users = db.query(User).all()
    user_id_map = {user.nickname: user.id for user in all_users}

    all_games_for_calc = db.query(Game).filter(or_(Game.event_id.is_(None), Game.event_id == '1')).order_by(Game.created_at.asc()).all()
    
    # --- ИЗМЕНЕНИЕ: Используем новую централизованную функцию ---
    all_points = calculate_all_game_points(all_games_for_calc)

    player_games_list = []
    sorted_games = sorted(all_games_for_calc, key=lambda g: g.created_at, reverse=True)

    for game in sorted_games:
        try:
            data = json.loads(game.data)
            players = data.get("players", [])
            if any(p.get("name") == nickname for p in players):
                processed_players = []
                for p in players:
                    name = p.get("name")
                    final_points = all_points.get(name, {}).get(game.gameId, 0)
                    processed_players.append({
                        "id": user_id_map.get(name),
                        "name": name,
                        "role": p.get("role", ""),
                        "sum": final_points,
                        "best_move": p.get("best_move", "")
                    })
                
                game_info = data.get("gameInfo", {})
                judge_nickname = game_info.get("judgeNickname")
                player_games_list.append({
                    "id": game.gameId,
                    "date": game.created_at.strftime("%d.%m.%Y %H:%M"),
                    "badgeColor": data.get("badgeColor", ""),
                    "event_id": game.event_id,
                    "players": processed_players,
                    "judge_nickname": judge_nickname,
                    "judge_id": user_id_map.get(judge_nickname),
                    "location": data.get("location"),
                    "tableNumber": game_info.get("tableNumber"),
                    "gameInfo": game_info,
                })
        except (json.JSONDecodeError, TypeError):
            continue

    return {"games": player_games_list}