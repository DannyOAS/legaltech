# Compliance Overview

## Canadian Frameworks

- **PIPEDA** – consent + safeguard alignment via audit logging, least privilege RBAC, access tracking (`AuditEvent`), secure hosting assumptions
- **PHIPA** – health privacy readiness: per-tenant isolation, logging, secure portal messaging for client communications, retention flags for PHI soft-delete
- **LSO Technology Expectations** – confidentiality, availability, integrity controls documented; S3 bucket region pinned to Canada, TLS enforced, MFA-ready auth

## Data Residency

- `CA_REGION` env controls AWS/MinIO region (default `ca-central-1`)
- S3 key prefix structure `{organization_id}/documents/...`
- Database + backups must reside in Canadian regions; docker-compose dev mimics local setup

## Retention & Destruction

- Soft-delete flags on `Client`, `Matter` for retention workflows
- Placeholder `TrustAccountBalance` highlights Law Society trust accounting requirements (documented for future modules)
- Document share links support one-time access tokens

## Incident & Breach Response

1. Detect via audit/anomaly monitoring
2. Contain by revoking share links/API tokens
3. Preserve logs (centralized via SIEM)
4. Notify affected clients per LSO + PIPEDA timelines

## Documentation & Training

- Security posture maintained in `docs/security.md`
- Tenancy enforcement described in `docs/tenancy.md`
- Roadmap captures upcoming Contract Analysis / Case Tracker obligations

## Future Enhancements

- Implement retention schedules & legal hold workflows
- Integrate DLP scanning during uploads
- Add Data Processing Agreement templates per client region
