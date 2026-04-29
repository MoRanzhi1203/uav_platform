from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from agri.models import AgriTask, FarmPlot
from fleet.models import Drone, DroneGroup, DroneGroupMember, LaunchSite, Pilot
from forest.models import ForestArea, ForestPatrolTask
from tasking.models import GlobalTask, TaskDispatch


USER_MODEL = get_user_model()


SITE_SPECS = [
    {
        "code": "FLEET-DEMO-SITE-01",
        "site_name": "Yubei North Base",
        "region": "Yubei",
        "longitude": 106.630201,
        "latitude": 29.719412,
        "altitude": 382.50,
        "status": "ready",
    },
    {
        "code": "FLEET-DEMO-SITE-02",
        "site_name": "Nanan River Base",
        "region": "Nanan",
        "longitude": 106.611823,
        "latitude": 29.522531,
        "altitude": 345.20,
        "status": "ready",
    },
    {
        "code": "FLEET-DEMO-SITE-03",
        "site_name": "Banan Valley Base",
        "region": "Banan",
        "longitude": 106.540325,
        "latitude": 29.402894,
        "altitude": 366.80,
        "status": "ready",
    },
    {
        "code": "FLEET-DEMO-SITE-04",
        "site_name": "Beibei Forest Base",
        "region": "Beibei",
        "longitude": 106.420118,
        "latitude": 29.825406,
        "altitude": 410.00,
        "status": "ready",
    },
]


PILOT_SPECS = [
    {"license_no": "CQ-PILOT-2026-001", "pilot_name": "Li Wei", "phone": "13800000001", "skill_level": "A", "status": "online"},
    {"license_no": "CQ-PILOT-2026-002", "pilot_name": "Wang Hao", "phone": "13800000002", "skill_level": "A", "status": "running"},
    {"license_no": "CQ-PILOT-2026-003", "pilot_name": "Zhang Rui", "phone": "13800000003", "skill_level": "B", "status": "idle"},
    {"license_no": "CQ-PILOT-2026-004", "pilot_name": "Chen Yu", "phone": "13800000004", "skill_level": "A", "status": "online"},
    {"license_no": "CQ-PILOT-2026-005", "pilot_name": "Liu Yang", "phone": "13800000005", "skill_level": "B", "status": "maintenance"},
    {"license_no": "CQ-PILOT-2026-006", "pilot_name": "Sun Jie", "phone": "13800000006", "skill_level": "A", "status": "idle"},
]


DRONE_SPECS = [
    {
        "drone_code": "UAV-DEMO-001",
        "drone_name": "Falcon-01",
        "model_name": "M300 RTK",
        "serial_no": "SN-DEMO-0001",
        "max_payload": 8.5,
        "battery_capacity": 92.0,
        "status": "online",
        "site_index": 0,
        "pilot_index": 0,
    },
    {
        "drone_code": "UAV-DEMO-002",
        "drone_name": "Falcon-02",
        "model_name": "M350 RTK",
        "serial_no": "SN-DEMO-0002",
        "max_payload": 9.0,
        "battery_capacity": 95.0,
        "status": "running",
        "site_index": 0,
        "pilot_index": 1,
    },
    {
        "drone_code": "UAV-DEMO-003",
        "drone_name": "Agri-Alpha",
        "model_name": "T40",
        "serial_no": "SN-DEMO-0003",
        "max_payload": 40.0,
        "battery_capacity": 88.0,
        "status": "idle",
        "site_index": 1,
        "pilot_index": 2,
    },
    {
        "drone_code": "UAV-DEMO-004",
        "drone_name": "Agri-Beta",
        "model_name": "T50",
        "serial_no": "SN-DEMO-0004",
        "max_payload": 50.0,
        "battery_capacity": 90.0,
        "status": "online",
        "site_index": 1,
        "pilot_index": 3,
    },
    {
        "drone_code": "UAV-DEMO-005",
        "drone_name": "Patrol-01",
        "model_name": "M30T",
        "serial_no": "SN-DEMO-0005",
        "max_payload": 6.0,
        "battery_capacity": 84.0,
        "status": "running",
        "site_index": 2,
        "pilot_index": 0,
    },
    {
        "drone_code": "UAV-DEMO-006",
        "drone_name": "Patrol-02",
        "model_name": "M30",
        "serial_no": "SN-DEMO-0006",
        "max_payload": 5.5,
        "battery_capacity": 80.0,
        "status": "idle",
        "site_index": 2,
        "pilot_index": 4,
    },
    {
        "drone_code": "UAV-DEMO-007",
        "drone_name": "Survey-01",
        "model_name": "Mavic 3E",
        "serial_no": "SN-DEMO-0007",
        "max_payload": 2.2,
        "battery_capacity": 76.0,
        "status": "maintenance",
        "site_index": 3,
        "pilot_index": 5,
    },
    {
        "drone_code": "UAV-DEMO-008",
        "drone_name": "Survey-02",
        "model_name": "Mavic 3T",
        "serial_no": "SN-DEMO-0008",
        "max_payload": 2.5,
        "battery_capacity": 78.0,
        "status": "online",
        "site_index": 3,
        "pilot_index": 1,
    },
]


