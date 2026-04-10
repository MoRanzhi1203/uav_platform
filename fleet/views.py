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
from fleet.models import Drone, DroneGroup, DroneGroupMember, LaunchSite, Pilot

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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overview(request):
    data = {
        "pilot_count": _pilot_queryset(request).count(),
        "launch_site_count": _launch_site_queryset(request).count(),
        "drone_count": _drone_queryset(request).count(),
        "drone_group_count": _drone_group_queryset(request).count(),
        "member_count": _drone_group_member_queryset(request).count(),
    }
    return api_response(data=data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def pilot_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_pilot_queryset(request)))

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
        return api_response(data=serialize_queryset(_drone_queryset(request)))
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
