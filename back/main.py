import os
import shutil
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.background import BackgroundScheduler
import uvicorn
from sqlalchemy import inspect, text  # Добавлено для проверки и добавления столбцов

from api import auth, games, users, events, notifications
from db.base import DATABASE_URL, Base, engine  # Добавил Base и engine для работы с моделями

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
app.include_router(notifications.router)

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

# --- НОВАЯ ФУНКЦИЯ: Проверка и добавление недостающих столбцов ---
def add_missing_columns():
    """
    Проверяет существующие столбцы в таблицах БД и добавляет недостающие на основе моделей SQLAlchemy.
    Работает только для SQLite. Для продакшена используйте Alembic.
    """
    if not DATABASE_URL.startswith("sqlite:///"):
        print("Добавление столбцов настроено только для SQLite.")
        return

    inspector = inspect(engine)
    
    with engine.connect() as conn:
        for table_name, table in Base.metadata.tables.items():
            # Получаем список существующих столбцов в таблице
            try:
                existing_columns = {col['name'] for col in inspector.get_columns(table_name)}
            except Exception as e:
                print(f"Ошибка при получении столбцов для таблицы {table_name}: {e}")
                continue
            
            # Проверяем каждый столбец из модели
            for column in table.columns:
                if column.name not in existing_columns:
                    # Формируем SQL для добавления столбца
                    column_type = str(column.type).upper()  # Например, "INTEGER", "VARCHAR(255)"
                    nullable = "" if column.nullable else " NOT NULL"
                    default = f" DEFAULT {column.default.arg}" if column.default else ""
                    
                    alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {column_type}{nullable}{default}"
                    
                    try:
                        conn.execute(text(alter_sql))
                        print(f"Добавлен столбец '{column.name}' в таблицу '{table_name}'.")
                    except Exception as e:
                        print(f"Ошибка при добавлении столбца '{column.name}' в '{table_name}': {e}")

scheduler = BackgroundScheduler()

@app.on_event("startup")
def start_scheduler():
    # Создаем таблицы при старте, если их нет
    Base.metadata.create_all(bind=engine)
    
    # Добавляем недостающие столбцы
    add_missing_columns()
    
    scheduler.add_job(backup_database, 'cron', hour=8, minute=0)
    scheduler.start()
    print("Планировщик резервного копирования запущен.")

@app.on_event("shutdown")
def shutdown_scheduler():
    scheduler.shutdown()
    print("Планировщик резервного копирования остановлен.")
 
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, workers=1)
