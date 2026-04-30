from django.db import models


class GlobalTask(models.Model):
    TASK_SCENE_CHOICES = (
        ("forest", "forest"),
        ("agri", "agri"),
        ("mixed", "mixed"),
    )

    task_code = models.CharField(max_length=64, unique=True)
    task_name = models.CharField(max_length=128)
    scene_type = models.CharField(max_length=32, choices=TASK_SCENE_CHOICES, default="mixed")
    priority = models.IntegerField(default=3)
    status = models.CharField(max_length=32, default="pending")
    command_center = models.CharField(max_length=128, default="Chongqing Command Center")
    creator_id = models.BigIntegerField(default=0)
    description = models.CharField(max_length=255, blank=True)
    planned_start = models.DateTimeField(null=True, blank=True)
    planned_end = models.DateTimeField(null=True, blank=True)
    terrain_area_id = models.BigIntegerField(null=True, blank=True, default=None)
    primary_drone_id = models.BigIntegerField(null=True, blank=True, default=None)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tasking_global_task"
        verbose_name = "global_task"
        verbose_name_plural = "global_task"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.task_name}({self.task_code})"


class TaskDispatch(models.Model):
    DISPATCH_TARGET_CHOICES = (
        ("forest", "forest"),
        ("agri", "agri"),
    )

    global_task_id = models.BigIntegerField(default=0)
    dispatch_code = models.CharField(max_length=64, unique=True)
    target_db = models.CharField(max_length=32, choices=DISPATCH_TARGET_CHOICES)
    target_task_id = models.BigIntegerField(default=0)
    drone_group_id = models.BigIntegerField(default=0)
    dispatch_status = models.CharField(max_length=32, default="created")
    dispatcher_id = models.BigIntegerField(default=0)
    dispatched_at = models.DateTimeField(auto_now_add=True)
    remark = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "tasking_task_dispatch"
        verbose_name = "task_dispatch"
        verbose_name_plural = "task_dispatch"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.dispatch_code}->{self.target_db}"
