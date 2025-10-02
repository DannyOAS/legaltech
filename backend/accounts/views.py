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
from services.notifications.email import send_invitation_email

from .permissions import IsNotClient, IsOrgAdminOrReadOnly, IsOrganizationMember
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

        # Record login timestamp for security tracking
        user.record_login()

        # Check if staff user needs MFA enforcement (Ontario compliance)
        if user.needs_mfa_enforcement():
            user.enforce_mfa_setup()
            audit_action(
                user.organization_id,
                user.id,
                "mfa.enforcement_applied",
                "user",
                str(user.id),
                request,
            )
            return Response(
                {
                    "mfa_setup_required": True,
                    "message": "MFA setup is required for staff accounts to comply with Ontario security standards.",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        refresh = RefreshToken.for_user(user)
        refresh["org_id"] = str(user.organization_id)
        access_token = TokenObtainPairSerializer.get_token(user).access_token

        # Include MFA setup requirement in response
        user_data = UserSerializer(user).data
        user_data["requires_mfa_setup"] = user.requires_mfa_setup()

        response = Response(user_data, status=status.HTTP_200_OK)
        expiry = timezone.now() + timedelta(minutes=15)
        response.set_cookie(
            settings.ACCESS_TOKEN_COOKIE_NAME,
            str(access_token),
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
            expires=expiry,
        )
        response.set_cookie(
            settings.REFRESH_TOKEN_COOKIE_NAME,
            str(refresh),
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Strict",
        )
        response.set_cookie(
            settings.CSRF_TOKEN_COOKIE_NAME,
            refresh.get("jti"),
            httponly=False,
            secure=not settings.DEBUG,
        )
        audit_action(user.organization_id, user.id, "auth.login", "user", str(user.id), request)
        return response


class LogoutView(generics.GenericAPIView):
    def post(self, request: Request) -> Response:
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(settings.ACCESS_TOKEN_COOKIE_NAME)
        response.delete_cookie(settings.REFRESH_TOKEN_COOKIE_NAME)
        audit_action(
            request.organization_id,
            request.user.id,
            "auth.logout",
            "user",
            str(request.user.id),
            request,
        )
        return response


class RefreshView(generics.GenericAPIView):
    serializer_class = RefreshSerializer
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        refresh_token = request.data.get("refresh") or request.COOKIES.get(
            settings.REFRESH_TOKEN_COOKIE_NAME
        )
        serializer = self.get_serializer(data={"refresh": refresh_token})
        serializer.is_valid(raise_exception=True)
        refresh = RefreshToken(serializer.validated_data["refresh"])
        user = User.objects.get(id=refresh["user_id"])
        request.organization_id = str(user.organization_id)
        access_token = TokenObtainPairSerializer.get_token(user).access_token
        response = Response(UserSerializer(user).data)
        response.set_cookie(
            settings.ACCESS_TOKEN_COOKIE_NAME,
            str(access_token),
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
        )
        response.set_cookie(
            settings.CSRF_TOKEN_COOKIE_NAME,
            refresh.get("jti"),
            httponly=False,
            secure=not settings.DEBUG,
        )
        audit_action(user.organization_id, user.id, "auth.refresh", "user", str(user.id), request)
        return response


class MFASetupView(generics.GenericAPIView):
    serializer_class = MFASetupSerializer

    def post(self, request: Request) -> Response:
        secret = generate_secret()
        request.user.mfa_pending_secret = secret
        request.user.save(update_fields=["mfa_pending_secret"])
        issuer = getattr(request, "organization_id", None) or request.user.organization.name
        qr_uri = provisioning_uri(secret, name=request.user.email, issuer=f"MapleLegal - {issuer}")
        return Response({"secret": secret, "qr_uri": qr_uri})


class MFAVerifyView(generics.GenericAPIView):
    serializer_class = MFAVerifySerializer

    def post(self, request: Request) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        updates: list[str] = []

        if serializer.validated_data.get("using_pending_secret") and user.mfa_pending_secret:
            user.mfa_secret = user.mfa_pending_secret
            user.mfa_pending_secret = None
            updates.extend(["mfa_secret", "mfa_pending_secret"])

        if not user.mfa_enabled:
            user.mfa_enabled = True
            updates.append("mfa_enabled")

        if user.mfa_enforced_at:
            user.mfa_enforced_at = None
            updates.append("mfa_enforced_at")

        if updates:
            # Use dict to keep field order unique while preserving original ordering
            user.save(update_fields=list(dict.fromkeys(updates)))

        audit_action(
            request.organization_id,
            request.user.id,
            "mfa.enabled",
            "user",
            str(request.user.id),
            request,
        )
        # Generate tokens for immediate login after MFA setup
        refresh = RefreshToken.for_user(request.user)
        refresh["org_id"] = str(request.user.organization_id)
        access_token = TokenObtainPairSerializer.get_token(request.user).access_token

        user_data = UserSerializer(request.user).data
        user_data["requires_mfa_setup"] = False

        response = Response({"status": "ok", "user": user_data, "setup_complete": True})

        # Set auth cookies for seamless login
        expiry = timezone.now() + timedelta(minutes=15)
        response.set_cookie(
            settings.ACCESS_TOKEN_COOKIE_NAME,
            str(access_token),
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
            expires=expiry,
        )
        response.set_cookie(
            settings.REFRESH_TOKEN_COOKIE_NAME,
            str(refresh),
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Strict",
        )
        response.set_cookie(
            settings.CSRF_TOKEN_COOKIE_NAME,
            refresh.get("jti"),
            httponly=False,
            secure=not settings.DEBUG,
        )

        return response


class InvitationAcceptView(generics.GenericAPIView):
    serializer_class = InvitationAcceptSerializer
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = serializer.validated_data["invitation"]
        user = serializer.save()

        # Comprehensive audit logging for invitation acceptance
        audit_action(
            user.organization_id,
            user.id,
            "invite.accepted",
            "user",
            str(user.id),
            request,
            metadata={
                "invitation_id": str(invitation.id),
                "role": invitation.role.name,
                "is_client": invitation.role.name == "Client",
                "client_id": str(invitation.client.id) if invitation.client else None,
            },
        )

        # Additional audit for client portal user creation if applicable
        if invitation.role.name == "Client" and invitation.client:
            audit_action(
                user.organization_id,
                user.id,
                "client.portal_user_created",
                "client",
                str(invitation.client.id),
                request,
                metadata={"user_id": str(user.id)},
            )

        # Return user data with role information for frontend routing
        user_data = UserSerializer(user).data
        user_data["roles"] = [invitation.role.name]

        return Response(user_data, status=status.HTTP_201_CREATED)


class OrganizationViewSet(
    mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    serializer_class = OrganizationSerializer
    permission_classes = [IsOrganizationMember]

    def get_object(self):
        return Organization.objects.get(id=self.request.organization_id)


class UserViewSet(OrganizationModelViewSet):
    serializer_class = UserSerializer
    queryset = User.objects.all()
    permission_classes = [IsOrganizationMember, IsNotClient]

    def get_permissions(self):  # type: ignore[override]
        if getattr(self, "action", None) == "me":
            return [IsOrganizationMember()]
        return [permission() for permission in self.permission_classes]

    def perform_create(self, serializer):
        password = self.request.data.get("password")
        user = serializer.save(organization=self.request.user.organization)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        audit_action(
            self.request.organization_id,
            self.request.user.id,
            "user.created",
            "user",
            str(user.id),
            self.request,
        )

    @action(detail=False, methods=["get"], serializer_class=UserSerializer)
    def me(self, request: Request) -> Response:
        return Response(self.get_serializer(request.user).data)


class RoleViewSet(OrganizationModelViewSet):
    serializer_class = RoleSerializer
    queryset = Role.objects.all()
    permission_classes = [IsOrganizationMember, IsOrgAdminOrReadOnly, IsNotClient]


class InvitationViewSet(OrganizationModelViewSet):
    serializer_class = InvitationSerializer
    queryset = Invitation.objects.select_related("role")
    permission_classes = [IsOrganizationMember, IsOrgAdminOrReadOnly, IsNotClient]

    def get_queryset(self):  # type: ignore[override]
        queryset = super().get_queryset().select_related("role", "client")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        invitation = serializer.save()
        audit_action(
            self.request.organization_id,
            self.request.user.id,
            "invite.created",
            "invitation",
            str(invitation.id),
            self.request,
        )

    def perform_destroy(self, instance):
        audit_action(
            self.request.organization_id,
            self.request.user.id,
            "invite.revoked",
            "invitation",
            str(instance.id),
            self.request,
        )
        return super().perform_destroy(instance)

    @action(detail=True, methods=["post"], url_path="resend")
    def resend(self, request: Request, pk=None) -> Response:
        invitation = self.get_object()
        if not invitation.is_valid():
            return Response({"detail": "Invitation expired"}, status=status.HTTP_400_BAD_REQUEST)
        base_url = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:5173")
        invite_link = f"{base_url.rstrip('/')}/invite/accept?token={invitation.token}"
        send_invitation_email(
            to=invitation.email,
            organization_name=invitation.organization.name,
            role_name=invitation.role.name,
            invite_link=invite_link,
            expires_at=invitation.expires_at,
        )
        invitation.last_sent_at = timezone.now()
        invitation.save(update_fields=["last_sent_at"])
        audit_action(
            request.organization_id,
            request.user.id,
            "invite.resent",
            "invitation",
            str(invitation.id),
            request,
        )
        return Response({"status": "sent"})


class APITokenViewSet(OrganizationModelViewSet):
    serializer_class = APITokenSerializer
    queryset = APIToken.objects.all()
    permission_classes = [IsOrganizationMember, IsOrgAdminOrReadOnly, IsNotClient]

    def perform_create(self, serializer):
        token = serializer.save(organization=self.request.user.organization)
        audit_action(
            self.request.organization_id,
            self.request.user.id,
            "api_token.created",
            "api_token",
            str(token.id),
            self.request,
        )
