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
    COMPLETED_TASK_STATUSES,
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
from tasking.models import GlobalTask, TaskDispatch
from tasking.serializers import TaskAssignmentSerializer, TaskSerializer

DB_ALIAS = "default"


def _global_task_queryset(request):
    queryset = GlobalTask.objects.using(DB_ALIAS).all()
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher"}:
        return queryset
    return queryset.filter(creator_id=request.user.id)


def _task_dispatch_queryset(request):
    queryset = TaskDispatch.objects.using(DB_ALIAS).all()
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher"}:
        return queryset
    return queryset.filter(dispatcher_id=request.user.id)


def _save_instance(instance):
    instance.save(using=DB_ALIAS)
    return api_response(data=serialize_instance(instance))


def _filter_tasks(request):
    queryset = _global_task_queryset(request)
    keyword = (request.GET.get("keyword") or request.GET.get("search") or "").strip()
    status_value = (request.GET.get("status") or "").strip()
    type_value = (request.GET.get("type") or request.GET.get("scene_type") or "").strip()
    start_date, end_date = resolve_time_window(request.GET.get("start_date"), request.GET.get("end_date"), default_days=90)

    if status_value:
        queryset = queryset.filter(status__iexact=status_value)
    if type_value:
        queryset = queryset.filter(scene_type__iexact=type_value)
    if keyword:
        queryset = queryset.filter(
            Q(task_name__icontains=keyword) | Q(task_code__icontains=keyword) | Q(description__icontains=keyword)
        )
    queryset = queryset.filter(
        Q(planned_start__date__range=(start_date, end_date))
        | Q(created_at__date__range=(start_date, end_date))
        | Q(planned_start__isnull=True, created_at__date__range=(start_date, end_date))
    )
    return queryset.order_by("-planned_start", "-created_at", "-id")


def _filter_dispatches(request):
    queryset = _task_dispatch_queryset(request)
    status_value = (request.GET.get("status") or "").strip()
    if status_value:
        queryset = queryset.filter(dispatch_status__iexact=status_value)
    return queryset.order_by("-dispatched_at", "-id")


def _task_summary_payload(task_rows):
    total = len(task_rows)
    running = sum(1 for item in task_rows if normalize_task_status(item["status"]) == "running")
    completed = sum(1 for item in task_rows if normalize_task_status(item["status"]) == "completed")
    abnormal = sum(1 for item in task_rows if item.get("delayed"))
    return {
        "task_total": total,
        "running_total": running,
        "completed_total": completed,
        "abnormal_total": abnormal,
    }


def _serialize_tasks(tasks, dispatches):
    assignment_context = build_assignment_context(DB_ALIAS, tasks=tasks, dispatches=dispatches)
    delayed_map = {}
    for task in tasks:
        if task.planned_end and normalize_task_status(task.status) != "completed":
            delayed_map[task.id] = True
    serializer = TaskSerializer(
        tasks,
        many=True,
        context={
            "task_assignment_map": assignment_context["task_assignment_map"],
            "task_delayed_map": delayed_map,
        },
    )
    return list(serializer.data), assignment_context


def _serialize_dispatches(dispatches, task_map):
    assignment_context = build_assignment_context(DB_ALIAS, dispatches=dispatches)
    serializer = TaskAssignmentSerializer(
        dispatches,
        many=True,
        context={
            "dispatch_assignment_map": assignment_context["dispatch_assignment_map"],
            "task_map": task_map,
        },
    )
    return list(serializer.data), assignment_context


def _export_task_csv(rows):
    return make_csv_response(
        "tasking_tasks.csv",
        ["ID", "任务名称", "类型", "状态", "无人机", "飞手", "区域", "开始时间", "结束时间", "延误"],
        [
            [
                item["id"],
                item["name"],
                item["type"],
                item["status"],
                item["assigned_drone_name"],
                item["assigned_pilot_name"],
                item["region"],
                item["start_time"],
                item["end_time"],
                "是" if item["delayed"] else "否",
            ]
            for item in rows
        ],
    )


