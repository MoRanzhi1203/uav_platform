from django.db import models

class TerrainArea(models.Model):
    """区域模型 (Area)"""
    name = models.CharField(max_length=100, verbose_name='区域名称')
    type = models.CharField(max_length=50, verbose_name='区域类型', choices=[
        ('mountain', '山地'),
        ('hill', '丘陵'),
        ('valley', '山谷'),
        ('plateau', '高原'),
        ('plain', '平原'),
        ('forest', '林区'),
        ('farm', '农田')
    ])
    risk_level = models.CharField(max_length=20, verbose_name='风险等级', choices=[
        ('low', '低'),
        ('medium', '中'),
        ('high', '高')
    ])
    area = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='面积（公顷）', default=0)
    description = models.TextField(blank=True, verbose_name='描述')
    center_lng = models.FloatField(null=True, blank=True, verbose_name="中心点经度")
    center_lat = models.FloatField(null=True, blank=True, verbose_name="中心点纬度")
    boundary_json = models.JSONField(verbose_name='边界数据', default=dict)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '区域'
        verbose_name_plural = '区域'
    
    def __str__(self):
        return self.name

class TerrainSubCategory(models.Model):
    """子类别管理 (SubCategory)"""
    category = models.CharField(max_length=50, verbose_name="大类")
    name = models.CharField(max_length=100, verbose_name="子类别名称")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '子类别'
        verbose_name_plural = '子类别'
        unique_together = ('category', 'name')

    def __str__(self):
        return f"{self.category} - {self.name}"

class TerrainZone(models.Model):
    """地块模型 (Zone)"""
    area_obj = models.ForeignKey(TerrainArea, on_delete=models.CASCADE, related_name='zones', verbose_name="所属区域", null=True)
    name = models.CharField(max_length=255, verbose_name="地块名称")
    category = models.CharField(max_length=50, verbose_name="地块分类", choices=[
        ('forest', '林区'),
        ('farmland', '农田'),
        ('water', '水域'),
        ('road', '道路'),
        ('building', '建筑')
    ])
    type = models.CharField(max_length=50, verbose_name="地块类型", null=True, blank=True)
    risk_level = models.CharField(max_length=20, verbose_name="风险等级", choices=[
        ('low', '低'),
        ('medium', '中'),
        ('high', '高')
    ])
    area = models.FloatField(default=0.0, verbose_name="面积")
    description = models.TextField(null=True, blank=True, verbose_name="描述")
    
    # JSON 字段
    geom_json = models.JSONField(default=dict, verbose_name="GeoJSON 轮廓")
    grid_json = models.JSONField(default=dict, verbose_name="网格绘制数据")
    style_json = models.JSONField(default=dict, verbose_name="样式信息")
    meta_json = models.JSONField(default=dict, verbose_name="扩展信息")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    is_deleted = models.BooleanField(default=False, verbose_name="是否删除")

    class Meta:
        db_table = 'terrain_zone'
        verbose_name = '地块'
        verbose_name_plural = '地块'

    def __str__(self):
        return self.name

class TerrainElement(models.Model):
    """要素模型 (Element)"""
    zone = models.ForeignKey(TerrainZone, on_delete=models.CASCADE, related_name='elements', verbose_name="所属地块")
    name = models.CharField(max_length=255, verbose_name="要素名称")
    type = models.CharField(max_length=50, verbose_name="要素类型")
    area = models.FloatField(default=0.0, verbose_name="面积")
    
    geom_json = models.JSONField(default=dict, verbose_name="GeoJSON 轮廓")
    meta_json = models.JSONField(default=dict, verbose_name="扩展信息")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        db_table = 'terrain_element'
        verbose_name = '要素'
        verbose_name_plural = '要素'

    def __str__(self):
        return self.name
