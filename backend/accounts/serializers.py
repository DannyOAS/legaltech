"""Serializers for accounts domain."""

from __future__ import annotations

from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer as SimpleJWTTokenObtainPair,
)

from config.tenancy import OrganizationScopedPrimaryKeyRelatedField
from matters.models import Client
from services.notifications.email import send_invitation_email

from .mfa import verify_totp
from .models import APIToken, Invitation, Organization, Role, User, UserRole


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "region", "created_at"]
        read_only_fields = ["id", "created_at"]


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "name", "organization"]
        read_only_fields = ["id", "organization"]


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "mfa_enabled",
            "mfa_required",
            "last_login_at",
            "created_at",
            "organization",
            "roles",
        ]
        read_only_fields = [
            "id",
            "is_staff",
            "created_at",
            "organization",
            "roles",
            "last_login_at",
            "mfa_required",
        ]

    def get_roles(self, obj: User) -> list[str]:
        return list(obj.roles.values_list("name", flat=True))


class InvitationSerializer(serializers.ModelSerializer):
    role = OrganizationScopedPrimaryKeyRelatedField(queryset=Role.objects.all())
    client = OrganizationScopedPrimaryKeyRelatedField(
        queryset=Client.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Invitation
        fields = [
            "id",
            "email",
            "role",
            "client",
            "token",
            "expires_at",
            "status",
            "accepted_at",
            "organization",
            "created_at",
            "metadata",
        ]
        read_only_fields = [
            "id",
            "token",
            "expires_at",
            "organization",
            "created_at",
            "status",
            "accepted_at",
        ]

    def validate(self, attrs):
        client = attrs.get("client")
        role: Role = attrs.get("role")
        if client and role and role.name != "Client":
            raise serializers.ValidationError(
                {"client": "Client invitations must use the Client role."}
            )
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        role = validated_data["role"]
        organization = request.user.organization
        ttl_hours = int(self.context.get("ttl_hours", 72))
        invitation = Invitation.issue(
            email=validated_data["email"],
            role=role,
            organization=organization,
            invited_by=request.user,
            client=validated_data.get("client"),
            ttl_hours=ttl_hours,
            metadata=validated_data.get("metadata"),
        )
        base_url = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:5173")
        invite_link = f"{base_url.rstrip('/')}/invite/accept?token={invitation.token}"
        send_invitation_email(
            to=invitation.email,
            organization_name=organization.name,
            role_name=role.name,
            invite_link=invite_link,
            expires_at=invitation.expires_at,
        )
        return invitation


class APITokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = APIToken
        fields = ["id", "name", "scopes", "created_at"]
        read_only_fields = ["id", "created_at"]


class UserRoleSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)

    class Meta:
        model = UserRole
        fields = ["id", "role"]


class TokenObtainPairSerializer(SimpleJWTTokenObtainPair):
    """Inject organization context into access tokens."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["org_id"] = str(user.organization_id)
        token["email"] = user.email
        return token


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    otp = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        user = authenticate(request=self.context.get("request"), email=email, password=password)
        if not user:
            raise AuthenticationFailed("Invalid credentials")
        if not user.is_active:
            raise AuthenticationFailed("User inactive")
        if user.mfa_enabled:
            otp = attrs.get("otp")
            if not otp:
                raise AuthenticationFailed("MFA required", code="mfa_required")
            if not user.mfa_secret:
                raise AuthenticationFailed("MFA not initialized", code="mfa_invalid")
            if not verify_totp(user.mfa_secret, otp, window=1):
                raise AuthenticationFailed("Invalid MFA token", code="mfa_invalid")
        attrs["user"] = user
        return attrs


class RefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class MFASetupSerializer(serializers.Serializer):
    secret = serializers.CharField(read_only=True)
    qr_uri = serializers.CharField(read_only=True)


class MFAVerifySerializer(serializers.Serializer):
    token = serializers.CharField()

    def validate(self, attrs):
        token = attrs["token"]
        user = self.context["request"].user
        if not user.mfa_secret:
            raise serializers.ValidationError("MFA secret not initialized")

        if not verify_totp(user.mfa_secret, token, window=1):
            raise serializers.ValidationError("Invalid MFA token")
        return attrs


class InvitationAcceptSerializer(serializers.Serializer):
    token = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            invitation = Invitation.objects.select_related("organization", "role", "client").get(
                token=attrs["token"]
            )
        except Invitation.DoesNotExist as exc:
            raise serializers.ValidationError({"token": "Invitation not found"}) from exc
        if not invitation.is_valid():
            raise serializers.ValidationError({"token": "Invitation expired"})
        attrs["invitation"] = invitation
        return attrs

    def create(self, validated_data):
        invitation: Invitation = validated_data["invitation"]
        user = User.objects.create_user(
            email=invitation.email,
            password=validated_data["password"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            organization=invitation.organization,
        )
        UserRole.objects.create(user=user, role=invitation.role)
        if invitation.role.name == "Client":
            client = invitation.client
            if client is None:
                client = Client.objects.create(
                    organization=invitation.organization,
                    display_name=f"{validated_data['first_name']} {validated_data['last_name']}",
                    primary_email=invitation.email,
                )
            if not client.portal_user:
                client.portal_user = user
                client.save(update_fields=["portal_user"])
            invitation.client = client
            invitation.save(update_fields=["client"])
        invitation.mark_accepted()
        return user
