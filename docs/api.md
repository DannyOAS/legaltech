# API Reference (v1)

Base URL: `/api/v1/`

## OpenAPI Schema Snapshot

- Latest export: [`docs/api/schema.yaml`](./api/schema.yaml) (generated with `drf-spectacular`)
- Regenerate after API changes:

  ```bash
  cd backend
  ../.venv/bin/python manage.py spectacular --file ../docs/api/schema.yaml
  ```

  _Common warnings_: several APIViews (e.g., `LogoutView`, `BillingSummaryView`) lack an explicit `serializer_class`, so they are omitted from the schema until serializers are defined. Custom authenticators such as `accounts.authentication.JWTCookieAuthentication` can be documented by implementing an [`OpenApiAuthenticationExtension`](https://drf-spectacular.readthedocs.io/en/latest/customization.html#extending-authentication)._ 

## Auth

| Endpoint | Method | Description |
| --- | --- | --- |
| `/auth/login/` | POST | Authenticate with email/password, returns user payload and sets cookies |
| `/auth/logout/` | POST | Clear JWT cookies |
| `/auth/refresh/` | POST | Refresh access token using refresh token |
| `/auth/mfa/setup/` | POST | Generate TOTP secret + provisioning URI |
| `/auth/mfa/verify/` | POST | Verify TOTP token and enable MFA |
| `/auth/invite/accept/` | POST | Accept invitation token and create account |

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
- `/permissions/` GET – enumerate available permission codenames for role management
- `/invitations/` GET/POST/DELETE
- `/invitations/{id}/resend/` POST – resend invitation email
- `/api-tokens/` GET/POST/DELETE

## Clients & Matters

- `/clients/` – list/create clients
- `/matters/` – list/create matters (leave `reference_code` blank to auto-generate per-organization file numbers)
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
- `/notifications/` GET – list in-app notifications for the authenticated user
- `/notifications/{id}/read/` POST – mark a notification as read

## Client Portal

- `/client/dashboard/` GET – aggregate view for client balances and recent documents
- `/client/documents/` GET – client-visible documents (requires `client_visible=true`)
- `/client/invoices/` GET – invoices tied to the authenticated client user

> Client-role accounts are limited to the `/client/...` endpoints; organization management, billing, and portal CRUD APIs return `403` for client users.

## RBAC & Row-Level Rules

- Roles map to permission codenames (e.g., `matter.view`, `invoice.manage`, `org.manage_roles`). Built-in roles (Admin, Lawyer, Paralegal, Client, Operations Admin, IT/Security, Accounting/Finance) follow the security matrix described in `docs/security.md`.
- `/roles/` supports POST/PATCH with a `permissions` array to define custom roles. Use `/permissions/` to render the checkbox matrix in the Org Settings UI.
- All list/detail endpoints are scoped to `organization_id` via middleware. Additional row-level filters ensure:
  - Lawyers and paralegals only see matters/documents/invoices they are assigned to (via lead lawyer or `MatterAccess`).
  - Accounting roles can access billing data but not matter or document records.
  - Clients are confined to `/client/...` routes and only see documents marked `client_visible=true`.

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
