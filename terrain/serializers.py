import json
import math

from pyproj import Geod
from rest_framework import serializers
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

from .models import TerrainArea, TerrainZone, TerrainElement, TerrainSubCategory


WGS84_GEOD = Geod(ellps='WGS84')


class GeoJSONCompatibilityMixin:
    """兼容旧接口 GeoJSON / geometry 结构，并统一为 WGS84 坐标。"""

    def _coerce_float(self, value):
        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            return None
        return numeric_value if numeric_value == numeric_value else None

    def _parse_json_value(self, value):
        current = value
        for _ in range(3):
            if isinstance(current, str):
                stripped = current.strip()
                if stripped in ('', 'null', 'None', '{}', '[]'):
                    return None
                try:
                    current = json.loads(stripped)
                except (TypeError, ValueError, json.JSONDecodeError):
                    return None
            else:
                break
        return current

    def _mercator_to_lng_lat(self, x, y):
        lng = (x / 20037508.34) * 180
        lat = (y / 20037508.34) * 180
        lat = (180 / math.pi) * (
            2 * math.atan(math.exp((lat * math.pi) / 180))
            - math.pi / 2
        )
        return [lng, lat]

    def _convert_coordinates(self, coordinates):
        if not isinstance(coordinates, list):
            return coordinates

        if len(coordinates) >= 2 and isinstance(coordinates[0], (int, float)) and isinstance(coordinates[1], (int, float)):
            x = float(coordinates[0])
            y = float(coordinates[1])
            if abs(x) > 180 or abs(y) > 90:
                lng, lat = self._mercator_to_lng_lat(x, y)
                return [lng, lat, *coordinates[2:]]
            return coordinates

        return [self._convert_coordinates(item) for item in coordinates]

    def _normalize_geojson(self, value):
        parsed = self._parse_json_value(value)
        if not isinstance(parsed, dict):
            return None

        geo_type = parsed.get('type')

        if geo_type == 'FeatureCollection':
            features = [
                self._normalize_geojson(feature)
                for feature in parsed.get('features', [])
            ]
            features = [feature for feature in features if feature]
            if not features:
                return None
            return {
                **parsed,
                'features': features,
            }

        if geo_type == 'Feature':
            geometry = self._normalize_geojson(parsed.get('geometry'))
            if not geometry:
                return None
            normalized_feature = dict(parsed)
            normalized_feature['geometry'] = geometry
            return normalized_feature

        if geo_type and isinstance(parsed.get('coordinates'), list):
            normalized_geometry = dict(parsed)
            normalized_geometry['coordinates'] = self._convert_coordinates(parsed['coordinates'])
            return normalized_geometry

        if isinstance(parsed.get('geometry'), dict):
            return self._normalize_geojson(parsed['geometry'])

        return None

    def _geometry_from_geojson(self, geojson):
        if not isinstance(geojson, dict):
            return None

        geo_type = geojson.get('type')
        if geo_type == 'FeatureCollection':
            geometries = [
                self._geometry_from_geojson(feature)
                for feature in geojson.get('features', [])
            ]
            geometries = [geom for geom in geometries if geom and not geom.is_empty]
            if not geometries:
                return None
            return unary_union(geometries)

        if geo_type == 'Feature':
            return self._geometry_from_geojson(geojson.get('geometry'))

        try:
            geometry = shape(geojson)
        except Exception:
            return None
        return geometry if geometry and not geometry.is_empty else None

    def _calculate_area_ha(self, geometry):
        if not geometry or geometry.is_empty:
            return None
        try:
            area_sq_m, _ = WGS84_GEOD.geometry_area_perimeter(geometry)
        except Exception:
            return None
        return abs(area_sq_m) / 10000 if area_sq_m is not None else None

    def _is_valid_center(self, lat, lng):
        if lat is None or lng is None:
            return False
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return False
        if abs(lat) < 1e-9 and abs(lng) < 1e-9:
            return False
        return True


