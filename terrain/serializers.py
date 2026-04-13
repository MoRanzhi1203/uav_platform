from rest_framework import serializers
from .models import TerrainPlot

class TerrainPlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = TerrainPlot
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'is_deleted')

    def validate_land_type(self, value):
        allowed_types = ['forest', 'farmland', 'water', 'road', 'building', 'mixed']
        if value not in allowed_types:
            raise serializers.ValidationError(f"Invalid land type: {value}")
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
