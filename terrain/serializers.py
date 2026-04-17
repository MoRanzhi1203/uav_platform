from collections import Counter

from rest_framework import serializers
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

from .models import TerrainArea, TerrainZone, TerrainElement, TerrainSubCategory


ZONE_CATEGORY_LABELS = dict(TerrainZone._meta.get_field('category').choices)


def _extract_shapely_geometries(raw_geojson):
    """兼容 Geometry / Feature / FeatureCollection 三种结构。"""
    if isinstance(raw_geojson, str):
        return []

    if not isinstance(raw_geojson, dict):
        return []

    geo_type = raw_geojson.get('type')
    if geo_type == 'FeatureCollection':
        geometries = []
        for feature in raw_geojson.get('features', []):
            geometries.extend(_extract_shapely_geometries(feature))
        return geometries

    if geo_type == 'Feature':
        geometry = raw_geojson.get('geometry')
        if not geometry:
            return []
        try:
            return [shape(geometry)]
        except Exception:
            return []

    try:
        return [shape(raw_geojson)]
    except Exception:
        return []


def _build_feature_from_geometry(geometry):
    if geometry is None or geometry.is_empty:
        return None
    return {
        'type': 'Feature',
        'geometry': mapping(geometry),
        'properties': {},
    }

class TerrainAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = TerrainArea
        fields = '__all__'



class TerrainAreaListSerializer(serializers.ModelSerializer):
    plot_count = serializers.IntegerField(read_only=True)
    composition_summary = serializers.SerializerMethodField()
    geojson = serializers.SerializerMethodField()
    boundary_geojson = serializers.SerializerMethodField()
    bbox = serializers.SerializerMethodField()
    center_lat = serializers.SerializerMethodField()
    center_lng = serializers.SerializerMethodField()
    plot_category_counts = serializers.SerializerMethodField()
    sub_category_count = serializers.SerializerMethodField()

    class Meta:
        model = TerrainArea
        fields = (
            'id',
            'name',
            'area',
            'risk_level',
            'plot_count',
            'composition_summary',
            'plot_category_counts',
            'sub_category_count',
            'center_lat',
            'center_lng',
            'bbox',
            'geojson',
            'boundary_geojson',
            'created_at',
            'updated_at',
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._geometry_cache = {}
        self._stats_cache = {}

    def _get_zones(self, obj):
        prefetched_zones = getattr(obj, 'active_zones', None)
        if prefetched_zones is not None:
            return prefetched_zones
        return list(obj.zones.filter(is_deleted=False))

    def _get_geometry(self, obj):
        cache_key = obj.pk
        if cache_key in self._geometry_cache:
            return self._geometry_cache[cache_key]

        geometry = None

        boundary_geometries = _extract_shapely_geometries(obj.boundary_json)
        if boundary_geometries:
            geometry = unary_union(boundary_geometries)
        else:
            zone_geometries = []
            for zone in self._get_zones(obj):
                zone_geometries.extend(_extract_shapely_geometries(zone.geom_json))
            if zone_geometries:
                geometry = unary_union(zone_geometries)

        if geometry is not None and geometry.is_empty:
            geometry = None

        self._geometry_cache[cache_key] = geometry
        return geometry

    def _get_stats(self, obj):
        cache_key = obj.pk
        if cache_key in self._stats_cache:
            return self._stats_cache[cache_key]

        zones = self._get_zones(obj)
        category_counter = Counter()
        unique_sub_types = set()

        for zone in zones:
            if zone.category:
                category_counter[zone.category] += 1
            if zone.type:
                unique_sub_types.add(zone.type)

        plot_count = getattr(obj, 'plot_count', len(zones))
        distinct_category_count = len(category_counter)
        distinct_sub_type_count = len(unique_sub_types)

        if plot_count <= 0:
            composition_summary = '暂无地块'
        elif distinct_sub_type_count >= 2:
            composition_summary = f'包含{distinct_sub_type_count}类地块'
        elif distinct_category_count >= 2:
            composition_summary = '混合地块'
        else:
            composition_summary = f'由{plot_count}个地块组成'

        stats = {
            'plot_count': plot_count,
            'category_counter': category_counter,
            'distinct_sub_type_count': distinct_sub_type_count,
            'composition_summary': composition_summary,
        }
        self._stats_cache[cache_key] = stats
        return stats

    def get_plot_category_counts(self, obj):
        category_counter = self._get_stats(obj)['category_counter']
        return [
            {
                'key': category_key,
                'label': ZONE_CATEGORY_LABELS.get(category_key, category_key),
                'count': count,
            }
            for category_key, count in category_counter.items()
        ]

    def get_sub_category_count(self, obj):
        return self._get_stats(obj)['distinct_sub_type_count']

    def get_composition_summary(self, obj):
        return self._get_stats(obj)['composition_summary']

    def get_geojson(self, obj):
        return _build_feature_from_geometry(self._get_geometry(obj))

    def get_boundary_geojson(self, obj):
        boundary_geometries = _extract_shapely_geometries(obj.boundary_json)
        if boundary_geometries:
            return _build_feature_from_geometry(unary_union(boundary_geometries))
        return self.get_geojson(obj)

    def get_bbox(self, obj):
        geometry = self._get_geometry(obj)
        if geometry is None:
            return None
        min_x, min_y, max_x, max_y = geometry.bounds
        return [min_x, min_y, max_x, max_y]

    def get_center_lat(self, obj):
        if obj.center_lat is not None:
            return obj.center_lat

        geometry = self._get_geometry(obj)
        if geometry is None:
            return None
        return geometry.centroid.y

    def get_center_lng(self, obj):
        if obj.center_lng is not None:
            return obj.center_lng

        geometry = self._get_geometry(obj)
        if geometry is None:
            return None
        return geometry.centroid.x
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
    sub_category = serializers.CharField(source='type', read_only=True)
    subCategory = serializers.CharField(source='type', read_only=True)
    
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
