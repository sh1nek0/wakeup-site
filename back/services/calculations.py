import json
import re
from typing import List, Dict, Tuple,Any
import math
from db.models import Event, Team, Registration, User, Notification, Game
from schemas.main import CreateTeamRequest, ManageRegistrationRequest, TeamActionRequest, EventSetupRequest, GenerateSeatingRequest, CreateEventRequest, UpdateEventRequest
from api.notifications import create_notification
from collections import defaultdict
from typing import Optional
from sqlalchemy import select, distinct, func, or_


def parse_best_move(best_move_string: str) -> list[int]:
    if not best_move_string:
        return []
    numbers = []
    tens = re.findall(r'10', best_move_string)
    numbers.extend([10] * len(tens))
    remaining_string = best_move_string.replace('10', '')
    single_digits = re.findall(r'[1-9]', remaining_string)
    numbers.extend([int(d) for d in single_digits])
    return numbers

def calculate_dynamic_penalties(games: List[Game]) -> dict:
    penalties = {}
    player_jk_counts = {}

    sorted_games = sorted(games, key=lambda g: g.created_at)

    for game in sorted_games:
        try:
            game_data = json.loads(game.data)
            players_in_game = game_data.get("players", [])

            for player in players_in_game:
                name = player.get("name")
                if not name:
                    continue

                sk_penalty = player.get("sk", 0) * 0.5
                jk_penalty = 0
                if player.get("jk", 0) > 0:
                    current_jk_count = player_jk_counts.get(name, 0)
                    for i in range(player.get("jk")):
                        current_jk_count += 1
                        jk_penalty += current_jk_count * 0.5
                    player_jk_counts[name] = current_jk_count

                if jk_penalty > 0 or sk_penalty > 0:
                    if name not in penalties:
                        penalties[name] = {}
                    penalties[name][game.gameId] = {
                        "jk_penalty": jk_penalty,
                        "sk_penalty": sk_penalty
                    }
        except (json.JSONDecodeError, TypeError):
            continue
            
    return penalties


def calculate_ci(x: int, n: int) -> float:
    if n <= 0 or x < 0 or x > n:
        return 0.0
    K = max(0, x - n / 10)
    if K == 0:
        return 0.0
    ci = K * (K + 1) / math.sqrt(n)
    return ci


