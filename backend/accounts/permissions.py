"""Role-based access helpers and permission enforcement."""
from __future__ import annotations

from functools import wraps
from typing import Callable, Iterable, Mapping, Sequence

from django.db.models import Q, QuerySet
from rest_framework.permissions import BasePermission, SAFE_METHODS
from rest_framework.request import Request

from .models import Role


def _role_names(user) -> set[str]:
    names = getattr(user, "_cached_role_names", None)
    if names is None:
        names = set(
            user.roles.values_list("name", flat=True)
        ) if user and getattr(user, "is_authenticated", False) else set()
        setattr(user, "_cached_role_names", names)
    return names


def _permission_codes(user) -> set[str]:
    codes = getattr(user, "_cached_permission_codes", None)
    if codes is None:
        if not user or not getattr(user, "is_authenticated", False):
            codes = set()
        else:
            codes = set(
                user.roles.values_list("permissions__codename", flat=True)
            )
        setattr(user, "_cached_permission_codes", codes)
    return codes


def clear_permission_cache(user) -> None:
    for attr in ("_cached_role_names", "_cached_permission_codes"):
        if hasattr(user, attr):
            delattr(user, attr)


def is_client_user(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return "Client" in _role_names(user)


def has_permission(user, permission: str) -> bool:
    if not permission:
        return True
    return permission in _permission_codes(user)


def has_permissions(user, permissions: Iterable[str]) -> bool:
    required = {p for p in permissions if p}
    if not required:
        return True
    codes = _permission_codes(user)
    return required.issubset(codes)


def has_any_permission(user, permissions: Iterable[str]) -> bool:
    options = {p for p in permissions if p}
    if not options:
        return True
    codes = _permission_codes(user)
    return bool(codes & options)


class PermissionRequirement:
    """Container for describing required permissions for an action."""

    __slots__ = ("all", "any")

    def __init__(self, all: Sequence[str] | None = None, any: Sequence[str] | None = None):
        self.all = list(all or [])
        self.any = list(any or [])

    def is_satisfied(self, user) -> bool:
        if not user or not getattr(user, "is_authenticated", False):
            return False
        if self.all and not has_permissions(user, self.all):
            return False
        if self.any and not has_any_permission(user, self.any):
            return False
        return True

    @classmethod
    def from_value(cls, value: Sequence[str] | Mapping[str, Sequence[str]] | "PermissionRequirement") -> "PermissionRequirement":
        if isinstance(value, PermissionRequirement):
            return value
        if isinstance(value, Mapping):
            return cls(all=value.get("all"), any=value.get("any"))
        return cls(all=value)


class RBACPermission(BasePermission):
    """Evaluate DRF view permission requirements against role permissions."""

    message = "You do not have permission to perform this action."

    def has_permission(self, request: Request, view) -> bool:  # type: ignore[override]
        requirement = getattr(view, "get_required_permissions", None)
        if callable(requirement):
            required = requirement()
        else:
            required = getattr(view, "required_permissions", None)
        if not required:
            return True
        requirement_obj = PermissionRequirement.from_value(required)
        return requirement_obj.is_satisfied(request.user)

    def has_object_permission(self, request: Request, view, obj) -> bool:  # type: ignore[override]
        checker = getattr(view, "get_object_permission_requirement", None)
        if callable(checker):
            requirement = checker(obj)
            if not requirement:
                return True
            requirement_obj = PermissionRequirement.from_value(requirement)
            return requirement_obj.is_satisfied(request.user)
        return True


class IsOrganizationMember(BasePermission):
    message = "User must belong to an organization."

    def has_permission(self, request, view) -> bool:  # type: ignore[override]
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "organization_id", None))


class IsOrgAdminOrReadOnly(BasePermission):
    """Backwards-compatible guard requiring org admin privileges for writes."""

    message = "Admin or partner role required for write operations."
    required_permission = "org.manage_users"

    def has_permission(self, request, view) -> bool:  # type: ignore[override]
        if request.method in SAFE_METHODS:
            return True
        return has_permission(request.user, self.required_permission)


class IsNotClient(BasePermission):
    message = "Client portal users cannot access this resource."

    def has_permission(self, request, view) -> bool:  # type: ignore[override]
        return not is_client_user(request.user)


def role_required(*role_names: str) -> Callable:
    """Decorator enforcing that the requesting user has one of the provided roles."""

    def decorator(view_func: Callable):
        @wraps(view_func)
        def wrapped(view_or_request, request=None, *args, **kwargs):
            if request is None:
                request = view_or_request
            else:
                # method view
                pass
            user = getattr(request, "user", None)
            if not user or not getattr(user, "is_authenticated", False):
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("Authentication required")
            if not (_role_names(user) & set(role_names)):
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("Role not allowed")
            return view_func(view_or_request, request, *args, **kwargs)

        return wrapped

    return decorator


def permission_required(*permissions: str) -> Callable:
    """Decorator enforcing that the user has all listed permissions."""

    def decorator(view_func: Callable):
        @wraps(view_func)
        def wrapped(view_or_request, request=None, *args, **kwargs):
            if request is None:
                request = view_or_request
            user = getattr(request, "user", None)
            if not user or not getattr(user, "is_authenticated", False):
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("Authentication required")
            if not has_permissions(user, permissions):
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("Missing required permissions")
            return view_func(view_or_request, request, *args, **kwargs)

        return wrapped

    return decorator


def restrict_matters_queryset(queryset: QuerySet, user, *, bypass_permission: str = "matter.view_all") -> QuerySet:
    """Apply row-level restrictions for matter querysets."""

    if has_permission(user, bypass_permission):
        return queryset
    client_profile = getattr(user, "client_profile", None)
    if client_profile:
        return queryset.filter(client=client_profile)
    return queryset.filter(
        Q(lead_lawyer=user)
        | Q(access_list__user=user)
    ).distinct()


def restrict_related_queryset(
    queryset: QuerySet,
    user,
    *,
    related_field: str,
    bypass_permission: str,
    client_visible_only: bool = False,
) -> QuerySet:
    """Restrict querysets that have a FK to matters or clients."""

    if has_permission(user, bypass_permission):
        return queryset
    client_profile = getattr(user, "client_profile", None)
    if client_profile:
        filters = {f"{related_field}__client": client_profile}
        if client_visible_only:
            filters["client_visible"] = True
        return queryset.filter(**filters)
    filters = Q(**{f"{related_field}__lead_lawyer": user}) | Q(**{f"{related_field}__access_list__user": user})
    if client_visible_only:
        filters &= Q(client_visible=True)
    return queryset.filter(filters).distinct()


def ensure_role(user, organization, role_name: str) -> Role:
    """Assign the specified role to the user if not already present."""

    role = Role.objects.get(organization=organization, name=role_name)
    if not role.role_users.filter(user=user).exists():
        role.role_users.create(user=user)
    clear_permission_cache(user)
    return role
