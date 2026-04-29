from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from agri.models import AgriTask, FarmPlot, PestMonitor
from common.decorators import admin_required, is_admin_user
from common.request_utils import (
    get_object_or_none,
    parse_request_data,
    serialize_instance,
    serialize_queryset,
    update_instance_from_payload,
)
from common.responses import api_error, api_response

DB_ALIAS = "agri"


def _farm_plot_queryset(request):
    queryset = FarmPlot.objects.using(DB_ALIAS).all()
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher"}:
        return queryset
    if getattr(request.user, "region", ""):
        queryset = queryset.filter(region=request.user.region)
    if getattr(request.user, "real_name", ""):
        return queryset.filter(owner_name__in=["", request.user.real_name])
    return queryset.none()


def _agri_task_queryset(request):
    queryset = AgriTask.objects.using(DB_ALIAS).all()
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher"}:
        return queryset
    plot_ids = list(_farm_plot_queryset(request).values_list("id", flat=True))
    return queryset.filter(farm_plot_id__in=plot_ids)


def _pest_monitor_queryset(request):
    queryset = PestMonitor.objects.using(DB_ALIAS).all()
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher"}:
        return queryset
    plot_ids = list(_farm_plot_queryset(request).values_list("id", flat=True))
    return queryset.filter(farm_plot_id__in=plot_ids)


def _save_instance(instance):
    instance.save(using=DB_ALIAS)
    return api_response(data=serialize_instance(instance))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overview(request):
    return api_response(
        data={
            "farm_plot_count": _farm_plot_queryset(request).count(),
            "agri_task_count": _agri_task_queryset(request).count(),
            "pest_monitor_count": _pest_monitor_queryset(request).count(),
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def farm_plot_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_farm_plot_queryset(request)))
    return _farm_plot_create(request)


@admin_required
def _farm_plot_create(request):
    payload = parse_request_data(request)
    instance = FarmPlot.objects.using(DB_ALIAS).create(
        plot_code=payload.get("plot_code", ""),
        plot_name=payload.get("plot_name", ""),
        region=payload.get("region", ""),
        owner_name=payload.get("owner_name", ""),
        crop_type=payload.get("crop_type", "rice"),
        area_mu=payload.get("area_mu", 0),
        longitude=payload.get("longitude", 0),
        latitude=payload.get("latitude", 0),
        risk_level=payload.get("risk_level", "medium"),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def farm_plot_detail(request, pk):
    instance = get_object_or_none(_farm_plot_queryset(request), id=pk)
    if not instance:
        return api_error(msg="farm_plot_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _farm_plot_update(request, instance)
    return _farm_plot_delete(request, instance)


@admin_required
def _farm_plot_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["plot_code", "plot_name", "region", "owner_name", "crop_type", "area_mu", "longitude", "latitude", "risk_level"],
    )
    return _save_instance(instance)


@admin_required
def _farm_plot_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def agri_task_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_agri_task_queryset(request)))
    return _agri_task_create(request)


@admin_required
def _agri_task_create(request):
    payload = parse_request_data(request)
    instance = AgriTask.objects.using(DB_ALIAS).create(
        task_code=payload.get("task_code", ""),
        global_task_id=payload.get("global_task_id", 0),
        farm_plot_id=payload.get("farm_plot_id", 0),
        drone_group_id=payload.get("drone_group_id", 0),
        task_type=payload.get("task_type", "spray"),
        pesticide_name=payload.get("pesticide_name", ""),
        status=payload.get("status", "pending"),
        planned_start=payload.get("planned_start"),
        planned_end=payload.get("planned_end"),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def agri_task_detail(request, pk):
    instance = get_object_or_none(_agri_task_queryset(request), id=pk)
    if not instance:
        return api_error(msg="agri_task_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _agri_task_update(request, instance)
    return _agri_task_delete(request, instance)


@admin_required
def _agri_task_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["task_code", "global_task_id", "farm_plot_id", "drone_group_id", "task_type", "pesticide_name", "status", "planned_start", "planned_end"],
    )
    return _save_instance(instance)


@admin_required
def _agri_task_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def pest_monitor_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_pest_monitor_queryset(request)))
    return _pest_monitor_create(request)


@admin_required
def _pest_monitor_create(request):
    payload = parse_request_data(request)
    instance = PestMonitor.objects.using(DB_ALIAS).create(
        agri_task_id=payload.get("agri_task_id", 0),
        farm_plot_id=payload.get("farm_plot_id", 0),
        pest_type=payload.get("pest_type", "unknown"),
        severity=payload.get("severity", "medium"),
        coverage_ratio=payload.get("coverage_ratio", 0),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def pest_monitor_detail(request, pk):
    instance = get_object_or_none(_pest_monitor_queryset(request), id=pk)
    if not instance:
        return api_error(msg="pest_monitor_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _pest_monitor_update(request, instance)
    return _pest_monitor_delete(request, instance)


@admin_required
def _pest_monitor_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["agri_task_id", "farm_plot_id", "pest_type", "severity", "coverage_ratio"],
    )
    return _save_instance(instance)


@admin_required
def _pest_monitor_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


def agri_index(request):
    """农田管理首页"""
    return render(request, "agri/index.html")
