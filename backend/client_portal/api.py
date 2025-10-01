"""Routing for client portal endpoints."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ClientDashboardView, ClientDocumentViewSet, ClientInvoiceViewSet, ClientMatterViewSet

router = DefaultRouter()
router.register("client/documents", ClientDocumentViewSet, basename="client-documents")
router.register("client/invoices", ClientInvoiceViewSet, basename="client-invoices")
router.register("client/matters", ClientMatterViewSet, basename="client-matters")

urlpatterns = router.urls + [
    path("client/dashboard/", ClientDashboardView.as_view(), name="client-dashboard"),
]
