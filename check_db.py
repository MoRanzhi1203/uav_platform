import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uav_platform.settings')
django.setup()

from django.db import connections
from terrain.models import TerrainArea

print("=== Testing database routing ===")

with connections['terrain'].cursor() as cursor:
    cursor.execute("SELECT COUNT(*) FROM terrain_terrainarea")
    terrain_count = cursor.fetchone()[0]
    print(f"terrain_db terrain_terrainarea count: {terrain_count}")

with connections['default'].cursor() as cursor:
    cursor.execute("SELECT COUNT(*) FROM terrain_terrainarea")
    default_count = cursor.fetchone()[0]
    print(f"central_db (default) terrain_terrainarea count: {default_count}")

print("\n=== Querying via ORM ===")
total = TerrainArea.objects.count()
print(f"ORM total count: {total}")

areas = TerrainArea.objects.all()[:3]
for area in areas:
    print(f"Area: {area.name}")
