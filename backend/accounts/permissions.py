from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission
        if user and getattr(user, "is_authenticated", False):
            names = set(user.roles.values_list("name", flat=True))
        else:
            names = set()
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
