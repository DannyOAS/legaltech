"""Serializers for client portal views."""
from __future__ import annotations

from rest_framework import serializers

from billing.models import Invoice
from matters.models import Matter
from portal.models import Document


class ClientDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            "id",
            "matter",
            "filename",
            "mime",
            "size",
            "uploaded_at",
            "client_visible",
        ]
        read_only_fields = fields


class ClientInvoiceSerializer(serializers.ModelSerializer):
    matter_title = serializers.CharField(source="matter.title", read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "number",
            "issue_date",
            "due_date",
            "total",
            "status",
            "matter_title",
        ]
        read_only_fields = fields


class ClientMatterSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.display_name", read_only=True)
    lead_lawyer_name = serializers.SerializerMethodField()

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
            "client_name",
            "lead_lawyer_name",
        ]
        read_only_fields = fields

    def get_lead_lawyer_name(self, obj: Matter) -> str | None:
        lawyer = getattr(obj, "lead_lawyer", None)
        if not lawyer:
            return None
        full_name = f"{lawyer.first_name} {lawyer.last_name}".strip()
        return full_name or lawyer.email
