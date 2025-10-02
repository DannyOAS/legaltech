"""Central RBAC configuration for system and custom roles."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from django.db import transaction

from .models import Organization, Permission, Role


@dataclass(frozen=True)
class PermissionDefinition:
    codename: str
    label: str
    description: str


PERMISSION_DEFINITIONS: tuple[PermissionDefinition, ...] = (
    PermissionDefinition("org.manage", "Manage organization settings", "Update organization profile and configuration."),
    PermissionDefinition("org.manage_users", "Manage staff users", "Invite and manage internal team members."),
    PermissionDefinition("org.invite_clients", "Invite clients", "Invite clients to the portal."),
    PermissionDefinition("org.manage_roles", "Manage roles & permissions", "Create roles and assign permissions."),
    PermissionDefinition("org.view_audit_logs", "View audit logs", "View compliance and audit trail reports."),
    PermissionDefinition("security.manage", "Manage security settings", "Configure MFA, SSO, and security controls."),
    PermissionDefinition("ai.use", "Use AI assistant", "Access AI drafting and analysis tools."),
    PermissionDefinition("client.view", "View clients", "View clients within the organization."),
    PermissionDefinition("client.manage", "Manage clients", "Create or update client profiles."),
    PermissionDefinition("matter.view", "View matters", "View matters assigned to the user."),
    PermissionDefinition("matter.manage", "Manage matters", "Create and update matters assigned to the user."),
    PermissionDefinition("matter.view_all", "View all matters", "View all matters in the organization."),
    PermissionDefinition("document.view", "View documents", "View documents for assigned matters."),
    PermissionDefinition("document.manage", "Manage documents", "Upload and edit documents for assigned matters."),
    PermissionDefinition("document.manage_visibility", "Toggle document visibility", "Control client visibility for documents."),
    PermissionDefinition("document.view_all", "View all documents", "View all documents in the organization."),
    PermissionDefinition("invoice.view", "View invoices", "View invoices for assigned matters."),
    PermissionDefinition("invoice.manage", "Manage invoices", "Create or edit invoices for assigned matters."),
    PermissionDefinition("invoice.mark_paid", "Record payments", "Mark invoices as paid and manage payments."),
    PermissionDefinition("invoice.view_all", "View all invoices", "View all invoices in the organization."),
    PermissionDefinition("billing.record_time", "Record time entries", "Create and update time entries."),
    PermissionDefinition("billing.record_expense", "Record expenses", "Create and update expenses."),
    PermissionDefinition("billing.export", "Export billing reports", "Export or download billing and compliance reports."),
    PermissionDefinition("messaging.use", "Secure messaging", "Participate in secure client messaging."),
    PermissionDefinition("portal.client_access", "Client portal access", "Access client portal resources."),
)


ROLE_DEFINITIONS: dict[str, dict[str, Iterable[str] | bool]] = {
    "Admin": {
        "permissions": [p.codename for p in PERMISSION_DEFINITIONS if p.codename != "portal.client_access"],
        "is_custom": False,
    },
    "Owner": {
        "permissions": [p.codename for p in PERMISSION_DEFINITIONS if p.codename != "portal.client_access"],
        "is_custom": False,
    },
    "Lawyer": {
        "permissions": [
            "client.view",
            "matter.view",
            "matter.manage",
            "document.view",
            "document.manage",
            "document.manage_visibility",
            "invoice.view",
            "invoice.manage",
            "billing.record_time",
            "billing.record_expense",
            "messaging.use",
            "ai.use",
        ],
        "is_custom": False,
    },
    "Paralegal": {
        "permissions": [
            "client.view",
            "matter.view",
            "document.view",
            "document.manage",
            "invoice.view",
            "billing.record_time",
            "billing.record_expense",
            "messaging.use",
        ],
        "is_custom": False,
    },
    "Assistant": {
        "permissions": [
            "client.view",
            "matter.view",
            "document.view",
            "messaging.use",
        ],
        "is_custom": False,
    },
    "Client": {
        "permissions": ["portal.client_access", "messaging.use"],
        "is_custom": False,
    },
    "Operations Admin": {
        "permissions": [
            "org.manage",
            "org.invite_clients",
            "client.view",
            "client.manage",
            "invoice.view",
            "invoice.mark_paid",
            "invoice.view_all",
            "billing.export",
        ],
        "is_custom": False,
    },
    "IT / Security": {
        "permissions": [
            "security.manage",
            "org.manage_roles",
            "org.view_audit_logs",
        ],
        "is_custom": False,
    },
    "Accounting / Finance": {
        "permissions": [
            "invoice.view",
            "invoice.manage",
            "invoice.mark_paid",
            "invoice.view_all",
            "billing.export",
        ],
        "is_custom": False,
    },
}


@transaction.atomic
def sync_organization_roles(organization: Organization) -> None:
    """Ensure that system roles and permissions exist for an organization."""

    for definition in PERMISSION_DEFINITIONS:
        Permission.objects.get_or_create(
            codename=definition.codename,
            defaults={"label": definition.label, "description": definition.description},
        )

    for role_name, config in ROLE_DEFINITIONS.items():
        permissions = list(config["permissions"])
        is_custom = bool(config.get("is_custom", False))
        role, _created = Role.objects.get_or_create(
            organization=organization,
            name=role_name,
            defaults={"is_custom": is_custom},
        )
        if role.is_custom != is_custom:
            role.is_custom = is_custom
            role.save(update_fields=["is_custom"])
        role.permissions.set(Permission.objects.filter(codename__in=permissions))


def bootstrap_all_organizations() -> None:
    for organization in Organization.objects.all():
        sync_organization_roles(organization)
