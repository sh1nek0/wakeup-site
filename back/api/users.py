from fastapi import APIRouter, Depends, HTTPException, Query, Form, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
import json
import logging
import time
import io
from pathlib import Path
from PIL import Image
from typing import Optional
import math
import os

from core.security import get_current_user, get_db, verify_password, get_password_hash, create_access_token
from core.config import AVATAR_DIR, MAX_AVATAR_SIZE, PNG_SIGNATURE
from db.models import User, Game, Registration, Notification
from schemas.main import UpdateProfileRequest, AvatarUploadResponse, DeleteAvatarRequest, UpdateCredentialsRequest
from services.calculations import calculate_all_game_points # --- ИЗМЕНЕНИЕ ---
from services.search import get_player_suggestions_logic

router = APIRouter()

def human_size(n: int) -> str:
    units = ["B", "KB", "MB", "GB"]
    i = 0
    f = float(n)
    while f >= 1024 and i < len(units) - 1:
        f /= 1024
        i += 1
    return f"{f:.1f} {units[i]}"

@router.get("/getUsers")
async def get_users(event_id: str = None, db: Session = Depends(get_db)):
    if event_id is None or event_id == "1":
        users = db.query(User).all()
    else:
        approved_user_ids = db.query(Registration.user_id).filter(
            Registration.event_id == event_id,
            Registration.status == "approved"
        ).all()
        user_ids = [uid for (uid,) in approved_user_ids]
        users = db.query(User).filter(User.id.in_(user_ids)).all()
    
    return {"users": [{
        "id": user.id, "email": user.email, "nickname": user.nickname,
        "role": user.role, "club": user.club
    } for user in users]}

@router.get("/getPlayersList")
async def get_players_list(db: Session = Depends(get_db)):
    users = db.query(User).all()
    games = db.query(Game).all()
    player_game_counts = {user.nickname: 0 for user in users}

    for game in games:
        try:
            game_data = json.loads(game.data)
            player_names_in_game = {p.get("name") for p in game_data.get("players", []) if p.get("name")}
            for name in player_names_in_game:
                if name in player_game_counts:
                    player_game_counts[name] += 1
        except (json.JSONDecodeError, TypeError):
            continue
    
    players_list = [{
        "id": user.id, "nickname": user.nickname, "club": user.club,
        "game_count": player_game_counts.get(user.nickname, 0), "photoUrl": user.avatar
    } for user in users]

    return {"players": sorted(players_list, key=lambda p: p["game_count"], reverse=True)}

@router.get("/getUser/{user_id}")
async def get_user(user_id: str, db: Session = Depends(get_db)):
    user_obj = db.query(User).filter(User.id == user_id).first()
    if not user_obj:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return {"user": {
        "nickname": user_obj.nickname, "role": user_obj.role, "id": user_obj.id,
        "name": user_obj.name, "club": user_obj.club, "favoriteCard": user_obj.favoriteCard,
        "vk": user_obj.vk, "tg": user_obj.tg, "site1": user_obj.site1,
        "site2": user_obj.site2, 'photoUrl': user_obj.avatar
    }}


@router.get("/getUserPhoto/{nickname}")
async def get_user_photo(nickname: str, db: Session = Depends(get_db)):
    user_obj = db.query(User).filter(User.nickname == nickname).first()
    if not user_obj:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return {"photoUrl": user_obj.avatar}


@router.post("/updateProfile")
async def update_profile(request: UpdateProfileRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.id != request.userId and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="У вас нет прав для обновления этого профиля")

    user_to_update = db.query(User).filter(User.id == request.userId).first()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    valid_clubs = ["WakeUp | MIET", "WakeUp | MIPT", "Другой"]
    if request.club and request.club not in valid_clubs:
        raise HTTPException(status_code=400, detail="Недопустимое значение клуба")

    user_to_update.name = request.name
    user_to_update.club = request.club
    user_to_update.favoriteCard = request.favoriteCard
    user_to_update.vk = request.vk
    user_to_update.tg = request.tg
    user_to_update.site1 = request.site1
    user_to_update.site2 = request.site2
    db.commit()
    return {"message": "Профиль обновлен успешно"}

@router.get("/get_player_suggestions")
async def get_player_suggestions(query: str, db: Session = Depends(get_db)):
    return get_player_suggestions_logic(query, db)

