from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("system", "0002_alter_rolepermission_options_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="SystemSetting",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("config_key", models.CharField(max_length=64, unique=True)),
                ("config_group", models.CharField(max_length=64)),
                ("config_name", models.CharField(max_length=128)),
                (
                    "value_type",
                    models.CharField(
                        choices=[
                            ("string", "string"),
                            ("int", "int"),
                            ("float", "float"),
                            ("bool", "bool"),
                            ("select", "select"),
                        ],
                        default="string",
                        max_length=16,
                    ),
                ),
                ("config_value", models.JSONField(default=dict)),
                ("options", models.JSONField(blank=True, default=list)),
                ("description", models.CharField(blank=True, max_length=255)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("updated_by", models.CharField(blank=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "system_setting",
                "ordering": ["config_group", "sort_order", "id"],
            },
        ),
    ]
