from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("matters", "0002_client_portal_user"),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER INDEX IF EXISTS matters_mat_reference_287ad0_idx RENAME TO matters_mat_referen_0e5285_idx;",
            reverse_sql="ALTER INDEX IF EXISTS matters_mat_referen_0e5285_idx RENAME TO matters_mat_reference_287ad0_idx;",
        ),
    ]
