from django.db import models


class TelemetrySnapshot(models.Model):
    drone_id = models.BigIntegerField(default=0)
    drone_code = models.CharField(max_length=64)
    battery_level = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    altitude = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    speed = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    longitude = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    latitude = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    flight_status = models.CharField(max_length=32, default="idle")
    signal_strength = models.IntegerField(default=100)
    reported_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "telemetry_snapshot"
        verbose_name = "telemetry_snapshot"
        verbose_name_plural = "telemetry_snapshot"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.drone_code}:{self.flight_status}"


class FlightTrajectory(models.Model):
    drone_id = models.BigIntegerField(default=0)
    global_task_id = models.BigIntegerField(default=0)
    seq_no = models.IntegerField(default=1)
    longitude = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    latitude = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    altitude = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    speed = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    sampled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "telemetry_flight_trajectory"
        verbose_name = "flight_trajectory"
        verbose_name_plural = "flight_trajectory"
        ordering = ["drone_id", "seq_no"]

    def __str__(self):
        return f"drone={self.drone_id},seq={self.seq_no}"


class DroneHeartbeat(models.Model):
    drone_id = models.BigIntegerField(default=0)
    drone_code = models.CharField(max_length=64)
    heartbeat_status = models.CharField(max_length=32, default="online")
    cpu_usage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    memory_usage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    network_delay_ms = models.IntegerField(default=0)
    heartbeat_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "telemetry_drone_heartbeat"
        verbose_name = "drone_heartbeat"
        verbose_name_plural = "drone_heartbeat"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.drone_code}:{self.heartbeat_status}"
