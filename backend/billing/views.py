"""Billing API viewsets."""
from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsOrganizationMember
from config.tenancy import OrganizationModelViewSet
from services.audit.logging import audit_action

from .models import Expense, Invoice, Payment, TimeEntry
from .serializers import BillingSummarySerializer, ExpenseSerializer, InvoiceSerializer, PaymentSerializer, TimeEntrySerializer


class TimeEntryViewSet(OrganizationModelViewSet):
    serializer_class = TimeEntrySerializer
    queryset = TimeEntry.objects.select_related("matter", "user")
    search_fields = ["description", "matter__title"]

    def perform_create(self, serializer):
        entry = serializer.save(organization=self.request.user.organization, user=self.request.user)
        audit_action(self.request.organization_id, self.request.user.id, "billing.time_entry.created", "time_entry", str(entry.id), self.request)


class ExpenseViewSet(OrganizationModelViewSet):
    serializer_class = ExpenseSerializer
    queryset = Expense.objects.select_related("matter")

    def perform_create(self, serializer):
        expense = serializer.save(organization=self.request.user.organization)
        audit_action(self.request.organization_id, self.request.user.id, "billing.expense.created", "expense", str(expense.id), self.request)


class InvoiceViewSet(OrganizationModelViewSet):
    serializer_class = InvoiceSerializer
    queryset = Invoice.objects.select_related("matter")

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        invoice = self.get_object()
        invoice.status = "paid"
        invoice.save(update_fields=["status"])
        audit_action(self.request.organization_id, self.request.user.id, "billing.invoice.paid", "invoice", str(invoice.id), request)
        return Response(self.get_serializer(invoice).data)


class PaymentViewSet(OrganizationModelViewSet):
    serializer_class = PaymentSerializer
    queryset = Payment.objects.select_related("invoice")

    def perform_create(self, serializer):
        payment = serializer.save(organization=self.request.user.organization)
        audit_action(self.request.organization_id, self.request.user.id, "billing.payment.recorded", "payment", str(payment.id), self.request)


class BillingSummaryView(APIView):
    """Provide aggregate billing metrics for dashboards."""

    permission_classes = [IsOrganizationMember]

    def get(self, request):
        org_id = request.organization_id
        hours = TimeEntry.objects.filter(organization_id=org_id).aggregate(total_minutes=Sum("minutes"))
        expenses = Expense.objects.filter(organization_id=org_id).aggregate(total=Sum("amount"))
        outstanding = Invoice.objects.filter(organization_id=org_id).exclude(status="paid").aggregate(total=Sum("total"))
        payload = {
            "total_hours": Decimal(hours["total_minutes"] or 0) / Decimal(60),
            "total_expenses": expenses["total"] or Decimal("0"),
            "outstanding_balance": outstanding["total"] or Decimal("0"),
        }
        serializer = BillingSummarySerializer(payload)
        return Response(serializer.data, status=status.HTTP_200_OK)
