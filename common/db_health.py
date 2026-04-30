from django.conf import settings
from django.db import connections


OPS_REQUIRED_TABLES = {
    "default": {
        "Drone": "fleet_drone",
        "Pilot": "fleet_pilot",
        "LaunchSite": "fleet_launch_site",
        "GlobalTask": "tasking_global_task",
        "TaskDispatch": "tasking_task_dispatch",
    },
    "terrain": {
        "TerrainArea": "terrain_terrainarea",
    },
}


def check_ops_database_health():
    errors = []
    database_info = {}

    for alias, required_tables in OPS_REQUIRED_TABLES.items():
        config = settings.DATABASES.get(alias, {})
        database_info[alias] = {
            "host": config.get("HOST", ""),
            "port": config.get("PORT", ""),
            "user": config.get("USER", ""),
            "name": config.get("NAME", ""),
        }
        try:
            connection = connections[alias]
            connection.ensure_connection()
            existing_tables = set(connection.introspection.table_names())
        except Exception as exc:
            errors.append(f"{alias} 数据库连接失败: {exc}")
            continue

        for label, table_name in required_tables.items():
            if table_name not in existing_tables:
                errors.append(f"{alias} 数据库缺少表 {label} ({table_name})")

    return {
        "ok": not errors,
        "errors": errors,
        "database_info": database_info,
    }
