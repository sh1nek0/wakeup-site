FROM python:3.9-slim

# Настройка DNS
RUN echo "nameserver 8.8.8.8" > /etc/resolv.conf && \
    echo "nameserver 1.1.1.1" >> /etc/resolv.conf

WORKDIR /app
COPY requirements.txt .

# Для slim образа обычно не нужны gcc/musl-dev
RUN pip install --trusted-host pypi.org --trusted-host pypi.python.org -r requirements.txt

COPY . .
CMD ["python", "main.py"]