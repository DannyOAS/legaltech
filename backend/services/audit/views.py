"""Audit event viewsets."""

from config.tenancy import OrganizationModelViewSet

from .models import AuditEvent
from .serializers import AuditEventSerializer


class AuditEventViewSet(OrganizationModelViewSet):
    serializer_class = AuditEventSerializer
    queryset = AuditEvent.objects.select_related("organization")
    http_method_names = ["get", "head", "options"]
    ordering = ["-created_at"]
    rbac_resource = "audit"
    rbac_permissions = {
        "list": PermissionRequirement(all=["org.view_audit_logs"]),
        "retrieve": PermissionRequirement(all=["org.view_audit_logs"]),
    }
