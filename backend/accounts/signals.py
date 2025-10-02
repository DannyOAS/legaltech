"""Account domain signals for RBAC bootstrap."""

from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Organization
from .rbac import sync_organization_roles


@receiver(post_save, sender=Organization)
def ensure_rbac_defaults(sender, instance: Organization, created: bool, **kwargs) -> None:
    """Ensure RBAC permissions stay in sync when organizations are created or updated."""

    sync_organization_roles(instance)
