"""Notification viewsets."""
from __future__ import annotations

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from config.tenancy import OrganizationScopedQuerySetMixin

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(OrganizationScopedQuerySetMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    queryset = Notification.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset().order_by("-created_at")
        queryset = queryset.filter(recipient=self.request.user)
        
        # Filter by read status if specified
        read_filter = self.request.query_params.get("read")
        if read_filter == "true":
            queryset = queryset.filter(read_at__isnull=False)
        elif read_filter == "false":
            queryset = queryset.filter(read_at__isnull=True)
        
        # Filter by notification type if specified
        notification_type = self.request.query_params.get("type")
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)
            
        return queryset

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request: Request) -> Response:
        """Get notification statistics for the current user."""
        queryset = self.get_queryset()
        total = queryset.count()
        unread = queryset.filter(read_at__isnull=True).count()
        
        # Get unread counts by type for Ontario legal compliance categories
        unread_by_type = {}
        for notification_type in ["billing.invoice.created", "portal.document.shared", "portal.message.sent", "mfa.enforcement_applied"]:
            count = queryset.filter(read_at__isnull=True, notification_type=notification_type).count()
            if count > 0:
                unread_by_type[notification_type] = count
                
        return Response({
            "total": total,
            "unread": unread,
            "unread_by_type": unread_by_type
        })

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request: Request, pk: str | None = None) -> Response:
        """Mark a specific notification as read."""
        notification = self.get_queryset().filter(pk=pk).first()
        if not notification:
            return Response(status=status.HTTP_404_NOT_FOUND)
        notification.mark_read()
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request: Request) -> Response:
        """Mark all notifications as read for the current user."""
        from .service import mark_all_read
        
        count = mark_all_read(
            organization_id=str(request.organization_id),
            recipient_id=str(request.user.id)
        )
        
        return Response({"marked_read": count})

    @action(detail=False, methods=["post"], url_path="mark-type-read")
    def mark_type_read(self, request: Request) -> Response:
        """Mark all notifications of a specific type as read."""
        notification_type = request.data.get("type")
        if not notification_type:
            return Response({"error": "type is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        from django.utils import timezone
        count = (
            self.get_queryset()
            .filter(notification_type=notification_type, read_at__isnull=True)
            .update(read_at=timezone.now())
        )
        
        return Response({"marked_read": count})
