from django.utils import timezone
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
from federation.models import FederationQueryRecord, FederationStatSnapshot
from federation.services import (
    build_cross_db_region_aggregation,
    build_cross_db_summary,
    build_cross_db_task_pairs,
)

DB_ALIAS = "default"


def _query_record_queryset(request):
    queryset = FederationQueryRecord.objects.using(DB_ALIAS).all()
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher"}:
        return queryset
    return queryset.filter(requester_id=request.user.id)


def _stat_snapshot_queryset(request):
    queryset = FederationStatSnapshot.objects.using(DB_ALIAS).all()
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher", "forest_officer", "agri_officer"}:
        return queryset
    return queryset.none()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overview(request):
    data = build_cross_db_summary()
    data["federation"] = {
        "query_records": _query_record_queryset(request).count(),
        "stat_snapshots": _stat_snapshot_queryset(request).count(),
    }
    return api_response(data=data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def query_record_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_query_record_queryset(request)))
    payload = parse_request_data(request)
    instance = FederationQueryRecord.objects.using(DB_ALIAS).create(
        query_code=payload.get("query_code", f"FQ{timezone.now().strftime('%Y%m%d%H%M%S')}"),
        query_name=payload.get("query_name", "cross_db_query"),
        requester_id=request.user.id,
        query_scope=payload.get("query_scope", "forest,agri"),
        source_dbs=payload.get("source_dbs", "default,forest,agri"),
        result_count=payload.get("result_count", 0),
        query_status=payload.get("query_status", "success"),
        remark=payload.get("remark", ""),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def query_record_detail(request, pk):
    instance = get_object_or_none(_query_record_queryset(request), id=pk)
    if not instance:
        return api_error(msg="federation_query_record_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _query_record_update(request, instance)
    return _query_record_delete(request, instance)


def _query_record_update(request, instance):
    if not (is_admin_user(request.user) or instance.requester_id == request.user.id):
        return api_error(msg="forbidden", code=403, status=403)
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["query_name", "query_scope", "source_dbs", "result_count", "query_status", "remark"],
    )
    instance.save(using=DB_ALIAS)
    return api_response(data=serialize_instance(instance))


def _query_record_delete(request, instance):
    if not (is_admin_user(request.user) or instance.requester_id == request.user.id):
        return api_error(msg="forbidden", code=403, status=403)
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def stat_snapshot_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_stat_snapshot_queryset(request)))
    return _stat_snapshot_create(request)


@admin_required
def _stat_snapshot_create(request):
    payload = parse_request_data(request)
    summary = build_cross_db_summary()
    instance = FederationStatSnapshot.objects.using(DB_ALIAS).create(
        snapshot_code=payload.get("snapshot_code", f"FS{timezone.now().strftime('%Y%m%d%H%M%S')}"),
        stat_date=payload.get("stat_date", timezone.now().date()),
        central_task_count=summary["central"]["global_tasks"],
        forest_event_count=summary["forest"]["fire_detections"],
        agri_event_count=summary["agri"]["pest_monitors"],
        total_dispatch_count=summary["central"]["dispatches"],
        snapshot_status=payload.get("snapshot_status", "generated"),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def stat_snapshot_detail(request, pk):
    instance = get_object_or_none(_stat_snapshot_queryset(request), id=pk)
    if not instance:
        return api_error(msg="federation_stat_snapshot_not_found", code=404, status=404)
    return api_response(data=serialize_instance(instance))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def cross_db_stats(request):
    return api_response(data=build_cross_db_task_pairs())


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def aggregate_summary(request):
    return api_response(
        data={
            "db_mapping": {
                "fleet": "central_db",
                "tasking": "central_db",
                "federation": "central_db",
                "telemetry": "central_db",
                "forest": "forest_db",
                "agri": "agri_db",
            },
            "summary": build_cross_db_summary(),
            "regions": build_cross_db_region_aggregation(),
        }
    )
