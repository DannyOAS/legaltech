"""Serializers for audit events."""

from rest_framework import serializers

from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "organization",
            "actor_id",
            "actor_type",
            "action",
            "resource_type",
            "resource_id",
            "ip",
            "user_agent",
            "created_at",
            "metadata",
        ]
        read_only_fields = fields
