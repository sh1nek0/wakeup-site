import json
from transliterate import translit
from sqlalchemy.orm import Session
from db.models import User, Game

def levenshtein_distance(s1, s2):
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

def convert_layout(text: str) -> str:
    eng_chars = "`qwertyuiop[]asdfghjkl;'\\zxcvbnm,./~QWERTYUIOP{}ASDFGHJKL:\"|ZXCVBNM<>?"
    rus_chars = "ёйцукенгшщзхъфывапролджэ\\ячсмитьбю.ЁЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭ/ЯЧСМИТЬБЮ,"
    translation_map = str.maketrans(eng_chars + rus_chars, rus_chars + eng_chars)
    return text.translate(translation_map)

def normalize_for_search(text: str) -> str:
    try:
        return translit(text, 'ru', reversed=True).lower()
    except Exception:
        return text.lower()

def get_all_player_names(db: Session):
    names = set()
    users = db.query(User.nickname).all()
    for user in users:
        names.add(user.nickname)

    games = db.query(Game.data).all()
    for game in games:
        try:
            game_data = json.loads(game.data)
            for player in game_data.get("players", []):
                if player.get("name"):
                    names.add(player["name"])
        except (json.JSONDecodeError, TypeError):
            continue
    
    return sorted(list(names), key=str.lower)

def get_player_suggestions_logic(query: str, db: Session):
    if not query:
        return []

    all_names = get_all_player_names(db)
    
    query_lower = query.lower()
    query_converted = convert_layout(query_lower)
    query_normalized = normalize_for_search(query)

    suggestions = []
    for name in all_names:
        name_lower = name.lower()
        name_normalized = normalize_for_search(name)

        if name_lower.startswith(query_lower):
            suggestions.append({"name": name, "rank": 0})
            continue
        
        if name_normalized.startswith(query_normalized):
            suggestions.append({"name": name, "rank": 0.5})
            continue

        if name_lower.startswith(query_converted):
            suggestions.append({"name": name, "rank": 1})
            continue

        distance = levenshtein_distance(name_lower, query_lower)
        if distance <= 2:
            suggestions.append({"name": name, "rank": 2 + distance})
            continue
        
        distance_normalized = levenshtein_distance(name_normalized, query_normalized)
        if distance_normalized <= 2:
            suggestions.append({"name": name, "rank": 3 + distance_normalized})
            continue
            
        distance_converted = levenshtein_distance(name_lower, query_converted)
        if distance_converted <= 2:
            suggestions.append({"name": name, "rank": 4 + distance_converted})
            continue
        
        if query_lower in name_lower:
            suggestions.append({"name": name, "rank": 5})
            continue

    unique_suggestions = {}
    for s in suggestions:
        if s["name"] not in unique_suggestions or s["rank"] < unique_suggestions[s["name"]]["rank"]:
            unique_suggestions[s["name"]] = s
    
    sorted_suggestions = sorted(unique_suggestions.values(), key=lambda x: x["rank"])
    return [s["name"] for s in sorted_suggestions[:10]]