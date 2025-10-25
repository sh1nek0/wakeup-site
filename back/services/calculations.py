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

# --- ИЗМЕНЕНИЕ: Новая централизованная функция для всех расчетов ---
def calculate_all_game_points(games: List[Game]) -> dict:
    
    game_points = {}
    player_x_counts = {}
    total_player_games = {}

    # Шаг 1: Предварительный подсчет общего количества игр для каждого игрока
    for game in games:
        try:
            game_data = json.loads(game.data)
            for p in game_data.get("players", []):
                name = p.get("name")
                if name:
                    total_player_games[name] = total_player_games.get(name, 0) + 1
        except (json.JSONDecodeError, TypeError):
            continue

    # Шаг 2: Получаем динамические штрафы
    dynamic_penalties = calculate_dynamic_penalties(games)
    
    # Шаг 3: Проходим по отсортированным играм и считаем все бонусы и итоговые очки
    sorted_games = sorted(games, key=lambda g: g.created_at)
    for game in sorted_games:
        try:
            game_data = json.loads(game.data)
            players_in_game = game_data.get("players", [])
            
            winning_roles = []
            if game_data.get("badgeColor") == "red": winning_roles = ["мирный", "шериф"]
            elif game_data.get("badgeColor") == "black": winning_roles = ["мафия", "дон"]
            
            player_roles = {p.get("id"): p.get("role", "").lower() for p in players_in_game}
            game_info = game_data.get("gameInfo", {})
            breakdown_source = game_info.get("breakdownSource", "none")
            breakdown_player_number = game_info.get("breakdownPlayerNumber")

            for player in players_in_game:
                name = player.get("name")
                if not name: continue

                # Инициализация очков для этой игры
                if name not in game_points: game_points[name] = {}

                # 1. Расчет best_move_bonus и cb_bonus (полностью с нуля)
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
                    black_in_bm = {p_num for p_num in best_move_numbers if player_roles.get(p_num) in ["мафия", "дон"]}
                    count_black = len(black_in_bm)
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
                        black_in_bm = {p_num for p_num in best_move_numbers if player_roles.get(p_num) in ["мафия", "дон"]}
                        count_black = len(black_in_bm)
                        if count_black == 2: best_move_bonus = 0.5
                        elif count_black == 3: best_move_bonus = 1.0

                # 2. Расчет Ci бонуса
                ci_bonus = 0
                if cb_bonus == 0 and best_move_string and role in ["мирный", "шериф"]:
                    best_move_numbers = parse_best_move(best_move_string)
                    found_black = any(player_roles.get(num) in ["мафия", "дон"] for num in best_move_numbers)
                    
                    x_before = player_x_counts.get(name, 0)
                    current_x = x_before
                    if found_black:
                        current_x += 1
                        player_x_counts[name] = current_x # Обновляем счетчик для следующих игр
                    
                    total_n = total_player_games.get(name)
                    if current_x > 0 and total_n and total_n > 0:
                        k = max(0, current_x - (total_n / 10.0))
                        if k > 0:
                            ci_bonus = (k * (k + 1)) / math.sqrt(total_n)

                # 3. Сборка всех компонентов
                team_win_bonus = 2.5 if role in winning_roles else 0
                base_sum = player.get("plus", 0) + best_move_bonus + cb_bonus + team_win_bonus
                
                penalties = dynamic_penalties.get(name, {}).get(game.gameId, {})
                jk_penalty = penalties.get("jk_penalty", 0)
                sk_penalty = penalties.get("sk_penalty", 0)

                final_points = base_sum + ci_bonus - jk_penalty - sk_penalty
                game_points[name][game.gameId] = round(final_points, 2)

        except (json.JSONDecodeError, TypeError):
            continue
            
    return game_points