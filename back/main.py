import os
from dotenv import load_dotenv

load_dotenv()

import re
import uuid
import math
import shutil
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, String, Text, DateTime, Integer, Float, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

import uvicorn
from transliterate import translit

import json
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
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


def get_optional_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if credentials is None:
        return None
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        nickname: str = payload.get("sub")
        if nickname is None:
            return None
        db = SessionLocal()
        user = db.query(User).filter(User.nickname == nickname).first()
        db.close()
        return user
    except JWTError:
        return None


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

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    nickname = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="user")  # Поле роли с дефолтным значением "user"
    club = Column(String, nullable=True)  # Новое поле для клуба (WakeUp | MIET, etc.)
    update_ai = Column(DateTime, nullable=True, default=None)  # Новое поле для даты обновления AI
    avatar = Column(String, nullable=True)  # Новое поле для аватара
    name = Column(String, nullable=True)
    favoriteCard = Column(String, nullable=True)
    vk = Column(String,nullable=True)
    tg = Column(String,nullable=True)
    site1 = Column(String,nullable=True)
    site2 = Column(String,nullable=True)

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
    members = Column(Text, nullable=False)  # JSON-строка с массивом ID участников (например, '["user_abc", "user_xyz"]')
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связь с Event (опционально, для удобства)
    event = relationship("Event", backref="teams")

