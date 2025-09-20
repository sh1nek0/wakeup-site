FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .

RUN pip install --trusted-host pypi.org \
               --trusted-host pypi.python.org \
               --trusted-host files.pythonhosted.org \
               --timeout=300 \
               -r requirements.txt

COPY . .
CMD ["python", "main.py"]