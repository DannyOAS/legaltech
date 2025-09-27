"""Matter domain viewsets."""
from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from config.tenancy import OrganizationModelViewSet
from services.audit.logging import audit_action

from .models import Client, Matter
from .serializers import ClientSerializer, MatterSerializer


class ClientViewSet(OrganizationModelViewSet):
    serializer_class = ClientSerializer
    queryset = Client.objects.filter(is_deleted=False)
    filter_backends = [filters.SearchFilter]
    search_fields = ["display_name", "primary_email"]

    def perform_create(self, serializer):
        client = serializer.save(organization=self.request.user.organization)
        audit_action(self.request.organization_id, self.request.user.id, "client.created", "client", str(client.id), self.request)


class MatterViewSet(OrganizationModelViewSet):
    serializer_class = MatterSerializer
    queryset = Matter.objects.filter(is_deleted=False).select_related("client", "lead_lawyer")
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["status", "practice_area", "client__id"]
    search_fields = ["title", "reference_code"]

    def perform_create(self, serializer):
        matter = serializer.save(organization=self.request.user.organization)
        audit_action(self.request.organization_id, self.request.user.id, "matter.created", "matter", str(matter.id), self.request)
