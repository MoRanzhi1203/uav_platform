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
from tasking.models import GlobalTask, TaskDispatch

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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overview(request):
    return api_response(
        data={
            "global_task_count": _global_task_queryset(request).count(),
            "dispatch_count": _task_dispatch_queryset(request).count(),
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def global_task_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_global_task_queryset(request)))
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
        return api_response(data=serialize_queryset(_task_dispatch_queryset(request)))
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
