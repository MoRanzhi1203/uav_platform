
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import django
import os
import sys

# 设置 Django 环境
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uav_platform.settings")
django.setup()

from terrain.models import TerrainArea
from django.utils import timezone

print("=" * 70)
print("给地形区域添加简单边界数据")
print("=" * 70)

# 基础坐标（北京附近）
base_lng = 116.4
base_lat = 39.9

areas = TerrainArea.objects.filter(is_deleted=False)

updated_count = 0

for idx, area in enumerate(areas):
    print(f"\n处理区域 {idx+1}/{len(areas)}: {area.name} (ID: {area.id})")
    
    # 如果没有边界数据或者中心点，设置简单的
    needs_update = False
    
    if not area.center_lng or not area.center_lat:
        area.center_lng = base_lng + (idx * 0.01)
        area.center_lat = base_lat + (idx * 0.005)
        needs_update = True
        print(f"  设置中心点: ({area.center_lng:.5f}, {area.center_lat:.5f})")
    
    if not area.boundary_json or len(str(area.boundary_json)) < 10:
        # 创建一个简单的矩形边界
        lng = area.center_lng or (base_lng + (idx * 0.01))
        lat = area.center_lat or (base_lat + (idx * 0.005))
        # 每个区域的边界大小不同
        size = 0.02 + (idx * 0.005)
        
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
        needs_update = True
        print(f"  添加了简单矩形边界")
    
    if needs_update:
        area.save()
        updated_count += 1
        print(f"  ✅ 已保存")
    else:
        print(f"  跳过 - 已有数据")

print("\n" + "=" * 70)
print(f"处理完成！更新了 {updated_count} 个区域")
print("=" * 70)
