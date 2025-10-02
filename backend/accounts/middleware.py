"""Middleware helpers for RBAC enforcement."""
from __future__ import annotations

from typing import Callable

from django.http import HttpRequest, HttpResponse

from .permissions import _permission_codes


class RBACMiddleware:
    """Attach cached permission sets to the request for quick access downstream."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        user = getattr(request, "user", None)
        request.permission_codes = _permission_codes(user) if user is not None else set()
        return self.get_response(request)
