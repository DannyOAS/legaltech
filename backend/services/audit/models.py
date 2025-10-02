"""Audit logging models."""

from __future__ import annotations

import uuid

from django.db import models

from accounts.models import Organization


class AuditEvent(models.Model):
    ACTOR_TYPES = [
        ("user", "User"),
        ("client", "Client"),
        ("system", "System"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, related_name="audit_events", on_delete=models.CASCADE
    )
    actor_id = models.UUIDField(null=True, blank=True)
    actor_type = models.CharField(max_length=20, choices=ACTOR_TYPES)
    action = models.CharField(max_length=120)
    resource_type = models.CharField(max_length=120)
    resource_id = models.CharField(max_length=120)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "created_at"]),
            models.Index(fields=["organization", "resource_type"]),
        ]
