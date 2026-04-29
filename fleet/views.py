from collections import defaultdict

from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from common.decorators import admin_required, is_admin_user
from common.request_utils import (
    get_object_or_none,
    parse_request_data,
    serialize_instance,
    serialize_queryset,
    update_instance_from_payload,
)
from common.responses import api_error, api_response
from common.uav_history import (
    ACTIVE_TASK_STATUSES,
    ONLINE_STATUSES,
    build_assignment_context,
    build_drone_track_segments,
    estimate_task_hours,
    iter_periods,
    make_csv_response,
    normalize_task_status,
    paginate_items,
    parse_positive_int,
    period_key,
    resolve_time_window,
)
from fleet.models import Drone, DroneGroup, DroneGroupMember, LaunchSite, Pilot
from fleet.serializers import DroneSerializer, PilotSerializer

DB_ALIAS = "default"
MANAGER_TYPES = {"super_admin", "dispatcher"}


def _can_read_all(user):
    return is_admin_user(user) or getattr(user, "user_type", "") in MANAGER_TYPES


def _pilot_queryset(request):
    queryset = Pilot.objects.using(DB_ALIAS).all()
    if _can_read_all(request.user):
        return queryset
    return queryset.filter(system_user_id=request.user.id)


def _launch_site_queryset(request):
    queryset = LaunchSite.objects.using(DB_ALIAS).all()
    if _can_read_all(request.user):
        return queryset
    if getattr(request.user, "region", ""):
        return queryset.filter(region=request.user.region)
    return queryset.none()


def _drone_queryset(request):
    queryset = Drone.objects.using(DB_ALIAS).all()
    if _can_read_all(request.user):
        return queryset
    pilot_ids = list(_pilot_queryset(request).values_list("id", flat=True))
    if pilot_ids:
        return queryset.filter(pilot_id__in=pilot_ids)
    site_ids = list(_launch_site_queryset(request).values_list("id", flat=True))
    if site_ids:
        return queryset.filter(launch_site_id__in=site_ids)
    return queryset.none()


def _drone_group_queryset(request):
    queryset = DroneGroup.objects.using(DB_ALIAS).all()
    if _can_read_all(request.user):
        return queryset
    drone_ids = list(_drone_queryset(request).values_list("id", flat=True))
    group_ids = list(
        DroneGroupMember.objects.using(DB_ALIAS).filter(drone_id__in=drone_ids).values_list("group_id", flat=True)
    )
    return queryset.filter(id__in=group_ids)


def _drone_group_member_queryset(request):
    queryset = DroneGroupMember.objects.using(DB_ALIAS).all()
    if _can_read_all(request.user):
        return queryset
    drone_ids = list(_drone_queryset(request).values_list("id", flat=True))
    return queryset.filter(drone_id__in=drone_ids)


def _save_instance(instance):
    instance.save(using=DB_ALIAS)
    return api_response(data=serialize_instance(instance))


def _get_filter_options(pilots, launch_sites):
    return {
        "statuses": [
            {"value": "idle", "label": "待命"},
            {"value": "online", "label": "在线"},
            {"value": "running", "label": "执行中"},
            {"value": "maintenance", "label": "维护中"},
            {"value": "offline", "label": "离线"},
        ],
        "pilots": [{"id": item.id, "name": item.pilot_name} for item in pilots],
        "regions": sorted({item.region for item in launch_sites if item.region}),
    }


def _filter_fleet_drones(request):
    queryset = _drone_queryset(request)
    search = (request.GET.get("keyword") or request.GET.get("search") or "").strip()
    status_value = (request.GET.get("status") or "").strip()
    region_value = (request.GET.get("region") or "").strip()
    pilot_id = request.GET.get("pilot") or request.GET.get("pilot_id")

    if status_value:
        queryset = queryset.filter(status__iexact=status_value)
    if pilot_id:
        queryset = queryset.filter(pilot_id=pilot_id)
    if region_value:
        site_ids = list(
            _launch_site_queryset(request).filter(region__iexact=region_value).values_list("id", flat=True)
        )
        queryset = queryset.filter(launch_site_id__in=site_ids)
    if search:
        queryset = queryset.filter(
            Q(drone_name__icontains=search)
            | Q(drone_code__icontains=search)
            | Q(model_name__icontains=search)
            | Q(serial_no__icontains=search)
        )
    return queryset.order_by("-updated_at", "-id")


