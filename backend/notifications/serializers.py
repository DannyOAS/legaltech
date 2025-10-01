"""Serializers for notifications."""
from __future__ import annotations

from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "title",
            "body",
            "metadata",
            "created_at",
            "read_at",
            "related_object_type",
            "related_object_id",
        ]
        read_only_fields = fields
