"""Reset multi-factor authentication for a specific user."""
from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandError

from accounts.models import User


class Command(BaseCommand):
    help = "Disable MFA and clear secrets for the given user email"

    def add_arguments(self, parser) -> None:
        parser.add_argument("email", help="Email address of the user to reset")

    def handle(self, *args: Any, **options: Any) -> None:
        email: str = options["email"].strip().lower()
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist as exc:  # pragma: no cover - simple guard
            raise CommandError(f"No user found with email {email}") from exc

        update_fields = []
        if user.mfa_enabled:
            user.mfa_enabled = False
            update_fields.append("mfa_enabled")
        if user.mfa_secret:
            user.mfa_secret = None
            update_fields.append("mfa_secret")
        if getattr(user, "mfa_pending_secret", None):
            user.mfa_pending_secret = None
            update_fields.append("mfa_pending_secret")
        if user.mfa_enforced_at:
            user.mfa_enforced_at = None
            update_fields.append("mfa_enforced_at")

        if not update_fields:
            self.stdout.write(self.style.WARNING("MFA already disabled; no changes applied."))
            return

        user.save(update_fields=update_fields)
        self.stdout.write(self.style.SUCCESS(f"MFA reset for {email}."))