def _build_drone_metrics(drones, assignment_context):
    task_assignment_map = assignment_context["task_assignment_map"]
    drone_task_count_map = defaultdict(int)
    drone_completed_map = defaultdict(int)
    drone_flight_duration_map = defaultdict(float)
    active_task_ids = set()

    for task in assignment_context["tasks"]:
        assignment = task_assignment_map.get(task.id) or {}
        drone_ids = assignment.get("drone_ids") or []
        status_key = normalize_task_status(getattr(task, "status", "pending"))
        task_hours = estimate_task_hours(task)
        for drone_id in drone_ids:
            drone_task_count_map[drone_id] += 1
            drone_flight_duration_map[drone_id] += task_hours
            if status_key == "completed":
                drone_completed_map[drone_id] += 1
            if getattr(task, "status", "").strip().lower() in ACTIVE_TASK_STATUSES:
                active_task_ids.add(task.id)

    drone_completion_rate_map = {}
    for drone in drones:
        total = drone_task_count_map.get(drone.id, 0)
        completed = drone_completed_map.get(drone.id, 0)
        drone_completion_rate_map[drone.id] = round((completed / total) * 100, 2) if total else 0
        drone_flight_duration_map[drone.id] = round(drone_flight_duration_map.get(drone.id, 0), 2)

    return {
        "drone_task_count_map": dict(drone_task_count_map),
        "drone_completed_map": dict(drone_completed_map),
        "drone_flight_duration_map": dict(drone_flight_duration_map),
        "drone_completion_rate_map": drone_completion_rate_map,
        "active_task_count": len(active_task_ids),
    }


def _drone_summary_payload(drones, pilots, metrics):
    drone_total = len(drones)
    online_count = sum(1 for item in drones if (item.status or "").lower() in ONLINE_STATUSES)
    return {
        "drone_total": drone_total,
        "online_rate": round((online_count / drone_total) * 100, 2) if drone_total else 0,
        "pilot_total": len(pilots),
        "active_tasks": metrics["active_task_count"],
        "avg_completion_rate": round(
            sum(metrics["drone_completion_rate_map"].values()) / drone_total,
            2,
        ) if drone_total else 0,
    }


def _serialize_drone_page(request, drones):
    launch_sites = list(_launch_site_queryset(request))
    pilots = list(_pilot_queryset(request))
    assignment_context = build_assignment_context(DB_ALIAS)
    metrics = _build_drone_metrics(drones, assignment_context)
    serializer_context = {
        "launch_site_map": {item.id: item for item in launch_sites},
        "pilot_map": {item.id: item for item in pilots},
        "drone_task_count_map": metrics["drone_task_count_map"],
        "drone_flight_duration_map": metrics["drone_flight_duration_map"],
        "drone_completion_rate_map": metrics["drone_completion_rate_map"],
    }
    serialized = DroneSerializer(drones, many=True, context=serializer_context).data
    return serialized, pilots, launch_sites, assignment_context, metrics


def _export_drone_csv(rows):
    return make_csv_response(
        "fleet_drones.csv",
        ["ID", "名称", "型号", "状态", "电量", "区域", "飞手", "任务数", "飞行时长(h)", "完成率(%)", "最近活动"],
        [
            [
                item["id"],
                item["name"],
                item["model"],
                item["status"],
                item["battery"],
                item["region"],
                item["pilot_name"],
                item["task_count"],
                item["flight_duration"],
                item["completion_rate"],
                item["last_active"],
            ]
            for item in rows
        ],
    )


