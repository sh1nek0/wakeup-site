# wakeup-site/site/back/Dockerfile

# --- ИЗМЕНЕНИЕ: Используем полную версию образа, а не slim ---
FROM python:3.9-bullseye

WORKDIR /app

COPY requirements.txt .

RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt --timeout=300

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]