"""Billing routing."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BillingSummaryView,
    ExpenseViewSet,
    InvoiceViewSet,
    PaymentViewSet,
    TimeEntryViewSet,
)

router = DefaultRouter()
router.register("time-entries", TimeEntryViewSet, basename="time-entry")
router.register("expenses", ExpenseViewSet, basename="expense")
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("payments", PaymentViewSet, basename="payment")

urlpatterns = [
    path("reports/billing-summary/", BillingSummaryView.as_view(), name="billing-summary"),
]
