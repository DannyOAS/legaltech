# Roadmap

## Phase 1 – Foundation (This Release)
- Billing automation MVP: time, expenses, invoices, payments
- Secure document portal with messaging and share links
- Multi-tenant auth, RBAC, audit logging, compliance docs

## Phase 2 – Contract Analysis
- Implement real provider in `services.ai.contracts` leveraging vector store / RAG
- Add contract clause extraction UI with risk scoring per Ontario statutes
- Integrate document scanning + PII redaction before AI processing

## Phase 3 – Case Tracker
- Expand `case_rules.engine` into a scheduling engine with court-specific timelines
- Calendar integrations (Outlook/Google) for matter deadlines
- Notifications (email/SMS) via `services.notifications`

## Phase 4 – AI Legal Research
- Implement `research.provider` to query Canadian caselaw APIs
- Provide answer synthesis + citation summaries
- Add knowledge base ingestion pipeline (policies, memos)

## Platform Enhancements
- Advanced billing: trust reconciliation, LEDES export, Interac reconciliation flow
- Portal: DocuSign/Dropbox Sign live integration, secure guest access, virus scanning
- Analytics: dashboards with trend charts, revenue forecasts, productivity metrics
- DevOps: Terraform modules for AWS Canada, backup management, Secrets Manager integration
