"""Helpers to enforce organization scoping across the API."""
from __future__ import annotations

from typing import Any

from django.db.models import Model, QuerySet
from django.http import HttpRequest
from rest_framework import mixins, viewsets


class OrganizationScopedQuerySetMixin:
    """Ensure querysets are filtered by the request organization."""

    organization_field = "organization"

    def get_queryset(self) -> QuerySet[Any]:  # type: ignore[override]
        queryset = super().get_queryset()
        org_id = getattr(self.request, "organization_id", None)
        if org_id is None:
            return queryset.none()
        return queryset.filter(**{f"{self.organization_field}_id": org_id})

    def perform_create(self, serializer):  # type: ignore[override]
        org_id = getattr(self.request, "organization_id", None)
        serializer.save(**{self.organization_field: self.request.user.organization})

    def perform_update(self, serializer):  # type: ignore[override]
        serializer.save()


class OrganizationModelViewSet(
    OrganizationScopedQuerySetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Generic viewset enforcing org scoping."""


def assert_object_org(obj: Model, request: HttpRequest) -> None:
    org_id = getattr(request, "organization_id", None)
    model_org_id = getattr(obj, "organization_id", None)
    if org_id is None or model_org_id is None or org_id != model_org_id:
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Object does not belong to the requesting organization")
