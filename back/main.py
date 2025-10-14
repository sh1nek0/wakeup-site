import os
import shutil
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.background import BackgroundScheduler
import uvicorn

# --- ИЗМЕНЕНИЕ: Импортируем все наши роутеры ---
from api import auth, games, users, events
from db.base import DATABASE_URL

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ИЗМЕНЕНИЕ: Подключаем роутеры БЕЗ префикса ---
app.include_router(auth.router)
app.include_router(games.router)
app.include_router(users.router)
app.include_router(events.router)

# Раздача статики (аватары)
app.mount("/data", StaticFiles(directory="data"), name="data")

# --- Логика резервного копирования ---
def backup_database():
    if not DATABASE_URL.startswith("sqlite:///"):
        print("Резервное копирование настроено только для SQLite.")
        return

    db_path_str = DATABASE_URL.split("///")[1]
    db_path = Path(db_path_str)
    
    if not db_path.exists():
        print(f"Файл базы данных не найден по пути: {db_path}")
        return
    
    backup_dir = db_path.parent / "backup"
    backup_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y-%m-%d")
    backup_filename = f"{timestamp}.db"
    backup_path = backup_dir / backup_filename
    
    try:
        shutil.copy2(db_path, backup_path)
        print(f"Резервная копия базы данных успешно создана: {backup_path}")
    except Exception as e:
        print(f"Ошибка при создании резервной копии: {e}")

scheduler = BackgroundScheduler()

@app.on_event("startup")
def start_scheduler():
    # Создаем таблицы при старте, если их нет
    from db.base import Base, engine
    Base.metadata.create_all(bind=engine)
    
    scheduler.add_job(backup_database, 'cron', hour=8, minute=0)
    scheduler.start()
    print("Планировщик резервного копирования запущен.")

@app.on_event("shutdown")
def shutdown_scheduler():
    scheduler.shutdown()
    print("Планировщик резервного копирования остановлен.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, workers=1)