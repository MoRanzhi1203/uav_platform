
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import sys
import django

# 设置Django环境
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uav_platform.settings")
django.setup()

from terrain.models import TerrainArea, TerrainZone
from tasking.models import GlobalTask

print("=" * 60)
print("检查地形区域数据...")
print("=" * 60)
areas = TerrainArea.objects.filter(is_deleted=False)
print(f"地形区域数量: {areas.count()}")
for area in areas:
    print(f"  - ID: {area.id}, 名称: {area.name}")
    zones = TerrainZone.objects.filter(area_obj=area, is_deleted=False)
    print(f"    地块数量: {zones.count()}")
    for zone in zones[:5]:  # 只显示前5个地块
        print(f"      - 地块: {zone.name}, 类型: {zone.category}, 风险: {zone.risk_level}")
    if zones.count() > 5:
        print(f"      ... 还有 {zones.count() - 5} 个地块")

print("\n" + "=" * 60)
print("检查风险区域数据...")
print("=" * 60)
risk_zones = TerrainZone.objects.filter(is_deleted=False, risk_level__in=["high", "medium"])
print(f"风险区域数量: {risk_zones.count()}")
for zone in risk_zones[:10]:
    area_name = zone.area_obj.name if zone.area_obj else "未绑定"
    print(f"  - ID: {zone.id}, 地块: {zone.name}, 风险: {zone.risk_level}, 所属: {area_name}")

print("\n" + "=" * 60)
print("检查任务数据...")
print("=" * 60)
tasks = GlobalTask.objects.all()
print(f"任务数量: {tasks.count()}")
for task in tasks[:10]:
    print(f"  - ID: {task.id}, 名称: {task.task_name}, 状态: {task.status}")

print("\n" + "=" * 60)
print("数据检查完成！")
print("=" * 60)
