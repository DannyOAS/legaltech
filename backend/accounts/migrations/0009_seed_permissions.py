from django.db import migrations

from accounts.rbac import PERMISSION_DEFINITIONS, ROLE_DEFINITIONS


def seed_permissions(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    Organization = apps.get_model("accounts", "Organization")

    for definition in PERMISSION_DEFINITIONS:
        Permission.objects.update_or_create(
            codename=definition.codename,
            defaults={"label": definition.label, "description": definition.description},
        )

    for organization in Organization.objects.all():
        for role_name, config in ROLE_DEFINITIONS.items():
            permissions = list(config["permissions"])
            is_custom = bool(config.get("is_custom", False))
            role, _ = Role.objects.update_or_create(
                organization=organization,
                name=role_name,
                defaults={"is_custom": is_custom},
            )
            if role.is_custom != is_custom:
                role.is_custom = is_custom
                role.save(update_fields=["is_custom"])
            role.permissions.set(Permission.objects.filter(codename__in=permissions))


def remove_permissions(apps, schema_editor):
    # No-op on reverse to preserve data created by administrators.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0008_permission_role_is_custom_alter_role_name_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_permissions, remove_permissions),
    ]