GROUP_SPECS = [
    {
        "group_code": "DG-DEMO-FOREST-01",
        "group_name": "Forest Patrol Team A",
        "scene_type": "forest",
        "command_level": "regional",
        "status": "standby",
        "description": "Forest patrol and fire inspection",
        "member_codes": ["UAV-DEMO-001", "UAV-DEMO-005"],
    },
    {
        "group_code": "DG-DEMO-AGRI-01",
        "group_name": "Agri Spray Team A",
        "scene_type": "agri",
        "command_level": "district",
        "status": "standby",
        "description": "Crop protection and precision spray",
        "member_codes": ["UAV-DEMO-003", "UAV-DEMO-004"],
    },
    {
        "group_code": "DG-DEMO-MIXED-01",
        "group_name": "Mixed Response Team A",
        "scene_type": "mixed",
        "command_level": "city",
        "status": "standby",
        "description": "Emergency response and mixed mission support",
        "member_codes": ["UAV-DEMO-002", "UAV-DEMO-008"],
    },
    {
        "group_code": "DG-DEMO-FOREST-02",
        "group_name": "Forest Survey Team B",
        "scene_type": "forest",
        "command_level": "district",
        "status": "standby",
        "description": "Routine survey and route replay testing",
        "member_codes": ["UAV-DEMO-006", "UAV-DEMO-007"],
    },
]


FOREST_AREA_SPECS = [
    {"area_code": "FOREST-AREA-DEMO-01", "area_name": "Jinyun Ridge", "region": "Beibei", "risk_level": "high", "coverage_km2": 42.6, "manager_name": "Forest Bureau A"},
    {"area_code": "FOREST-AREA-DEMO-02", "area_name": "Tongluo Valley", "region": "Yubei", "risk_level": "medium", "coverage_km2": 28.4, "manager_name": "Forest Bureau B"},
    {"area_code": "FOREST-AREA-DEMO-03", "area_name": "Shuitu Slope", "region": "Beibei", "risk_level": "medium", "coverage_km2": 19.8, "manager_name": "Forest Bureau C"},
]


FARM_PLOT_SPECS = [
    {"plot_code": "AGRI-PLOT-DEMO-01", "plot_name": "Banan Rice Field", "region": "Banan", "owner_name": "He Farm", "crop_type": "rice", "area_mu": 180.0, "longitude": 106.557213, "latitude": 29.394172, "risk_level": "medium"},
    {"plot_code": "AGRI-PLOT-DEMO-02", "plot_name": "Nanan Citrus Field", "region": "Nanan", "owner_name": "Lin Farm", "crop_type": "citrus", "area_mu": 120.0, "longitude": 106.602384, "latitude": 29.498313, "risk_level": "high"},
    {"plot_code": "AGRI-PLOT-DEMO-03", "plot_name": "Yubei Corn Field", "region": "Yubei", "owner_name": "Xu Farm", "crop_type": "corn", "area_mu": 150.0, "longitude": 106.688224, "latitude": 29.741215, "risk_level": "low"},
]


