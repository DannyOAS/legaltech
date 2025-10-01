"""Role-based access helpers."""
from __future__ import annotations

from rest_framework.permissions import BasePermission, SAFE_METHODS


def _role_names(user) -> set[str]:
    names = getattr(user, "_cached_role_names", None)
    if names is None:
        names = set(user.roles.values_list("name", flat=True)) if user and user.is_authenticated else set()
        setattr(user, "_cached_role_names", names)
    return names


def is_client_user(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return "Client" in _role_names(user)


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
        return bool(_role_names(user) & self.elevated_roles)


class IsNotClient(BasePermission):
    message = "Client portal users cannot access this resource."

    def has_permission(self, request, view) -> bool:
        return not is_client_user(request.user)
