FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y build-essential libpq-dev && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt backend/requirements-dev.txt ./
RUN pip install --upgrade pip && pip install -r requirements-dev.txt
COPY backend /app
ENV DJANGO_SETTINGS_MODULE=core.settings
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