TASK_SPECS = [
    {
        "task_code": "TASK-DEMO-001",
        "task_name": "North Ridge Fire Patrol",
        "scene_type": "forest",
        "priority": 1,
        "status": "completed",
        "command_center": "Chongqing Command Center",
        "description": "Completed patrol over the northern ridge fire belt.",
        "days_offset": -24,
        "duration_hours": 3,
        "group_code": "DG-DEMO-FOREST-01",
        "target_db": "forest",
        "target_ref": "FOREST-AREA-DEMO-01",
        "dispatch_status": "completed",
    },
    {
        "task_code": "TASK-DEMO-002",
        "task_name": "Citrus Field Spray",
        "scene_type": "agri",
        "priority": 2,
        "status": "completed",
        "command_center": "Chongqing Command Center",
        "description": "Precision crop spray for citrus disease control.",
        "days_offset": -21,
        "duration_hours": 2,
        "group_code": "DG-DEMO-AGRI-01",
        "target_db": "agri",
        "target_ref": "AGRI-PLOT-DEMO-02",
        "dispatch_status": "completed",
    },
    {
        "task_code": "TASK-DEMO-003",
        "task_name": "Mixed Emergency Recon",
        "scene_type": "mixed",
        "priority": 1,
        "status": "completed",
        "command_center": "Municipal Emergency Desk",
        "description": "Mixed reconnaissance mission after heavy rain.",
        "days_offset": -18,
        "duration_hours": 4,
        "group_code": "DG-DEMO-MIXED-01",
        "target_db": "forest",
        "target_ref": "FOREST-AREA-DEMO-02",
        "dispatch_status": "completed",
    },
    {
        "task_code": "TASK-DEMO-004",
        "task_name": "Banan Crop Mapping",
        "scene_type": "agri",
        "priority": 3,
        "status": "completed",
        "command_center": "West District Dispatch Center",
        "description": "Crop growth mapping and low-altitude imaging.",
        "days_offset": -15,
        "duration_hours": 2,
        "group_code": "DG-DEMO-AGRI-01",
        "target_db": "agri",
        "target_ref": "AGRI-PLOT-DEMO-01",
        "dispatch_status": "completed",
    },
    {
        "task_code": "TASK-DEMO-005",
        "task_name": "River Bank Forest Scan",
        "scene_type": "forest",
        "priority": 2,
        "status": "running",
        "command_center": "Chongqing Command Center",
        "description": "Active forest scan for smoke and heat source detection.",
        "days_offset": -10,
        "duration_hours": 5,
        "group_code": "DG-DEMO-FOREST-02",
        "target_db": "forest",
        "target_ref": "FOREST-AREA-DEMO-03",
        "dispatch_status": "running",
    },
    {
        "task_code": "TASK-DEMO-006",
        "task_name": "Nanan Orchard Inspection",
        "scene_type": "agri",
        "priority": 2,
        "status": "running",
        "command_center": "South District Dispatch Center",
        "description": "Ongoing orchard inspection with thermal sensing.",
        "days_offset": -7,
        "duration_hours": 3,
        "group_code": "DG-DEMO-MIXED-01",
        "target_db": "agri",
        "target_ref": "AGRI-PLOT-DEMO-02",
        "dispatch_status": "running",
    },
    {
        "task_code": "TASK-DEMO-007",
        "task_name": "Yubei Forest Corridor Patrol",
        "scene_type": "forest",
        "priority": 1,
        "status": "running",
        "command_center": "Municipal Emergency Desk",
        "description": "Patrol task covering forest corridor and road access.",
        "days_offset": -4,
        "duration_hours": 4,
        "group_code": "DG-DEMO-FOREST-01",
        "target_db": "forest",
        "target_ref": "FOREST-AREA-DEMO-02",
        "dispatch_status": "running",
    },
    {
        "task_code": "TASK-DEMO-008",
        "task_name": "Rice Protection Mission",
        "scene_type": "agri",
        "priority": 3,
        "status": "pending",
        "command_center": "West District Dispatch Center",
        "description": "Queued crop protection mission for late-stage rice plots.",
        "days_offset": 1,
        "duration_hours": 2,
        "group_code": "DG-DEMO-AGRI-01",
        "target_db": "agri",
        "target_ref": "AGRI-PLOT-DEMO-01",
        "dispatch_status": "created",
    },
    {
        "task_code": "TASK-DEMO-009",
        "task_name": "Forest Early Warning Sweep",
        "scene_type": "forest",
        "priority": 1,
        "status": "pending",
        "command_center": "Chongqing Command Center",
        "description": "Scheduled early warning sweep for high-risk dry zone.",
        "days_offset": 3,
        "duration_hours": 3,
        "group_code": "DG-DEMO-FOREST-02",
        "target_db": "forest",
        "target_ref": "FOREST-AREA-DEMO-01",
        "dispatch_status": "created",
    },
    {
        "task_code": "TASK-DEMO-010",
        "task_name": "Cross-Region Recon Drill",
        "scene_type": "mixed",
        "priority": 2,
        "status": "pending",
        "command_center": "Municipal Emergency Desk",
        "description": "Joint drill mission for mixed response coordination.",
        "days_offset": 5,
        "duration_hours": 4,
        "group_code": "DG-DEMO-MIXED-01",
        "target_db": "forest",
        "target_ref": "FOREST-AREA-DEMO-03",
        "dispatch_status": "created",
    },
]


