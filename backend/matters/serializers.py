"""Serializers for clients and matters."""

from __future__ import annotations

from rest_framework import serializers

from accounts.models import User
from config.tenancy import OrganizationScopedPrimaryKeyRelatedField

from .models import Client, Matter, CaseDeadline


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
    client_id = OrganizationScopedPrimaryKeyRelatedField(
        queryset=Client.objects.all(), source="client", write_only=True
    )
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


class CaseDeadlineSerializer(serializers.ModelSerializer):
    matter = MatterSerializer(read_only=True)
    matter_id = OrganizationScopedPrimaryKeyRelatedField(queryset=Matter.objects.all(), source="matter", write_only=True)
    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = CaseDeadline
        fields = [
            "id",
            "title",
            "description",
            "deadline_type",
            "due_date",
            "rule_reference",
            "priority",
            "status",
            "matter",
            "matter_id",
            "created_by",
            "notifications_sent",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "matter", "created_by", "notifications_sent"]


class CaseDeadlineListSerializer(serializers.ModelSerializer):
    matter_title = serializers.CharField(source="matter.title", read_only=True)
    matter_reference = serializers.CharField(source="matter.reference_code", read_only=True)

    class Meta:
        model = CaseDeadline
        fields = [
            "id",
            "title",
            "deadline_type",
            "due_date",
            "priority",
            "status",
            "matter_id",
            "matter_title",
            "matter_reference",
            "created_at",
        ]