def calculate_all_game_points(games: List[Game], db) -> Dict[str, Dict[str, Any]]:
    # Собираем user_ids
    user_ids: set = set()

    # Маппинг для подсчета количества игр по локациям для каждого игрока
    player_location_stats = defaultdict(lambda: {"МФТИ": 0, "МИЭТ": 0})

    # Получаем пользователей из БД
    users = {u.nickname: u for u in db.query(User).all() if u.nickname}  # Получаем пользователей с никнеймами

    # Обрабатываем все игры
    for game in games:
        if not game.data:
            continue
        try:
            data = json.loads(game.data)
        except json.JSONDecodeError:
            continue

        # Извлекаем локацию игры
        location = func.trim(func.json_extract(Game.data, "$.location"), '"')

        for p in data.get("players", []):
            user_id = p.get("userId")
            if not user_id:
                continue
            if isinstance(user_id, str) and user_id.isdigit():
                user_ids.add(int(user_id))
            else:
                user_ids.add(user_id)

            # Получаем имя игрока для статистики
            player_name = p.get("name", "").strip()
            if player_name:
                # Увеличиваем счётчик игр по локации для игрока
                if location == "МФТИ":
                    player_location_stats[player_name]["МФТИ"] += 1
                elif location == "МИЭТ":
                    player_location_stats[player_name]["МИЭТ"] += 1

    # Получаем пользователей из БД
    db_users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map: Dict[Any, User] = {u.id: u for u in db_users}

    role_mapping = {
        "шериф": "sheriff",
        "мирный": "citizen",
        "мафия": "mafia",
        "дон": "don",
    }

    player_totals: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        "total_plus_only": 0.0,
        "games_count": 0,
        "total_best_move_bonus": 0.0,
        "total_minus": 0.0,
        "bestMovesWithBlack": 0,
        "jk_count": 0,
        "sk_count": 0,
        "wins": defaultdict(int),
        "gamesPlayed": defaultdict(int),
        "role_plus": defaultdict(list),
        "user_id": None,
        "name": None,
        "deaths": 0,
        "deathsWith1Black": 0,
        "deathsWith2Black": 0,
        "deathsWith3Black": 0,
        "games_miet": 0,  # Количество игр в МИЭТ
        "games_mfti": 0,  # Количество игр в МФТИ
    })

    # Обрабатываем игроков в играх и обновляем статистику
    for game in games:
        if not game.data:
            continue
        try:
            data = json.loads(game.data)
        except json.JSONDecodeError:
            continue

        players = data.get("players")
        if not players:
            continue

        badge_color = data.get("badgeColor")
        
        # Извлекаем локацию игры
        location = func.trim(func.json_extract(game.data, "$.location"), '"')

        # Создание словаря с ролями игроков
        player_roles = {str(p.get("id")): p.get("role") for p in players}

        for p in players:
            player_name = (p.get("name") or "").strip()
            if not player_name:
                continue

            player_key = player_name

            # user_id
            user_id = p.get("userId")
            if user_id:
                if isinstance(user_id, str) and user_id.isdigit():
                    user_id = int(user_id)
                player_totals[player_key]["user_id"] = user_id

            # Если нашли юзера в БД — нормализуем имя
            normalized_key = player_key
            db_user = user_map.get(player_totals[player_key]["user_id"])
            if db_user:
                db_name = (db_user.nickname or db_user.name or "").strip()
                if db_name:
                    normalized_key = db_name

            # Если имя поменялось — переносим накопленные данные
            if normalized_key != player_key:
                if normalized_key not in player_totals:
                    player_totals[normalized_key] = player_totals[player_key]
                else:
                    # Сливаем, если вдруг уже есть запись
                    for k, v in player_totals[player_key].items():
                        if isinstance(v, (int, float)):
                            player_totals[normalized_key][k] += v
                player_key = normalized_key

            player_totals[player_key]["name"] = player_key

            role = p.get("role", "")
            english_role = role_mapping.get(role, "")

            if english_role:
                player_totals[player_key]["gamesPlayed"][english_role] += 1

                # Победа по badgeColor
                win_condition = (
                    (badge_color == "red" and role in ["мирный", "шериф"]) or
                    (badge_color == "black" and role in ["мафия", "дон"])
                )
                if win_condition:
                    player_totals[player_key]["wins"][english_role] += 1

                plus_value = p.get("plus", 0.0)
                if isinstance(plus_value, (int, float)):
                    player_totals[player_key]["role_plus"][english_role].append(float(plus_value))
                    player_totals[player_key]["total_plus_only"] += float(plus_value)

            player_totals[player_key]["games_count"] += 1

            # best_move
            best_move = (p.get("best_move") or "").strip()
            has_black_in_best_move = False
            if best_move:
                nominated_strs = [s.strip() for s in best_move.split() if s.strip().isdigit()]
                if len(nominated_strs) == 3:
                    nominated_ids = []
                    for s in nominated_strs:
                        idx = int(s) - 1
                        if 0 <= idx < len(players):
                            nominated_ids.append(players[idx].get("id"))

                    mafia_don_count = sum(
                        1 for nid in nominated_ids
                        if player_roles.get(str(nid), "") in ["мафия", "дон"]
                    )

                    bonus = 0.0
                    if mafia_don_count == 3:
                        bonus = 1.5
                    elif mafia_don_count == 2:
                        bonus = 1.0

                    player_totals[player_key]["total_best_move_bonus"] += bonus
                    if english_role and bonus > 0:
                        player_totals[player_key]["role_plus"][english_role].append(float(bonus))

                    if mafia_don_count >= 1:
                        has_black_in_best_move = True

                    # У тебя это называется deaths, но по факту это счётчик best_move-ов
                    player_totals[player_key]["deaths"] += 1
                    if mafia_don_count == 1:
                        player_totals[player_key]["deathsWith1Black"] += 1
                    elif mafia_don_count == 2:
                        player_totals[player_key]["deathsWith2Black"] += 1
                    elif mafia_don_count == 3:
                        player_totals[player_key]["deathsWith3Black"] += 1

            # sk / jk
            sk_count = p.get("sk", 0)
            if isinstance(sk_count, (int, float)) and sk_count > 0:
                player_totals[player_key]["sk_count"] += int(sk_count)
                player_totals[player_key]["total_minus"] += -0.5 * float(sk_count)

            jk_count = p.get("jk", 0)
            if isinstance(jk_count, (int, float)) and jk_count > 0:
                player_totals[player_key]["jk_count"] += int(jk_count)

            if has_black_in_best_move:
                player_totals[player_key]["bestMovesWithBlack"] += 1

            
            # После обработки всех игр, добавляем количество игр по локации в итоговый результат
            player_totals[player_key]["games_miet"] = player_location_stats[player_key]["МИЭТ"]
            player_totals[player_key]["games_mfti"] = player_location_stats[player_key]["МФТИ"]

    result: Dict[str, Dict[str, Any]] = {}

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

        total_wins = sum(details["wins"].values())
        total_bonus += 2.5 * total_wins + ci

        games_count = details["games_count"]
        user_id = details["user_id"]
        photo_url = None
        if user_id in user_map:
            photo_url = getattr(user_map[user_id], "photo_url", None)

        result[player_key] = {
            "games": int(games_count),
            "total_sum": round(float(total_bonus), 2),
            "user_id": user_id,
            "photo_url": photo_url,
            "games_miet": details["games_miet"],  # количество игр для МИЭТ
            "games_mfti": details["games_mfti"],  # количество игр для МФТИ
        }

    return result

