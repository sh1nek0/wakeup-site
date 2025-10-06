import os
from dotenv import load_dotenv

load_dotenv()

import re

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, String, Text, DateTime, Integer, Float, ForeignKey
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

import uvicorn
from transliterate import translit

import json
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        nickname: str = payload.get("sub")
        if nickname is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    db = SessionLocal()
    user = db.query(User).filter(User.nickname == nickname).first()
    db.close()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# Настройка базы данных (SQLite для примера; замените на вашу БД, если нужно)
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Устанавливаем значение по умолчанию, если переменная не найдена
    DATABASE_URL = "sqlite:///data/database.db" 
    
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Настройки для JWT и паролей
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("Необходимо установить переменную окружения SECRET_KEY")

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Вспомогательные функции для паролей (перемещены выше, чтобы избежать ошибки)
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# Модель таблицы User (добавлены club, update_ai и avatar)
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    nickname = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="user")  # Поле роли с дефолтным значением "user"
    club = Column(String, nullable=True)  # Новое поле для клуба (WakeUp | MIET, etc.)
    update_ai = Column(DateTime, nullable=True, default=None)  # Новое поле для даты обновления AI
    avatar = Column(String, nullable=True)  # Новое поле для аватара

# Модель таблицы Game (без изменений)
class Game(Base):
    __tablename__ = "games"

    gameId = Column(String, primary_key=True, index=True)  # gameId как первичный ключ
    data = Column(Text)  # JSON с полными данными (players, fouls, gameInfo, badgeColor)
    event_id = Column(String, index=True)  # Столбец для привязки к событиям (как строка)
    created_at = Column(DateTime, default=datetime.utcnow)

# Новая модель для событий (турниров)
class Event(Base):
    __tablename__ = "events"
    
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    dates = Column(String, nullable=False)  # Даты как строка (например, "22.11.2025 – 23.11.2025")
    location = Column(String, nullable=False)
    type = Column(String, nullable=False)  # "solo" | "pair" | "team"
    participants_limit = Column(Integer, nullable=False)
    participants_count = Column(Integer, default=0)  # Можно вычислять динамически
    fee = Column(Float, nullable=False)
    currency = Column(String, default="₽")
    gs_name = Column(String, nullable=False)
    gs_role = Column(String, default="ГС турнира")
    gs_avatar = Column(String, nullable=True)  # URL или путь к аватару
    org_name = Column(String, nullable=False)
    org_role = Column(String, default="Организатор")
    org_avatar = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Новая модель для команд
class Team(Base):
    __tablename__ = "teams"

    id = Column(String, primary_key=True, index=True)  # Уникальный ID команды
    event_id = Column(String, ForeignKey("events.id"), nullable=False)
    name = Column(String, nullable=False)
    members = Column(Text, nullable=False)  # JSON-строка с массивом ID участников (например, "[1,2,3]")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связь с Event (опционально, для удобства)
    event = relationship("Event", backref="teams")

# Создание таблиц (запустите один раз; при изменении модели может потребоваться миграция)
Base.metadata.create_all(bind=engine)

