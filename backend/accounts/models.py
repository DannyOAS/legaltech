"""Account and organization models."""
from __future__ import annotations

import secrets
import uuid
from datetime import timedelta

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.contrib.postgres.fields import ArrayField
from django.core.mail import send_mail
from django.db import models
from django.utils import timezone


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    region = models.CharField(max_length=64, default="ON")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("The given email must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        org = extra_fields.setdefault("organization", Organization.objects.first())
        if org is None:
            org = Organization.objects.create(name="System", region="ON")
            extra_fields["organization"] = org
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    organization = models.ForeignKey(Organization, related_name="users", on_delete=models.CASCADE)
    mfa_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = ["first_name", "last_name", "organization"]

    class Meta:
        ordering = ["email"]

    def __str__(self) -> str:
        return self.email

    def email_user(self, subject: str, message: str) -> None:
        send_mail(subject, message, None, [self.email])

    @property
    def roles(self):  # noqa: D401 - simple helper
        return Role.objects.filter(role_users__user=self)


class Role(models.Model):
    ROLE_CHOICES = [
        ("Owner", "Owner"),
        ("Admin", "Admin"),
        ("Lawyer", "Lawyer"),
        ("Paralegal", "Paralegal"),
        ("Assistant", "Assistant"),
        ("Client", "Client"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=32, choices=ROLE_CHOICES)
    organization = models.ForeignKey(Organization, related_name="roles", on_delete=models.CASCADE)

    class Meta:
        unique_together = ("name", "organization")
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.organization_id})"


class UserRole(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, related_name="user_roles", on_delete=models.CASCADE)
    role = models.ForeignKey(Role, related_name="role_users", on_delete=models.CASCADE)

    class Meta:
        unique_together = ("user", "role")


class Invitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="invitations")
    token = models.CharField(max_length=128, unique=True)
    expires_at = models.DateTimeField()
    organization = models.ForeignKey(Organization, related_name="invitations", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["token"])]

    @classmethod
    def issue(cls, email: str, role: Role, organization: Organization, ttl_hours: int = 72) -> "Invitation":
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(hours=ttl_hours)
        invitation = cls.objects.create(
            email=email,
            role=role,
            organization=organization,
            token=token,
            expires_at=expires_at,
        )
        return invitation

    def is_valid(self) -> bool:
        return timezone.now() < self.expires_at


class APIToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    hashed_key = models.CharField(max_length=128)
    organization = models.ForeignKey(Organization, related_name="api_tokens", on_delete=models.CASCADE)
    scopes = ArrayField(models.CharField(max_length=50), default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("name", "organization")

    def __str__(self) -> str:
        return self.name
