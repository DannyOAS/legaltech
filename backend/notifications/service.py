"""Helpers to emit notifications."""

from __future__ import annotations

from typing import Any

from django.utils import timezone

from notifications.models import Notification


def send_notification(
    *,
    organization_id: str,
    recipient_id: str,
    notification_type: str,
    title: str,
    body: str | None = None,
    metadata: dict[str, Any] | None = None,
    related_object_type: str | None = None,
    related_object_id: str | None = None,
) -> Notification:
    return Notification.objects.create(
        organization_id=organization_id,
        recipient_id=recipient_id,
        notification_type=notification_type,
        title=title,
        body=body or "",
        metadata=metadata or {},
        related_object_type=related_object_type or "",
        related_object_id=related_object_id or "",
    )


def mark_all_read(*, organization_id: str, recipient_id: str) -> int:
    return Notification.objects.filter(
        organization_id=organization_id,
        recipient_id=recipient_id,
        read_at__isnull=True,
    ).update(read_at=timezone.now())
