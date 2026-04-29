from django.db import models


class FarmPlot(models.Model):
    plot_code = models.CharField(max_length=64, unique=True)
    plot_name = models.CharField(max_length=128)
    region = models.CharField(max_length=128, blank=True)
    owner_name = models.CharField(max_length=64, blank=True)
    crop_type = models.CharField(max_length=64, default="rice")
    area_mu = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    longitude = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    latitude = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    terrain_id = models.BigIntegerField(default=0, blank=True, null=True)
    risk_level = models.CharField(max_length=32, default="medium")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "agri_farm_plot"
        verbose_name = "farm_plot"
        verbose_name_plural = "farm_plot"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.plot_name}({self.plot_code})"


class AgriTask(models.Model):
    task_code = models.CharField(max_length=64, unique=True)
    global_task_id = models.BigIntegerField(default=0)
    farm_plot_id = models.BigIntegerField(default=0)
    drone_group_id = models.BigIntegerField(default=0)
    task_type = models.CharField(max_length=32, default="spray")
    pesticide_name = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=32, default="pending")
    planned_start = models.DateTimeField(null=True, blank=True)
    planned_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "agri_task"
        verbose_name = "agri_task"
        verbose_name_plural = "agri_task"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.task_code}:{self.status}"


class PestMonitor(models.Model):
    agri_task_id = models.BigIntegerField(default=0)
    farm_plot_id = models.BigIntegerField(default=0)
    pest_type = models.CharField(max_length=64, default="unknown")
    severity = models.CharField(max_length=32, default="medium")
    coverage_ratio = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    detected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "agri_pest_monitor"
        verbose_name = "pest_monitor"
        verbose_name_plural = "pest_monitor"
        ordering = ["-id"]

    def __str__(self):
        return f"pest-{self.id}-{self.pest_type}"
