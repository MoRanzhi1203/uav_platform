from django.db import models


class TerrainType(models.Model):
    type_code = models.CharField(max_length=32, unique=True)
    type_name = models.CharField(max_length=64)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "terrain_type"
        verbose_name = "terrain_type"
        verbose_name_plural = "terrain_type"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.type_name}({self.type_code})"


class TerrainFeature(models.Model):
    terrain_id = models.BigIntegerField(default=0)
    slope = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # 坡度
    elevation = models.DecimalField(max_digits=8, decimal_places=2, default=0)  # 海拔
    soil_type = models.CharField(max_length=64, blank=True)  # 土壤类型
    vegetation_coverage = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # 植被覆盖率
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "terrain_feature"
        verbose_name = "terrain_feature"
        verbose_name_plural = "terrain_feature"
        ordering = ["-id"]

    def __str__(self):
        return f"feature-{self.terrain_id}"


class Terrain(models.Model):
    terrain_code = models.CharField(max_length=64, unique=True)
    terrain_name = models.CharField(max_length=128)
    terrain_type_id = models.BigIntegerField(default=0)
    region = models.CharField(max_length=128, blank=True)
    area_mu = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    longitude = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    latitude = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    farm_plot_id = models.BigIntegerField(default=0, blank=True, null=True)
    forest_area_id = models.BigIntegerField(default=0, blank=True, null=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "terrain"
        verbose_name = "terrain"
        verbose_name_plural = "terrain"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.terrain_name}({self.terrain_code})"
