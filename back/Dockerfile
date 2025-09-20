FROM python:3.9-alpine

RUN apk add --no-cache gcc musl-dev

WORKDIR /app
COPY requirements.txt .
RUN pip install --trusted-host pypi.python.org --trusted-host pypi.org -r requirements.txt

COPY . .
CMD ["python", "main.py"]