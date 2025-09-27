"""Aggregate API routing for versioned endpoints."""
from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.api import auth_urlpatterns, router as accounts_router
from billing.api import router as billing_router, urlpatterns as billing_urls
from core.views import SettingsView
from matters.api import router as matters_router
from portal.api import router as portal_router, urlpatterns as portal_urls
from services.audit.api import router as audit_router

router = DefaultRouter()
for r in (accounts_router, matters_router, billing_router, portal_router, audit_router):
    for prefix, viewset, basename in r.registry:
        router.register(prefix, viewset, basename=basename)

urlpatterns = [
    path("", include(router.urls)),
    path("", include((billing_urls, "billing"))),
    path("", include((portal_urls, "portal"))),
    path("auth/", include((auth_urlpatterns, "auth"))),
    path("settings/", SettingsView.as_view(), name="settings"),
    path("integrations/", include("integrations.api")),
]
