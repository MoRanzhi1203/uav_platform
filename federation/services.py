from agri.models import AgriTask, FarmPlot, PestMonitor
from fleet.models import Drone, DroneGroup, Pilot
from forest.models import FireDetection, ForestArea, ForestPatrolTask
from system.models import SystemUser
from tasking.models import GlobalTask, TaskDispatch

CENTRAL_DB = "default"
FOREST_DB = "forest"
AGRI_DB = "agri"


def build_cross_db_summary():
    central = {
        "users": SystemUser.objects.using(CENTRAL_DB).count(),
        "pilots": Pilot.objects.using(CENTRAL_DB).count(),
        "drones": Drone.objects.using(CENTRAL_DB).count(),
        "drone_groups": DroneGroup.objects.using(CENTRAL_DB).count(),
        "global_tasks": GlobalTask.objects.using(CENTRAL_DB).count(),
        "dispatches": TaskDispatch.objects.using(CENTRAL_DB).count(),
    }
    forest = {
        "areas": ForestArea.objects.using(FOREST_DB).count(),
        "patrol_tasks": ForestPatrolTask.objects.using(FOREST_DB).count(),
        "fire_detections": FireDetection.objects.using(FOREST_DB).count(),
    }
    agri = {
        "farm_plots": FarmPlot.objects.using(AGRI_DB).count(),
        "agri_tasks": AgriTask.objects.using(AGRI_DB).count(),
        "pest_monitors": PestMonitor.objects.using(AGRI_DB).count(),
    }
    summary = {
        "total_uav_tasks": central["global_tasks"] + forest["patrol_tasks"] + agri["agri_tasks"],
        "total_risk_events": forest["fire_detections"] + agri["pest_monitors"],
        "forest_risk_ratio": 0,
        "agri_risk_ratio": 0,
    }
    total_risk_events = summary["total_risk_events"]
    if total_risk_events:
        summary["forest_risk_ratio"] = round(forest["fire_detections"] / total_risk_events, 4)
        summary["agri_risk_ratio"] = round(agri["pest_monitors"] / total_risk_events, 4)
    return {"central": central, "forest": forest, "agri": agri, "summary": summary}


def build_cross_db_task_pairs():
    global_tasks = list(
        GlobalTask.objects.using(CENTRAL_DB).values(
            "id", "task_code", "task_name", "scene_type", "status", "priority"
        )
    )
    forest_map = {
        item["global_task_id"]: item
        for item in ForestPatrolTask.objects.using(FOREST_DB).values(
            "id", "global_task_id", "task_code", "status", "drone_group_id"
        )
    }
    agri_map = {
        item["global_task_id"]: item
        for item in AgriTask.objects.using(AGRI_DB).values(
            "id", "global_task_id", "task_code", "status", "drone_group_id"
        )
    }
    return [
        {
            "global_task": task,
            "forest_task": forest_map.get(task["id"]),
            "agri_task": agri_map.get(task["id"]),
        }
        for task in global_tasks
    ]


def build_cross_db_region_aggregation():
    forest_rows = list(ForestArea.objects.using(FOREST_DB).values("region"))
    agri_rows = list(FarmPlot.objects.using(AGRI_DB).values("region"))
    region_map = {}
    for row in forest_rows:
        region = row["region"] or "unknown"
        region_map.setdefault(region, {"region": region, "forest_areas": 0, "farm_plots": 0})
        region_map[region]["forest_areas"] += 1
    for row in agri_rows:
        region = row["region"] or "unknown"
        region_map.setdefault(region, {"region": region, "forest_areas": 0, "farm_plots": 0})
        region_map[region]["farm_plots"] += 1
    return list(region_map.values())