def _planned_window(now, days_offset, duration_hours):
    start_time = timezone.localtime(now).replace(minute=0, second=0, microsecond=0) + timedelta(days=days_offset)
    start_time = start_time.replace(hour=8 + (abs(days_offset) % 5))
    end_time = start_time + timedelta(hours=duration_hours)
    return start_time, end_time


def seed_fleet(admin_user):
    sites = {}
    for spec in SITE_SPECS:
        site, _ = LaunchSite.objects.update_or_create(
            site_name=spec["site_name"],
            defaults={
                "region": spec["region"],
                "longitude": spec["longitude"],
                "latitude": spec["latitude"],
                "altitude": spec["altitude"],
                "status": spec["status"],
            },
        )
        sites[spec["code"]] = site

    pilots = {}
    for spec in PILOT_SPECS:
        pilot, _ = Pilot.objects.update_or_create(
            license_no=spec["license_no"],
            defaults={
                "system_user_id": admin_user.id,
                "pilot_name": spec["pilot_name"],
                "phone": spec["phone"],
                "skill_level": spec["skill_level"],
                "status": spec["status"],
            },
        )
        pilots[spec["license_no"]] = pilot

    drones = {}
    for spec in DRONE_SPECS:
        site = sites[SITE_SPECS[spec["site_index"]]["code"]]
        pilot = pilots[PILOT_SPECS[spec["pilot_index"]]["license_no"]]
        drone, _ = Drone.objects.update_or_create(
            drone_code=spec["drone_code"],
            defaults={
                "drone_name": spec["drone_name"],
                "model_name": spec["model_name"],
                "serial_no": spec["serial_no"],
                "max_payload": spec["max_payload"],
                "battery_capacity": spec["battery_capacity"],
                "status": spec["status"],
                "launch_site_id": site.id,
                "pilot_id": pilot.id,
            },
        )
        drones[spec["drone_code"]] = drone

    groups = {}
    for spec in GROUP_SPECS:
        group, _ = DroneGroup.objects.update_or_create(
            group_code=spec["group_code"],
            defaults={
                "group_name": spec["group_name"],
                "scene_type": spec["scene_type"],
                "command_level": spec["command_level"],
                "status": spec["status"],
                "description": spec["description"],
            },
        )
        groups[spec["group_code"]] = group
        for index, drone_code in enumerate(spec["member_codes"]):
            DroneGroupMember.objects.update_or_create(
                group_id=group.id,
                drone_id=drones[drone_code].id,
                defaults={
                    "role_name": "captain" if index == 0 else "worker",
                    "join_status": "active",
                },
            )

    return {
        "sites": sites,
        "pilots": pilots,
        "drones": drones,
        "groups": groups,
    }


def seed_target_resources():
    forest_areas = {}
    for spec in FOREST_AREA_SPECS:
        area, _ = ForestArea.objects.using("forest").update_or_create(
            area_code=spec["area_code"],
            defaults={
                "area_name": spec["area_name"],
                "region": spec["region"],
                "risk_level": spec["risk_level"],
                "coverage_km2": spec["coverage_km2"],
                "manager_name": spec["manager_name"],
            },
        )
        forest_areas[spec["area_code"]] = area

    farm_plots = {}
    for spec in FARM_PLOT_SPECS:
        plot, _ = FarmPlot.objects.using("agri").update_or_create(
            plot_code=spec["plot_code"],
            defaults={
                "plot_name": spec["plot_name"],
                "region": spec["region"],
                "owner_name": spec["owner_name"],
                "crop_type": spec["crop_type"],
                "area_mu": spec["area_mu"],
                "longitude": spec["longitude"],
                "latitude": spec["latitude"],
                "risk_level": spec["risk_level"],
            },
        )
        farm_plots[spec["plot_code"]] = plot

    return {
        "forest_areas": forest_areas,
        "farm_plots": farm_plots,
    }


