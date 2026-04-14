from rest_framework import serializers
from .models import TerrainArea, TerrainZone, TerrainElement, TerrainSubCategory

class TerrainAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = TerrainArea
        fields = '__all__'

class TerrainSubCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TerrainSubCategory
        fields = '__all__'

class TerrainElementSerializer(serializers.ModelSerializer):
    class Meta:
        model = TerrainElement
        fields = '__all__'

class TerrainZoneSerializer(serializers.ModelSerializer):
    elements = TerrainElementSerializer(many=True, read_only=True)
    
    class Meta:
        model = TerrainZone
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'is_deleted')

    def validate_category(self, value):
        allowed_categories = ['forest', 'farmland', 'water', 'road', 'building', 'bare']
        if value not in allowed_categories:
            raise serializers.ValidationError(f"Invalid land category: {value}")
        return value

    def validate_risk_level(self, value):
        allowed_levels = ['low', 'medium', 'high']
        if value not in allowed_levels:
            raise serializers.ValidationError(f"Invalid risk level: {value}")
        return value

    def to_internal_value(self, data):
        # 自动填充默认名称
        if not data.get('name'):
            data['name'] = "未命名地块"
        return super().to_internal_value(data)

# 保留旧名以兼容（如果还有其他地方用到）
TerrainPlotSerializer = TerrainZoneSerializer
