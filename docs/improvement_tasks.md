# Suggested Follow-up Tasks

## Typo Fix
- Update the notification actions menu copy in `frontend/src/components/NotificationBell.tsx` from "Mark all read" to the grammatically correct "Mark all **as** read" so the button text matches the intended action. 【F:frontend/src/components/NotificationBell.tsx†L118-L125】

## Bug Fix
- Align the `ContractAnalysisResponse` serializer with the actual payload returned by `analyze_contract` so the OpenAPI schema reflects the nested objects (`missing_clauses`, `risky_terms`, `found_clauses`, `summary`, etc.) that the endpoint already emits. This avoids runtime schema mismatches for API consumers. 【F:backend/services/ai/api.py†L21-L40】【F:backend/services/ai/contracts.py†L129-L188】

## Documentation Discrepancy
- Correct `docs/architecture.md`, which states the matters module handles “clients, contacts, matters,” even though the Django app only implements `Client`, `Matter`, and `CaseDeadline` models—there is no contacts feature today. 【F:docs/architecture.md†L51-L55】【F:backend/matters/models.py†L19-L103】

## Test Improvement
- Extend `backend/tests/test_notifications.py::test_list_notifications_scoped_to_user` to create a notification for another user and assert it is excluded from the queryset, strengthening the regression coverage for tenant/user scoping. 【F:backend/tests/test_notifications.py†L23-L64】
