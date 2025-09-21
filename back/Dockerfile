FROM python:3.9-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем системные зависимости (если нужны для pip)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Копируем только requirements.txt на этом этапе (для кэша)
COPY requirements.txt .

# Устанавливаем зависимости Python
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt --timeout=300

# Копируем весь проект
COPY . .

# Указываем команду запуска
CMD ["python", "main.py"]
