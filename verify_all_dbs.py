import os
import django
from django.db import connections

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uav_platform.settings')
django.setup()

dbs = ['default', 'forest', 'agri', 'terrain']

print("=== Checking Database Connections ===")
for db_name in dbs:
    try:
        with connections[db_name].cursor() as cursor:
            cursor.execute("SELECT 1")
            print(f"[OK] {db_name}: Connected")
    except Exception as e:
        print(f"[FAIL] {db_name}: Failed - {e}")

print("\n=== Checking Tables ===")
checks = {
    'forest': 'forest_area',
    'agri': 'agri_farm_plot',
    'terrain': 'terrain_terrainarea'
}

for db_name, table in checks.items():
    try:
        with connections[db_name].cursor() as cursor:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"[OK] {db_name}.{table}: {count} records")
    except Exception as e:
        print(f"[FAIL] {db_name}.{table}: Error - {e}")
