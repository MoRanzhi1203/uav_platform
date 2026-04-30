import os
import django
import random
from datetime import datetime, timedelta
from django.utils import timezone

# 设置环境
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uav_platform.settings")
django.setup()

from common.db_health import check_ops_database_health
from fleet.models import Drone, Pilot, LaunchSite, DroneGroup, DroneGroupMember
from tasking.models import GlobalTask, TaskDispatch
from terrain.models import TerrainArea
from system.models import SystemUser


def ensure_admin_user():
    user, _ = SystemUser.objects.using("default").get_or_create(
        username="admin",
        defaults={
            "real_name": "系统管理员",
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
            "user_type": "super_admin",
            "roles": ["super_admin", "dispatcher"],
            "region": "重庆市",
        },
    )
    user.set_password("Admin@123456")
    user.save(using="default")
    return user

def generate_test_data():
    health = check_ops_database_health()
    if not health["ok"]:
        print("数据库检查失败，停止生成测试数据：")
        for error in health["errors"]:
            print("-", error)
        return False

    print("开始生成测试数据...")
    admin_user = ensure_admin_user()
    
    # 1. 生成 3 个测试区域
    regions = ["重庆北碚山区", "成都双流平原", "贵阳黔南林区"]
    area_objs = []
    for r_name in regions:
        area, _ = TerrainArea.objects.using("terrain").get_or_create(
            name=r_name,
            defaults={
                "type": random.choice(["mountain", "plain", "forest"]),
                "risk_level": random.choice(["low", "medium", "high"]),
                "area": random.uniform(100, 1000),
                "description": f"{r_name}测试区域"
            }
        )
        area_objs.append(area)
    
    # 2. 生成起降点
    site, _ = LaunchSite.objects.using("default").get_or_create(
        site_name="核心枢纽起降点",
        defaults={
            "region": "中心区",
            "longitude": 106.39,
            "latitude": 29.81,
            "altitude": 250.0,
            "status": "ready"
        }
    )

    # 3. 生成飞手 (6名)
    pilots = []
    for i in range(1, 7):
        pilot, created = Pilot.objects.using("default").get_or_create(
            license_no=f"L-2026-00{i}",
            defaults={
                "system_user_id": admin_user.id,
                "pilot_name": f"飞手-{i:02d}",
                "phone": f"1380013800{i}",
                "skill_level": random.choice(["A", "B", "C"]),
                "status": "idle"
            }
        )
        if pilot.system_user_id != admin_user.id or pilot.status != "idle":
            pilot.system_user_id = admin_user.id
            pilot.status = "idle"
            pilot.skill_level = random.choice(["A", "B", "C"])
            pilot.save(using="default")
        pilots.append(pilot)
    print(f"已生成 {len(pilots)} 名飞手")

    # 4. 生成无人机 (10台)
    # 无人机名称示例：UAV-01 ~ UAV-10
    drones = []
    models_list = ["DJI M300 RTK", "DJI Mavic 3E", "Autel Evo II", "JOUAV CW-15"]
    for i in range(1, 11):
        uav_name = f"UAV-{i:02d}"
        serial_no = f"SN-2026-X{i:03d}"
        
        # 避免 serial_no 重复冲突
        Drone.objects.using("default").filter(serial_no=serial_no).exclude(drone_code=f"CODE-{uav_name}").delete()
        
        drone, created = Drone.objects.using("default").update_or_create(
            drone_code=f"CODE-{uav_name}",
            defaults={
                "drone_name": uav_name,
                "model_name": random.choice(models_list),
                "serial_no": serial_no,
                "max_payload": random.uniform(2.0, 15.0),
                "battery_capacity": random.uniform(5000, 30000),
                "status": random.choice(["online", "offline"]),
                "launch_site_id": site.id,
                "pilot_id": random.choice(pilots).id,
                "terrain_id": random.choice(area_objs).id,
                "bound_terrain_id": random.choice(area_objs).id,
                "battery_percentage": random.randint(10, 100),
                "last_active": timezone.now() - timedelta(minutes=random.randint(0, 1000))
            }
        )
        drones.append(drone)
    print(f"已生成 {len(drones)} 台无人机")

    groups = []
    for i in range(1, 4):
        group, _ = DroneGroup.objects.using("default").update_or_create(
            group_code=f"DG-2026-{i:02d}",
            defaults={
                "group_name": f"测试编组-{i:02d}",
                "scene_type": "mixed",
                "command_level": "regional",
                "status": "standby",
                "description": "自动生成测试编组",
            },
        )
        groups.append(group)

    DroneGroupMember.objects.using("default").filter(group_id__in=[item.id for item in groups]).delete()
    for index, drone in enumerate(drones):
        group = groups[index % len(groups)]
        DroneGroupMember.objects.using("default").update_or_create(
            group_id=group.id,
            drone_id=drone.id,
            defaults={
                "role_name": "captain" if index < len(groups) else "worker",
                "join_status": "active",
            },
        )

    # 5. 生成任务 (8个)
    import datetime as dt
    start_base = datetime(2026, 4, 1, tzinfo=dt.timezone.utc)

    task_statuses = ["running"] * 3 + ["completed"] * 3 + ["abnormal"] * 2
    random.shuffle(task_statuses)
    task_types = ["巡检", "测绘", "运送"]

    for i in range(1, 9):
        status = task_statuses[i - 1]
        start_time = start_base + timedelta(days=random.randint(0, 29), hours=random.randint(0, 23))
        end_time = start_time + timedelta(hours=random.randint(1, 4))
        drone = random.choice(drones)
        area = random.choice(area_objs)
        group = random.choice(groups)

        task_name = f"Task-{i:02d}"
        task, _ = GlobalTask.objects.using("default").update_or_create(
            task_code=f"TASK-CODE-{i:02d}",
            defaults={
                "task_name": task_name,
                "scene_type": random.choice(task_types),
                "priority": random.randint(1, 5),
                "status": status,
                "command_center": "重庆协同指挥中心",
                "creator_id": admin_user.id,
                "description": f"{task_name} 自动生成测试任务",
                "planned_start": start_time,
                "planned_end": end_time,
                "terrain_area_id": area.id,
                "primary_drone_id": drone.id,
            }
        )
        TaskDispatch.objects.using("default").update_or_create(
            dispatch_code=f"DISPATCH-TASK-{i:02d}",
            defaults={
                "global_task_id": task.id,
                "target_db": "forest" if i % 2 else "agri",
                "target_task_id": i,
                "drone_group_id": group.id,
                "dispatch_status": "completed" if status == "completed" else "running" if status == "running" else "failed",
                "dispatcher_id": admin_user.id,
                "remark": f"{task_name} 自动分派",
            },
        )
    print("已生成 8 个测试任务")
    
    print("测试数据生成完毕！")
    return True

if __name__ == "__main__":
    generate_test_data()