@router.get("/getRating")
async def get_rating(limit: int = Query(10, description="Количество элементов на странице"), offset: int = Query(0, description="Смещение для пагинации"), db: Session = Depends(get_db)):
    logger = logging.getLogger("uvicorn.error")
    games = db.query(Game).filter(or_(Game.event_id.is_(None), Game.event_id == '1')).order_by(Game.created_at.asc()).all()
    raw_users = db.query(User).all()
    users = {u.nickname: u for u in raw_users if u.nickname}
    clubs = {name: u.club for name, u in users.items()}
    
    # --- ИЗМЕНЕНИЕ: Используем новую централизованную функцию ---
    all_points = calculate_all_game_points(games)
    
    player_stats = {}

    for game in games:
        try:
            game_data = json.loads(game.data)
            location = game_data.get("location", "").lower()

            for player in game_data.get("players", []):
                name = player.get("name")
                if not name or not name.strip(): continue
                
                user = users.get(name)
                final_points = all_points.get(name, {}).get(game.gameId, 0)

                if name not in player_stats:
                    player_stats[name] = {
                        "games": 0, "total_sum": 0,
                        "user_id": user.id if user else None,
                        "photo_url": user.avatar if user else None,
                        "games_miet": 0,
                        "games_mipt": 0,
                    }
                player_stats[name]["games"] += 1
                player_stats[name]["total_sum"] += final_points
                
                if "миэт" in location:
                    player_stats[name]["games_miet"] += 1
                elif "мфти" in location:
                    player_stats[name]["games_mipt"] += 1

        except (json.JSONDecodeError, TypeError) as je:
            logger.warning(f"JSON decode error for game {game.gameId}: {je}")
            continue

    rating = [{
        "name": name, "games": stats["games"], "points": stats["total_sum"],
        "club": clubs.get(name), "id": stats["user_id"], "photoUrl": stats["photo_url"],
        "rating_score": stats["total_sum"] / math.sqrt(stats["games"]) if stats["games"] > 0 else 0.0,
        "games_miet": stats["games_miet"],
        "games_mipt": stats["games_mipt"],
    } for name, stats in player_stats.items() if stats["games"] > 0]

    rating.sort(key=lambda x: x["rating_score"], reverse=True)
    return {"players": rating[offset: offset + limit], "total_count": len(rating)}

@router.get("/getDetailedStats")
async def get_detailed_stats(
    limit: int = Query(200, description="Количество игроков на странице"),
    offset: int = Query(0, description="Смещение для пагинации игроков"),
    event_id: Optional[str] = Query(None, description="ID события для фильтрации"),
    db: Session = Depends(get_db)
):
    # Эта функция больше не используется фронтендом для основной статистики,
    # но оставляем ее на случай, если она нужна где-то еще, и исправляем аналогично.
    # Если она не нужна, ее можно будет удалить.
    users = db.query(User).all()
    user_map = {p.nickname: p for p in users}
    
    games_query = db.query(Game)
    if event_id and event_id != 'all':
        games_query = games_query.filter(Game.event_id == event_id)
    else:
        games_query = games_query.filter(or_(Game.event_id.is_(None), Game.event_id == '1'))

    games = games_query.order_by(Game.created_at.asc()).all()
    
    # --- ИЗМЕНЕНИЕ: Используем новую централизованную функцию ---
    all_points = calculate_all_game_points(games)
    
    player_stats = {}
    for game in games:
        try:
            game_data = json.loads(game.data)
            badge_color = game_data.get("badgeColor", "")
            players = game_data.get("players", [])

            for player in players:
                name = player.get("name")
                if not name or not name.strip(): continue
                
                final_points = all_points.get(name, {}).get(game.gameId, 0)

                if name not in player_stats:
                    player_stats[name] = {
                        "totalPoints": 0, "gamesPlayedCount": 0
                        # Можно добавить другие агрегированные статистики при необходимости
                    }

                stats = player_stats[name]
                stats["totalPoints"] += final_points
                stats["gamesPlayedCount"] += 1
                # Логика для wins, gamesPlayed по ролям и т.д. может быть добавлена сюда,
                # если эта функция действительно нужна. Для /getRating она не требуется.

        except (json.JSONDecodeError, TypeError):
            continue

    players_list = []
    for name, stats in player_stats.items():
        user_obj = user_map.get(name)
        player_data = {
            "id": user_obj.id if user_obj else None,
            "nickname": name,
            "club": user_obj.club if user_obj else None,
            "totalPoints": stats["totalPoints"]
            # ... другие поля
        }
        players_list.append(player_data)

    players_list.sort(key=lambda x: x["totalPoints"], reverse=True)

    total_count = len(players_list)
    paginated_players = players_list[offset:offset + limit]
    average_points = sum(p["totalPoints"] for p in players_list) / total_count if total_count > 0 else 0

    return {
        "players": paginated_players,
        "total_count": total_count,
        "average_points": average_points
    }

