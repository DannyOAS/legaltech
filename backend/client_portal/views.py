"""Client portal endpoints."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Sum
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.models import Invoice
from matters.models import Matter
from portal.models import Document
from services.audit.logging import audit_action
from services.storage.presign import generate_get_url

from .serializers import ClientDocumentSerializer, ClientInvoiceSerializer, ClientMatterSerializer


class ClientPortalMixin:
    permission_classes = [IsAuthenticated]

    def _get_client(self):
        return getattr(self.request.user, "client_profile", None)

    def _client_queryset(self, queryset):
        client = self._get_client()
        if not client:
            return queryset.none()
        return queryset.filter(organization=client.organization)

    def _ensure_client(self):
        client = self._get_client()
        if client is None:
            return None
        return client


class ClientDocumentViewSet(ClientPortalMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = ClientDocumentSerializer

    def get_queryset(self):
        client = self._get_client()
        if not client:
            return Document.objects.none()
        queryset = Document.objects.filter(
            organization=client.organization,
            matter__client=client,
            client_visible=True,
        ).order_by("-uploaded_at")
        matter_id = self.request.query_params.get("matter")
        if matter_id:
            queryset = queryset.filter(matter_id=matter_id)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(filename__icontains=search.strip())
        return queryset

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request: Request, pk: str | None = None) -> Response:
        document = self.get_object()
        if not document.client_visible:
            return Response({"detail": "Document not shared"}, status=status.HTTP_403_FORBIDDEN)
        url = generate_get_url(document.organization_id, document.s3_key)
        client = self._get_client()
        audit_action(
            document.organization_id,
            getattr(request.user, "id", None),
            "client_portal.document.downloaded",
            "document",
            str(document.id),
            request,
        )
        return Response({"url": url})


class ClientInvoiceViewSet(ClientPortalMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = ClientInvoiceSerializer

    def get_queryset(self):
        client = self._get_client()
        if not client:
            return Invoice.objects.none()
        queryset = Invoice.objects.filter(
            organization=client.organization,
            matter__client=client,
        ).order_by("-issue_date")
        matter_id = self.request.query_params.get("matter")
        if matter_id:
            queryset = queryset.filter(matter_id=matter_id)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request: Request, pk=None) -> Response:
        invoice = self.get_object()
        if not invoice.pdf_file:
            return Response(
                {"detail": "Invoice PDF not available"}, status=status.HTTP_404_NOT_FOUND
            )
        url = generate_get_url(invoice.organization_id, invoice.pdf_file)
        audit_action(
            invoice.organization_id,
            getattr(request.user, "id", None),
            "client_portal.invoice.downloaded",
            "invoice",
            str(invoice.id),
            request,
        )
        return Response({"url": url})


class ClientMatterViewSet(
    ClientPortalMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    serializer_class = ClientMatterSerializer

    def get_queryset(self):
        client = self._get_client()
        if not client:
            return Matter.objects.none()
        return Matter.objects.filter(organization=client.organization, client=client).order_by(
            "-opened_at"
        )


class ClientDashboardView(ClientPortalMixin, APIView):
    def get(self, request: Request) -> Response:
        client = self._get_client()
        if not client:
            return Response(
                {"detail": "Client account not linked"}, status=status.HTTP_400_BAD_REQUEST
            )
        organization_id = client.organization_id
        invoices = Invoice.objects.filter(organization_id=organization_id, matter__client=client)
        documents_count = Document.objects.filter(
            organization_id=organization_id, matter__client=client, client_visible=True
        ).count()
        recent_documents = Document.objects.filter(
            organization_id=organization_id,
            matter__client=client,
            client_visible=True,
        ).order_by("-uploaded_at")[:5]
        serializer = ClientDocumentSerializer(recent_documents, many=True)
        outstanding_value = invoices.exclude(status="paid").aggregate(total=Sum("total"))[
            "total"
        ] or Decimal("0")
        outstanding_value = outstanding_value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if outstanding_value == outstanding_value.to_integral():
            outstanding_display = str(outstanding_value.to_integral())
        else:
            outstanding_display = f"{outstanding_value:.2f}"
        data = {
            "documents_count": documents_count,
            "outstanding_balance": outstanding_display,
            "recent_documents": serializer.data,
        }
        return Response(data)
