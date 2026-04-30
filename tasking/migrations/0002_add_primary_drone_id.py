from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tasking", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="globaltask",
            name="primary_drone_id",
            field=models.BigIntegerField(null=True, blank=True, default=None),
        ),
    ]