# --- НОВАЯ МОДЕЛЬ ДЛЯ РЕГИСТРАЦИЙ ---
class Registration(Base):
    __tablename__ = "registrations"

    id = Column(String, primary_key=True, index=True)
    event_id = Column(String, ForeignKey("events.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending, approved, rejected
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    event = relationship("Event")


# Создание таблиц (запустите один раз; при изменении модели может потребоваться миграция)
Base.metadata.create_all(bind=engine)

# Тестовые данные: вставка демо-данных, если они не существуют
db = SessionLocal()
try:
    # --- ИСПРАВЛЕННАЯ ЛОГИКА СОЗДАНИЯ ДЕМО-ДАННЫХ ---
    if db.query(Event).filter(Event.title == "Cyber Couple Cup").first() is None:
        demo_event = Event(
            id=f"event_{uuid.uuid4().hex[:8]}", # Генерируем уникальный ID
            title="Cyber Couple Cup",
            dates="22.11.2025 – 23.11.2025",
            location="Физтех, Долгопрудный, ул. Институтская 9",
            type="pair",
            participants_limit=40,
            participants_count=0,
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
        db.commit()
        print("Демо-событие 'Cyber Couple Cup' добавлено.")

    if db.query(User).count() == 0:
        demo_users_data = [
            {"id": f"user_{uuid.uuid4().hex[:8]}", "email": "alfa@example.com", "nickname": "Alfa", "club": "Polar Cats"},
            {"id": f"user_{uuid.uuid4().hex[:8]}", "email": "bravo@example.com", "nickname": "Bravo", "club": "North Lights"},
            {"id": f"user_{uuid.uuid4().hex[:8]}", "email": "charlie@example.com", "nickname": "Charlie", "club": "Aurora"},
            {"id": f"user_{uuid.uuid4().hex[:8]}", "email": "delta@example.com", "nickname": "Delta", "club": "Polar Cats"},
            {"id": f"user_{uuid.uuid4().hex[:8]}", "email": "echo@example.com", "nickname": "Echo", "club": "Aurora"},
            {"id": f"user_{uuid.uuid4().hex[:8]}", "email": "alfa2@example.com", "nickname": "Alfa2", "club": "Polar Cats"},
        ]
        
        users_to_add = [
            User(
                id=u["id"],
                email=u["email"],
                nickname=u["nickname"],
                hashed_password=get_password_hash("password"),
                club=u["club"],
                avatar=""
            ) for u in demo_users_data
        ]
        db.add_all(users_to_add)
        db.commit()
        print("Демо-пользователи добавлены.")

        # Удаляем старые демо-команды, так как логика участников изменилась
        db.query(Team).delete()
        db.commit()
        print("Старые демо-команды удалены.")

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
    club: str  
    name: str

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
    members: list[str] = Field(..., description="Список ID участников")

# Pydantic модель для обновления профиля
class UpdateProfileRequest(BaseModel):
    userId: str = Field(..., description="ID пользователя для обновления")
    name: str = Field("", description="Имя пользователя")
    club: str = Field("", description="Клуб пользователя")
    favoriteCard: str = Field("", description="Любимая карта")
    vk: str = Field("", description="Ссылка на VK")
    tg: str = Field("", description="Ссылка на Telegram")
    site1: str = Field("", description="Ссылка на сайт 1 (Gomafia)")
    site2: str = Field("", description="Ссылка на сайт 2 (MU)")

# --- НОВАЯ МОДЕЛЬ ДЛЯ УПРАВЛЕНИЯ РЕГИСТРАЦИЕЙ ---
class ManageRegistrationRequest(BaseModel):
    action: str = Field(..., description="Действие: 'approve' или 'reject'")


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

# --- ИСПРАВЛЕННАЯ ЛОГИКА ПОИСКА ---

def get_all_player_names(db: SessionLocal):
    """Получает актуальные имена игроков из таблиц User и Game без кэширования."""
    names = set()
    # 1. Зарегистрированные пользователи
    users = db.query(User.nickname).all()
    for user in users:
        names.add(user.nickname)

    # 2. Игроки из игр
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
        
        # УЛУЧШЕНИЕ: Ранк 5 - поиск вхождения подстроки (самый низкий приоритет)
        if query_lower in name_lower:
            suggestions.append({"name": name, "rank": 5})
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
            id=f"user_{uuid.uuid4().hex[:12]}",
            email=user.email,
            nickname=user.nickname,
            hashed_password=hashed_password,
            role="user",
            name="",
            club=user.club,  # Новое поле
            update_ai=datetime.utcnow(),  # Новое поле: текущая дата
            favoriteCard="",
            vk= "",
            tg= "",
            site1= "",
            site2= ""
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        access_token = create_access_token(
            data={"sub": new_user.nickname, "role": new_user.role, "id": new_user.id},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        user_data = {
            "id": new_user.id,
            "nickname": new_user.nickname,
            "role": new_user.role,
            'name': new_user.name,
            "club": new_user.club,
            "favoriteCard": new_user.favoriteCard,
            "vk": new_user.vk,
            "tg" : new_user.tg,
            "site1" : new_user.site1,
            "site2" : new_user.site2
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
            "id": db_user.id,
            'name': db_user.name,
            "club": db_user.club,
            "favoriteCard": db_user.favoriteCard,
            "vk": db_user.vk,
            "tg" : db_user.tg,
            "site1" : db_user.site1,
            "site2" : db_user.site2
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
            # Получаем ID одобренных участников
            approved_user_ids = db.query(Registration.user_id).filter(
                Registration.event_id == event_id,
                Registration.status == "approved"
            ).all()
            user_ids = [uid for (uid,) in approved_user_ids]
            users = db.query(User).filter(User.id.in_(user_ids)).all()

        users_list = [
            {
                "id": user.id,
                "email": user.email,
                "nickname": user.nickname,
                "role": user.role,
                "club": user.club
            }
            for user in users
        ]

        return {"users": users_list}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения пользователей: {str(e)}")
    finally:
        db.close()


@app.get("/getUser/{user_id}")
async def get_user(user_id: str):
    db = SessionLocal()
    try:
        user_obj = db.query(User).filter(User.id == user_id).first()
        if not user_obj:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        user_data = {
            "nickname": user_obj.nickname,
            "role": user_obj.role,
            "id": user_obj.id,
            "name": user_obj.name,
            "club": user_obj.club,
            "favoriteCard": user_obj.favoriteCard,
            "vk": user_obj.vk,
            "tg": user_obj.tg,
            "site1": user_obj.site1,
            "site2": user_obj.site2
        }
        return {"user": user_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения пользователя: {str(e)}")
    finally:
        db.close()


@app.post("/updateProfile")
async def update_profile(request: UpdateProfileRequest, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
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

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка обновления профиля: {str(e)}")
    finally:
        db.close()


# --- ОБНОВЛЕННЫЙ ЭНДПОИНТ ДЛЯ ПОЛУЧЕНИЯ ИНФОРМАЦИИ ПО СОБЫТИЮ ---
@app.get("/getEvent/{event_id}")
async def get_event(event_id: str, current_user: User = Depends(get_optional_current_user)):
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")

        # Получаем все регистрации для события
        registrations = db.query(Registration).filter(Registration.event_id == event_id).all()

        # 1. Одобренные участники
        approved_regs = [reg for reg in registrations if reg.status == "approved"]
        participants_list = [
            {
                "id": reg.user.id,
                "nick": reg.user.nickname,
                "avatar": reg.user.avatar or "",
                "club": reg.user.club
            }
            for reg in approved_regs
        ]

        # 2. Заявки на рассмотрении (только для админов)
        pending_registrations_list = []
        if current_user and current_user.role == "admin":
            pending_regs = [reg for reg in registrations if reg.status == "pending"]
            pending_registrations_list = [
                {
                    "registration_id": reg.id,
                    "user": {
                        "id": reg.user.id,
                        "nick": reg.user.nickname,
                        "avatar": reg.user.avatar or "",
                        "club": reg.user.club
                    }
                }
                for reg in pending_regs
            ]

        # 3. Статус регистрации для текущего пользователя
        user_registration_status = "none"
        if current_user:
            user_reg = next((reg for reg in registrations if reg.user_id == current_user.id), None)
            if user_reg:
                user_registration_status = user_reg.status # "pending" или "approved"

        # Команды (логика не изменилась, но теперь она основана на одобренных участниках)
        teams = db.query(Team).filter(Team.event_id == event_id).all()
        teams_list = []
        for t in teams:
            members_ids = json.loads(t.members)
            # Проверяем, что все участники команды одобрены
            approved_member_ids = {p["id"] for p in participants_list}
            if all(mid in approved_member_ids for mid in members_ids):
                members = [
                    {"id": mid, "nick": p["nick"]}
                    for mid in members_ids
                    if (p := next((p_data for p_data in participants_list if p_data["id"] == mid), None))
                ]
                teams_list.append({
                    "id": t.id,
                    "name": t.name,
                    "members": members
                })

        event_data = {
            "title": event.title,
            "dates": event.dates,
            "location": event.location,
            "type": event.type,
            "participantsLimit": event.participants_limit,
            "participantsCount": event.participants_count,
            "fee": event.fee,
            "currency": event.currency,
            "gs": {"name": event.gs_name, "role": event.gs_role, "avatar": event.gs_avatar},
            "org": {"name": event.org_name, "role": event.org_role, "avatar": event.org_avatar},
            "participants": participants_list,
            "teams": teams_list,
            "pending_registrations": pending_registrations_list,
            "user_registration_status": user_registration_status
        }

        return event_data

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка получения данных события: {str(e)}")
    finally:
        db.close()


# Вспомогательная функция для парсинга "Лучшего хода"
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

            team_win_bonus = 2.5 if role in winning_roles else 0
            
            if "ci_bonus" not in player:
                player["ci_bonus"] = 0

            sum_points = plus + best_move_bonus + team_win_bonus
            player["sum"] = sum_points
        
        game_info = data.gameInfo
        
        existing_game = db.query(Game).filter(Game.gameId == data.gameId).first()

        if existing_game:
            existing_data = json.loads(existing_game.data)
            existing_judge = existing_data.get("gameInfo", {}).get("judgeNickname")
            
            # Если в запросе не пришел ник судьи (пустая строка), используем старый
            if not game_info.get("judgeNickname") and existing_judge:
                game_info["judgeNickname"] = existing_judge
        else:
            # Если игра новая и судья не указан, назначаем текущего пользователя
            if "judgeNickname" not in game_info or not game_info["judgeNickname"]:
                game_info["judgeNickname"] = current_user.nickname

        game_json = json.dumps({
            "players": data.players,
            "fouls": data.fouls,
            "gameInfo": game_info,
            "badgeColor": data.badgeColor
        }, ensure_ascii=False)

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


@app.delete("/deleteGame/{gameId}")
async def delete_game(gameId: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия (требуется роль admin)")

        game = db.query(Game).filter(Game.gameId == gameId).first()
        if not game:
            raise HTTPException(status_code=404, detail="Игра не найдена")

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
                    "points": final_points,
                    "best_move": p.get("best_move", "")
                })

            games_list.append({
                "id": game.gameId,
                "date": game.created_at.strftime("%d.%m.%Y %H:%M"),
                "badgeColor": data.get("badgeColor", ""),
                "event_id": game.event_id,
                "players": processed_players,
                "judge_nickname": data.get("gameInfo", {}).get("judgeNickname")
            })

        return {"games": games_list, "total_count": total_count}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения списка игр: {str(e)}")
    finally:
        db.close()


@app.get("/getPlayerGames/{nickname}")
async def get_player_games(nickname: str):
    db = SessionLocal()
    try:
        all_games = db.query(Game).order_by(Game.created_at.desc()).all()
        player_games = []

        for game in all_games:
            try:
                data = json.loads(game.data)
                players = data.get("players", [])
                
                # Проверяем, участвовал ли игрок в этой игре
                if any(p.get("name") == nickname for p in players):
                    player_games.append({
                        "id": game.gameId,
                        "date": game.created_at.strftime("%d.%m.%Y %H:%M"),
                        "badgeColor": data.get("badgeColor", ""),
                        "event_id": game.event_id,
                        "players": data.get("players", []),
                        "judge_nickname": data.get("gameInfo", {}).get("judgeNickname")
                    })
            except (json.JSONDecodeError, TypeError):
                continue

        return {"games": player_games}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения игр игрока: {str(e)}")
    finally:
        db.close()


def calculate_ci_bonuses(games: list[Game]) -> dict:
    ci_bonuses = {}
    player_x_counts = {}    # Динамический счетчик X (успешных "лучших ходов")
    total_player_games = {} # Здесь будет храниться N для каждого игрока

    # --- ЭТАП 1: Предварительный расчет N для каждого игрока ---
    # N - это общее количество игр, сыгранных игроком в предоставленном наборе `games`.
    for game in games:
        game_data = json.loads(game.data)
        players_in_game = game_data.get("players", [])
        for p in players_in_game:
            name = p.get("name")
            if name:
                total_player_games[name] = total_player_games.get(name, 0) + 1

    # --- ЭТАП 2: Расчет бонусов Ci в хронологическом порядке ---
    sorted_games = sorted(games, key=lambda g: g.created_at)

    for game in sorted_games:
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

        # Расчет бонуса
        current_x = player_x_counts.get(player_name, 0)
        # Используем предрассчитанное общее N для игрока
        total_n = total_player_games.get(player_name)

        if current_x > 0 and total_n and total_n > 0:
            # K = max(0, X - N/10)
            k = max(0, current_x - (total_n / 10.0))

            if k > 0:
                # Ci = (K * (K + 1)) / sqrt(N)
                ci_bonus = (k * (k + 1)) / math.sqrt(total_n)
                
                # Округляем до 2 знаков после запятой, как вы просили
                rounded_ci_bonus = round(ci_bonus, 2)

                if player_name not in ci_bonuses:
                    ci_bonuses[player_name] = {}
                ci_bonuses[player_name][game.gameId] = rounded_ci_bonus
                
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
    return penalties


@app.get("/getRating")
async def get_rating(limit: int = Query(10, description="Количество элементов на странице"),
                     offset: int = Query(0, description="Смещение для пагинации")):
    db = SessionLocal()
    try:
        games = db.query(Game).order_by(Game.created_at.asc()).all()

        ci_bonuses = calculate_ci_bonuses(games)
        dynamic_penalties = calculate_dynamic_penalties(games)

        all_players = db.query(User).all()
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

        rating = [
            {
                "name": name,
                "games": stats["games"],
                "points": stats["total_sum"],
                "club": clubs.get(name, None),
                "rating_score": (stats["total_sum"] / math.sqrt(stats["games"])) if stats["games"] > 0 else 0.0
            }
            for name, stats in player_stats.items() if stats["games"] > 0
        ]
        rating.sort(key=lambda x: x["rating_score"], reverse=True)

        total_count = len(rating)
        paginated_rating = rating[offset:offset + limit]

        return {"players": paginated_rating, "total_count": total_count}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения рейтинга: {str(e)}")
    finally:
        db.close()


@app.get("/getDetailedStats")
async def get_detailed_stats(
    limit: int = Query(200, description="Количество игроков на странице"),
    offset: int = Query(0, description="Смещение для пагинации игроков"),
    event_id: str = Query(None, description="ID события для фильтрации")
):
    db = SessionLocal()
    try:
        users = db.query(User).all()
        user_map = {p.nickname: p for p in users}
        
        games_query = db.query(Game)
        if event_id and event_id != 'all':
            games_query = games_query.filter(Game.event_id == event_id)
        
        games = games_query.order_by(Game.created_at.asc()).all()
        
        ci_bonuses = calculate_ci_bonuses(games)
        dynamic_penalties = calculate_dynamic_penalties(games)
        
        player_stats = {}
        # ... (логика расчета статистики остается прежней) ...
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

        players_list = []
        for name, stats in player_stats.items():
            user_obj = user_map.get(name)
            player_data = {
                "id": user_obj.id if user_obj else None,
                "nickname": name,
                "club": user_obj.club if user_obj else None,
                **stats
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
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Только администраторы могут создавать команды")

        event = db.query(Event).filter(Event.id == request.event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")

        team_size = 2 if event.type == "pair" else 5
        min_team_size = team_size // 2 if event.type == "team" else team_size

        if event.type == "pair" and len(request.members) != 2:
            raise HTTPException(status_code=400, detail="Для парного турнира требуется ровно 2 участника")
        elif event.type == "team" and not (min_team_size <= len(request.members) <= team_size):
            raise HTTPException(status_code=400, detail=f"Для командного турнира требуется от {min_team_size} до {team_size} участников")
        elif event.type == "solo":
            raise HTTPException(status_code=400, detail="Создание команд не поддерживается для личного турнира")

        # Проверяем, что все участники одобрены
        approved_user_ids = {reg.user_id for reg in db.query(Registration).filter(
            Registration.event_id == request.event_id,
            Registration.status == "approved"
        ).all()}

        if not all(member_id in approved_user_ids for member_id in request.members):
            raise HTTPException(status_code=400, detail="Один или несколько выбранных участников не являются подтвержденными участниками турнира")

        existing_teams = db.query(Team).filter(Team.event_id == request.event_id).all()
        assigned_ids = set()
        for t in existing_teams:
            assigned_ids.update(json.loads(t.members))
        if any(mid in assigned_ids for mid in request.members):
            raise HTTPException(status_code=400, detail="Один или несколько участников уже в другой команде")

        team_id = f"team_{uuid.uuid4().hex[:8]}"

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


@app.delete("/deleteTeam/{team_id}")
async def delete_team(team_id: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия (требуется роль admin)")

        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise HTTPException(status_code=404, detail="Команда не найдена")

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

# --- НОВЫЕ ЭНДПОИНТЫ ДЛЯ РЕГИСТРАЦИИ ---

@app.post("/events/{event_id}/register")
async def register_for_event(event_id: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")

        if event.participants_count >= event.participants_limit:
            raise HTTPException(status_code=400, detail="Регистрация на событие закрыта, достигнут лимит участников")

        existing_registration = db.query(Registration).filter(
            Registration.event_id == event_id,
            Registration.user_id == current_user.id
        ).first()

        if existing_registration:
            raise HTTPException(status_code=400, detail="Вы уже подали заявку на участие в этом событии")

        new_registration = Registration(
            id=f"reg_{uuid.uuid4().hex[:12]}",
            event_id=event_id,
            user_id=current_user.id,
            status="pending"
        )
        db.add(new_registration)
        db.commit()

        return {"message": "Ваша заявка на участие успешно подана и ожидает подтверждения"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка при подаче заявки: {str(e)}")
    finally:
        db.close()


@app.post("/registrations/{registration_id}/manage")
async def manage_registration(registration_id: str, request: ManageRegistrationRequest, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия")

        registration = db.query(Registration).filter(Registration.id == registration_id).first()
        if not registration:
            raise HTTPException(status_code=404, detail="Заявка не найдена")

        event = db.query(Event).filter(Event.id == registration.event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Событие, связанное с заявкой, не найдено")

        if request.action == "approve":
            if registration.status == "approved":
                return {"message": "Заявка уже была одобрена"}
            
            if event.participants_count >= event.participants_limit:
                raise HTTPException(status_code=400, detail="Невозможно одобрить заявку, достигнут лимит участников")

            registration.status = "approved"
            event.participants_count += 1
            db.commit()
            return {"message": "Заявка успешно одобрена"}

        elif request.action == "reject":
            if registration.status == "approved":
                event.participants_count -= 1

            db.delete(registration)
            db.commit()
            return {"message": "Заявка успешно отклонена"}

        else:
            raise HTTPException(status_code=400, detail="Недопустимое действие")

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка при управлении заявкой: {str(e)}")
    finally:
        db.close()


# --- Логика резервного копирования ---
def backup_database():
    if not DATABASE_URL.startswith("sqlite:///"):
        print("Резервное копирование настроено только для SQLite.")
        return

    db_path = DATABASE_URL.split("///")[1]
    if not os.path.exists(db_path):
        print(f"Файл базы данных не найден по пути: {db_path}")
        return
    
    backup_dir = os.path.join("data", "backup")
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y-%m-%d")
    backup_filename = f"{timestamp}.db"
    backup_path = os.path.join(backup_dir, backup_filename)
    
    try:
        shutil.copy2(db_path, backup_path)
        print(f"Резервная копия базы данных успешно создана: {backup_path}")
    except Exception as e:
        print(f"Ошибка при создании резервной копии: {e}")

scheduler = BackgroundScheduler()

@app.on_event("startup")
def start_scheduler():
    scheduler.add_job(backup_database, 'cron', hour=8, minute=0)
    scheduler.start()
    print("Планировщик резервного копирования запущен.")

@app.on_event("shutdown")
def shutdown_scheduler():
    scheduler.shutdown()
    print("Планировщик резервного копирования остановлен.")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, workers=1)