
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import sys
import django
from django.utils import timezone

# 设置Django环境
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uav_platform.settings")
django.setup()

from terrain.models import TerrainArea, TerrainZone
from tasking.models import GlobalTask

print("=" * 60)
print("创建示例数据...")
print("=" * 60)

# 1. 更新一些地块的风险等级
print("\n1. 更新地块风险等级...")
zones = TerrainZone.objects.filter(is_deleted=False)[:20]
risk_levels = ["high", "medium", "low"]
updated_count = 0
for i, zone in enumerate(zones):
    if i % 3 == 0:
        zone.risk_level = "high"
        zone.description = "这是一个高风险区域，需要重点监测"
    elif i % 3 == 1:
        zone.risk_level = "medium"
        zone.description = "这是一个中风险区域，需要定期检查"
    zone.save()
    updated_count += 1
    print(f"  - 更新地块: {zone.name} -> {zone.risk_level}")
print(f"  共更新 {updated_count} 个地块")

# 2. 创建示例任务
print("\n2. 创建示例任务...")
task_names = [
    "林区防火巡查",
    "农田病虫害监测",
    "建筑安全检查",
    "水域水质监测",
    "道路状况巡查",
    "森林资源调查",
    "农作物生长监测",
    "区域综合测绘"
]

scene_types = ["forest", "agri", "mixed", "forest", "agri", "forest", "agri", "mixed"]
statuses = ["pending", "running", "completed", "pending", "running", "pending", "completed", "running"]

for i, (name, scene, status) in enumerate(zip(task_names, scene_types, statuses)):
    task = GlobalTask.objects.create(
        task_name=name,
        task_code=f"TASK-{1000 + i}",
        scene_type=scene,
        status=status,
        description=f"这是一个示例{name}任务，用于演示数据模块功能",
        planned_start=timezone.now(),
        planned_end=timezone.now() + timezone.timedelta(days=7),
    )
    print(f"  - 创建任务: {name} ({status})")

print("\n" + "=" * 60)
print("验证数据...")
print("=" * 60)

# 验证风险区域
risk_zones = TerrainZone.objects.filter(is_deleted=False, risk_level__in=["high", "medium"])
print(f"\n风险区域数量: {risk_zones.count()}")
for zone in risk_zones[:5]:
    area_name = zone.area_obj.name if zone.area_obj else "未绑定"
    print(f"  - {zone.name} ({zone.risk_level}) - {area_name}")

# 验证任务
tasks = GlobalTask.objects.all()
print(f"\n任务数量: {tasks.count()}")
for task in tasks[:5]:
    print(f"  - {task.task_name} ({task.status})")

print("\n" + "=" * 60)
print("示例数据创建完成！")
print("=" * 60)
