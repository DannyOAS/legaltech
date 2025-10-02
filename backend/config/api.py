"""Aggregate API routing for versioned endpoints."""

from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.api import auth_urlpatterns
from accounts.api import router as accounts_router
from billing.api import router as billing_router
from billing.api import urlpatterns as billing_urls
from case_rules.api import CalculateDeadlinesView
from client_portal.api import router as client_portal_router
from client_portal.api import urlpatterns as client_portal_urls
from core.views import SettingsView
from matters.api import router as matters_router
from notifications.api import router as notifications_router
from portal.api import router as portal_router
from portal.api import urlpatterns as portal_urls
from services.ai.api import ContractAnalysisView
from services.audit.api import router as audit_router

router = DefaultRouter()
for r in (
    accounts_router,
    matters_router,
    billing_router,
    portal_router,
    audit_router,
    notifications_router,
    client_portal_router,
):
    for prefix, viewset, basename in r.registry:
        router.register(prefix, viewset, basename=basename)

urlpatterns = [
    path("", include(router.urls)),
    path("", include((billing_urls, "billing"))),
    path("", include((portal_urls, "portal"))),
    path("auth/", include((auth_urlpatterns, "auth"))),
    path("settings/", SettingsView.as_view(), name="settings"),
    path("integrations/", include("integrations.api")),
    path("", include((client_portal_urls, "client-portal"))),
    path("case-rules/calc/", CalculateDeadlinesView.as_view(), name="case-rules-calc"),
    path("contracts/analyze/", ContractAnalysisView.as_view(), name="contracts-analyze"),
]
