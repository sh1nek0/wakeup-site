import os
import shutil
from datetime import datetime
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.background import BackgroundScheduler

from sqlalchemy import text
from sqlalchemy.orm import Session

from api import auth, games, users, events, notifications
from api import ws_agent
from db.base import DATABASE_URL, Base, engine, SessionLocal


ROOT_PATH = os.getenv("ROOT_PATH", "")  # по умолчанию пусто для локали

app = FastAPI(
    
)

# -------------------- CORS --------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- ROUTERS --------------------
app.include_router(auth.router)
app.include_router(games.router)
app.include_router(users.router)
app.include_router(events.router)
app.include_router(notifications.router)
app.include_router(ws_agent.router)



# -------------------- STATIC FILES --------------------
app.mount("/data", StaticFiles(directory="data"), name="data")


# -------------------- BACKUP LOGIC --------------------
def backup_database():
    if not DATABASE_URL.startswith("sqlite:///"):
        print("Резервное копирование поддерживается только для SQLite")
        return

    db_path = Path(DATABASE_URL.replace("sqlite:///", ""))

    if not db_path.exists():
        print(f"Файл БД не найден: {db_path}")
        return

    backup_dir = db_path.parent / "backup"
    backup_dir.mkdir(exist_ok=True)

    backup_file = backup_dir / f"{datetime.now():%Y-%m-%d}.db"

    try:
        shutil.copy2(db_path, backup_file)
        print(f"Бэкап БД создан: {backup_file}")
    except Exception as e:
        print(f"Ошибка резервного копирования: {e}")


scheduler = BackgroundScheduler()

# -------------------- SQLITE FULL MIGRATION --------------------
def run_sqlite_migrations(db: Session):

    raw_conn = db.connection().connection
    cursor = raw_conn.cursor()

    # ============================================================
    # 1️⃣ MIGRATE event_judges.position
    # ============================================================

    result = db.execute(text("PRAGMA table_info(event_judges)")).fetchall()
    position_column = next((col for col in result if col[1] == "position"), None)

    if not position_column:
        print("Добавляем колонку position в event_judges...")

        cursor.executescript("""
        BEGIN;

        CREATE TABLE event_judges_new (
            event_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            position INTEGER DEFAULT 0,
            PRIMARY KEY (event_id, user_id),
            FOREIGN KEY(event_id) REFERENCES events(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        INSERT INTO event_judges_new (event_id, user_id, position)
        SELECT event_id, user_id, 0 FROM event_judges;

        DROP TABLE event_judges;
        ALTER TABLE event_judges_new RENAME TO event_judges;

        COMMIT;
        """)

        print("event_judges успешно обновлена")
    else:
        print("Миграция event_judges не требуется")

    # ============================================================
    # 2️⃣ MIGRATE notifications.recipient_id -> NULLABLE
    # ============================================================

    result = db.execute(text("PRAGMA table_info(notifications)")).fetchall()

    recipient_col = next((col for col in result if col[1] == "recipient_id"), None)

    if recipient_col and recipient_col[3] == 1:  # NOT NULL
        print("Миграция notifications.recipient_id -> NULLABLE")

        cursor.executescript("""
        BEGIN;

        CREATE TABLE notifications_new (
            id TEXT PRIMARY KEY,
            recipient_id TEXT NULL,
            sender_id TEXT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            related_id TEXT,
            is_read BOOLEAN DEFAULT 0,
            actions TEXT,
            created_at DATETIME,
            FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(sender_id) REFERENCES users(id)
        );

        INSERT INTO notifications_new
        SELECT * FROM notifications;

        DROP TABLE notifications;
        ALTER TABLE notifications_new RENAME TO notifications;

        COMMIT;
        """)

        print("notifications успешно обновлена")
    else:
        print("Миграция notifications не требуется")

    cursor.close()
    print("Все SQLite миграции завершены")


# -------------------- STARTUP --------------------
@app.on_event("startup")
def on_startup():
    # Создание таблиц
    Base.metadata.create_all(bind=engine)

    # Миграция
    db = SessionLocal()
    try:
        run_sqlite_migrations(db)
    finally:
        db.close()

    # Планировщик бэкапов
    scheduler.add_job(backup_database, "cron", hour=8, minute=0)
    scheduler.start()

    print("Приложение успешно запущено")


# -------------------- SHUTDOWN --------------------
@app.on_event("shutdown")
def on_shutdown():
    scheduler.shutdown()
    print("Приложение остановлено")


# -------------------- ENTRYPOINT --------------------
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
