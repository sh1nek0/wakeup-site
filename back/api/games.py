from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
import json
import logging
import math

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
    
    # --- ИЗМЕНЕНИЕ: Используем новую централизованную функцию ---
    all_points = calculate_all_game_points(played_games_for_calc)

    total_count = len(played_games_for_calc)
    paginated_games = sorted(played_games_for_calc, key=lambda g: g.created_at, reverse=True)[offset:offset+limit]
    
    games_list = []
    for game in paginated_games:
        data = json.loads(game.data)
        players = data.get("players", [])
        
        processed_players = []
        for p in players:
            name = p.get("name")
            final_points = all_points.get(name, {}).get(game.gameId, 0)
            processed_players.append({
                "id": user_id_map.get(name), 
                "name": name,
                "role": p.get("role", ""),
                "points": final_points,
                "best_move": p.get("best_move", "")
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