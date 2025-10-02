"""Audit event viewsets."""

    serializer_class = AuditEventSerializer
    queryset = AuditEvent.objects.select_related("organization")
    http_method_names = ["get", "head", "options"]
    ordering = ["-created_at"]