def seed_tasking(admin_user, fleet_data, target_data):
    now = timezone.now()
    tasks = {}
    dispatches = {}

    for spec in TASK_SPECS:
        planned_start, planned_end = _planned_window(now, spec["days_offset"], spec["duration_hours"])
        task, _ = GlobalTask.objects.update_or_create(
            task_code=spec["task_code"],
            defaults={
                "task_name": spec["task_name"],
                "scene_type": spec["scene_type"],
                "priority": spec["priority"],
                "status": spec["status"],
                "command_center": spec["command_center"],
                "creator_id": admin_user.id,
                "description": spec["description"],
                "planned_start": planned_start,
                "planned_end": planned_end,
            },
        )
        tasks[spec["task_code"]] = task

        group = fleet_data["groups"][spec["group_code"]]
        if spec["target_db"] == "forest":
            area = target_data["forest_areas"][spec["target_ref"]]
            target_task, _ = ForestPatrolTask.objects.using("forest").update_or_create(
                task_code=f"{spec['task_code']}-FOREST",
                defaults={
                    "global_task_id": task.id,
                    "area_id": area.id,
                    "drone_group_id": group.id,
                    "patrol_type": "routine" if spec["status"] != "running" else "fire_watch",
                    "status": spec["status"],
                    "planned_start": planned_start,
                    "planned_end": planned_end,
                },
            )
        else:
            plot = target_data["farm_plots"][spec["target_ref"]]
            target_task, _ = AgriTask.objects.using("agri").update_or_create(
                task_code=f"{spec['task_code']}-AGRI",
                defaults={
                    "global_task_id": task.id,
                    "farm_plot_id": plot.id,
                    "drone_group_id": group.id,
                    "task_type": "spray" if spec["status"] != "completed" else "survey",
                    "pesticide_name": "Demo Mix A",
                    "status": spec["status"],
                    "planned_start": planned_start,
                    "planned_end": planned_end,
                },
            )

        dispatch, _ = TaskDispatch.objects.update_or_create(
            dispatch_code=f"DISPATCH-{spec['task_code']}",
            defaults={
                "global_task_id": task.id,
                "target_db": spec["target_db"],
                "target_task_id": target_task.id,
                "drone_group_id": group.id,
                "dispatch_status": spec["dispatch_status"],
                "dispatcher_id": admin_user.id,
                "remark": f"Auto seeded for {spec['task_name']}",
            },
        )
        TaskDispatch.objects.filter(pk=dispatch.pk).update(dispatched_at=planned_start - timedelta(hours=2))
        dispatch.refresh_from_db()
        dispatches[dispatch.dispatch_code] = dispatch

    return {
        "tasks": tasks,
        "dispatches": dispatches,
    }


def ensure_admin_user():
    admin_user = USER_MODEL.objects.filter(is_superuser=True).order_by("id").first()
    if admin_user:
        return admin_user
    return USER_MODEL.objects.create_superuser(
        username="admin",
        password="admin123456",
        real_name="Demo Admin",
        user_type="super_admin",
        roles=["super_admin", "dispatcher"],
        region="Chongqing",
    )


def main():
    admin_user = ensure_admin_user()
    fleet_data = seed_fleet(admin_user)
    target_data = seed_target_resources()
    tasking_data = seed_tasking(admin_user, fleet_data, target_data)

    summary = {
        "launch_sites": LaunchSite.objects.count(),
        "pilots": Pilot.objects.count(),
        "drones": Drone.objects.count(),
        "groups": DroneGroup.objects.count(),
        "group_members": DroneGroupMember.objects.count(),
        "global_tasks": GlobalTask.objects.count(),
        "dispatches": TaskDispatch.objects.count(),
        "forest_areas": ForestArea.objects.using("forest").count(),
        "forest_tasks": ForestPatrolTask.objects.using("forest").count(),
        "farm_plots": FarmPlot.objects.using("agri").count(),
        "agri_tasks": AgriTask.objects.using("agri").count(),
        "seeded_task_codes": sorted(tasking_data["tasks"].keys()),
    }
    print(summary)


if __name__ == "__main__":
    main()
