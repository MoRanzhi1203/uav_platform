from django.db import migrations


CREATE_SURVEY_SHIFT_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS `terrain_survey_shift` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `task_id` bigint NOT NULL,
    `drone_id` bigint NOT NULL,
    `drone_name` varchar(128) NOT NULL,
    `start_time` datetime(6) NOT NULL,
    `end_time` datetime(6) NOT NULL,
    `status` varchar(32) NOT NULL DEFAULT 'pending',
    `created_at` datetime(6) NOT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""


DROP_SURVEY_SHIFT_TABLE_SQL = "DROP TABLE IF EXISTS `terrain_survey_shift`;"


class Migration(migrations.Migration):
    dependencies = [
        ("terrain", "0009_surveyshift"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=CREATE_SURVEY_SHIFT_TABLE_SQL,
                    reverse_sql=DROP_SURVEY_SHIFT_TABLE_SQL,
                ),
            ],
            state_operations=[],
        ),
    ]

