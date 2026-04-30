
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import django
import os
import sys

# 设置 Django 环境
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uav_platform.settings")
django.setup()

from terrain.models import TerrainArea

print("=" * 70)
print("检查地形区域的边界数据")
print("=" * 70)

areas = TerrainArea.objects.filter(is_deleted=False)

for area in areas:
    print(f"\n区域 ID: {area.id}, 名称: {area.name}")
    if hasattr(area, 'boundary_json') and area.boundary_json:
        # 检查边界数据
        boundary = area.boundary_json
        if isinstance(boundary, dict):
            print(f"  边界数据类型: dict")
            print(f"  边界数据键: {list(boundary.keys())}")
        elif isinstance(boundary, list):
            print(f"  边界数据类型: list, 长度: {len(boundary)}")
        else:
            print(f"  边界数据类型: {type(boundary)}")
        
        # 估算大小
        import json
        size = len(json.dumps(boundary))
        print(f"  估计数据大小: {size / 1024:.2f} KB")
    else:
        print("  无边界数据")

print("\n" + "=" * 70)
print("检查完成")
print("=" * 70)
