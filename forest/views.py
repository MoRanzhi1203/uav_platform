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
from forest.models import FireDetection, ForestArea, ForestPatrolTask

DB_ALIAS = "forest"


def _area_queryset(request):
    queryset = ForestArea.objects.using(DB_ALIAS).all()
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher"}:
        return queryset
    if getattr(request.user, "region", ""):
        return queryset.filter(region=request.user.region)
    return queryset.none()


def _patrol_queryset(request):
    queryset = ForestPatrolTask.objects.using(DB_ALIAS).all()
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher"}:
        return queryset
    area_ids = list(_area_queryset(request).values_list("id", flat=True))
    return queryset.filter(area_id__in=area_ids)


def _fire_queryset(request):
    queryset = FireDetection.objects.using(DB_ALIAS).all()
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher"}:
        return queryset
    area_ids = list(_area_queryset(request).values_list("id", flat=True))
    return queryset.filter(forest_area_id__in=area_ids)


def _save_instance(instance):
    instance.save(using=DB_ALIAS)
    return api_response(data=serialize_instance(instance))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overview(request):
    return api_response(
        data={
            "forest_area_count": _area_queryset(request).count(),
            "forest_patrol_task_count": _patrol_queryset(request).count(),
            "fire_detection_count": _fire_queryset(request).count(),
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def forest_area_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_area_queryset(request)))
    return _forest_area_create(request)


@admin_required
def _forest_area_create(request):
    payload = parse_request_data(request)
    instance = ForestArea.objects.using(DB_ALIAS).create(
        area_code=payload.get("area_code", ""),
        area_name=payload.get("area_name", ""),
        region=payload.get("region", ""),
        risk_level=payload.get("risk_level", "medium"),
        coverage_km2=payload.get("coverage_km2", 0),
        manager_name=payload.get("manager_name", ""),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def forest_area_detail(request, pk):
    instance = get_object_or_none(_area_queryset(request), id=pk)
    if not instance:
        return api_error(msg="forest_area_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _forest_area_update(request, instance)
    return _forest_area_delete(request, instance)


@admin_required
def _forest_area_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["area_code", "area_name", "region", "risk_level", "coverage_km2", "manager_name"],
    )
    return _save_instance(instance)


@admin_required
def _forest_area_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def forest_patrol_task_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_patrol_queryset(request)))
    return _forest_patrol_task_create(request)


@admin_required
def _forest_patrol_task_create(request):
    payload = parse_request_data(request)
    instance = ForestPatrolTask.objects.using(DB_ALIAS).create(
        task_code=payload.get("task_code", ""),
        global_task_id=payload.get("global_task_id", 0),
        area_id=payload.get("area_id", 0),
        drone_group_id=payload.get("drone_group_id", 0),
        patrol_type=payload.get("patrol_type", "routine"),
        status=payload.get("status", "pending"),
        planned_start=payload.get("planned_start"),
        planned_end=payload.get("planned_end"),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def forest_patrol_task_detail(request, pk):
    instance = get_object_or_none(_patrol_queryset(request), id=pk)
    if not instance:
        return api_error(msg="forest_patrol_task_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _forest_patrol_task_update(request, instance)
    return _forest_patrol_task_delete(request, instance)


@admin_required
def _forest_patrol_task_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["task_code", "global_task_id", "area_id", "drone_group_id", "patrol_type", "status", "planned_start", "planned_end"],
    )
    return _save_instance(instance)


@admin_required
def _forest_patrol_task_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def fire_detection_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_fire_queryset(request)))
    return _fire_detection_create(request)


@admin_required
def _fire_detection_create(request):
    payload = parse_request_data(request)
    instance = FireDetection.objects.using(DB_ALIAS).create(
        patrol_task_id=payload.get("patrol_task_id", 0),
        forest_area_id=payload.get("forest_area_id", 0),
        alert_level=payload.get("alert_level", "yellow"),
        fire_status=payload.get("fire_status", "suspected"),
        longitude=payload.get("longitude", 0),
        latitude=payload.get("latitude", 0),
        heat_score=payload.get("heat_score", 0),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def fire_detection_detail(request, pk):
    instance = get_object_or_none(_fire_queryset(request), id=pk)
    if not instance:
        return api_error(msg="fire_detection_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _fire_detection_update(request, instance)
    return _fire_detection_delete(request, instance)


@admin_required
def _fire_detection_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["patrol_task_id", "forest_area_id", "alert_level", "fire_status", "longitude", "latitude", "heat_score"],
    )
    return _save_instance(instance)


@admin_required
def _fire_detection_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})
