
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import django
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uav_platform.settings")
django.setup()

from terrain.models import TerrainArea

print("=" * 70)
print("给所有地形区域补全边界和中心点数据")
print("=" * 70)

base_lng = 116.4
base_lat = 39.9

areas = TerrainArea.objects.filter(is_deleted=False)

updated = 0
for idx, area in enumerate(areas):
    needs_save = False
    print(f"\n处理 {idx+1}/{len(areas)}: {area.name} (ID: {area.id})")
    
    # 设置中心点
    if not area.center_lng or not area.center_lat:
        area.center_lng = base_lng + (idx * 0.02)
        area.center_lat = base_lat + (idx * 0.01)
        needs_save = True
        print(f"  中心点: ({area.center_lng}, {area.center_lat})")
    
    # 设置边界
    if not area.boundary_json or len(str(area.boundary_json)) < 10:
        lng = area.center_lng
        lat = area.center_lat
        size = 0.025 + (idx * 0.005)
        
        area.boundary_json = {
            "type": "Polygon",
            "coordinates": [
                [
                    [lng - size, lat - size],
                    [lng + size, lat - size],
                    [lng + size, lat + size],
                    [lng - size, lat + size],
                    [lng - size, lat - size]
                ]
            ]
        }
        needs_save = True
        print(f"  边界: 已添加")
    
    if needs_save:
        area.save()
        updated += 1
        print(f"  已保存")

print("\n" + "=" * 70)
print(f"完成！共更新了 {updated} 个区域")
print("=" * 70)
