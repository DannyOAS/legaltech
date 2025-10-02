"""Custom middleware for tenancy context and security headers."""

from __future__ import annotations

from typing import Callable

from django.conf import settings
from django.http import HttpRequest, HttpResponse

from services.audit import context as audit_context


class TenantContextMiddleware:
    """Populate request tenant context based on authenticated user or claims."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        org_id = getattr(request, "tenant_org_id", None) or getattr(
            request.user, "organization_id", None
        )
        request.organization_id = org_id
        audit_context.set_current_org(org_id)
        try:
            response = self.get_response(request)
        finally:
            audit_context.clear_current_org()
        if csp := getattr(settings, "CONTENT_SECURITY_POLICY", None):
            response["Content-Security-Policy"] = csp
        response["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains" if not settings.DEBUG else "max-age=60"
        )
        return response
