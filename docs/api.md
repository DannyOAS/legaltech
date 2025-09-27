# API Reference (v1)

Base URL: `/api/v1/`

## Auth

| Endpoint | Method | Description |
| --- | --- | --- |
| `/auth/login/` | POST | Authenticate with email/password, returns user payload and sets cookies |
| `/auth/logout/` | POST | Clear JWT cookies |
| `/auth/refresh/` | POST | Refresh access token using refresh token |
| `/auth/mfa/setup/` | POST | Returns TOTP secret + QR stub |
| `/auth/mfa/verify/` | POST | Verify MFA token (stub, expects `000000`) |

### Login Request

```json
{
  "email": "owner@firm.ca",
  "password": "Passw0rd!123"
}
```

### Login Response

```json
{
  "id": "...",
  "email": "owner@firm.ca",
  "first_name": "Olivia",
  "last_name": "Owner",
  "mfa_enabled": false,
  "roles": ["Owner"]
}
```

## Organizations & Users

- `/org/<org_id>/` GET/PUT – view or update current organization
- `/users/` GET/POST – manage users (tenant-scoped)
- `/users/me/` GET – current user profile
- `/roles/` GET/POST
- `/invitations/` GET/POST/DELETE
- `/api-tokens/` GET/POST/DELETE

## Clients & Matters

- `/clients/` – list/create clients
- `/matters/` – list/create matters
- `/matters/{id}/` – retrieve/update

## Billing

- `/time-entries/` – CRUD on time entries
- `/expenses/` – CRUD on expenses
- `/invoices/` – CRUD on invoices
- `/payments/` – CRUD on payments
- `/reports/billing-summary/` – aggregate metrics

## Portal

- `/documents/` POST – initiate upload (returns presigned URL)
- `/documents/{id}/download/` GET – fetch download URL
- `/threads/` – manage message threads
- `/messages/` – create messages with attachments
- `/share-links/` – manage secure links
- `/share-links/resolve/{token}/` – public resolution endpoint

## Integrations

- `/integrations/stripe/connect` POST – stubbed Stripe Connect exchange
- `/integrations/docusign/webhook` POST – webhook receiver (AllowAny)

## Audit & Settings

- `/audit-events/` GET – tenant audit trail
- `/settings/` GET – environment + feature flag summary

All endpoints support pagination via `?limit`/`?offset`, basic filtering with query params, and ordering where appropriate. Errors follow DRF standard:

```json
{
  "detail": "Permission denied"
}
```