# Тестовые данные: вставка демо-данных, если они не существуют
db = SessionLocal()
try:
    # Проверить, есть ли уже данные
    if db.query(Event).count() == 0:
        # Демо-событие
        demo_event = Event(
            id="2",
            title="Cyber Couple Cup",
            dates="22.11.2025 – 23.11.2025",
            location="Физтех, Долгопрудный, ул. Институтская 9",
            type="pair",
            participants_limit=40,
            participants_count=15,  # Обновить на основе участников
            fee=1700,
            currency="₽",
            gs_name="Антон Третьяков",
            gs_role="ГС турнира",
            gs_avatar="",
            org_name="Долматович Ростислав",
            org_role="Организатор",
            org_avatar=""
        )
        db.add(demo_event)

    if db.query(User).count() <=10:
        # Демо-участники
        demo_users = [
            User(email="alfa@example.com", nickname="Alfa", hashed_password=get_password_hash("password"), club="Polar Cats", avatar=""),
            User(email="bravo@example.com", nickname="Bravo", hashed_password=get_password_hash("password"), club="North Lights", avatar=""),
            User(email="charlie@example.com", nickname="Charlie", hashed_password=get_password_hash("password"), club="Aurora", avatar=""),
            User(email="delta@example.com", nickname="Delta", hashed_password=get_password_hash("password"), club="Polar Cats", avatar=""),
            User(email="echo@example.com", nickname="Echo", hashed_password=get_password_hash("password"), club="Aurora", avatar=""),
            User(email="alfa2@example.com", nickname="Alfa2", hashed_password=get_password_hash("password"), club="Polar Cats", avatar=""),
            User(email="bravo2@example.com", nickname="Bravo2", hashed_password=get_password_hash("password"), club="North Lights", avatar=""),
            User(email="charlie2@example.com", nickname="Charlie2", hashed_password=get_password_hash("password"), club="Aurora", avatar=""),
            User(email="delta2@example.com", nickname="Delta2", hashed_password=get_password_hash("password"), club="Polar Cats", avatar=""),
            User(email="echo2@example.com", nickname="Echo2", hashed_password=get_password_hash("password"), club="Aurora", avatar=""),
            User(email="alfa3@example.com", nickname="Alfa3", hashed_password=get_password_hash("password"), club="Polar Cats", avatar=""),
            User(email="bravo3@example.com", nickname="Bravo3", hashed_password=get_password_hash("password"), club="North Lights", avatar=""),
            User(email="charlie3@example.com", nickname="Charlie3", hashed_password=get_password_hash("password"), club="Aurora", avatar=""),
            User(email="delta3@example.com", nickname="Delta3", hashed_password=get_password_hash("password"), club="Polar Cats", avatar=""),
            User(email="echo3@example.com", nickname="Echo3", hashed_password=get_password_hash("password"), club="Aurora", avatar=""),
        ]
        for user in demo_users:
            db.add(user)

    if db.query(Team).count() == 0:
        # Демо-команды (пары, поскольку type="pair") — добавлены уникальные id
        demo_teams = [
            Team(id="team_1", event_id="2", name="FrostBite", members=json.dumps([1, 2])),  # Alfa и Bravo
            Team(id="team_2", event_id="2", name="IceStorm", members=json.dumps([3, 4])),  # Charlie и Delta
            Team(id="team_3", event_id="2", name="SnowWolf", members=json.dumps([5, 6])),  # Echo и Alfa2
        ]
        for team in demo_teams:
            db.add(team)
    db.commit()
    print("Тестовые данные добавлены")
except Exception as e:
    db.rollback()
    print(f"Ошибка добавления тестовых данных: {str(e)}")
finally:
    db.close()

db = SessionLocal()
try:
    first_user = db.query(User).first()
    if first_user and first_user.role != "admin":
        first_user.role = "admin"
        db.commit()
        print("Роль первого пользователя обновлена на 'admin'")
except Exception as e:
    print(f"Ошибка при обновлении роли первого пользователя: {str(e)}")
finally:
    db.close()

class SaveGameData(BaseModel):
    gameId: str = Field(..., description="Идентификатор игры (теперь первичный ключ)")
    players: list[dict] = Field(...,
                                description="Список игроков (с полями role, plus и т.д.; поле sum добавляется автоматически)")
    fouls: list[dict] = Field(..., description="Список фолов")
    gameInfo: dict = Field(..., description="Информация по игре")
    badgeColor: str = Field(..., description="Цвет бейджа")
    eventId: str = Field(..., description="ID события для привязки (как строка)")

# Новая Pydantic модель для удаления игры (с проверкой админа)
class DeleteGameRequest(BaseModel):
    admin_nickname: str = Field(..., description="Никнейм админа для аутентификации")
    admin_password: str = Field(..., description="Пароль админа для аутентификации")

# Pydantic модели для пользователей (добавлено club в UserCreate)
class UserCreate(BaseModel):
    email: str
    nickname: str
    password: str
    club: str  # Новое поле для клуба (опциональное; сделайте str, если обязательное)

class UserLogin(BaseModel):
    nickname: str
    password: str

# Новая Pydantic модель для запроса на повышение пользователя до админа
class PromoteAdminRequest(BaseModel):
    admin_nickname: str = Field(..., description="Никнейм админа для аутентификации")
    admin_password: str = Field(..., description="Пароль админа для аутентификации")
    target_email: str = Field(..., description="Email пользователя, которого нужно сделать админом")
    target_nickname: str = Field(..., description="Никнейм пользователя, которого нужно сделать админом")

class CreateTeamRequest(BaseModel):
    event_id: str = Field(..., description="ID события")
    name: str = Field(..., description="Название команды/пары")
    members: list[int] = Field(..., description="Список ID участников")

# Вспомогательные функции для JWT (без изменений)
def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# FastAPI приложение (без изменений)
app = FastAPI()

# CORS middleware для разрешения запросов с React (localhost:3000) (без изменений)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешить запросы с вашего React-сервера
    allow_credentials=True,
    allow_methods=["*"],  # Разрешить все методы (GET, POST и т.д.)
    allow_headers=["*"],  # Разрешить все заголовки
)


