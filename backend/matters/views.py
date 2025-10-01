"""Matter domain viewsets."""
from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta

from config.tenancy import OrganizationModelViewSet
from services.audit.logging import audit_action

from .models import Client, Matter, CaseDeadline
from .serializers import ClientSerializer, MatterSerializer, CaseDeadlineSerializer, CaseDeadlineListSerializer


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


class CaseDeadlineViewSet(OrganizationModelViewSet):
    serializer_class = CaseDeadlineSerializer
    queryset = CaseDeadline.objects.filter(is_deleted=False).select_related("matter", "created_by")
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "priority", "deadline_type", "matter__id"]
    search_fields = ["title", "description", "matter__title"]
    ordering_fields = ["due_date", "created_at", "priority"]
    ordering = ["due_date"]

    def get_serializer_class(self):
        if self.action == "list":
            return CaseDeadlineListSerializer
        return CaseDeadlineSerializer

    def perform_create(self, serializer):
        deadline = serializer.save(
            organization=self.request.user.organization,
            created_by=self.request.user
        )
        audit_action(
            self.request.organization_id, 
            self.request.user.id, 
            "deadline.created", 
            "deadline", 
            str(deadline.id), 
            self.request
        )

    def perform_update(self, serializer):
        deadline = serializer.save()
        audit_action(
            self.request.organization_id, 
            self.request.user.id, 
            "deadline.updated", 
            "deadline", 
            str(deadline.id), 
            self.request
        )

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Get upcoming deadlines summary for dashboard widget."""
        now = timezone.now()
        upcoming_deadlines = self.get_queryset().filter(
            due_date__gte=now,
            status="pending"
        ).order_by("due_date")[:5]
        
        overdue_count = self.get_queryset().filter(
            due_date__lt=now,
            status="pending"
        ).count()
        
        serializer = CaseDeadlineListSerializer(upcoming_deadlines, many=True)
        return Response({
            "upcoming": serializer.data,
            "overdue_count": overdue_count
        })

    @action(detail=False, methods=["get"])
    def calendar(self, request):
        """Get deadlines for calendar view."""
        start_date = request.query_params.get("start")
        end_date = request.query_params.get("end")
        
        queryset = self.get_queryset()
        if start_date and end_date:
            queryset = queryset.filter(
                due_date__gte=start_date,
                due_date__lte=end_date
            )
        
        serializer = CaseDeadlineListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def mark_completed(self, request, pk=None):
        """Mark a deadline as completed."""
        deadline = self.get_object()
        deadline.status = "completed"
        deadline.save(update_fields=["status", "updated_at"])
        
        audit_action(
            self.request.organization_id, 
            self.request.user.id, 
            "deadline.completed", 
            "deadline", 
            str(deadline.id), 
            self.request
        )
        
        return Response({"status": "completed"})
