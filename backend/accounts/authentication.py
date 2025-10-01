"""JWT authentication that reads tokens from httpOnly cookies and headers."""

from __future__ import annotations

import logging

from django.conf import settings
from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication

logger = logging.getLogger(__name__)


class JWTCookieAuthentication(JWTAuthentication):
    """Authenticate using simplejwt but sourcing tokens from cookies."""

    def authenticate(self, request):  # type: ignore[override]
        header = self.get_header(request)
        raw_token = None
        if header is not None:
            raw_token = self.get_raw_token(header)
        if raw_token is None:
            raw_token = request.COOKIES.get(settings.ACCESS_TOKEN_COOKIE_NAME)
        if raw_token is None:
            return None
        validated_token = self.get_validated_token(raw_token)
        if not self._check_csrf(request):
            raise exceptions.AuthenticationFailed("Missing or invalid CSRF token", code="bad_csrf")
        user = self.get_user(validated_token)
        claim_org = validated_token.get("org_id")
        actual_org = str(user.organization_id)
        if claim_org is None:
            logger.warning("JWT missing org_id claim", extra={"user_id": str(user.id)})
            raise exceptions.AuthenticationFailed(
                "Token missing organization scope", code="org_missing"
            )
        if str(claim_org) != actual_org:
            logger.warning(
                "JWT organization mismatch",
                extra={
                    "user_id": str(user.id),
                    "claim_org": str(claim_org),
                    "actual_org": actual_org,
                },
            )
            raise exceptions.AuthenticationFailed(
                "Token organization mismatch", code="org_mismatch"
            )
        request.tenant_org_id = actual_org
        request.organization_id = actual_org
        underlying = getattr(request, "_request", None)
        if underlying is not None:
            underlying.tenant_org_id = actual_org
            underlying.organization_id = actual_org
        return user, validated_token

    def _check_csrf(self, request) -> bool:
        # Double-submit cookie pattern
        csrf_cookie = request.COOKIES.get(settings.CSRF_TOKEN_COOKIE_NAME)
        csrf_header = request.headers.get("X-CSRFToken")
        if request.method in ("GET", "HEAD", "OPTIONS", "TRACE"):
            return True
        return bool(csrf_cookie and csrf_header and csrf_cookie == csrf_header)


class OptionalJWTAuthentication(JWTCookieAuthentication):
    """Authentication class that does not fail if token missing."""

    def authenticate(self, request):  # type: ignore[override]
        try:
            return super().authenticate(request)
        except exceptions.AuthenticationFailed:
            return None
