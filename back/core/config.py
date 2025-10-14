import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

# JWT
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("Необходимо установить переменную окружения SECRET_KEY")

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/database.db")

# Directories
AVATAR_DIR = Path("data") / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

# Avatar settings
MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2 MB
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"