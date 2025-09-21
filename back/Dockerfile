FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .


RUN pip install --index-url https://pypi.org/simple/ \
               --timeout=300 \
               -r requirements.txt

COPY . .
CMD ["python", "main.py"]