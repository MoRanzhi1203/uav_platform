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
from fleet.models import Drone, Pilot
from telemetry.models import DroneHeartbeat, FlightTrajectory, TelemetrySnapshot

DB_ALIAS = "default"


def _allowed_drone_ids(request):
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher"}:
        return list(Drone.objects.using(DB_ALIAS).values_list("id", flat=True))
    pilot_ids = list(Pilot.objects.using(DB_ALIAS).filter(system_user_id=request.user.id).values_list("id", flat=True))
    if pilot_ids:
        return list(Drone.objects.using(DB_ALIAS).filter(pilot_id__in=pilot_ids).values_list("id", flat=True))
    return []


def _snapshot_queryset(request):
    queryset = TelemetrySnapshot.objects.using(DB_ALIAS).all()
    allowed = _allowed_drone_ids(request)
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher"}:
        return queryset
    return queryset.filter(drone_id__in=allowed)


def _trajectory_queryset(request):
    queryset = FlightTrajectory.objects.using(DB_ALIAS).all()
    allowed = _allowed_drone_ids(request)
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher"}:
        return queryset
    return queryset.filter(drone_id__in=allowed)


def _heartbeat_queryset(request):
    queryset = DroneHeartbeat.objects.using(DB_ALIAS).all()
    allowed = _allowed_drone_ids(request)
    if is_admin_user(request.user) or getattr(request.user, "user_type", "") in {"dispatcher"}:
        return queryset
    return queryset.filter(drone_id__in=allowed)


def _save_instance(instance):
    instance.save(using=DB_ALIAS)
    return api_response(data=serialize_instance(instance))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overview(request):
    data = {
        "telemetry_snapshot_count": _snapshot_queryset(request).count(),
        "trajectory_count": _trajectory_queryset(request).count(),
        "heartbeat_count": _heartbeat_queryset(request).count(),
    }
    return api_response(data=data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def snapshot_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_snapshot_queryset(request)))
    return _snapshot_create(request)


@admin_required
def _snapshot_create(request):
    payload = parse_request_data(request)
    instance = TelemetrySnapshot.objects.using(DB_ALIAS).create(
        drone_id=payload.get("drone_id", 0),
        drone_code=payload.get("drone_code", ""),
        battery_level=payload.get("battery_level", 100),
        altitude=payload.get("altitude", 0),
        speed=payload.get("speed", 0),
        longitude=payload.get("longitude", 0),
        latitude=payload.get("latitude", 0),
        flight_status=payload.get("flight_status", "idle"),
        signal_strength=payload.get("signal_strength", 100),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def snapshot_detail(request, pk):
    instance = get_object_or_none(_snapshot_queryset(request), id=pk)
    if not instance:
        return api_error(msg="telemetry_snapshot_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _snapshot_update(request, instance)
    return _snapshot_delete(request, instance)


@admin_required
def _snapshot_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["drone_id", "drone_code", "battery_level", "altitude", "speed", "longitude", "latitude", "flight_status", "signal_strength"],
    )
    return _save_instance(instance)


@admin_required
def _snapshot_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def trajectory_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_trajectory_queryset(request)))
    return _trajectory_create(request)


@admin_required
def _trajectory_create(request):
    payload = parse_request_data(request)
    instance = FlightTrajectory.objects.using(DB_ALIAS).create(
        drone_id=payload.get("drone_id", 0),
        global_task_id=payload.get("global_task_id", 0),
        seq_no=payload.get("seq_no", 1),
        longitude=payload.get("longitude", 0),
        latitude=payload.get("latitude", 0),
        altitude=payload.get("altitude", 0),
        speed=payload.get("speed", 0),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def trajectory_detail(request, pk):
    instance = get_object_or_none(_trajectory_queryset(request), id=pk)
    if not instance:
        return api_error(msg="flight_trajectory_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _trajectory_update(request, instance)
    return _trajectory_delete(request, instance)


@admin_required
def _trajectory_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["drone_id", "global_task_id", "seq_no", "longitude", "latitude", "altitude", "speed"],
    )
    return _save_instance(instance)


@admin_required
def _trajectory_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def heartbeat_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_heartbeat_queryset(request)))
    return _heartbeat_create(request)


@admin_required
def _heartbeat_create(request):
    payload = parse_request_data(request)
    instance = DroneHeartbeat.objects.using(DB_ALIAS).create(
        drone_id=payload.get("drone_id", 0),
        drone_code=payload.get("drone_code", ""),
        heartbeat_status=payload.get("heartbeat_status", "online"),
        cpu_usage=payload.get("cpu_usage", 0),
        memory_usage=payload.get("memory_usage", 0),
        network_delay_ms=payload.get("network_delay_ms", 0),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def heartbeat_detail(request, pk):
    instance = get_object_or_none(_heartbeat_queryset(request), id=pk)
    if not instance:
        return api_error(msg="drone_heartbeat_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _heartbeat_update(request, instance)
    return _heartbeat_delete(request, instance)


@admin_required
def _heartbeat_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["drone_id", "drone_code", "heartbeat_status", "cpu_usage", "memory_usage", "network_delay_ms"],
    )
    return _save_instance(instance)


@admin_required
def _heartbeat_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def drone_realtime_status(request, drone_id):
    latest_snapshot = _snapshot_queryset(request).filter(drone_id=drone_id).first()
    latest_heartbeat = _heartbeat_queryset(request).filter(drone_id=drone_id).first()
    if not latest_snapshot and not latest_heartbeat:
        return api_error(msg="drone_status_not_found", code=404, status=404)
    return api_response(
        data={
            "snapshot": serialize_instance(latest_snapshot) if latest_snapshot else None,
            "heartbeat": serialize_instance(latest_heartbeat) if latest_heartbeat else None,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def drone_track_query(request, drone_id):
    rows = _trajectory_queryset(request).filter(drone_id=drone_id)[:200]
    return api_response(data=serialize_queryset(rows))
