"""Account and organization models."""
from __future__ import annotations

import secrets
import uuid
from datetime import timedelta
from typing import TYPE_CHECKING

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.contrib.postgres.fields import ArrayField
from django.core.mail import send_mail
from django.db import models
from django.utils import timezone

if TYPE_CHECKING:
    from matters.models import Client


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    region = models.CharField(max_length=64, default="ON")
    created_at = models.DateTimeField(auto_now_add=True)
    matter_code_prefix = models.CharField(max_length=12, blank=True, default="")
    next_matter_number = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def get_matter_code_prefix(self) -> str:
        prefix = (self.matter_code_prefix or "").upper().strip()
        if not prefix:
            normalized = "".join(ch for ch in self.name if ch.isalnum()).upper()
            prefix = normalized[:4] or "MAT"
        return prefix

    def generate_matter_reference(self) -> str:
        from django.db import transaction
        from django.utils import timezone

        with transaction.atomic():
            org = type(self).objects.select_for_update().get(pk=self.pk)
            sequence = org.next_matter_number
            org.next_matter_number = sequence + 1
            org.save(update_fields=["next_matter_number"])
        prefix = org.get_matter_code_prefix()
        year = timezone.now().year
        reference = f"{prefix}-{year}-{sequence:04d}"
        self.next_matter_number = org.next_matter_number
        return reference


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
    mfa_secret = models.CharField(max_length=32, blank=True, null=True)
    mfa_pending_secret = models.CharField(max_length=32, blank=True, null=True)
    mfa_required = models.BooleanField(default=True)  # Ontario legal security requirement
    mfa_enforced_at = models.DateTimeField(null=True, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    password_changed_at = models.DateTimeField(null=True, blank=True)
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

    def is_client_role(self) -> bool:
        """Check if user has only client role (Ontario compliance)."""
        user_roles = list(self.roles.values_list("name", flat=True))
        return "Client" in user_roles and len(user_roles) == 1

    def requires_mfa_setup(self) -> bool:
        """Check if user needs to set up MFA for Ontario legal compliance."""
        if self.is_client_role():
            return False  # Clients don't require MFA in Ontario
        return self.mfa_required and not self.mfa_enabled

    def needs_mfa_enforcement(self) -> bool:
        """Check if MFA should be enforced on next login."""
        if self.is_client_role():
            return False
        return self.mfa_required and not self.mfa_enabled and not self.mfa_enforced_at

    def record_login(self) -> None:
        """Record successful login timestamp."""
        from django.utils import timezone
        self.last_login_at = timezone.now()
        self.save(update_fields=["last_login_at"])

    def enforce_mfa_setup(self) -> None:
        """Mark that MFA enforcement has been applied."""
        from django.utils import timezone
        self.mfa_enforced_at = timezone.now()
        self.save(update_fields=["mfa_enforced_at"])

    def record_password_change(self) -> None:
        """Record when password was changed for security tracking."""
        from django.utils import timezone
        self.password_changed_at = timezone.now()
        self.save(update_fields=["password_changed_at"])


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
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_EXPIRED = "expired"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_EXPIRED, "Expired"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="invitations")
    token = models.CharField(max_length=128, unique=True)
    expires_at = models.DateTimeField()
    organization = models.ForeignKey(Organization, related_name="invitations", on_delete=models.CASCADE)
    invited_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="sent_invitations")
    client = models.ForeignKey("matters.Client", null=True, blank=True, on_delete=models.SET_NULL, related_name="invitations")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    accepted_at = models.DateTimeField(null=True, blank=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [models.Index(fields=["token"])]

    @classmethod
    def issue(
        cls,
        email: str,
        role: Role,
        organization: Organization,
        *,
        invited_by: User | None = None,
        client: "matters.Client" | None = None,
        ttl_hours: int = 72,
        metadata: dict | None = None,
    ) -> "Invitation":
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(hours=ttl_hours)
        invitation = cls.objects.create(
            email=email,
            role=role,
            organization=organization,
            token=token,
            expires_at=expires_at,
            invited_by=invited_by,
            client=client,
            last_sent_at=timezone.now(),
            metadata=metadata or {},
        )
        return invitation

    def is_valid(self) -> bool:
        return self.status == self.STATUS_PENDING and timezone.now() < self.expires_at

    def mark_accepted(self) -> None:
        self.status = self.STATUS_ACCEPTED
        self.accepted_at = timezone.now()
        self.save(update_fields=["status", "accepted_at"])


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