# --- НОВЫЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПОИСКА ---
# Кэш для хранения всех имен игроков
all_player_names_cache = None

def get_all_player_names(db: SessionLocal):
    """Получает и кэширует уникальные имена игроков из таблиц User и Game."""
    global all_player_names_cache
    if all_player_names_cache is not None:
        return all_player_names_cache

    names = set()
    # 1. Зарегистрированные пользователи
    users = db.query(User.nickname).all()
    for user in users:
        names.add(user.nickname)

    # 2. Игроки из старых игр
    games = db.query(Game.data).all()
    for game in games:
        try:
            game_data = json.loads(game.data)
            for player in game_data.get("players", []):
                if player.get("name"):
                    names.add(player["name"])
        except (json.JSONDecodeError, TypeError):
            continue
    
    all_player_names_cache = sorted(list(names), key=str.lower)
    return all_player_names_cache

def levenshtein_distance(s1, s2):
    """Вычисляет расстояние Левенштейна между двумя строками."""
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
    """Конвертирует текст между русской и английской раскладками, включая оба регистра."""
    eng_chars = "`qwertyuiop[]asdfghjkl;'\\zxcvbnm,./~QWERTYUIOP{}ASDFGHJKL:\"|ZXCVBNM<>?"
    rus_chars = "ёйцукенгшщзхъфывапролджэ\\ячсмитьбю.ЁЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭ/ЯЧСМИТЬБЮ,"
    
    # Создаем единый словарь для перевода в обе стороны
    translation_map = str.maketrans(eng_chars + rus_chars, rus_chars + eng_chars)
    
    return text.translate(translation_map)


def normalize_for_search(text: str) -> str:
    """Нормализует строку для поиска: транслитерирует в латиницу и приводит к нижнему регистру."""
    try:
        # reversed=True означает транслитерацию с кириллицы на латиницу.
        # Функция корректно обрабатывает уже латинские строки, не изменяя их.
        return translit(text, 'ru', reversed=True).lower()
    except Exception:
        # Запасной вариант на случай ошибки в библиотеке
        return text.lower()

@app.get("/get_player_suggestions")
async def get_player_suggestions(query: str):
    if not query:
        return []

    db = SessionLocal()
    try:
        all_names = get_all_player_names(db)
    finally:
        db.close()

    query_lower = query.lower()
    query_converted = convert_layout(query_lower)
    query_normalized = normalize_for_search(query)

    suggestions = []
    for name in all_names:
        name_lower = name.lower()
        name_normalized = normalize_for_search(name)

        # Ранк 0: Прямое совпадение в начале строки (самый высокий приоритет)
        if name_lower.startswith(query_lower):
            suggestions.append({"name": name, "rank": 0})
            continue
        
        # Ранк 0.5: Совпадение по транслитерации в начале строки
        if name_normalized.startswith(query_normalized):
            suggestions.append({"name": name, "rank": 0.5})
            continue

        # Ранк 1: Совпадение с конвертированной раскладкой
        if name_lower.startswith(query_converted):
            suggestions.append({"name": name, "rank": 1})
            continue

        # Ранк 2: Поиск по опечаткам (расстояние Левенштейна)
        distance = levenshtein_distance(name_lower, query_lower)
        if distance <= 2: # Допускаем 1-2 опечатки
            suggestions.append({"name": name, "rank": 2 + distance})
            continue
        
        # Ранк 3: Поиск по опечаткам в транслитерированном виде
        distance_normalized = levenshtein_distance(name_normalized, query_normalized)
        if distance_normalized <= 2:
            suggestions.append({"name": name, "rank": 3 + distance_normalized})
            continue
            
        # Ранк 4: Поиск по опечаткам в конвертированной раскладке
        distance_converted = levenshtein_distance(name_lower, query_converted)
        if distance_converted <= 2:
            suggestions.append({"name": name, "rank": 4 + distance_converted})
            continue

    # Убираем дубликаты, оставляя только вариант с лучшим (наименьшим) рангом
    unique_suggestions = {}
    for s in suggestions:
        if s["name"] not in unique_suggestions or s["rank"] < unique_suggestions[s["name"]]["rank"]:
            unique_suggestions[s["name"]] = s
    
    # Сортируем по рангу и берем топ-10
    sorted_suggestions = sorted(unique_suggestions.values(), key=lambda x: x["rank"])
    return [s["name"] for s in sorted_suggestions[:10]]



