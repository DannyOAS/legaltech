"""Serializers for billing domain."""
from __future__ import annotations

from rest_framework import serializers

from config.tenancy import OrganizationScopedPrimaryKeyRelatedField
from matters.models import Matter

from .models import Expense, Invoice, Payment, TimeEntry


class TimeEntrySerializer(serializers.ModelSerializer):
    matter = OrganizationScopedPrimaryKeyRelatedField(queryset=Matter.objects.all())

    class Meta:
        model = TimeEntry
        fields = [
            "id",
            "matter",
            "user",
            "description",
            "minutes",
            "rate",
            "date",
            "billable",
            "source",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "user"]


class ExpenseSerializer(serializers.ModelSerializer):
    matter = OrganizationScopedPrimaryKeyRelatedField(queryset=Matter.objects.all())

    class Meta:
        model = Expense
        fields = [
            "id",
            "matter",
            "description",
            "amount",
            "date",
            "tax_code",
            "receipt_file",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class InvoiceSerializer(serializers.ModelSerializer):
    matter = OrganizationScopedPrimaryKeyRelatedField(queryset=Matter.objects.all())

    class Meta:
        model = Invoice
        fields = [
            "id",
            "matter",
            "number",
            "issue_date",
            "due_date",
            "subtotal",
            "tax_total",
            "total",
            "status",
            "pdf_file",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "pdf_file"]


class PaymentSerializer(serializers.ModelSerializer):
    invoice = OrganizationScopedPrimaryKeyRelatedField(queryset=Invoice.objects.all())

    class Meta:
        model = Payment
        fields = [
            "id",
            "invoice",
            "amount",
            "date",
            "method",
            "external_ref",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class BillingSummarySerializer(serializers.Serializer):
    total_hours = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_expenses = serializers.DecimalField(max_digits=12, decimal_places=2)
    outstanding_balance = serializers.DecimalField(max_digits=12, decimal_places=2)