def _export_pilot_csv(rows):
    return make_csv_response(
        "fleet_pilots.csv",
        ["ID", "飞手姓名", "资质等级", "状态", "无人机数量", "无人机列表", "联系电话"],
        [
            [
                item["id"],
                item["name"],
                item["qualification"],
                item["status"],
                len(item["assigned_drone_ids"]),
                " / ".join(item["assigned_drone_names"]),
                item["phone"],
            ]
            for item in rows
        ],
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overview(request):
    drones = list(_drone_queryset(request))
    pilots = list(_pilot_queryset(request))
    assignment_context = build_assignment_context(DB_ALIAS)
    metrics = _build_drone_metrics(drones, assignment_context)
    data = {
        "pilot_count": len(pilots),
        "launch_site_count": _launch_site_queryset(request).count(),
        "drone_count": len(drones),
        "drone_group_count": _drone_group_queryset(request).count(),
        "member_count": _drone_group_member_queryset(request).count(),
        "online_rate": _drone_summary_payload(drones, pilots, metrics)["online_rate"],
        "active_task_count": metrics["active_task_count"],
    }
    return api_response(data=data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def pilot_list_create(request):
    if request.method == "GET":
        queryset = _pilot_queryset(request)
        keyword = (request.GET.get("keyword") or request.GET.get("search") or "").strip()
        status_value = (request.GET.get("status") or "").strip()
        if status_value:
            queryset = queryset.filter(status__iexact=status_value)
        if keyword:
            queryset = queryset.filter(
                Q(pilot_name__icontains=keyword) | Q(license_no__icontains=keyword) | Q(phone__icontains=keyword)
            )
        queryset = queryset.order_by("-updated_at", "-id")
        pilots = list(queryset)
        drone_map = defaultdict(list)
        drone_name_map = defaultdict(list)
        for drone in _drone_queryset(request):
            drone_map[drone.pilot_id].append(drone.id)
            drone_name_map[drone.pilot_id].append(drone.drone_name)
        serializer = PilotSerializer(
            pilots,
            many=True,
            context={"pilot_drone_ids": dict(drone_map), "pilot_drone_names": dict(drone_name_map)},
        )
        rows = list(serializer.data)
        if request.GET.get("export") == "csv":
            return _export_pilot_csv(rows)
        page = parse_positive_int(request.GET.get("page"), 1)
        page_size = parse_positive_int(request.GET.get("page_size"), 10, maximum=50)
        page_obj, pagination = paginate_items(rows, page, page_size)
        return api_response(
            data={
                "items": list(page_obj.object_list),
                "pagination": pagination,
                "summary": {
                    "pilot_total": len(rows),
                    "busy_pilots": sum(1 for item in rows if item["status"] == "busy"),
                    "assigned_drone_total": sum(len(item["assigned_drone_ids"]) for item in rows),
                },
            }
        )

    return _pilot_create(request)


@admin_required
def _pilot_create(request):
    payload = parse_request_data(request)
    instance = Pilot.objects.using(DB_ALIAS).create(
        system_user_id=payload.get("system_user_id", 0),
        pilot_name=payload.get("pilot_name", ""),
        license_no=payload.get("license_no", ""),
        phone=payload.get("phone", ""),
        skill_level=payload.get("skill_level", "A"),
        status=payload.get("status", "idle"),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def pilot_detail(request, pk):
    instance = get_object_or_none(_pilot_queryset(request), id=pk)
    if not instance:
        return api_error(msg="pilot_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _pilot_update(request, instance)
    return _pilot_delete(request, instance)


@admin_required
def _pilot_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["system_user_id", "pilot_name", "license_no", "phone", "skill_level", "status"],
    )
    return _save_instance(instance)


@admin_required
def _pilot_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def launch_site_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_launch_site_queryset(request)))
    return _launch_site_create(request)


@admin_required
def _launch_site_create(request):
    payload = parse_request_data(request)
    instance = LaunchSite.objects.using(DB_ALIAS).create(
        site_name=payload.get("site_name", ""),
        region=payload.get("region", ""),
        longitude=payload.get("longitude", 0),
        latitude=payload.get("latitude", 0),
        altitude=payload.get("altitude", 0),
        status=payload.get("status", "ready"),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def launch_site_detail(request, pk):
    instance = get_object_or_none(_launch_site_queryset(request), id=pk)
    if not instance:
        return api_error(msg="launch_site_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _launch_site_update(request, instance)
    return _launch_site_delete(request, instance)


@admin_required
def _launch_site_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["site_name", "region", "longitude", "latitude", "altitude", "status"],
    )
    return _save_instance(instance)


@admin_required
def _launch_site_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def drone_list_create(request):
    if request.method == "GET":
        filtered_queryset = _filter_fleet_drones(request)
        drones = list(filtered_queryset)
        rows, pilots, launch_sites, _, metrics = _serialize_drone_page(request, drones)
        if request.GET.get("export") == "csv":
            return _export_drone_csv(rows)
        page = parse_positive_int(request.GET.get("page"), 1)
        page_size = parse_positive_int(request.GET.get("page_size"), 10, maximum=50)
        page_obj, pagination = paginate_items(rows, page, page_size)
        return api_response(
            data={
                "items": list(page_obj.object_list),
                "pagination": pagination,
                "summary": _drone_summary_payload(drones, pilots, metrics),
                "filters": _get_filter_options(pilots, launch_sites),
            }
        )
    return _drone_create(request)


@admin_required
def _drone_create(request):
    payload = parse_request_data(request)
    instance = Drone.objects.using(DB_ALIAS).create(
        drone_code=payload.get("drone_code", ""),
        drone_name=payload.get("drone_name", ""),
        model_name=payload.get("model_name", ""),
        serial_no=payload.get("serial_no", ""),
        max_payload=payload.get("max_payload", 0),
        battery_capacity=payload.get("battery_capacity", 0),
        status=payload.get("status", "idle"),
        launch_site_id=payload.get("launch_site_id", 0),
        pilot_id=payload.get("pilot_id", 0),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def drone_detail(request, pk):
    instance = get_object_or_none(_drone_queryset(request), id=pk)
    if not instance:
        return api_error(msg="drone_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _drone_update(request, instance)
    return _drone_delete(request, instance)


@admin_required
def _drone_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        [
            "drone_code",
            "drone_name",
            "model_name",
            "serial_no",
            "max_payload",
            "battery_capacity",
            "status",
            "launch_site_id",
            "pilot_id",
        ],
    )
    return _save_instance(instance)


@admin_required
def _drone_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def drone_history(request):
    filtered_queryset = _filter_fleet_drones(request)
    drones = list(filtered_queryset)
    rows, pilots, launch_sites, assignment_context, metrics = _serialize_drone_page(request, drones)
    start_date, end_date = resolve_time_window(request.GET.get("start_date"), request.GET.get("end_date"))
    grain = (request.GET.get("grain") or "day").strip().lower()
    if grain not in {"day", "week", "month"}:
        grain = "day"
    periods = iter_periods(start_date, end_date, grain)
    labels = [item["label"] for item in periods]
    counters = {item["key"]: {"completed": 0, "running": 0, "pending": 0} for item in periods}
    visible_drone_ids = {item.id for item in drones}

    for task in assignment_context["tasks"]:
        assignment = assignment_context["task_assignment_map"].get(task.id) or {}
        if not set(assignment.get("drone_ids") or []).intersection(visible_drone_ids):
            continue
        task_date = (getattr(task, "planned_start", None) or getattr(task, "created_at", None))
        if not task_date:
            continue
        task_key = period_key(task_date.date(), grain)
        if task_key not in counters:
            continue
        status_key = normalize_task_status(getattr(task, "status", "pending"))
        if status_key == "abnormal":
            status_key = "pending"
        counters[task_key][status_key] += 1

    selected_drone_id = request.GET.get("drone_id")
    selected_drone = None
    if selected_drone_id:
        selected_drone = next((item for item in drones if str(item.id) == str(selected_drone_id)), None)
    if selected_drone is None and drones:
        selected_drone = drones[0]

    selected_row = next((item for item in rows if selected_drone and item["id"] == selected_drone.id), None)
    drone_history_rows = []
    trajectories = []
    heat_points = []
    replay_dates = []

    if selected_drone:
        selected_tasks = [
            task
            for task in assignment_context["tasks_by_drone"].get(selected_drone.id, [])
            if start_date
            <= (getattr(task, "planned_start", None) or getattr(task, "created_at", None)).date()
            <= end_date
        ]
        per_period = {item["key"]: [] for item in periods}
        for task in selected_tasks:
            task_date = getattr(task, "planned_start", None) or getattr(task, "created_at", None)
            if task_date:
                task_key = period_key(task_date.date(), grain)
                if task_key in per_period:
                    per_period[task_key].append(task)

        previous_battery = selected_row["battery"] if selected_row else 75
        previous_status = None
        status_changes = []
        for index, period in enumerate(periods):
            task_group = per_period[period["key"]]
            completed_count = sum(
                1 for task in task_group if normalize_task_status(getattr(task, "status", "pending")) == "completed"
            )
            task_total = len(task_group)
            flight_hours = round(sum(estimate_task_hours(task) for task in task_group), 2)
            derived_status = (
                normalize_task_status(getattr(task_group[-1], "status", "pending")) if task_group else "pending"
            )
            battery = max(18, previous_battery - (3 if index else 0) - task_total * 2)
            battery_consumption = max(0, previous_battery - battery)
            completion_rate = round((completed_count / task_total) * 100, 2) if task_total else 0
            if previous_status and previous_status != derived_status:
                status_changes.append({"date": period["key"], "from": previous_status, "to": derived_status})
            drone_history_rows.append(
                {
                    "period": period["label"],
                    "date": period["key"],
                    "battery": battery,
                    "battery_consumption": battery_consumption,
                    "task_total": task_total,
                    "task_completed": completed_count,
                    "flight_duration": flight_hours,
                    "completion_rate": completion_rate,
                    "status": derived_status,
                }
            )
            previous_battery = battery
            previous_status = derived_status

        trajectories, heat_points, replay_dates = build_drone_track_segments(
            selected_drone,
            selected_tasks,
            assignment_context["task_assignment_map"],
            assignment_context["launch_site_map"],
        )
        if selected_row is not None:
            selected_row["status_changes"] = status_changes

    if request.GET.get("export") == "csv":
        return make_csv_response(
            "fleet_drone_history.csv",
            ["周期", "电量", "电量消耗", "任务总数", "完成数", "飞行时长(h)", "完成率(%)", "状态"],
            [
                [
                    item["period"],
                    item["battery"],
                    item["battery_consumption"],
                    item["task_total"],
                    item["task_completed"],
                    item["flight_duration"],
                    item["completion_rate"],
                    item["status"],
                ]
                for item in drone_history_rows
            ],
        )

    return api_response(
        data={
            "summary": _drone_summary_payload(drones, pilots, metrics),
            "chart": {
                "grain": grain,
                "labels": labels,
                "series": {
                    "completed": [counters[item["key"]]["completed"] for item in periods],
                    "running": [counters[item["key"]]["running"] for item in periods],
                    "pending": [counters[item["key"]]["pending"] for item in periods],
                },
            },
            "detail": {
                "selected_drone": selected_row,
                "history": drone_history_rows,
                "replay_dates": replay_dates,
                "trajectories": trajectories,
                "heat_points": heat_points,
            },
            "filters": _get_filter_options(pilots, launch_sites),
            "drones": [{"id": item["id"], "name": item["name"]} for item in rows],
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def drone_group_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_drone_group_queryset(request)))
    return _drone_group_create(request)


@admin_required
def _drone_group_create(request):
    payload = parse_request_data(request)
    instance = DroneGroup.objects.using(DB_ALIAS).create(
        group_code=payload.get("group_code", ""),
        group_name=payload.get("group_name", ""),
        scene_type=payload.get("scene_type", "mixed"),
        command_level=payload.get("command_level", "regional"),
        status=payload.get("status", "standby"),
        description=payload.get("description", ""),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def drone_group_detail(request, pk):
    instance = get_object_or_none(_drone_group_queryset(request), id=pk)
    if not instance:
        return api_error(msg="drone_group_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _drone_group_update(request, instance)
    return _drone_group_delete(request, instance)


@admin_required
def _drone_group_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["group_code", "group_name", "scene_type", "command_level", "status", "description"],
    )
    return _save_instance(instance)


@admin_required
def _drone_group_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def drone_group_member_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_drone_group_member_queryset(request)))
    return _drone_group_member_create(request)


@admin_required
def _drone_group_member_create(request):
    payload = parse_request_data(request)
    instance = DroneGroupMember.objects.using(DB_ALIAS).create(
        group_id=payload.get("group_id", 0),
        drone_id=payload.get("drone_id", 0),
        role_name=payload.get("role_name", "worker"),
        join_status=payload.get("join_status", "active"),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def drone_group_member_detail(request, pk):
    instance = get_object_or_none(_drone_group_member_queryset(request), id=pk)
    if not instance:
        return api_error(msg="drone_group_member_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _drone_group_member_update(request, instance)
    return _drone_group_member_delete(request, instance)


@admin_required
def _drone_group_member_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(instance, payload, ["group_id", "drone_id", "role_name", "join_status"])
    return _save_instance(instance)


@admin_required
def _drone_group_member_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})