def _export_assignment_csv(rows):
    return make_csv_response(
        "tasking_assignments.csv",
        ["ID", "任务", "无人机", "飞手", "状态", "时间", "区域", "目标库"],
        [
            [
                item["id"],
                item["task_name"],
                item["drone_name"],
                item["pilot_name"],
                item["status"],
                item["timestamp"],
                item["region"],
                item["target_db"],
            ]
            for item in rows
        ],
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overview(request):
    tasks = list(_global_task_queryset(request))
    dispatches = list(_task_dispatch_queryset(request))
    task_rows, _ = _serialize_tasks(tasks, dispatches)
    return api_response(
        data={
            "global_task_count": len(tasks),
            "dispatch_count": len(dispatches),
            **_task_summary_payload(task_rows),
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def global_task_list_create(request):
    if request.method == "GET":
        tasks = list(_filter_tasks(request))
        dispatches = list(_task_dispatch_queryset(request))
        task_rows, assignment_context = _serialize_tasks(tasks, dispatches)

        drone_id = request.GET.get("drone") or request.GET.get("drone_id")
        pilot_id = request.GET.get("pilot") or request.GET.get("pilot_id")
        region_value = (request.GET.get("region") or "").strip()
        if drone_id or pilot_id or region_value:
            filtered_rows = []
            for row in task_rows:
                if drone_id and str(row.get("assigned_drone_id") or "") != str(drone_id):
                    continue
                if pilot_id and str(row.get("assigned_pilot_id") or "") != str(pilot_id):
                    continue
                if region_value and (row.get("region") or "").lower() != region_value.lower():
                    continue
                filtered_rows.append(row)
            task_rows = filtered_rows

        if request.GET.get("export") == "csv":
            return _export_task_csv(task_rows)

        page = parse_positive_int(request.GET.get("page"), 1)
        page_size = parse_positive_int(request.GET.get("page_size"), 10, maximum=50)
        page_obj, pagination = paginate_items(task_rows, page, page_size)
        filters = {
            "types": sorted({item.scene_type for item in tasks if item.scene_type}),
            "statuses": sorted({item.status for item in tasks if item.status}),
            "regions": sorted(
                {
                    assignment.get("region", "")
                    for assignment in assignment_context["task_assignment_map"].values()
                    if assignment.get("region")
                }
            ),
            "drones": sorted(
                {
                    (assignment.get("drone_id"), assignment.get("drone_name"))
                    for assignment in assignment_context["task_assignment_map"].values()
                    if assignment.get("drone_id")
                }
            ),
            "pilots": sorted(
                {
                    (assignment.get("pilot_id"), assignment.get("pilot_name"))
                    for assignment in assignment_context["task_assignment_map"].values()
                    if assignment.get("pilot_id")
                }
            ),
        }
        return api_response(
            data={
                "items": list(page_obj.object_list),
                "pagination": pagination,
                "summary": _task_summary_payload(task_rows),
                "filters": {
                    "types": filters["types"],
                    "statuses": filters["statuses"],
                    "regions": filters["regions"],
                    "drones": [{"id": item[0], "name": item[1]} for item in filters["drones"]],
                    "pilots": [{"id": item[0], "name": item[1]} for item in filters["pilots"]],
                },
            }
        )
    return _global_task_create(request)


def _global_task_create(request):
    payload = parse_request_data(request)
    instance = GlobalTask.objects.using(DB_ALIAS).create(
        task_code=payload.get("task_code", ""),
        task_name=payload.get("task_name", ""),
        scene_type=payload.get("scene_type", "mixed"),
        priority=payload.get("priority", 3),
        status=payload.get("status", "pending"),
        command_center=payload.get("command_center", "Chongqing Command Center"),
        creator_id=request.user.id,
        description=payload.get("description", ""),
        planned_start=payload.get("planned_start"),
        planned_end=payload.get("planned_end"),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def global_task_detail(request, pk):
    instance = get_object_or_none(_global_task_queryset(request), id=pk)
    if not instance:
        return api_error(msg="global_task_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _global_task_update(request, instance)
    return _global_task_delete(request, instance)


def _can_modify_task(request, instance):
    return is_admin_user(request.user) or instance.creator_id == request.user.id or request.user.user_type == "dispatcher"


def _global_task_update(request, instance):
    if not _can_modify_task(request, instance):
        return api_error(msg="forbidden", code=403, status=403)
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["task_code", "task_name", "scene_type", "priority", "status", "command_center", "description", "planned_start", "planned_end"],
    )
    return _save_instance(instance)


def _global_task_delete(request, instance):
    if not _can_modify_task(request, instance):
        return api_error(msg="forbidden", code=403, status=403)
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def task_dispatch_list_create(request):
    if request.method == "GET":
        dispatches = list(_filter_dispatches(request))
        task_map = {item.id: item for item in _global_task_queryset(request)}
        dispatch_rows, _ = _serialize_dispatches(dispatches, task_map)
        drone_id = request.GET.get("drone") or request.GET.get("drone_id")
        pilot_id = request.GET.get("pilot") or request.GET.get("pilot_id")
        region_value = (request.GET.get("region") or "").strip()
        if drone_id or pilot_id or region_value:
            filtered_rows = []
            for row in dispatch_rows:
                if drone_id and str(row.get("drone_id") or "") != str(drone_id):
                    continue
                if pilot_id and str(row.get("pilot_id") or "") != str(pilot_id):
                    continue
                if region_value and (row.get("region") or "").lower() != region_value.lower():
                    continue
                filtered_rows.append(row)
            dispatch_rows = filtered_rows
        if request.GET.get("export") == "csv":
            return _export_assignment_csv(dispatch_rows)
        page = parse_positive_int(request.GET.get("page"), 1)
        page_size = parse_positive_int(request.GET.get("page_size"), 10, maximum=50)
        page_obj, pagination = paginate_items(dispatch_rows, page, page_size)
        return api_response(
            data={
                "items": list(page_obj.object_list),
                "pagination": pagination,
                "summary": {
                    "assignment_total": len(dispatch_rows),
                    "running_total": sum(
                        1 for item in dispatch_rows if normalize_task_status(item["status"]) == "running"
                    ),
                    "completed_total": sum(
                        1 for item in dispatch_rows if normalize_task_status(item["status"]) == "completed"
                    ),
                },
            }
        )
    return _task_dispatch_create(request)


@admin_required
def _task_dispatch_create(request):
    payload = parse_request_data(request)
    instance = TaskDispatch.objects.using(DB_ALIAS).create(
        global_task_id=payload.get("global_task_id", 0),
        dispatch_code=payload.get("dispatch_code", ""),
        target_db=payload.get("target_db", "forest"),
        target_task_id=payload.get("target_task_id", 0),
        drone_group_id=payload.get("drone_group_id", 0),
        dispatch_status=payload.get("dispatch_status", "created"),
        dispatcher_id=request.user.id,
        remark=payload.get("remark", ""),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def task_dispatch_detail(request, pk):
    instance = get_object_or_none(_task_dispatch_queryset(request), id=pk)
    if not instance:
        return api_error(msg="task_dispatch_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _task_dispatch_update(request, instance)
    return _task_dispatch_delete(request, instance)


@admin_required
def _task_dispatch_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["global_task_id", "dispatch_code", "target_db", "target_task_id", "drone_group_id", "dispatch_status", "remark"],
    )
    return _save_instance(instance)


@admin_required
def _task_dispatch_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def task_history(request):
    start_date, end_date = resolve_time_window(request.GET.get("start_date"), request.GET.get("end_date"), default_days=90)
    grain = (request.GET.get("grain") or "day").strip().lower()
    if grain not in {"day", "week", "month"}:
        grain = "day"
    tasks = list(_filter_tasks(request))
    dispatches = list(_filter_dispatches(request))
    task_rows, assignment_context = _serialize_tasks(tasks, dispatches)
    dispatch_rows, dispatch_context = _serialize_dispatches(dispatches, {item.id: item for item in tasks})

    drone_id = request.GET.get("drone") or request.GET.get("drone_id")
    pilot_id = request.GET.get("pilot") or request.GET.get("pilot_id")
    region_value = (request.GET.get("region") or "").strip()
    type_value = (request.GET.get("type") or "").strip()
    status_value = (request.GET.get("status") or "").strip()

    filtered_task_rows = []
    for row in task_rows:
        if type_value and row["type"] != type_value:
            continue
        if status_value and row["status"] != status_value:
            continue
        if drone_id and str(row.get("assigned_drone_id") or "") != str(drone_id):
            continue
        if pilot_id and str(row.get("assigned_pilot_id") or "") != str(pilot_id):
            continue
        if region_value and (row.get("region") or "").lower() != region_value.lower():
            continue
        filtered_task_rows.append(row)

    filtered_dispatch_rows = []
    for row in dispatch_rows:
        if status_value and row["status"] != status_value:
            continue
        if drone_id and str(row.get("drone_id") or "") != str(drone_id):
            continue
        if pilot_id and str(row.get("pilot_id") or "") != str(pilot_id):
            continue
        if region_value and (row.get("region") or "").lower() != region_value.lower():
            continue
        filtered_dispatch_rows.append(row)

    periods = iter_periods(start_date, end_date, grain)
    counters = {item["key"]: {"completed": 0, "running": 0, "pending": 0} for item in periods}
    selected_task_id = request.GET.get("task_id")
    selected_task_row = next((item for item in filtered_task_rows if str(item["id"]) == str(selected_task_id)), None)
    if selected_task_row is None and filtered_task_rows:
        selected_task_row = filtered_task_rows[0]

    for row in filtered_task_rows:
        source_time = row["start_time"] or row["created_at"]
        if not source_time:
            continue
        if hasattr(source_time, "date"):
            task_date = source_time.date()
        else:
            task_date = resolve_time_window(str(source_time)[:10], str(source_time)[:10], default_days=1)[0]
        task_key = period_key(task_date, grain)
        if task_key not in counters:
            continue
        status_key = normalize_task_status(row["status"])
        if status_key == "abnormal":
            status_key = "pending"
        counters[task_key][status_key] += 1

    delay_total = sum(1 for item in filtered_task_rows if item["delayed"])
    assignment_completion_rate = round(
        (sum(1 for item in filtered_dispatch_rows if normalize_task_status(item["status"]) == "completed") / len(filtered_dispatch_rows)) * 100,
        2,
    ) if filtered_dispatch_rows else 0

    task_detail = {"selected_task": selected_task_row, "assignments": [], "trajectories": [], "heat_points": [], "replay_dates": []}
    if selected_task_row:
        task_detail["assignments"] = [
            item for item in filtered_dispatch_rows if str(item["task_id"]) == str(selected_task_row["id"])
        ]
        assignment = assignment_context["task_assignment_map"].get(selected_task_row["id"]) or {}
        primary_drone_id = assignment.get("drone_id")
        primary_drone = assignment_context["drone_map"].get(primary_drone_id)
        if primary_drone:
            selected_tasks = assignment_context["tasks_by_drone"].get(primary_drone.id, [])
            trajectories, heat_points, replay_dates = build_drone_track_segments(
                primary_drone,
                selected_tasks,
                assignment_context["task_assignment_map"],
                assignment_context["launch_site_map"],
            )
            task_detail["trajectories"] = [
                item for item in trajectories if item.get("task_id") == selected_task_row["id"]
            ] or trajectories[:1]
            task_detail["heat_points"] = heat_points
            task_detail["replay_dates"] = replay_dates

    if request.GET.get("export") == "csv":
        return make_csv_response(
            "tasking_history.csv",
            ["周期", "已完成", "执行中", "待执行", "延误任务"],
            [
                [
                    item["label"],
                    counters[item["key"]]["completed"],
                    counters[item["key"]]["running"],
                    counters[item["key"]]["pending"],
                    delay_total,
                ]
                for item in periods
            ],
        )

    return api_response(
        data={
            "summary": {
                **_task_summary_payload(filtered_task_rows),
                "delay_total": delay_total,
                "assignment_completion_rate": assignment_completion_rate,
            },
            "chart": {
                "grain": grain,
                "labels": [item["label"] for item in periods],
                "series": {
                    "completed": [counters[item["key"]]["completed"] for item in periods],
                    "running": [counters[item["key"]]["running"] for item in periods],
                    "pending": [counters[item["key"]]["pending"] for item in periods],
                },
            },
            "filters": {
                "statuses": sorted({item["status"] for item in task_rows}),
                "types": sorted({item["type"] for item in task_rows}),
                "regions": sorted({item["region"] for item in task_rows if item["region"]}),
                "drones": sorted(
                    [{"id": item["assigned_drone_id"], "name": item["assigned_drone_name"]} for item in task_rows if item["assigned_drone_id"]],
                    key=lambda item: item["id"],
                ),
                "pilots": sorted(
                    [{"id": item["assigned_pilot_id"], "name": item["assigned_pilot_name"]} for item in task_rows if item["assigned_pilot_id"]],
                    key=lambda item: item["id"],
                ),
            },
            "detail": task_detail,
            "task_ids": [{"id": item["id"], "name": item["name"]} for item in filtered_task_rows],
            "assignment_summary": {
                "assignment_total": len(filtered_dispatch_rows),
                "by_drone": list(
                    sorted(
                        (
                            drone_name,
                            sum(1 for row in filtered_dispatch_rows if (row["drone_name"] or "未分配") == drone_name),
                        )
                        for drone_name in sorted({row["drone_name"] or "未分配" for row in filtered_dispatch_rows})
                    )
                ),
            },
        }
    )
