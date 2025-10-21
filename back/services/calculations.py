import json
import math
import re
from typing import List
from db.models import Game

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

def calculate_ci_bonuses(games: List[Game]) -> dict:
    ci_bonuses = {}
    player_x_counts = {}
    total_player_games = {}

    for game in games:
        try:
            game_data = json.loads(game.data)
            players_in_game = game_data.get("players", [])
            for p in players_in_game:
                name = p.get("name")
                if name:
                    total_player_games[name] = total_player_games.get(name, 0) + 1
        except (json.JSONDecodeError, TypeError):
            continue

    sorted_games = sorted(games, key=lambda g: g.created_at)

    for game in sorted_games:
        try:
            game_data = json.loads(game.data)
            players_in_game = game_data.get("players", [])
            player_roles = {p.get("id"): p.get("role", "").lower() for p in players_in_game}

            eliminated_player = next((p for p in players_in_game if p.get("best_move")), None)
            if not eliminated_player:
                continue

            # --- ИЗМЕНЕНИЕ: Если за эту игру был начислен C_b, полностью пропускаем ее для C_i ---
            if eliminated_player.get("cb_bonus", 0) > 0:
                continue

            player_name = eliminated_player.get("name")
            player_role = eliminated_player.get("role", "").lower()
            if not player_name or player_role in ["мафия", "дон"]:
                continue

            best_move_numbers = parse_best_move(eliminated_player.get("best_move", ""))
            found_black = any(player_roles.get(num) in ["мафия", "дон"] for num in best_move_numbers)
            
            if found_black:
                player_x_counts[player_name] = player_x_counts.get(player_name, 0) + 1

            current_x = player_x_counts.get(player_name, 0)
            total_n = total_player_games.get(player_name)

            if current_x > 0 and total_n and total_n > 0:
                k = max(0, current_x - (total_n / 10.0))
                if k > 0:
                    ci_bonus = (k * (k + 1)) / math.sqrt(total_n)
                    rounded_ci_bonus = round(ci_bonus, 2)
                    if player_name not in ci_bonuses:
                        ci_bonuses[player_name] = {}
                    ci_bonuses[player_name][game.gameId] = rounded_ci_bonus
        except (json.JSONDecodeError, TypeError):
            continue
                
    return ci_bonuses

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