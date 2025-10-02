# Security Posture

## Controls Checklist

- **Authentication** – httpOnly JWT cookies with CSRF double-submit token, enforced TOTP MFA flow, optional OIDC stubs
- **Authorization** – RBAC via `Role` + `Permission` relationships, per-org row-level scoping, API throttles, staff-only admin. `Client` role tokens are restricted to the read-only client portal surface.
- **Transport** – TLS termination assumed at load balancer, HSTS, CSP, secure cookies, proxy SSL header
- **Data at Rest** – Postgres row-level tenancy (`organization_id`), MinIO/S3 per-tenant prefixes, server-side encryption w/ KMS alias (`CA_REGION`)
- **Auditability** – `AuditEvent` persisted for CRUD + downloads, contextual logging, CI-enforced code quality
- **Input Validation** – DRF serializers, file mime/size metadata, SHA-256 verification hooks, strict request schemas
- **Rate Limiting** – DRF burst and sustained throttle classes with env-configurable limits
- **Secrets** – Expectation of encrypted env (e.g., SOPS/Secrets Manager). Docker compose uses local dev defaults only
- **Vulnerability Management** – Pre-commit for linting, CI (black/ruff/mypy/pytest/tsc/vitest/eslint), dependency pinning

## CSRF Strategy

- JWT stored in httpOnly cookies (`mlp_access`, `mlp_refresh`)
- CSRF cookie `mlp_csrf` exposed to JS
- SPA sends `X-CSRFToken` header with mutating requests
- Middleware enforces equality for unsafe verbs

## File Handling & Virus Scanning

- Documents stream directly to S3 via presigned URLs
- Metadata captured before upload (hash, mime, size)
- Uploads are queued through `services.storage.virus_scan.schedule_scan` so an AV engine can process before client access

## Logging & Monitoring

- Structured logging with tenant context filter
- Interac e-Transfer reconciliation documented (manual acknowledgement until automated banking APIs in a future phase)
- Audit events keyed by organization for isolation
- Extend via SIEM shipping (CloudWatch, ELK) by subscribing to console handler

## Incident Response Hooks

- Share links can be invalidated (`ShareLink.regenerate()`)
- API tokens stored hashed with scoped permissions (future expansion), ready for revocation
- `services/audit` ready for real-time streaming to analytics pipeline

## Third-Party Integrations
- Stripe Connect + PaymentIntents scaffolding (stub only)
- DocuSign webhook receiver placeholder
- Email notifications via Django backend (switchable to SES/Mailgun)

## Role-Based Access Controls

- **Admin / Owner** – Full tenant administration: manage users and custom roles, update organization settings, access every matter, document, invoice, audit trail, and AI tools. May not cross tenant boundaries.
- **Lawyer** – Create and manage matters they own or are assigned to, upload documents (including visibility toggles), manage invoices for those matters, record time/expenses, use secure messaging and AI helpers.
- **Paralegal / Assistant** – Access only assigned matters, upload supporting documents, record time and expenses, participate in messaging. Cannot change document visibility, manage invoices, or invite users.
- **Operations Admin** – Maintain non-legal organization settings, invite clients, run billing workflows (mark invoices paid, send reminders), export compliance/billing reports. No matter/document access and no staff role management.
- **IT / Security** – Manage MFA/SSO settings, adjust RBAC policies, and review audit logs. No matter, document, or billing access.
- **Accounting / Finance** – Create/edit/mark invoices paid and export billing reports. No access to matter work product.
- **Client** – Restricted to `/client/...` endpoints: view assigned matters, client-visible documents, invoices, Docuseal e-sign flows, and secure messaging with assigned staff.
- **Custom Roles** – Administrators can compose bespoke roles through the Org Settings UI, selecting from the permission catalog backed by the new `Permission` model.

Row-level filters ensure lawyers, paralegals, accounting staff, and clients only see matters, documents, and invoices tied to their assignments. Organization-scoped middleware enforces `organization_id` on every queryset and serializer.
