from django.db import models


class Pilot(models.Model):
    system_user_id = models.BigIntegerField(default=0)
    pilot_name = models.CharField(max_length=64)
    license_no = models.CharField(max_length=64, unique=True)
    phone = models.CharField(max_length=32, blank=True)
    skill_level = models.CharField(max_length=32, default="A")
    status = models.CharField(max_length=32, default="idle")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fleet_pilot"
        verbose_name = "pilot"
        verbose_name_plural = "pilot"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.pilot_name}({self.license_no})"


class LaunchSite(models.Model):
    site_name = models.CharField(max_length=128)
    region = models.CharField(max_length=128)
    longitude = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    latitude = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    altitude = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    status = models.CharField(max_length=32, default="ready")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "fleet_launch_site"
        verbose_name = "launch_site"
        verbose_name_plural = "launch_site"
        ordering = ["-id"]

    def __str__(self):
        return self.site_name


class Drone(models.Model):
    drone_code = models.CharField(max_length=64, unique=True)
    drone_name = models.CharField(max_length=128)
    model_name = models.CharField(max_length=128)
    serial_no = models.CharField(max_length=128, unique=True)
    max_payload = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    battery_capacity = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    status = models.CharField(max_length=32, default="idle")
    launch_site_id = models.BigIntegerField(default=0)
    pilot_id = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fleet_drone"
        verbose_name = "drone"
        verbose_name_plural = "drone"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.drone_name}({self.drone_code})"


class DroneGroup(models.Model):
    group_code = models.CharField(max_length=64, unique=True)
    group_name = models.CharField(max_length=128)
    scene_type = models.CharField(max_length=32, default="mixed")
    command_level = models.CharField(max_length=32, default="regional")
    status = models.CharField(max_length=32, default="standby")
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "fleet_drone_group"
        verbose_name = "drone_group"
        verbose_name_plural = "drone_group"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.group_name}({self.group_code})"


class DroneGroupMember(models.Model):
    group_id = models.BigIntegerField()
    drone_id = models.BigIntegerField()
    role_name = models.CharField(max_length=64, default="worker")
    join_status = models.CharField(max_length=32, default="active")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "fleet_drone_group_member"
        unique_together = ("group_id", "drone_id")
        verbose_name = "drone_group_member"
        verbose_name_plural = "drone_group_member"
        ordering = ["-id"]

    def __str__(self):
        return f"group={self.group_id},drone={self.drone_id}"
