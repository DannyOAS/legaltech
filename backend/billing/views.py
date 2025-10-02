"""Billing API viewsets."""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from datetime import date

from django.db import transaction
from django.db.models import Sum
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsOrganizationMember, PermissionRequirement, restrict_related_queryset
from notifications.service import send_notification
from config.tenancy import OrganizationModelViewSet
from services.audit.logging import audit_action
from services.notifications.email import send_invoice_created_email
from services.storage.presign import generate_get_url

from .models import Expense, Invoice, Payment, TimeEntry
from .pdf import ensure_invoice_pdf, regenerate_invoice_pdf
from .serializers import ExpenseSerializer, InvoiceSerializer, PaymentSerializer, TimeEntrySerializer


class TimeEntryViewSet(OrganizationModelViewSet):
    serializer_class = TimeEntrySerializer
    queryset = TimeEntry.objects.select_related("matter", "user")
    search_fields = ["description", "matter__title"]
    rbac_resource = "billing"
    rbac_permissions = {
        "list": PermissionRequirement(any=["billing.record_time", "invoice.view", "invoice.view_all"]),
        "retrieve": PermissionRequirement(any=["billing.record_time", "invoice.view", "invoice.view_all"]),
        "create": PermissionRequirement(all=["billing.record_time"]),
        "update": PermissionRequirement(all=["billing.record_time"]),
        "partial_update": PermissionRequirement(all=["billing.record_time"]),
        "destroy": PermissionRequirement(all=["billing.record_time"]),
    }

    def get_queryset(self):  # type: ignore[override]
        queryset = super().get_queryset()
        return restrict_related_queryset(queryset, self.request.user, related_field="matter", bypass_permission="invoice.view_all")

    def perform_create(self, serializer):
        entry = serializer.save(organization=self.request.user.organization, user=self.request.user)
        audit_action(self.request.organization_id, self.request.user.id, "billing.time_entry.created", "time_entry", str(entry.id), self.request)


class ExpenseViewSet(OrganizationModelViewSet):
    serializer_class = ExpenseSerializer
    queryset = Expense.objects.select_related("matter")
    rbac_resource = "billing"
    rbac_permissions = {
        "list": PermissionRequirement(any=["billing.record_expense", "invoice.view", "invoice.view_all"]),
        "retrieve": PermissionRequirement(any=["billing.record_expense", "invoice.view", "invoice.view_all"]),
        "create": PermissionRequirement(all=["billing.record_expense"]),
        "update": PermissionRequirement(all=["billing.record_expense"]),
        "partial_update": PermissionRequirement(all=["billing.record_expense"]),
        "destroy": PermissionRequirement(all=["billing.record_expense"]),
    }

    def get_queryset(self):  # type: ignore[override]
        queryset = super().get_queryset()
        return restrict_related_queryset(queryset, self.request.user, related_field="matter", bypass_permission="invoice.view_all")

    def perform_create(self, serializer):
        expense = serializer.save(organization=self.request.user.organization)
        audit_action(self.request.organization_id, self.request.user.id, "billing.expense.created", "expense", str(expense.id), self.request)


