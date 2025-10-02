from rest_framework.permissions import SAFE_METHODS, BasePermission
        if user and getattr(user, "is_authenticated", False):
            names = set(user.roles.values_list("name", flat=True))
        else:
            names = set()

    def has_permission(self, request: Request, view) -> bool:  # type: ignore[override]

    def has_permission(self, request: Request, view) -> bool:  # type: ignore[override]
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return bool(_role_names(user) & self.elevated_roles)


class IsNotClient(BasePermission):
    message = "Client portal users cannot access this resource."

    def has_permission(self, request: Request, view) -> bool:  # type: ignore[override]
        return not is_client_user(request.user)
