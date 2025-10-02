# Maple Legal Platform

Ontario-focused legal tech SaaS foundation combining billing automation and a secure client portal.

## Docker Development (Recommended)

### Start All Services
```bash
docker compose -f devops/docker-compose.dev.yml up -d
```

### Stop All Services
```bash
docker compose -f devops/docker-compose.dev.yml down
```

### View Service Status
```bash
docker ps
```

## Service Management

### Individual Service Control
```bash
# Start specific service
docker compose -f devops/docker-compose.dev.yml up -d db
docker compose -f devops/docker-compose.dev.yml up -d backend
docker compose -f devops/docker-compose.dev.yml up -d frontend

# Stop specific service
docker compose -f devops/docker-compose.dev.yml stop backend
docker compose -f devops/docker-compose.dev.yml stop frontend

# Restart specific service
docker compose -f devops/docker-compose.dev.yml restart backend
```

### View Logs
```bash
# All services
docker compose -f devops/docker-compose.dev.yml logs -f

# Specific service
docker compose -f devops/docker-compose.dev.yml logs -f backend
docker compose -f devops/docker-compose.dev.yml logs -f frontend
docker compose -f devops/docker-compose.dev.yml logs -f db
```

### Rebuild Services
```bash
# Rebuild all
docker compose -f devops/docker-compose.dev.yml build

# Rebuild specific service
docker compose -f devops/docker-compose.dev.yml build backend
docker compose -f devops/docker-compose.dev.yml build frontend

# Rebuild and restart
docker compose -f devops/docker-compose.dev.yml up -d --build
```

## Testing

### Run All Tests
```bash
docker compose -f devops/docker-compose.dev.yml exec backend python -m pytest tests
```

### Run Specific Test Files
```bash
docker compose -f devops/docker-compose.dev.yml exec backend python -m pytest tests/test_accounts.py
docker compose -f devops/docker-compose.dev.yml exec backend python -m pytest tests/test_client_portal.py
```

### Run Tests with Verbose Output
```bash
docker compose -f devops/docker-compose.dev.yml exec backend python -m pytest tests -v
```

## Database Management

### Access Database Shell
```bash
docker compose -f devops/docker-compose.dev.yml exec db psql -U postgres -d legaltech
```

### Run Migrations
```bash
docker compose -f devops/docker-compose.dev.yml exec backend python manage.py migrate
```

### Create Migrations
```bash
docker compose -f devops/docker-compose.dev.yml exec backend python manage.py makemigrations
```

### Create Superuser
```bash
docker compose -f devops/docker-compose.dev.yml exec backend python manage.py createsuperuser
```

## Development

### Access Backend Shell
```bash
docker compose -f devops/docker-compose.dev.yml exec backend bash
```

### Access Frontend Shell
```bash
docker compose -f devops/docker-compose.dev.yml exec frontend bash
```

### Django Management Commands
```bash
# Run Django shell
docker compose -f devops/docker-compose.dev.yml exec backend python manage.py shell

# Collect static files
docker compose -f devops/docker-compose.dev.yml exec backend python manage.py collectstatic

# Check for issues
docker compose -f devops/docker-compose.dev.yml exec backend python manage.py check
```

## Service URLs

### Local Access
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Admin Panel**: http://localhost:8000/admin
- **Database**: localhost:5432
- **MinIO (S3)**: http://localhost:9000 (console: http://localhost:9001)
- **MailHog**: http://localhost:8025

### Network Access (from other computers)
- **Frontend**: http://10.0.0.161:5173
- **Backend API**: http://10.0.0.161:8000
- **Admin Panel**: http://10.0.0.161:8000/admin
- **MinIO Console**: http://10.0.0.161:9001
- **MailHog**: http://10.0.0.161:8025

**Note**: If your IP address changes, update the environment variables in `devops/docker-compose.dev.yml` and restart the services.

## Auto-Restart Configuration

All services are configured with `restart: unless-stopped`, meaning they will:
- ✅ Start automatically when your computer boots
- ✅ Restart if they crash
- ❌ NOT restart if you manually stop them

## Troubleshooting

### Services Won't Start
```bash
# Check what's running
docker ps -a

# Check logs for errors
docker compose -f devops/docker-compose.dev.yml logs

# Remove stopped containers and try again
docker compose -f devops/docker-compose.dev.yml down
docker compose -f devops/docker-compose.dev.yml up -d
```

### Database Connection Issues
```bash
# Ensure database is running
docker compose -f devops/docker-compose.dev.yml ps db

# Check database logs
docker compose -f devops/docker-compose.dev.yml logs db

# Reset database (WARNING: destroys data)
docker compose -f devops/docker-compose.dev.yml down -v
docker compose -f devops/docker-compose.dev.yml up -d
```

### Test Failures
```bash
# Ensure all services are running
docker compose -f devops/docker-compose.dev.yml ps

# Run migrations first
docker compose -f devops/docker-compose.dev.yml exec backend python manage.py migrate

# Run tests again
docker compose -f devops/docker-compose.dev.yml exec backend python -m pytest tests
```

## Local Development (Alternative)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

Create a `.env` in `backend/` (values shown with secure defaults):

```
DJANGO_SECRET_KEY=change-me
DATABASE_URL=postgres://postgres:postgres@localhost:5432/legaltech
CA_REGION=ca-central-1
S3_ENDPOINT_URL=http://localhost:9000
S3_BUCKET_NAME=legaltech-dev
STRIPE_SECRET_KEY=sk_test_stub
STRIPE_WEBHOOK_SECRET=whsec_stub
```

Frontend `.env` example:

```
VITE_API_BASE=http://localhost:8000/api/v1
VITE_CA_REGION=ca-central-1
```

### Makefile Snippets

Add these to your shell or a future `Makefile`:

```
make lint-backend   # black + ruff + mypy
make test-backend   # pytest --cov
make lint-frontend  # npm run lint
make test-frontend  # npm run test -- --run
```

## Features

- **Billing automation** – time/expense capture, invoicing, Stripe stub + Interac guidance
- **Secure client portal** – S3-backed document exchange, threaded messaging, share links
- **Tenancy & security** – org-scoped queries, JWT (httpOnly), MFA-ready, CSRF double-submit
- **Compliance posture** – PIPEDA/PHIPA aware storage, audit logs, Canadian region config
- **Future ready** – AI service interface, contract analysis stubs, case tracker hooks

## Testing

Backend: `pytest --cov`. Frontend: `npm run test -- --run`. CI enforces formatting, linting, typing, and unit tests.

## Documentation

- [Architecture overview](docs/architecture.md)
- [Frontend patterns & design system](docs/frontend.md)
- [Security posture](docs/security.md)
- [Compliance controls](docs/compliance.md)
- [Tenant model](docs/tenancy.md)
- [API reference & schema](docs/api.md)
- [Product roadmap](docs/roadmap.md)
