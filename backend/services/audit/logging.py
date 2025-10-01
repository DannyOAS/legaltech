"""Audit logging helpers."""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings

from .context import get_current_org
from django.apps import apps

logger = logging.getLogger(settings.AUDIT_EVENT_NAME)


def audit_action(organization_id: str | None, actor_id: str | None, action: str, resource_type: str, resource_id: str, request, metadata: dict[str, Any] | None = None) -> None:
    if organization_id is None:
        return
    metadata = metadata or {}
    ip = getattr(request, "META", {}).get("REMOTE_ADDR") if request else None
    user_agent = ""
    if request:
        user_agent = getattr(request, "META", {}).get("HTTP_USER_AGENT", "") or ""
    try:
        AuditEvent = apps.get_model("audit", "AuditEvent")
    except Exception:  # apps not ready yet or model unavailable
        return
    AuditEvent.objects.create(
        organization_id=organization_id,
        actor_id=actor_id,
        actor_type="user" if actor_id else "system",
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip=ip,
        user_agent=user_agent,
        metadata=metadata,
    )
    logger.info("audit action", extra={"organization_id": organization_id, "action": action})


class TenantContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.organization_id = get_current_org() or "-"
        return True
