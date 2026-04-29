from django.utils import timezone
from rest_framework import serializers

from tasking.models import GlobalTask, TaskDispatch


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


class TaskSerializer(AwareDateTimeMixin, serializers.ModelSerializer):
    name = serializers.CharField(source="task_name", read_only=True)
    type = serializers.CharField(source="scene_type", read_only=True)
    start_time = serializers.SerializerMethodField()
    end_time = serializers.SerializerMethodField()
    assigned_drone_id = serializers.SerializerMethodField()
    assigned_drone_name = serializers.SerializerMethodField()
    assigned_pilot_id = serializers.SerializerMethodField()
    assigned_pilot_name = serializers.SerializerMethodField()
    region_id = serializers.SerializerMethodField()
    region = serializers.SerializerMethodField()
    delayed = serializers.SerializerMethodField()
    planned_start = serializers.SerializerMethodField()
    planned_end = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()
    updated_at = serializers.SerializerMethodField()

    class Meta:
        model = GlobalTask
        fields = (
            "id",
            "name",
            "task_name",
            "task_code",
            "type",
            "scene_type",
            "status",
            "assigned_drone_id",
            "assigned_drone_name",
            "assigned_pilot_id",
            "assigned_pilot_name",
            "start_time",
            "end_time",
            "planned_start",
            "planned_end",
            "region_id",
            "region",
            "priority",
            "command_center",
            "description",
            "delayed",
            "created_at",
            "updated_at",
        )

    def get_assigned_drone_id(self, obj):
        assignment = (self.context.get("task_assignment_map") or {}).get(obj.id, {})
        return assignment.get("drone_id")

    def get_assigned_drone_name(self, obj):
        assignment = (self.context.get("task_assignment_map") or {}).get(obj.id, {})
        return assignment.get("drone_name", "")

    def get_assigned_pilot_id(self, obj):
        assignment = (self.context.get("task_assignment_map") or {}).get(obj.id, {})
        return assignment.get("pilot_id")

    def get_assigned_pilot_name(self, obj):
        assignment = (self.context.get("task_assignment_map") or {}).get(obj.id, {})
        return assignment.get("pilot_name", "")

    def get_region_id(self, obj):
        assignment = (self.context.get("task_assignment_map") or {}).get(obj.id, {})
        return assignment.get("region", "")

    def get_region(self, obj):
        assignment = (self.context.get("task_assignment_map") or {}).get(obj.id, {})
        return assignment.get("region", "")

    def get_delayed(self, obj):
        delayed_map = self.context.get("task_delayed_map") or {}
        return bool(delayed_map.get(obj.id, False))

    def get_start_time(self, obj):
        return self._serialize_datetime(obj.planned_start)

    def get_end_time(self, obj):
        return self._serialize_datetime(obj.planned_end)

    def get_planned_start(self, obj):
        return self._serialize_datetime(obj.planned_start)

    def get_planned_end(self, obj):
        return self._serialize_datetime(obj.planned_end)

    def get_created_at(self, obj):
        return self._serialize_datetime(obj.created_at)

    def get_updated_at(self, obj):
        return self._serialize_datetime(obj.updated_at)


class TaskAssignmentSerializer(AwareDateTimeMixin, serializers.ModelSerializer):
    task_id = serializers.IntegerField(source="global_task_id", read_only=True)
    drone_id = serializers.SerializerMethodField()
    drone_name = serializers.SerializerMethodField()
    pilot_id = serializers.SerializerMethodField()
    pilot_name = serializers.SerializerMethodField()
    status = serializers.CharField(source="dispatch_status", read_only=True)
    timestamp = serializers.SerializerMethodField()
    task_name = serializers.SerializerMethodField()
    region = serializers.SerializerMethodField()
    dispatched_at = serializers.SerializerMethodField()

    class Meta:
        model = TaskDispatch
        fields = (
            "id",
            "task_id",
            "task_name",
            "dispatch_code",
            "drone_id",
            "drone_name",
            "pilot_id",
            "pilot_name",
            "status",
            "dispatch_status",
            "timestamp",
            "dispatched_at",
            "target_db",
            "target_task_id",
            "drone_group_id",
            "region",
            "remark",
        )

    def get_drone_id(self, obj):
        assignment = (self.context.get("dispatch_assignment_map") or {}).get(obj.id, {})
        return assignment.get("drone_id")

    def get_drone_name(self, obj):
        assignment = (self.context.get("dispatch_assignment_map") or {}).get(obj.id, {})
        return assignment.get("drone_name", "")

    def get_pilot_id(self, obj):
        assignment = (self.context.get("dispatch_assignment_map") or {}).get(obj.id, {})
        return assignment.get("pilot_id")

    def get_pilot_name(self, obj):
        assignment = (self.context.get("dispatch_assignment_map") or {}).get(obj.id, {})
        return assignment.get("pilot_name", "")

    def get_task_name(self, obj):
        task_map = self.context.get("task_map") or {}
        task = task_map.get(obj.global_task_id)
        return task.task_name if task else ""

    def get_region(self, obj):
        assignment = (self.context.get("dispatch_assignment_map") or {}).get(obj.id, {})
        return assignment.get("region", "")

    def get_timestamp(self, obj):
        return self._serialize_datetime(obj.dispatched_at)

    def get_dispatched_at(self, obj):
        return self._serialize_datetime(obj.dispatched_at)
