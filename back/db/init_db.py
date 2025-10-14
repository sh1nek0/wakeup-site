import sys
from pathlib import Path
import uuid
from datetime import datetime

# --- ИЗМЕНЕНИЕ: Добавляем корневую папку проекта в sys.path ---
# Это позволяет скрипту находить другие модули (core, db, api)
project_root = Path(__file__).resolve().parent.parent
sys.path.append(str(project_root))
# --- КОНЕЦ ИЗМЕНЕНИЯ ---

from core.security import get_password_hash
from db.base import SessionLocal, Base, engine
from db.models import User, Event, Team

def init_db():
    # Создаем все таблицы
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Проверяем, есть ли уже данные
        if db.query(Event).count() > 0:
            print("База данных уже содержит данные. Инициализация пропущена.")
            return

        # --- Создание тестовых событий ---
        print("Создание демо-событий...")
        solo_event = Event(
            id=f"event_{uuid.uuid4().hex[:8]}", title="Solo Championship",
            dates="10.12.2025", location="Онлайн", type="solo",
            participants_limit=20, fee=500, gs_name="Admin", org_name="WakeUp"
        )
        pair_event = Event(
            id=f"event_{uuid.uuid4().hex[:8]}", title="Cyber Couple Cup",
            dates="22.11.2025 – 23.11.2025", location="Физтех, Долгопрудный", type="pair",
            participants_limit=40, fee=1700, gs_name="Антон Третьяков", org_name="Ростислав Долматович"
        )
        team_event = Event(
            id=f"event_{uuid.uuid4().hex[:8]}", title="Team Battle Arena",
            dates="15.01.2026", location="МИЭТ, Зеленоград", type="team",
            participants_limit=50, fee=1000, gs_name="Admin", org_name="WakeUp"
        )
        db.add_all([solo_event, pair_event, team_event])
        db.commit()
        print("Демо-события созданы.")

        # --- Создание тестовых пользователей ---
        print("Создание демо-пользователей...")
        users_data = [
            {"email": "admin@example.com", "nickname": "Admin", "club": "WakeUp | MIET", "role": "admin"},
            {"email": "alfa@example.com", "nickname": "Alfa", "club": "WakeUp | MIET"},
            {"email": "bravo@example.com", "nickname": "Bravo", "club": "WakeUp | MIPT"},
            {"email": "charlie@example.com", "nickname": "Charlie", "club": "Aurora"},
            {"email": "delta@example.com", "nickname": "Delta", "club": "WakeUp | MIET"},
            {"email": "echo@example.com", "nickname": "Echo", "club": "WakeUp | MIPT"},
        ]
        
        for u_data in users_data:
            user = User(
                id=f"user_{uuid.uuid4().hex[:12]}",
                email=u_data["email"],
                nickname=u_data["nickname"],
                hashed_password=get_password_hash("password"),
                club=u_data.get("club"),
                role=u_data.get("role", "user"),
                avatar=""
            )
            db.add(user)
        db.commit()
        print("Демо-пользователи созданы.")
        
    except Exception as e:
        print(f"Ошибка при инициализации БД: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Инициализация базы данных с демо-данными...")
    init_db()