# Эндпоинт для регистрации (обновлён: добавлена обработка club и update_ai)
@app.post("/register")
async def register(user: UserCreate):
    db = SessionLocal()
    try:
        # Валидация клуба (если предоставлен)
        valid_clubs = ["WakeUp | MIET", "WakeUp | MIPT", "Другой"]
        if user.club and user.club not in valid_clubs:
            raise HTTPException(status_code=400, detail="Недопустимое значение клуба")

        existing_user = db.query(User).filter(
            (User.email == user.email) | (User.nickname == user.nickname)
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Пользователь с таким email или nickname уже существует")

        hashed_password = get_password_hash(user.password)
        new_user = User(
            email=user.email,
            nickname=user.nickname,
            hashed_password=hashed_password,
            role="user",
            club=user.club,  # Новое поле
            update_ai=datetime.utcnow()  # Новое поле: текущая дата
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        access_token = create_access_token(
            data={"sub": new_user.nickname, "role": new_user.role},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        user_data = {
            "nickname": new_user.nickname,
            "role": new_user.role,
            # Если есть поле avatarUrl в модели User, раскомментируйте:
            # "avatarUrl": getattr(db_user, "avatarUrl", None),
        }

        return {
            "message": "Вход выполнен успешно",
            "token": access_token,
            "user": user_data
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {str(e)}")
    finally:
        db.close()

# Эндпоинт для входа (без изменений)
@app.post("/login")
async def login(user: UserLogin):
    db = SessionLocal()
    try:
        db_user = db.query(User).filter(User.nickname == user.nickname).first()
        if not db_user or not verify_password(user.password, db_user.hashed_password):
            raise HTTPException(status_code=400, detail="Неверный nickname или пароль")

        access_token = create_access_token(
            data={"sub": db_user.nickname, "role": db_user.role, "id": db_user.id},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )

        user_data = {
            "nickname": db_user.nickname,
            "role": db_user.role,
            "id": db_user.id
            # Если есть поле avatarUrl в модели User, раскомментируйте:
            # "avatarUrl": getattr(db_user, "avatarUrl", None),
        }

        return {
            "message": "Вход выполнен успешно",
            "token": access_token,
            "user": user_data
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {str(e)}")
    finally:
        db.close()

# Новый эндпоинт для повышения пользователя до админа (только админы могут использовать)
@app.post("/promote_admin")
async def promote_admin(request: PromoteAdminRequest, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия (требуется роль admin)")

        # Найти целевого пользователя по email и nickname
        target_user = db.query(User).filter(
            (User.email == request.target_email) & (User.nickname == request.target_nickname)
        ).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Пользователь с таким email и nickname не найден")

        # Обновить роль целевого пользователя на "admin"
        target_user.role = "admin"
        db.commit()

        return {"message": f"Пользователь {target_user.nickname} успешно повышен до админа"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {str(e)}")
    finally:
        db.close()

# Получить список пользователей (с опциональным фильтром по event_id)
@app.get("/getUsers")
async def get_users(event_id: str = None):
    db = SessionLocal()
    try:
        if event_id is None or event_id == "1":
            users = db.query(User).all()
        else:
            games = db.query(Game).filter(Game.event_id == event_id).all()
            nicknames = set()
            for game in games:
                game_data = json.loads(game.data)
                players = game_data.get("players", [])
                for player in players:
                    name = player.get("name", "")
                    if name:
                        nicknames.add(name)
            users = db.query(User).filter(User.nickname.in_(nicknames)).all()

        users_list = [
            {
                "id": user.id,
                "email": user.email,
                "nickname": user.nickname,
                "role": user.role,
                "club": user.club  # Новое поле в ответе
            }
            for user in users
        ]

        return {"users": users_list}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения пользователей: {str(e)}")
    finally:
        db.close()

# Новый эндпоинт для получения информации по событию
@app.get("/getEvent/{event_id}")
async def get_event(event_id: str):
    db = SessionLocal()
    try:
        # Получить событие по ID
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")

        # Получить участников (всех User, или можно добавить связь с событием, если нужно фильтровать)
        participants = db.query(User).all()
        participants_list = [
            {
                "id": p.id,
                "nick": p.nickname,
                "avatar": p.avatar or "",
                "club": p.club
            }
            for p in participants
        ]

        # Получить команды для этого события
        teams = db.query(Team).filter(Team.event_id == event_id).all()
        teams_list = []
        for t in teams:
            members_ids = json.loads(t.members)  # Парсим JSON-строку в список ID
            members = [
                {"id": mid, "nick": db.query(User).filter(User.id == mid).first().nickname if db.query(User).filter(User.id == mid).first() else "Неизвестный"}
                for mid in members_ids
            ]
            teams_list.append({
                "id": t.id,
                "name": t.name,
                "members": members
            })

        # Сформировать ответ в формате, ожидаемом фронтендом
        event_data = {
            "title": event.title,
            "dates": event.dates,
            "location": event.location,
            "type": event.type,
            "participantsLimit": event.participants_limit,
            "participantsCount": event.participants_count,
            "fee": event.fee,
            "currency": event.currency,
            "gs": {
                "name": event.gs_name,
                "role": event.gs_role,
                "avatar": event.gs_avatar
            },
            "org": {
                "name": event.org_name,
                "role": event.org_role,
                "avatar": event.org_avatar
            },
            "participants": participants_list,
            "teams": teams_list
        }

        return event_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения данных события: {str(e)}")
    finally:
        db.close()



# Вспомогательная функция для парсинга "Лучшего хода"
def parse_best_move(best_move_string: str) -> list[int]:
    if not best_move_string:
        return []

    numbers = []
    
    # Шаг 1: Сначала извлекаем все "10", чтобы избежать путаницы с "1" и "0"
    tens = re.findall(r'10', best_move_string)
    numbers.extend([10] * len(tens))
    
    # Удаляем "10" из строки, чтобы они не мешали поиску одиночных цифр
    remaining_string = best_move_string.replace('10', '')
    
    # Шаг 2: Извлекаем все остальные цифры от 1 до 9
    single_digits = re.findall(r'[1-9]', remaining_string)
    numbers.extend([int(d) for d in single_digits])
    
    return numbers


@app.post("/saveGameData")
async def save_game_data(data: SaveGameData, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия (требуется роль admin)")

        player_roles = {player.get("id"): player.get("role", "").lower() for player in data.players}

        if data.badgeColor == "red":
            winning_roles = ["мирный", "шериф"]
        elif data.badgeColor == "black":
            winning_roles = ["мафия", "дон"]
        else:
            winning_roles = []

        for player in data.players:
            plus = player.get("plus", 0)
            role = player.get("role", "").lower()
            best_move_string = player.get("best_move", "")
            
            # Штрафы за карточки (без сохранения в 'minus')
            jk = player.get("jk", 0)
            sk = player.get("sk", 0)
            
            # Рассчитываем бонус за лучший ход
            best_move_bonus = 0
            if role not in ["мафия", "дон"] and best_move_string:
                best_move_numbers = parse_best_move(best_move_string)
                black_players_in_best_move = set()
                for player_num in best_move_numbers:
                    if player_num in player_roles and player_roles[player_num] in ["мафия", "дон"]:
                        black_players_in_best_move.add(player_num)
                
                count_black = len(black_players_in_best_move)
                if count_black == 3:
                    best_move_bonus = 1.0
                elif count_black == 2:
                    best_move_bonus = 0.5
            
            player["best_move_bonus"] = best_move_bonus

            # Рассчитываем бонус за победу
            team_win_bonus = 2.5 if role in winning_roles else 0
            
            # Инициализируем ci_bonus, если его нет
            if "ci_bonus" not in player:
                player["ci_bonus"] = 0

            # Итоговая сумма (без динамических штрафов и Ci)
            sum_points = plus + best_move_bonus + team_win_bonus
            player["sum"] = sum_points

        game_json = json.dumps({
            "players": data.players,
            "fouls": data.fouls,
            "gameInfo": data.gameInfo,
            "badgeColor": data.badgeColor
        }, ensure_ascii=False)

        existing_game = db.query(Game).filter(Game.gameId == data.gameId).first()
        if existing_game:
            existing_game.data = game_json
            existing_game.event_id = data.eventId
        else:
            new_game = Game(
                gameId=data.gameId,
                data=game_json,
                event_id=data.eventId
            )
            db.add(new_game)
        db.commit()
        return {"message": "Данные игры сохранены успешно"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения игры: {str(e)}")
    finally:
        db.close()

# Эндпоинт для получения данных игры (без изменений)
@app.get("/getGameData/{gameId}")
async def get_game_data(gameId: str):
    db = SessionLocal()
    try:
        game = db.query(Game).filter(Game.gameId == gameId).first()
        if not game:
            raise HTTPException(status_code=404, detail="Игра не найдена")

        game_data = json.loads(game.data)
        return game_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения данных игры: {str(e)}")
    finally:
        db.close()

# НОВЫЙ ЭНДПОИНТ для проверки существования игры
@app.get("/checkGameExists/{gameId}")
async def check_game_exists(gameId: str):
    db = SessionLocal()
    try:
        game = db.query(Game).filter(Game.gameId == gameId).first()
        return {"exists": game is not None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка проверки игры: {str(e)}")
    finally:
        db.close()

# Новый эндпоинт для удаления игры (только админы могут использовать, с JWT)
@app.delete("/deleteGame/{gameId}")
async def delete_game(gameId: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия (требуется роль admin)")

        # Найти игру по gameId
        game = db.query(Game).filter(Game.gameId == gameId).first()
        if not game:
            raise HTTPException(status_code=404, detail="Игра не найдена")

        # Удалить игру
        db.delete(game)
        db.commit()

        return {"message": f"Игра с ID {gameId} успешно удалена"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка удаления игры: {str(e)}")
    finally:
        db.close()

@app.get("/getGames")
async def get_games(limit: int = 10, offset: int = 0, event_id: str = Query(None, description="ID события для фильтрации")):
    db = SessionLocal()
    try:
        base_query = db.query(Game)
        if event_id and event_id != 'all':
            base_query = base_query.filter(Game.event_id == event_id)

        all_games_for_calc = base_query.order_by(Game.created_at.asc()).all()
        ci_bonuses = calculate_ci_bonuses(all_games_for_calc)
        dynamic_penalties = calculate_dynamic_penalties(all_games_for_calc)

        total_count = base_query.count()
        paginated_games = base_query.order_by(Game.created_at.desc()).offset(offset).limit(limit).all()
        
        games_list = []
        for game in paginated_games:
            data = json.loads(game.data)
            players = data.get("players", [])
            
            processed_players = []
            for p in players:
                name = p.get("name")
                base_sum = p.get("sum", 0)
                
                ci_bonus = ci_bonuses.get(name, {}).get(game.gameId, 0)
                penalties = dynamic_penalties.get(name, {}).get(game.gameId, {})
                jk_penalty = penalties.get('jk_penalty', 0)
                sk_penalty = penalties.get('sk_penalty', 0)
                
                final_points = base_sum + ci_bonus - jk_penalty - sk_penalty

                processed_players.append({
                    "name": name,
                    "role": p.get("role", ""),
                    "points": final_points
                })

            games_list.append({
                "id": game.gameId,
                "date": game.created_at.strftime("%d.%m.%Y %H:%M"),
                "badgeColor": data.get("badgeColor", ""),
                "event_id": game.event_id,
                "players": processed_players
            })

        return {"games": games_list, "total_count": total_count}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения списка игр: {str(e)}")
    finally:
        db.close()

def calculate_ci_bonuses(games: list[Game]) -> dict:
    ci_bonuses = {}
    player_x_counts = {}
    n = 0

    sorted_games = sorted(games, key=lambda g: g.created_at)

    for game in sorted_games:
        n += 1
        game_data = json.loads(game.data)
        players_in_game = game_data.get("players", [])
        player_roles = {p.get("id"): p.get("role", "").lower() for p in players_in_game}

        eliminated_player = next((p for p in players_in_game if p.get("best_move")), None)
        if not eliminated_player:
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
        if current_x > 0:
            k = max(0, current_x - (n // 10))
            if k > 0:
                ci_bonus = 0.5 * (k * (k + 1) / 2)
                if player_name not in ci_bonuses:
                    ci_bonuses[player_name] = {}
                ci_bonuses[player_name][game.gameId] = ci_bonus
    return ci_bonuses

def calculate_dynamic_penalties(games: list[Game]) -> dict:
    penalties = {}
    player_jk_counts = {}

    sorted_games = sorted(games, key=lambda g: g.created_at)

    for game in sorted_games:
        game_data = json.loads(game.data)
        players_in_game = game_data.get("players", [])

        for player in players_in_game:
            name = player.get("name")
            if not name:
                continue

            # SK penalty is static
            sk_penalty = player.get("sk", 0) * 0.5
            
            # JK penalty is dynamic
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
    return penalties


@app.get("/getRating")
async def get_rating(limit: int = Query(10, description="Количество элементов на странице"),
                     offset: int = Query(0, description="Смещение для пагинации"),
                     event_id: str = Query(None, description="ID события для фильтрации")):
    db = SessionLocal()
    try:
        games_query = db.query(Game)
        if event_id and event_id != 'all':
            games_query = games_query.filter(Game.event_id == event_id)
        
        games = games_query.order_by(Game.created_at.asc()).all()

        ci_bonuses = calculate_ci_bonuses(games)
        dynamic_penalties = calculate_dynamic_penalties(games)

        all_players = db.query(User).all()
        player_names = {p.nickname for p in all_players}
        clubs = {p.nickname: p.club for p in all_players}

        player_stats = {}
        for game in games:
            game_data = json.loads(game.data)
            players = game_data.get("players", [])

            for player in players:
                name = player.get("name")
                if not name or not name.strip():
                    continue
                
                base_sum = player.get("sum", 0)
                ci_bonus = ci_bonuses.get(name, {}).get(game.gameId, 0)
                penalties = dynamic_penalties.get(name, {}).get(game.gameId, {})
                jk_penalty = penalties.get('jk_penalty', 0)
                sk_penalty = penalties.get('sk_penalty', 0)

                final_points = base_sum + ci_bonus - jk_penalty - sk_penalty

                if name not in player_stats:
                    player_stats[name] = {"games": 0, "total_sum": 0}
                
                player_stats[name]["games"] += 1
                player_stats[name]["total_sum"] += final_points

        for name in player_names:
            if name not in player_stats:
                player_stats[name] = {"games": 0, "total_sum": 0}

        rating = [
            {
                "name": name,
                "games": stats["games"],
                "points": stats["total_sum"],
                "club": clubs.get(name, None)
            }
            for name, stats in player_stats.items()
        ]
        rating.sort(key=lambda x: x["points"], reverse=True)

        total_count = len(rating)
        paginated_rating = rating[offset:offset + limit]

        return {"players": paginated_rating, "total_count": total_count}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения рейтинга: {str(e)}")
    finally:
        db.close()

@app.get("/getDetailedStats")
async def get_detailed_stats(
    limit: int = Query(10, description="Количество игроков на странице"),
    offset: int = Query(0, description="Смещение для пагинации игроков"),
    event_id: str = Query(None, description="ID события для фильтрации")
):
    db = SessionLocal()
    try:
        all_players = db.query(User).all()
        player_names = {p.nickname for p in all_players}
        clubs = {p.nickname: p.club for p in all_players}
        
        games_query = db.query(Game)
        if event_id and event_id != 'all':
            games_query = games_query.filter(Game.event_id == event_id)
        
        games = games_query.order_by(Game.created_at.asc()).all()
        
        ci_bonuses = calculate_ci_bonuses(games)
        dynamic_penalties = calculate_dynamic_penalties(games)
        
        player_stats = {}

        for game in games:
            game_data = json.loads(game.data)
            badge_color = game_data.get("badgeColor", "")
            players = game_data.get("players", [])

            for player in players:
                name = player.get("name")
                if not name or not name.strip():
                    continue
                
                role = player.get("role", "").lower()
                plus = player.get("plus", 0)
                base_sum = player.get("sum", 0)
                best_move_bonus = player.get("best_move_bonus", 0)
                
                ci_bonus = ci_bonuses.get(name, {}).get(game.gameId, 0)
                penalties = dynamic_penalties.get(name, {}).get(game.gameId, {})
                jk_penalty = penalties.get('jk_penalty', 0)
                sk_penalty = penalties.get('sk_penalty', 0)
                
                final_points = base_sum + ci_bonus - jk_penalty - sk_penalty

                if name not in player_stats:
                    player_stats[name] = {
                        "totalPoints": 0, "bonuses": 0, "total_jk_penalty": 0, "total_sk_penalty": 0,
                        "wins": {"sheriff": 0, "citizen": 0, "mafia": 0, "don": 0},
                        "gamesPlayed": {"sheriff": 0, "citizen": 0, "mafia": 0, "don": 0},
                        "role_plus": {"sheriff": [], "citizen": [], "mafia": [], "don": []},
                        "total_jk": 0, "total_sk": 0,
                        "successful_best_moves": 0, "total_best_move_bonus": 0, "total_ci_bonus": 0
                    }

                stats = player_stats[name]
                stats["totalPoints"] += final_points
                stats["bonuses"] += plus
                stats["total_jk_penalty"] += jk_penalty
                stats["total_sk_penalty"] += sk_penalty
                stats["total_jk"] += player.get("jk", 0)
                stats["total_sk"] += player.get("sk", 0)
                stats["total_best_move_bonus"] += best_move_bonus
                stats["total_ci_bonus"] += ci_bonus
                if best_move_bonus > 0:
                    stats["successful_best_moves"] += 1

                role_map = {"мирный": "citizen", "шериф": "sheriff", "мафия": "mafia", "дон": "don"}
                mapped_role = role_map.get(role)

                if mapped_role:
                    stats["gamesPlayed"][mapped_role] += 1
                    stats["role_plus"][mapped_role].append(plus)
                    
                    is_win = (badge_color == "red" and mapped_role in ["citizen", "sheriff"]) or \
                             (badge_color == "black" and mapped_role in ["mafia", "don"])
                    
                    if is_win:
                        stats["wins"][mapped_role] += 1

        for name in player_names:
            if name not in player_stats:
                 player_stats[name] = {
                    "totalPoints": 0, "bonuses": 0, "total_jk_penalty": 0, "total_sk_penalty": 0,
                    "wins": {"sheriff": 0, "citizen": 0, "mafia": 0, "don": 0},
                    "gamesPlayed": {"sheriff": 0, "citizen": 0, "mafia": 0, "don": 0},
                    "role_plus": {"sheriff": [], "citizen": [], "mafia": [], "don": []},
                    "total_jk": 0, "total_sk": 0,
                    "successful_best_moves": 0, "total_best_move_bonus": 0, "total_ci_bonus": 0
                }

        players_list = [{"nickname": name, "club": clubs.get(name, None), **stats} for name, stats in player_stats.items()]
        players_list.sort(key=lambda x: x["totalPoints"], reverse=True)

        total_count = len(players_list)
        paginated_players = players_list[offset:offset + limit]

        average_points = sum(p["totalPoints"] for p in players_list) / total_count if total_count > 0 else 0

        return {
            "players": paginated_players,
            "total_count": total_count,
            "average_points": average_points
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения детальной статистики: {str(e)}")
    finally:
        db.close()

@app.get("/events")
async def get_events():
    db = SessionLocal()
    try:
        events = db.query(Event).order_by(Event.created_at.desc()).all()
        events_list = [
            {
                "id": event.id,
                "title": event.title,
                "dates": event.dates,
                "location": event.location,
                "type": event.type,
                "participants_limit": event.participants_limit,
                "participants_count": event.participants_count,
            }
            for event in events
        ]
        return {"events": events_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения событий: {str(e)}")
    finally:
        db.close()

@app.post("/createTeam")
async def create_team(request: CreateTeamRequest, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        # Проверить существование события
        event = db.query(Event).filter(Event.id == request.event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")

        # Определить размер команды
        team_size = 2 if event.type == "pair" else 5  # Предполагаем 5 для team; можно сделать динамичным
        min_team_size = team_size // 2 if event.type == "team" else team_size  # Минимум половина для team

        # Валидация размера команды
        if event.type == "pair" and len(request.members) != 2:
            raise HTTPException(status_code=400, detail="Для парного турнира требуется ровно 2 участника")
        elif event.type == "team" and not (min_team_size <= len(request.members) <= team_size):
            raise HTTPException(status_code=400, detail=f"Для командного турнира требуется от {min_team_size} до {team_size} участников")
        elif event.type == "solo":
            raise HTTPException(status_code=400, detail="Создание команд не поддерживается для личного турнира")

        # Проверить, что все участники существуют
        members = db.query(User).filter(User.id.in_(request.members)).all()
        if len(members) != len(request.members):
            raise HTTPException(status_code=400, detail="Один или несколько участников не найдены")

        # Проверка прав: если не админ, должен включать себя
        if current_user.role != "admin" and current_user.id not in request.members:
            raise HTTPException(status_code=403, detail="Вы можете создавать команду только с участием себя")

        # Проверить, что участники не в других командах этого события
        existing_teams = db.query(Team).filter(Team.event_id == request.event_id).all()
        assigned_ids = set()
        for t in existing_teams:
            assigned_ids.update(json.loads(t.members))
        if any(mid in assigned_ids for mid in request.members):
            raise HTTPException(status_code=400, detail="Один или несколько участников уже в другой команде")

        # Сгенерировать уникальный ID команды
        import uuid
        team_id = f"team_{uuid.uuid4().hex[:8]}"

        # Создать команду
        new_team = Team(
            id=team_id,
            event_id=request.event_id,
            name=request.name,
            members=json.dumps(request.members)
        )
        db.add(new_team)
        db.commit()

        return {"message": "Команда создана успешно", "team_id": team_id}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка создания команды: {str(e)}")
    finally:
        db.close()

# Новый эндпоинт для удаления команды (только админы)
@app.delete("/deleteTeam/{team_id}")
async def delete_team(team_id: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия (требуется роль admin)")

        # Найти команду
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise HTTPException(status_code=404, detail="Команда не найдена")

        # Удалить команду
        db.delete(team)
        db.commit()

        return {"message": f"Команда {team_id} удалена успешно"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка удаления команды: {str(e)}")
    finally:
        db.close()


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, workers=4)