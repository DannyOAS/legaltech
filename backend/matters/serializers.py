"""Serializers for clients and matters."""
from __future__ import annotations

from rest_framework import serializers

from accounts.models import User
from config.tenancy import OrganizationScopedPrimaryKeyRelatedField

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
            "portal_user",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "portal_user"]


class MatterSerializer(serializers.ModelSerializer):
    client = ClientSerializer(read_only=True)
    client_id = OrganizationScopedPrimaryKeyRelatedField(queryset=Client.objects.all(), source="client", write_only=True)
    lead_lawyer = OrganizationScopedPrimaryKeyRelatedField(
        queryset=User.objects.all(), allow_null=True, required=False
    )

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
        extra_kwargs = {
            "reference_code": {"required": False, "allow_blank": True},
        }

    def validate_reference_code(self, value: str) -> str:
        return value.strip()
