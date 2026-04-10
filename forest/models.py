from django.db import models


class ForestArea(models.Model):
    area_code = models.CharField(max_length=64, unique=True)
    area_name = models.CharField(max_length=128)
    region = models.CharField(max_length=128)
    risk_level = models.CharField(max_length=32, default="medium")
    coverage_km2 = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    manager_name = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "forest_area"
        verbose_name = "forest_area"
        verbose_name_plural = "forest_area"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.area_name}({self.area_code})"


class ForestPatrolTask(models.Model):
    task_code = models.CharField(max_length=64, unique=True)
    global_task_id = models.BigIntegerField(default=0)
    area_id = models.BigIntegerField(default=0)
    drone_group_id = models.BigIntegerField(default=0)
    patrol_type = models.CharField(max_length=32, default="routine")
    status = models.CharField(max_length=32, default="pending")
    planned_start = models.DateTimeField(null=True, blank=True)
    planned_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "forest_patrol_task"
        verbose_name = "forest_patrol_task"
        verbose_name_plural = "forest_patrol_task"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.task_code}:{self.status}"


class FireDetection(models.Model):
    patrol_task_id = models.BigIntegerField(default=0)
    forest_area_id = models.BigIntegerField(default=0)
    alert_level = models.CharField(max_length=32, default="yellow")
    fire_status = models.CharField(max_length=32, default="suspected")
    longitude = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    latitude = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    heat_score = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    detected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "forest_fire_detection"
        verbose_name = "fire_detection"
        verbose_name_plural = "fire_detection"
        ordering = ["-id"]

    def __str__(self):
        return f"fire-{self.id}-{self.fire_status}"
