from django.utils import timezone
from rest_framework import serializers

from fleet.models import Drone, LaunchSite, Pilot


ONLINE_STATUSES = {"online", "running", "busy", "active", "ready"}


def normalize_datetime(value):
    if not value:
        return value
    current_timezone = timezone.get_current_timezone()
    if timezone.is_naive(value):
        value = timezone.make_aware(value, current_timezone)
    return timezone.localtime(value, current_timezone)


class AwareDateTimeMixin:
    @staticmethod
    def _serialize_datetime(value):
        value = normalize_datetime(value)
        return value.isoformat() if value else None


class PilotSerializer(AwareDateTimeMixin, serializers.ModelSerializer):
    name = serializers.CharField(source="pilot_name", read_only=True)
    qualification = serializers.CharField(source="skill_level", read_only=True)
    assigned_drone_ids = serializers.SerializerMethodField()
    assigned_drone_names = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()
    updated_at = serializers.SerializerMethodField()

    class Meta:
        model = Pilot
        fields = (
            "id",
            "name",
            "pilot_name",
            "qualification",
            "skill_level",
            "license_no",
            "phone",
            "status",
            "assigned_drone_ids",
            "assigned_drone_names",
            "created_at",
            "updated_at",
        )

    def get_assigned_drone_ids(self, obj):
        drone_ids_map = self.context.get("pilot_drone_ids") or {}
        if obj.id in drone_ids_map:
            return drone_ids_map[obj.id]
        return list(Drone.objects.filter(pilot_id=obj.id).values_list("id", flat=True))

    def get_assigned_drone_names(self, obj):
        drone_name_map = self.context.get("pilot_drone_names") or {}
        if obj.id in drone_name_map:
            return drone_name_map[obj.id]
        return list(Drone.objects.filter(pilot_id=obj.id).values_list("drone_name", flat=True))

    def get_created_at(self, obj):
        return self._serialize_datetime(obj.created_at)

    def get_updated_at(self, obj):
        return self._serialize_datetime(obj.updated_at)


class DroneSerializer(AwareDateTimeMixin, serializers.ModelSerializer):
    name = serializers.CharField(source="drone_name", read_only=True)
    model = serializers.CharField(source="model_name", read_only=True)
    battery = serializers.SerializerMethodField()
    last_active = serializers.SerializerMethodField()
    region_id = serializers.SerializerMethodField()
    region = serializers.SerializerMethodField()
    pilot_name = serializers.SerializerMethodField()
    launch_site_name = serializers.SerializerMethodField()
    task_count = serializers.SerializerMethodField()
    flight_duration = serializers.SerializerMethodField()
    completion_rate = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()
    updated_at = serializers.SerializerMethodField()

    class Meta:
        model = Drone
        fields = (
            "id",
            "name",
            "drone_name",
            "drone_code",
            "model",
            "model_name",
            "serial_no",
            "battery",
            "battery_capacity",
            "status",
            "last_active",
            "region_id",
            "region",
            "launch_site_id",
            "launch_site_name",
            "pilot_id",
            "pilot_name",
            "task_count",
            "flight_duration",
            "completion_rate",
            "max_payload",
            "created_at",
            "updated_at",
        )

    def get_battery(self, obj):
        battery_map = self.context.get("drone_battery_map") or {}
        if obj.id in battery_map:
            return battery_map[obj.id]

        now = normalize_datetime(self.context.get("now")) or normalize_datetime(timezone.now())
        updated_at = normalize_datetime(obj.updated_at)
        age_hours = max(0, int((now - updated_at).total_seconds() // 3600)) if updated_at else 0
        status = (obj.status or "").lower()
        base = 90 if status in ONLINE_STATUSES else 72
        return max(15, min(100, base - ((obj.id * 11 + age_hours * 3) % 48)))

    def get_last_active(self, obj):
        return self._serialize_datetime(obj.updated_at)

    def get_region_id(self, obj):
        site = self._get_launch_site(obj)
        return site.region if site else ""

    def get_region(self, obj):
        site = self._get_launch_site(obj)
        return site.region if site else ""

    def get_pilot_name(self, obj):
        pilot_map = self.context.get("pilot_map") or {}
        pilot = pilot_map.get(obj.pilot_id)
        return pilot.pilot_name if pilot else ""

    def get_launch_site_name(self, obj):
        site = self._get_launch_site(obj)
        return site.site_name if site else ""

    def get_task_count(self, obj):
        return (self.context.get("drone_task_count_map") or {}).get(obj.id, 0)

    def get_flight_duration(self, obj):
        return round((self.context.get("drone_flight_duration_map") or {}).get(obj.id, 0), 2)

    def get_completion_rate(self, obj):
        return round((self.context.get("drone_completion_rate_map") or {}).get(obj.id, 0), 2)

    def get_created_at(self, obj):
        return self._serialize_datetime(obj.created_at)

    def get_updated_at(self, obj):
        return self._serialize_datetime(obj.updated_at)

    def _get_launch_site(self, obj):
        launch_site_map = self.context.get("launch_site_map") or {}
        return launch_site_map.get(obj.launch_site_id)
