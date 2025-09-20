FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .

# ПРОСТО УСТАНОВИТЕ БЕЗ trusted-host!
RUN pip install --timeout=300 -r requirements.txt

COPY . .
CMD ["python", "main.py"]