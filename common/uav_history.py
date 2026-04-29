import csv
import math
from collections import defaultdict
from datetime import date, datetime, timedelta

from django.core.paginator import Paginator
from django.http import HttpResponse
from django.utils import timezone


ONLINE_STATUSES = {"online", "running", "busy", "active", "ready"}
ACTIVE_TASK_STATUSES = {"running", "executing", "in_progress", "active"}
COMPLETED_TASK_STATUSES = {"completed", "done", "success", "finished"}
PENDING_TASK_STATUSES = {"pending", "created", "planned", "queued", "standby"}
ABNORMAL_TASK_STATUSES = {"failed", "error", "delayed", "abnormal", "timeout", "cancelled"}
STATUS_COLORS = {
    "completed": "#0d6efd",
    "running": "#198754",
    "pending": "#fd7e14",
    "abnormal": "#dc3545",
}


def parse_positive_int(raw_value, default, minimum=1, maximum=None):
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        value = default
    value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


def parse_date_param(raw_value, default=None):
    if not raw_value:
        return default
    if isinstance(raw_value, date):
        return raw_value
    try:
        return datetime.fromisoformat(str(raw_value)[:10]).date()
    except ValueError:
        return default


def resolve_time_window(start_raw, end_raw, default_days=30):
    today = timezone.localdate()
    end_date = parse_date_param(end_raw, today)
    start_date = parse_date_param(start_raw, end_date - timedelta(days=default_days - 1))
    if start_date > end_date:
        start_date, end_date = end_date, start_date
    return start_date, end_date


def normalize_task_status(status):
    value = str(status or "").strip().lower()
    if value in COMPLETED_TASK_STATUSES:
        return "completed"
    if value in ACTIVE_TASK_STATUSES:
        return "running"
    if value in ABNORMAL_TASK_STATUSES:
        return "abnormal"
    return "pending"


def build_pagination_payload(page_obj):
    return {
        "page": page_obj.number,
        "page_size": page_obj.paginator.per_page,
        "total": page_obj.paginator.count,
        "total_pages": page_obj.paginator.num_pages,
        "has_previous": page_obj.has_previous(),
        "has_next": page_obj.has_next(),
    }


def paginate_items(queryset_or_items, page, page_size):
    paginator = Paginator(queryset_or_items, page_size)
    page_obj = paginator.get_page(page)
    return page_obj, build_pagination_payload(page_obj)


def period_key(value, grain):
    if isinstance(value, datetime):
        value = value.date()
    if grain == "week":
        week_start = value - timedelta(days=value.weekday())
        return week_start.isoformat()
    if grain == "month":
        return value.replace(day=1).isoformat()
    return value.isoformat()


def iter_periods(start_date, end_date, grain):
    cursor = start_date
    periods = []
    seen = set()
    while cursor <= end_date:
        key = period_key(cursor, grain)
        if key not in seen:
            seen.add(key)
            if grain == "month":
                label = f"{cursor.year}-{cursor.month:02d}"
            elif grain == "week":
                week_start = cursor - timedelta(days=cursor.weekday())
                label = f"{week_start.month:02d}/{week_start.day:02d}"
            else:
                label = cursor.strftime("%m-%d")
            periods.append({"key": key, "label": label})
        if grain == "month":
            cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
        else:
            cursor += timedelta(days=7 if grain == "week" else 1)
    return periods


def estimate_task_hours(task):
    start_time = getattr(task, "planned_start", None) or getattr(task, "created_at", None)
    end_time = getattr(task, "planned_end", None) or getattr(task, "updated_at", None)
    if start_time and end_time and end_time > start_time:
        return round((end_time - start_time).total_seconds() / 3600, 2)
    status = normalize_task_status(getattr(task, "status", "pending"))
    default_hours = {
        "completed": 2.0,
        "running": 1.25,
        "pending": 0.75,
        "abnormal": 1.5,
    }
    return default_hours.get(status, 1.0)


def make_csv_response(filename, headers, rows):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.write("\ufeff")
    writer = csv.writer(response)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return response


