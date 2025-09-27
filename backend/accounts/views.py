"""API views for account management."""
from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from config.tenancy import OrganizationModelViewSet
from services.audit.logging import audit_action

from .models import APIToken, Invitation, Organization, Role, User
from .permissions import IsOrgAdminOrReadOnly, IsOrganizationMember
from .serializers import (
    APITokenSerializer,
    InvitationSerializer,
    LoginSerializer,
    MFASetupSerializer,
    MFAVerifySerializer,
    OrganizationSerializer,
    RefreshSerializer,
    RoleSerializer,
    TokenObtainPairSerializer,
    UserSerializer,
)


class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)
        refresh["org_id"] = str(user.organization_id)
        access_token = TokenObtainPairSerializer.get_token(user).access_token
        response = Response(UserSerializer(user).data, status=status.HTTP_200_OK)
        expiry = timezone.now() + timedelta(minutes=15)
        response.set_cookie(settings.ACCESS_TOKEN_COOKIE_NAME, str(access_token), httponly=True, secure=not settings.DEBUG, samesite="Lax", expires=expiry)
        response.set_cookie(settings.REFRESH_TOKEN_COOKIE_NAME, str(refresh), httponly=True, secure=not settings.DEBUG, samesite="Strict")
        response.set_cookie(settings.CSRF_TOKEN_COOKIE_NAME, refresh.get("jti"), httponly=False, secure=not settings.DEBUG)
        audit_action(user.organization_id, user.id, "auth.login", "user", str(user.id), request)
        return response


class LogoutView(generics.GenericAPIView):
    def post(self, request: Request) -> Response:
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(settings.ACCESS_TOKEN_COOKIE_NAME)
        response.delete_cookie(settings.REFRESH_TOKEN_COOKIE_NAME)
        audit_action(request.organization_id, request.user.id, "auth.logout", "user", str(request.user.id), request)
        return response


class RefreshView(generics.GenericAPIView):
    serializer_class = RefreshSerializer
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        refresh_token = request.data.get("refresh") or request.COOKIES.get(settings.REFRESH_TOKEN_COOKIE_NAME)
        serializer = self.get_serializer(data={"refresh": refresh_token})
        serializer.is_valid(raise_exception=True)
        refresh = RefreshToken(serializer.validated_data["refresh"])
        user = User.objects.get(id=refresh["user_id"])
        request.organization_id = str(user.organization_id)
        access_token = TokenObtainPairSerializer.get_token(user).access_token
        response = Response(UserSerializer(user).data)
        response.set_cookie(settings.ACCESS_TOKEN_COOKIE_NAME, str(access_token), httponly=True, secure=not settings.DEBUG, samesite="Lax")
        response.set_cookie(settings.CSRF_TOKEN_COOKIE_NAME, refresh.get("jti"), httponly=False, secure=not settings.DEBUG)
        audit_action(user.organization_id, user.id, "auth.refresh", "user", str(user.id), request)
        return response


class MFASetupView(generics.GenericAPIView):
    serializer_class = MFASetupSerializer

    def post(self, request: Request) -> Response:
        payload = {"secret": "BASE32SECRET", "qr_uri": "otpauth://totp/MapleLegal"}
        return Response(payload)


class MFAVerifyView(generics.GenericAPIView):
    serializer_class = MFAVerifySerializer

    def post(self, request: Request) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.mfa_enabled = True
        request.user.save(update_fields=["mfa_enabled"])
        audit_action(request.organization_id, request.user.id, "mfa.enabled", "user", str(request.user.id), request)
        return Response({"status": "ok"})


class OrganizationViewSet(mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    serializer_class = OrganizationSerializer
    permission_classes = [IsOrganizationMember]

    def get_object(self):
        return Organization.objects.get(id=self.request.organization_id)


class UserViewSet(OrganizationModelViewSet):
    serializer_class = UserSerializer
    queryset = User.objects.all()
    permission_classes = [IsOrganizationMember]

    def perform_create(self, serializer):
        password = self.request.data.get("password")
        user = serializer.save(organization=self.request.user.organization)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        audit_action(self.request.organization_id, self.request.user.id, "user.created", "user", str(user.id), self.request)

    @action(detail=False, methods=["get"], serializer_class=UserSerializer)
    def me(self, request: Request) -> Response:
        return Response(self.get_serializer(request.user).data)


class RoleViewSet(OrganizationModelViewSet):
    serializer_class = RoleSerializer
    queryset = Role.objects.all()
    permission_classes = [IsOrgAdminOrReadOnly]


class InvitationViewSet(OrganizationModelViewSet):
    serializer_class = InvitationSerializer
    queryset = Invitation.objects.select_related("role")
    permission_classes = [IsOrgAdminOrReadOnly]

    def perform_destroy(self, instance):
        audit_action(self.request.organization_id, self.request.user.id, "invite.revoked", "invitation", str(instance.id), self.request)
        return super().perform_destroy(instance)


class APITokenViewSet(OrganizationModelViewSet):
    serializer_class = APITokenSerializer
    queryset = APIToken.objects.all()
    permission_classes = [IsOrgAdminOrReadOnly]

    def perform_create(self, serializer):
        token = serializer.save(organization=self.request.user.organization)
        audit_action(self.request.organization_id, self.request.user.id, "api_token.created", "api_token", str(token.id), self.request)
