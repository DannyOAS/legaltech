"""Role-based access helpers."""
from __future__ import annotations

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOrganizationMember(BasePermission):
    message = "User must belong to an organization."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "organization_id", None))


class IsOrgAdminOrReadOnly(BasePermission):
    message = "Admin or owner role required for write operations."

    elevated_roles = {"Owner", "Admin"}

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return bool(set(user.roles.values_list("name", flat=True)) & self.elevated_roles)  # type: ignore[attr-defined]