class TerrainAreaSerializer(GeoJSONCompatibilityMixin, serializers.ModelSerializer):
    plot_count = serializers.SerializerMethodField()
    center_lng = serializers.SerializerMethodField()
    center_lat = serializers.SerializerMethodField()
    boundary_json = serializers.SerializerMethodField()
    boundary_geojson = serializers.SerializerMethodField()
    has_boundary = serializers.SerializerMethodField()
    has_center = serializers.SerializerMethodField()
    has_bbox = serializers.SerializerMethodField()
    has_area = serializers.SerializerMethodField()
    data_accuracy = serializers.SerializerMethodField()
    bbox_min_lng = serializers.SerializerMethodField()
    bbox_min_lat = serializers.SerializerMethodField()
    bbox_max_lng = serializers.SerializerMethodField()
    bbox_max_lat = serializers.SerializerMethodField()
    area = serializers.SerializerMethodField()
    area_ha = serializers.SerializerMethodField()

    class Meta:
        model = TerrainArea
        fields = (
            'id',
            'name',
            'type',
            'risk_level',
            'area',
            'area_ha',
            'description',
            'center_lng',
            'center_lat',
            'boundary_json',
            'boundary_geojson',
            'created_at',
            'updated_at',
            'is_deleted',
            'plot_count',
            'has_boundary',
            'has_center',
            'has_bbox',
            'has_area',
            'data_accuracy',
            'bbox_min_lng',
            'bbox_min_lat',
            'bbox_max_lng',
            'bbox_max_lat',
        )

    def _build_geojson_from_related_zones(self, obj):
        zones_manager = getattr(obj, 'zones', None)
        if zones_manager is None:
            return None, None

        prefetched = getattr(obj, '_prefetched_objects_cache', {})
        if 'zones' in prefetched:
            zones = prefetched['zones']
        else:
            zones = zones_manager.filter(is_deleted=False).only('id', 'geom_json')

        geometries = []
        for zone in zones:
            zone_geojson = self._normalize_geojson(getattr(zone, 'geom_json', None))
            zone_geometry = self._geometry_from_geojson(zone_geojson)
            if zone_geometry and not zone_geometry.is_empty:
                geometries.append(zone_geometry)

        if not geometries:
            return None, None

        try:
            merged_geometry = unary_union(geometries)
            merged_geojson = self._normalize_geojson(mapping(merged_geometry))
        except Exception:
            return None, None

        if not merged_geojson:
            return None, None
        return merged_geojson, merged_geometry

    def _get_spatial_meta(self, obj):
        if not hasattr(self, '_spatial_meta_cache'):
            self._spatial_meta_cache = {}

        cache_key = f'{obj.__class__.__name__}:{getattr(obj, "pk", id(obj))}'
        if cache_key in self._spatial_meta_cache:
            return self._spatial_meta_cache[cache_key]

        normalized_geojson = self._normalize_geojson(getattr(obj, 'boundary_json', None))
        geometry = self._geometry_from_geojson(normalized_geojson)
        if not geometry:
            normalized_geojson, geometry = self._build_geojson_from_related_zones(obj)
        bbox = geometry.bounds if geometry else None
        derived_area_ha = self._calculate_area_ha(geometry)
        stored_area = self._coerce_float(getattr(obj, 'area', None))

        center_lat = self._coerce_float(getattr(obj, 'center_lat', None))
        center_lng = self._coerce_float(getattr(obj, 'center_lng', None))
        if not self._is_valid_center(center_lat, center_lng) and geometry:
            centroid = geometry.centroid
            centroid_lat = self._coerce_float(getattr(centroid, 'y', None))
            centroid_lng = self._coerce_float(getattr(centroid, 'x', None))
            if self._is_valid_center(centroid_lat, centroid_lng):
                center_lat = centroid_lat
                center_lng = centroid_lng
            else:
                center_lat = None
                center_lng = None

        area_ha = stored_area if stored_area and stored_area > 0 else derived_area_ha
        if area_ha is not None:
            area_ha = round(float(area_ha), 4)

        meta = {
            'boundary_geojson': normalized_geojson,
            'geometry': geometry,
            'has_boundary': bool(normalized_geojson and geometry),
            'bbox': bbox,
            'area_ha': area_ha,
            'center_lat': center_lat if self._is_valid_center(center_lat, center_lng) else None,
            'center_lng': center_lng if self._is_valid_center(center_lat, center_lng) else None,
        }
        meta['has_bbox'] = bool(bbox)
        meta['has_area'] = area_ha is not None and area_ha > 0
        meta['has_center'] = meta['center_lat'] is not None and meta['center_lng'] is not None
        self._spatial_meta_cache[cache_key] = meta
        return meta

    def get_plot_count(self, obj):
        plot_count = getattr(obj, 'plot_count', None)
        if plot_count is not None:
            return int(plot_count)
        if hasattr(obj, 'zones'):
            return obj.zones.filter(is_deleted=False).count()
        return 0

    def get_area(self, obj):
        return self._get_spatial_meta(obj)['area_ha']

    def get_area_ha(self, obj):
        return self._get_spatial_meta(obj)['area_ha']

    def get_center_lng(self, obj):
        return self._get_spatial_meta(obj)['center_lng']

    def get_center_lat(self, obj):
        return self._get_spatial_meta(obj)['center_lat']

    def get_boundary_json(self, obj):
        return self._get_spatial_meta(obj)['boundary_geojson']

    def get_boundary_geojson(self, obj):
        return self._get_spatial_meta(obj)['boundary_geojson']

    def get_has_boundary(self, obj):
        return self._get_spatial_meta(obj)['has_boundary']

    def get_has_center(self, obj):
        return self._get_spatial_meta(obj)['has_center']

    def get_has_bbox(self, obj):
        return self._get_spatial_meta(obj)['has_bbox']

    def get_has_area(self, obj):
        return self._get_spatial_meta(obj)['has_area']

    def get_data_accuracy(self, obj):
        score = 60
        if obj.name:
            score += 5
        meta = self._get_spatial_meta(obj)
        if meta['has_center']:
            score += 10
        if meta['has_boundary']:
            score += 15
        if self.get_plot_count(obj):
            score += 10
        return f'{min(score, 98)}%'

    def get_bbox_min_lng(self, obj):
        bbox = self._get_spatial_meta(obj)['bbox']
        return round(bbox[0], 6) if bbox else None

    def get_bbox_min_lat(self, obj):
        bbox = self._get_spatial_meta(obj)['bbox']
        return round(bbox[1], 6) if bbox else None

    def get_bbox_max_lng(self, obj):
        bbox = self._get_spatial_meta(obj)['bbox']
        return round(bbox[2], 6) if bbox else None

    def get_bbox_max_lat(self, obj):
        bbox = self._get_spatial_meta(obj)['bbox']
        return round(bbox[3], 6) if bbox else None


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


