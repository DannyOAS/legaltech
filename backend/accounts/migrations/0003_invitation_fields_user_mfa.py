from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_alter_user_managers_user_groups_user_is_superuser_and_more"),
        ("matters", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="mfa_secret",
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
        migrations.AddField(
            model_name="invitation",
            name="accepted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="invitation",
            name="client",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="invitations", to="matters.client"),
        ),
        migrations.AddField(
            model_name="invitation",
            name="invited_by",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sent_invitations", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="invitation",
            name="last_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="invitation",
            name="status",
            field=models.CharField(choices=[("pending", "Pending"), ("accepted", "Accepted"), ("expired", "Expired")], default="pending", max_length=16),
        ),
    ]