@router.post("/profile/avatar", response_model=AvatarUploadResponse)
async def upload_avatar(userId: str = Form(...), avatar: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if str(current_user.id) != str(userId) and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="У вас нет прав для обновления этого аватара")

    user = db.query(User).filter(User.id == userId).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    old_avatar_url = user.avatar

    if avatar.content_type != "image/png":
        raise HTTPException(status_code=400, detail="Допустим только PNG-файл")

    contents = await avatar.read()
    if len(contents) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=413, detail=f"Файл слишком большой. Лимит: {human_size(MAX_AVATAR_SIZE)}")
    
    if not contents.startswith(PNG_SIGNATURE):
        raise HTTPException(status_code=400, detail="Файл не является корректным PNG")

    try:
        with Image.open(io.BytesIO(contents)) as im:
            w, h = im.size
            side = min(w, h)
            im = im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
            im = im.resize((512, 512), Image.LANCZOS)
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGBA")
            out_buf = io.BytesIO()
            im.save(out_buf, format="PNG", optimize=True, compress_level=9)
            safe_png = out_buf.getvalue()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Не удалось обработать изображение: {e}")

    filename = f"{userId}_v{int(time.time())}.png"
    filepath = AVATAR_DIR / filename

    try:
        with open(filepath, "wb") as f:
            f.write(safe_png)
        os.chmod(filepath, 0o644)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка записи файла: {e}")

    url = f"/data/avatars/{filename}"
    try:
        user.avatar = url
        db.commit()
    except Exception as e:
        db.rollback()
        if filepath.is_file():
            filepath.unlink()
        raise HTTPException(status_code=500, detail=f"Не удалось обновить профиль: {e}")
    
    if old_avatar_url:
        try:
            old_filename = Path(old_avatar_url.lstrip('/')).name
            old_filepath = AVATAR_DIR / old_filename
            if old_filepath.is_file() and old_filepath != filepath:
                old_filepath.unlink()
        except Exception as e:
            print(f"Could not delete old avatar {old_avatar_url}: {e}")

    return AvatarUploadResponse(url=url)

@router.delete("/profile/avatar")
async def delete_avatar(request: DeleteAvatarRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if str(current_user.id) != str(request.userId) and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="У вас нет прав для удаления этого аватара")

    user = db.query(User).filter(User.id == request.userId).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    old_avatar_url = user.avatar
    if not old_avatar_url:
        return {"message": "Аватар уже был удален."}

    try:
        user.avatar = None
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Не удалось обновить профиль: {e}")

    try:
        old_filename = Path(old_avatar_url.lstrip('/')).name
        old_filepath = AVATAR_DIR / old_filename
        if old_filepath.is_file():
            old_filepath.unlink()
    except Exception as e:
        print(f"Could not delete avatar file {old_avatar_url}: {e}")

    return {"message": "Аватар успешно удален"}

@router.post("/update_credentials")
async def update_credentials(request: UpdateCredentialsRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.id != request.userId and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="У вас нет прав для изменения этих данных")

    user_to_update = db.query(User).filter(User.id == request.userId).first()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if not verify_password(request.current_password, user_to_update.hashed_password):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")

    token_needs_refresh = False
    
    if request.new_nickname and request.new_nickname != user_to_update.nickname:
        old_nickname = user_to_update.nickname
        new_nickname = request.new_nickname

        existing_user = db.query(User).filter(User.nickname == new_nickname).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Этот никнейм уже занят")
        
        user_to_update.nickname = new_nickname
        token_needs_refresh = True

        all_games = db.query(Game).all()
        for game in all_games:
            try:
                game_data = json.loads(game.data)
                is_game_updated = False
                for player in game_data.get("players", []):
                    if player.get("name") == old_nickname:
                        player["name"] = new_nickname
                        is_game_updated = True
                if game_data.get("gameInfo", {}).get("judgeNickname") == old_nickname:
                    game_data["gameInfo"]["judgeNickname"] = new_nickname
                    is_game_updated = True
                
                if is_game_updated:
                    game.data = json.dumps(game_data, ensure_ascii=False)
            except (json.JSONDecodeError, TypeError):
                continue

        db.query(Notification).filter(
            Notification.message.contains(old_nickname)
        ).update(
            {Notification.message: func.replace(Notification.message, old_nickname, new_nickname)},
            synchronize_session=False
        )
        
    if request.new_password:
        user_to_update.hashed_password = get_password_hash(request.new_password)

    db.commit()
    db.refresh(user_to_update)

    response_data = {"message": "Данные успешно обновлены"}

    if token_needs_refresh:
        new_token = create_access_token(
            data={"sub": user_to_update.nickname, "role": user_to_update.role, "id": user_to_update.id}
        )
        response_data["new_token"] = new_token
        response_data["message"] = "Никнейм успешно изменен. Данные во всех записях обновлены. Пожалуйста, используйте новый токен."

    return response_data