class TerrainAreaPlotSerializer(GeoJSONCompatibilityMixin, serializers.ModelSerializer):
    plot_type = serializers.CharField(source='category', read_only=True)
    sub_type = serializers.CharField(source='type', read_only=True)
    boundary_json = serializers.SerializerMethodField()
    boundary_geojson = serializers.SerializerMethodField()
    area = serializers.SerializerMethodField()

    class Meta:
        model = TerrainZone
        fields = (
            'id',
            'name',
            'plot_type',
            'sub_type',
            'area',
            'risk_level',
            'boundary_json',
            'boundary_geojson',
        )

    def _get_zone_spatial_meta(self, obj):
        if not hasattr(self, '_zone_spatial_meta_cache'):
            self._zone_spatial_meta_cache = {}

        cache_key = f'zone:{getattr(obj, "pk", id(obj))}'
        if cache_key in self._zone_spatial_meta_cache:
            return self._zone_spatial_meta_cache[cache_key]

        normalized_geojson = self._normalize_geojson(getattr(obj, 'geom_json', None))
        geometry = self._geometry_from_geojson(normalized_geojson)
        stored_area = self._coerce_float(getattr(obj, 'area', None))
        derived_area_ha = self._calculate_area_ha(geometry)
        area_ha = stored_area if stored_area and stored_area > 0 else derived_area_ha
        if area_ha is not None:
            area_ha = round(float(area_ha), 4)

        meta = {
            'boundary_geojson': normalized_geojson,
            'area_ha': area_ha,
        }
        self._zone_spatial_meta_cache[cache_key] = meta
        return meta

    def get_boundary_json(self, obj):
        return self._get_zone_spatial_meta(obj)['boundary_geojson']

    def get_boundary_geojson(self, obj):
        return self._get_zone_spatial_meta(obj)['boundary_geojson']

    def get_area(self, obj):
        return self._get_zone_spatial_meta(obj)['area_ha']

# 保留旧名以兼容（如果还有其他地方用到）
TerrainPlotSerializer = TerrainZoneSerializer
