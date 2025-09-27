"""Serializers for clients and matters."""
from __future__ import annotations

from rest_framework import serializers

from .models import Client, Matter


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            "id",
            "display_name",
            "primary_email",
            "phone",
            "address",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class MatterSerializer(serializers.ModelSerializer):
    client = ClientSerializer(read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all(), source="client", write_only=True)

    class Meta:
        model = Matter
        fields = [
            "id",
            "title",
            "practice_area",
            "status",
            "opened_at",
            "closed_at",
            "reference_code",
            "lead_lawyer",
            "client",
            "client_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "client"]
