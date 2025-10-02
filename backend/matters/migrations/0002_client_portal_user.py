import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("matters", "0001_initial"),
        ("accounts", "0003_invitation_fields_user_mfa"),
    ]

    operations = [
        migrations.AddField(
            model_name="client",
            name="portal_user",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="client_profile",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
