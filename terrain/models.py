from django.db import models

class Terrain(models.Model):
    """地形模型"""
    name = models.CharField(max_length=100, verbose_name='地形名称')
    type = models.CharField(max_length=50, verbose_name='地形类型', choices=[
        ('mountain', '山地'),
        ('hill', '丘陵'),
        ('valley', '山谷'),
        ('plateau', '高原'),
        ('plain', '平原'),
        ('forest', '林区'),
        ('farm', '农田'),
        ('mixed', '混合')
    ])
    risk_level = models.CharField(max_length=20, verbose_name='风险等级', choices=[
        ('low', '低'),
        ('medium', '中'),
        ('high', '高')
    ])
    area = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='面积（公顷）', default=0)
    description = models.TextField(blank=True, verbose_name='描述')
    coordinates = models.JSONField(verbose_name='坐标数据', default=list)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '地形'
        verbose_name_plural = '地形'
    
    def __str__(self):
        return self.name