class InvoiceViewSet(OrganizationModelViewSet):
    serializer_class = InvoiceSerializer
    queryset = Invoice.objects.select_related("matter")
    search_fields = ["number", "matter__title"]
    rbac_resource = "invoice"
    rbac_permissions = {
        "list": PermissionRequirement(all=["invoice.view"]),
        "retrieve": PermissionRequirement(all=["invoice.view"]),
        "create": PermissionRequirement(all=["invoice.manage"]),
        "update": PermissionRequirement(all=["invoice.manage"]),
        "partial_update": PermissionRequirement(all=["invoice.manage"]),
        "destroy": PermissionRequirement(all=["invoice.manage"]),
        "send": PermissionRequirement(all=["invoice.manage"]),
        "mark_paid": PermissionRequirement(all=["invoice.mark_paid"]),
        "download": PermissionRequirement(all=["invoice.view"]),
    }

    def get_queryset(self):  # type: ignore[override]
        queryset = super().get_queryset().select_related("matter")
        queryset = restrict_related_queryset(queryset, self.request.user, related_field="matter", bypass_permission="invoice.view_all")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset.order_by("-issue_date")

    def perform_create(self, serializer):
        invoice = serializer.save(organization=self.request.user.organization)
        ensure_invoice_pdf(invoice)
        audit_action(self.request.organization_id, self.request.user.id, "billing.invoice.created", "invoice", str(invoice.id), self.request)
        matter = invoice.matter
        client_user = matter.client.portal_user if matter and matter.client else None
        if client_user and invoice.status == "sent":
            send_notification(
                organization_id=str(self.request.organization_id),
                recipient_id=str(client_user.id),
                notification_type="billing.invoice.created",
                title=f"Invoice {invoice.number} ready",
                body=f"An invoice for {matter.title} is now available.",
                metadata={"invoice_id": str(invoice.id)},
                related_object_type="invoice",
                related_object_id=str(invoice.id),
            )
            send_invoice_created_email(
                to=client_user.email,
                matter_title=matter.title,
                invoice_number=invoice.number,
                amount=str(invoice.total),
            )

    @action(detail=True, methods=["post"], url_path="send")
    def send(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status == "sent":
            return Response(self.get_serializer(invoice).data)
        invoice.status = "sent"
        invoice.save(update_fields=["status"])
        regenerate_invoice_pdf(invoice)
        matter = invoice.matter
        client_user = matter.client.portal_user if matter and matter.client else None
        if client_user:
            send_notification(
                organization_id=str(self.request.organization_id),
                recipient_id=str(client_user.id),
                notification_type="billing.invoice.created",
                title=f"Invoice {invoice.number} ready",
                body=f"An invoice for {matter.title} is now available.",
                metadata={"invoice_id": str(invoice.id)},
                related_object_type="invoice",
                related_object_id=str(invoice.id),
            )
            send_invoice_created_email(
                to=client_user.email,
                matter_title=matter.title,
                invoice_number=invoice.number,
                amount=str(invoice.total),
            )
        audit_action(self.request.organization_id, self.request.user.id, "billing.invoice.sent", "invoice", str(invoice.id), request)
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status == "paid":
            return Response(self.get_serializer(invoice).data)

        data = request.data or {}
        amount = Decimal(str(data.get("amount", invoice.total)))
        method = data.get("method", "manual")
        payment_date = data.get("date")
        try:
            parsed_date = date.fromisoformat(payment_date) if payment_date else date.today()
        except ValueError:
            return Response({"date": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            Payment.objects.create(
                organization=invoice.organization,
                invoice=invoice,
                amount=amount,
                date=parsed_date,
                method=method,
                external_ref=data.get("external_ref", ""),
            )
            invoice.status = "paid"
            invoice.save(update_fields=["status"])

        audit_action(self.request.organization_id, self.request.user.id, "billing.invoice.paid", "invoice", str(invoice.id), request)
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        invoice = self.get_object()
        if not invoice.pdf_file:
            ensure_invoice_pdf(invoice)
        url = generate_get_url(invoice.organization_id, invoice.pdf_file)
        audit_action(
            self.request.organization_id,
            self.request.user.id,
            "billing.invoice.downloaded",
            "invoice",
            str(invoice.id),
            request,
        )
        return Response({"url": url})


class PaymentViewSet(OrganizationModelViewSet):
    serializer_class = PaymentSerializer
    queryset = Payment.objects.select_related("invoice")
    rbac_resource = "invoice"
    rbac_permissions = {
        "list": PermissionRequirement(all=["invoice.view"]),
        "retrieve": PermissionRequirement(all=["invoice.view"]),
        "create": PermissionRequirement(all=["invoice.mark_paid"]),
        "update": PermissionRequirement(all=["invoice.mark_paid"]),
        "partial_update": PermissionRequirement(all=["invoice.mark_paid"]),
        "destroy": PermissionRequirement(all=["invoice.mark_paid"]),
    }

    def get_queryset(self):  # type: ignore[override]
        queryset = super().get_queryset().select_related("invoice", "invoice__matter")
        return restrict_related_queryset(queryset, self.request.user, related_field="invoice__matter", bypass_permission="invoice.view_all")

    def perform_create(self, serializer):
        payment = serializer.save(organization=self.request.user.organization)
        audit_action(self.request.organization_id, self.request.user.id, "billing.payment.recorded", "payment", str(payment.id), self.request)


class BillingSummaryView(APIView):
    """Provide aggregate billing metrics for dashboards."""

    permission_classes = [AllowAny]

    def get(self, request):
        org_id = getattr(request, "organization_id", None)
        if not org_id:
            return Response({"detail": "Organization context required"}, status=status.HTTP_400_BAD_REQUEST)
        hours = TimeEntry.objects.filter(organization_id=org_id).aggregate(total_minutes=Sum("minutes"))
        expenses = Expense.objects.filter(organization_id=org_id).aggregate(total=Sum("amount"))
        outstanding = Invoice.objects.filter(organization_id=org_id).exclude(status="paid").aggregate(total=Sum("total"))
        total_minutes = Decimal(hours["total_minutes"] or 0)
        total_hours = (total_minutes / Decimal(60)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_expenses = (expenses["total"] or Decimal("0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        outstanding_balance = (outstanding["total"] or Decimal("0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        payload = {
            "total_hours": f"{total_hours:.2f}",
            "total_expenses": f"{total_expenses:.2f}",
            "outstanding_balance": f"{outstanding_balance:.2f}",
        }
        return Response(payload, status=status.HTTP_200_OK)
