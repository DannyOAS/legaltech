"""Routing helpers for account endpoints."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    APITokenViewSet,
    InvitationViewSet,
    InvitationAcceptView,
    LoginView,
    LogoutView,
    MFASetupView,
    MFAVerifyView,
    OrganizationViewSet,
    PermissionViewSet,
    RefreshView,
    RoleViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register("org", OrganizationViewSet, basename="org")
router.register("users", UserViewSet, basename="user")
router.register("roles", RoleViewSet, basename="role")
router.register("permissions", PermissionViewSet, basename="permission")
router.register("invitations", InvitationViewSet, basename="invitation")
router.register("api-tokens", APITokenViewSet, basename="api-token")

auth_urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("mfa/setup/", MFASetupView.as_view(), name="mfa-setup"),
    path("mfa/verify/", MFAVerifyView.as_view(), name="mfa-verify"),
    path("invite/accept/", InvitationAcceptView.as_view(), name="invite-accept"),
]