def build_assignment_context(db_alias="default", tasks=None, dispatches=None):
    from fleet.models import Drone, DroneGroupMember, LaunchSite, Pilot
    from tasking.models import GlobalTask, TaskDispatch

    task_list = list(tasks) if tasks is not None else list(GlobalTask.objects.using(db_alias).all())
    dispatch_list = (
        list(dispatches)
        if dispatches is not None
        else list(TaskDispatch.objects.using(db_alias).all().order_by("dispatched_at", "id"))
    )
    drone_map = {item.id: item for item in Drone.objects.using(db_alias).all()}
    pilot_map = {item.id: item for item in Pilot.objects.using(db_alias).all()}
    launch_site_map = {item.id: item for item in LaunchSite.objects.using(db_alias).all()}
    group_members = defaultdict(list)
    for member in DroneGroupMember.objects.using(db_alias).all():
        group_members[member.group_id].append(member.drone_id)

    task_map = {item.id: item for item in task_list}
    task_assignment_map = {}
    dispatch_assignment_map = {}
    task_dispatch_map = defaultdict(list)
    tasks_by_drone = defaultdict(list)
    dispatches_by_drone = defaultdict(list)

    for dispatch in dispatch_list:
        drone_ids = group_members.get(dispatch.drone_group_id, [])
        primary_drone = drone_map.get(drone_ids[0]) if drone_ids else None
        pilot = pilot_map.get(getattr(primary_drone, "pilot_id", 0))
        launch_site = launch_site_map.get(getattr(primary_drone, "launch_site_id", 0))
        task = task_map.get(dispatch.global_task_id)
        assignment = {
            "dispatch_id": dispatch.id,
            "task_id": dispatch.global_task_id,
            "task_name": getattr(task, "task_name", "") if task else "",
            "drone_id": primary_drone.id if primary_drone else None,
            "drone_ids": drone_ids,
            "drone_name": getattr(primary_drone, "drone_name", "") if primary_drone else "",
            "pilot_id": pilot.id if pilot else None,
            "pilot_name": getattr(pilot, "pilot_name", "") if pilot else "",
            "pilot_ids": [pilot.id] if pilot else [],
            "region": getattr(launch_site, "region", "") if launch_site else "",
            "launch_site_name": getattr(launch_site, "site_name", "") if launch_site else "",
            "dispatch_status": getattr(dispatch, "dispatch_status", "created"),
            "timestamp": getattr(dispatch, "dispatched_at", None),
            "target_db": getattr(dispatch, "target_db", ""),
        }
        dispatch_assignment_map[dispatch.id] = assignment
        task_assignment_map[dispatch.global_task_id] = assignment
        task_dispatch_map[dispatch.global_task_id].append(assignment)
        for drone_id in drone_ids:
            if task:
                tasks_by_drone[drone_id].append(task)
            dispatches_by_drone[drone_id].append(dispatch)

    return {
        "tasks": task_list,
        "dispatches": dispatch_list,
        "task_map": task_map,
        "drone_map": drone_map,
        "pilot_map": pilot_map,
        "launch_site_map": launch_site_map,
        "group_members": group_members,
        "task_assignment_map": task_assignment_map,
        "dispatch_assignment_map": dispatch_assignment_map,
        "task_dispatch_map": task_dispatch_map,
        "tasks_by_drone": tasks_by_drone,
        "dispatches_by_drone": dispatches_by_drone,
    }


def get_drone_coordinates(drone, launch_site_map):
    launch_site = launch_site_map.get(getattr(drone, "launch_site_id", 0))
    if launch_site:
        return float(launch_site.latitude or 29.56301), float(launch_site.longitude or 106.55156)
    return 29.56301, 106.55156


def build_drone_track_segments(drone, tasks, task_assignment_map, launch_site_map):
    base_lat, base_lng = get_drone_coordinates(drone, launch_site_map)
    ordered_tasks = sorted(
        tasks,
        key=lambda item: getattr(item, "planned_start", None) or getattr(item, "created_at", None) or timezone.now(),
    )
    segments = []
    heat_points = []
    replay_dates = []

    if not ordered_tasks:
        now = timezone.now()
        segments.append(
            {
                "task_id": None,
                "task_name": "待命轨迹",
                "date": now.date().isoformat(),
                "status": "pending",
                "color": STATUS_COLORS["pending"],
                "points": [
                    {
                        "lat": base_lat,
                        "lng": base_lng,
                        "timestamp": now.isoformat(),
                        "status": "pending",
                    }
                ],
            }
        )
        heat_points.append({"lat": base_lat, "lng": base_lng, "intensity": 0.35, "status": "pending"})
        replay_dates.append(now.date().isoformat())
        return segments, heat_points, replay_dates

    for index, task in enumerate(ordered_tasks):
        start_time = getattr(task, "planned_start", None) or getattr(task, "created_at", None) or timezone.now()
        end_time = getattr(task, "planned_end", None) or getattr(task, "updated_at", None) or (start_time + timedelta(minutes=45))
        status = normalize_task_status(getattr(task, "status", "pending"))
        color = STATUS_COLORS.get(status, STATUS_COLORS["pending"])
        seed = (drone.id or 1) * 31 + (task.id or 1) * 17 + index * 13
        scale = 0.010 + (index % 4) * 0.004
        points = []
        for step, ratio in enumerate((0.0, 0.5, 1.0)):
            angle = (seed + step * 19) / 7.5
            lat = base_lat + math.sin(angle) * scale * (1 + ratio / 3)
            lng = base_lng + math.cos(angle) * scale * (1 + ratio / 3)
            moment = start_time + ((end_time - start_time) * ratio)
            points.append(
                {
                    "lat": round(lat, 6),
                    "lng": round(lng, 6),
                    "timestamp": moment.isoformat(),
                    "status": status,
                }
            )
        replay_date = start_time.date().isoformat()
        replay_dates.append(replay_date)
        segments.append(
            {
                "task_id": task.id,
                "task_name": getattr(task, "task_name", "") or getattr(task, "task_code", "") or f"任务 {task.id}",
                "date": replay_date,
                "status": status,
                "color": color,
                "assignment": task_assignment_map.get(task.id, {}),
                "points": points,
            }
        )
        heat_points.append(
            {
                "lat": points[-1]["lat"],
                "lng": points[-1]["lng"],
                "intensity": 1.0 if status == "running" else 0.78 if status == "completed" else 0.55,
                "status": status,
            }
        )

    return segments, heat_points, sorted(set(replay_dates))
