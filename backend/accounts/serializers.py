"""Serializers for accounts domain."""
from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer as SimpleJWTTokenObtainPair

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
            "created_at",
            "organization",
            "roles",
        ]
        read_only_fields = ["id", "is_staff", "created_at", "organization", "roles"]

    def get_roles(self, obj: User) -> list[str]:
        return list(obj.roles.values_list("name", flat=True))


class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = ["id", "email", "role", "token", "expires_at", "organization", "created_at"]
        read_only_fields = ["id", "token", "organization", "created_at"]

    def create(self, validated_data):
        role = validated_data["role"]
        organization = self.context["request"].user.organization
        invitation = Invitation.issue(
            email=validated_data["email"],
            role=role,
            organization=organization,
            ttl_hours=int(self.context.get("ttl_hours", 72)),
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

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        user = authenticate(request=self.context.get("request"), email=email, password=password)
        if not user:
            raise AuthenticationFailed("Invalid credentials")
        if not user.is_active:
            raise AuthenticationFailed("User inactive")
        attrs["user"] = user
        return attrs


class RefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class MFASetupSerializer(serializers.Serializer):
    """Stub for MFA setup - provides secret and QR uri."""

    secret = serializers.CharField(read_only=True)
    qr_uri = serializers.CharField(read_only=True)


class MFAVerifySerializer(serializers.Serializer):
    token = serializers.CharField()

    def validate(self, attrs):
        # This will be implemented with real TOTP verification later.
        token = attrs["token"]
        if token != "000000":
            raise serializers.ValidationError("Invalid MFA token stub")
        return attrs


class PasswordlessInviteSerializer(serializers.Serializer):
    token = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            invite = Invitation.objects.get(token=attrs["token"])
        except Invitation.DoesNotExist as exc:
            raise serializers.ValidationError("Invite not found") from exc
        if not invite.is_valid():
            raise serializers.ValidationError("Invite expired")
        attrs["invitation"] = invite
        return attrs

    def create(self, validated_data):
        invite: Invitation = validated_data["invitation"]
        user = User.objects.create_user(
            email=invite.email,
            password=validated_data["password"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            organization=invite.organization,
        )
        UserRole.objects.create(user=user, role=invite.role)
        invite.delete()
        return user
