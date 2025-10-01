from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_invitation_fields_user_mfa"),
    ]

    operations = [
        migrations.AddField(
            model_name="organization",
            name="matter_code_prefix",
            field=models.CharField(blank=True, default="", max_length=12),
        ),
        migrations.AddField(
            model_name="organization",
            name="next_matter_number",
            field=models.PositiveIntegerField(default=1),
        ),
    ]
