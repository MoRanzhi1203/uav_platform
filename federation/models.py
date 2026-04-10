from django.db import models


class FederationQueryRecord(models.Model):
    query_code = models.CharField(max_length=64, unique=True)
    query_name = models.CharField(max_length=128)
    requester_id = models.BigIntegerField(default=0)
    query_scope = models.CharField(max_length=64, default="forest,agri")
    source_dbs = models.CharField(max_length=64, default="default,forest,agri")
    result_count = models.IntegerField(default=0)
    query_status = models.CharField(max_length=32, default="success")
    remark = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "federation_query_record"
        verbose_name = "federation_query_record"
        verbose_name_plural = "federation_query_record"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.query_name}({self.query_code})"


class FederationStatSnapshot(models.Model):
    snapshot_code = models.CharField(max_length=64, unique=True)
    stat_date = models.DateField()
    central_task_count = models.IntegerField(default=0)
    forest_event_count = models.IntegerField(default=0)
    agri_event_count = models.IntegerField(default=0)
    total_dispatch_count = models.IntegerField(default=0)
    snapshot_status = models.CharField(max_length=32, default="generated")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "federation_stat_snapshot"
        verbose_name = "federation_stat_snapshot"
        verbose_name_plural = "federation_stat_snapshot"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.snapshot_code}:{self.stat_date}"
