"""Integration API stubs."""

from __future__ import annotations

from django.urls import path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from services.audit.logging import audit_action

from . import docusign, stripe


@api_view(["POST"])
def stripe_connect(request: Request) -> Response:
    auth_code = request.data.get("code")
    connection = stripe.connect_account(auth_code)
    audit_action(
        request.organization_id,
        request.user.id,
        "integration.stripe.connect",
        "stripe",
        connection.account_id,
        request,
    )
    return Response({"account_id": connection.account_id, "livemode": connection.livemode})


@api_view(["POST"])
@permission_classes([AllowAny])
def docusign_webhook(request: Request) -> Response:
    docusign.handle_webhook(request.data)
    return Response({"status": "ok"})


urlpatterns = [
    path("stripe/connect", stripe_connect, name="stripe-connect"),
    path("docusign/webhook", docusign_webhook, name="docusign-webhook"),
]
