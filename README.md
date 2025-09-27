# Maple Legal Platform

Ontario-focused legal tech SaaS foundation combining billing automation and a secure client portal.

## Quick Start

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py runserver

# Frontend
cd ../frontend
npm install
npm run dev
```

Or start the full stack:

```bash
cd devops
docker compose -f docker-compose.dev.yml up --build
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

See `/docs` for architecture, security, compliance, tenancy, API references, and roadmap.
