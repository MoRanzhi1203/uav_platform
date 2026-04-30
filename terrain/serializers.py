import json
import math

from pyproj import Geod
from rest_framework import serializers
from shapely.geometry import shape
from shapely.ops import unary_union

from fleet.models import Drone
from .models import TerrainArea, TerrainZone, TerrainElement, TerrainSubCategory
from .services import calculate_terrain_risk, get_risk_level_display, normalize_risk_level


WGS84_GEOD = Geod(ellps='WGS84')

PLOT_TYPE_LABELS = {
    'forest': '林区',
    'farmland': '农田',
    'building': '建筑',
    'water': '水域',
    'road': '道路',
    'bare_land': '裸地',
}

PLOT_TYPE_ALIASES = {
    'forest': 'forest',
    '林区': 'forest',
    'farmland': 'farmland',
    '农田': 'farmland',
    'building': 'building',
    '建筑': 'building',
    'water': 'water',
    '水域': 'water',
    'road': 'road',
    '道路': 'road',
    'bare': 'bare_land',
    'bare_land': 'bare_land',
    '裸地': 'bare_land',
    'open': 'bare_land',
    'open_land': 'bare_land',
    'empty_land': 'bare_land',
    'unused_land': 'bare_land',
    '空地': 'bare_land',
    '开敞地': 'bare_land',
}


def normalize_plot_type_key(value, for_storage=False):
    if value is None:
        normalized = None
    else:
        raw_value = str(value).strip()
        normalized = (
            PLOT_TYPE_ALIASES.get(raw_value)
            or PLOT_TYPE_ALIASES.get(raw_value.lower())
        )
    if not normalized:
        return None
    if for_storage and normalized == 'bare_land':
        return 'bare'
    return normalized


def get_plot_type_label(value):
    normalized = normalize_plot_type_key(value) or ''
    return PLOT_TYPE_LABELS.get(normalized, normalized)


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
    risk_level = serializers.SerializerMethodField()
    plot_count = serializers.SerializerMethodField()
    center_lng = serializers.SerializerMethodField()
    center_lat = serializers.SerializerMethodField()
    boundary_json = serializers.SerializerMethodField()
    boundary_geojson = serializers.SerializerMethodField()
    has_boundary = serializers.SerializerMethodField()
    spatial_status = serializers.SerializerMethodField()
    data_accuracy = serializers.SerializerMethodField()
    data_status = serializers.SerializerMethodField()
    bbox_min_lng = serializers.SerializerMethodField()
    bbox_min_lat = serializers.SerializerMethodField()
    bbox_max_lng = serializers.SerializerMethodField()
    bbox_max_lat = serializers.SerializerMethodField()
    area = serializers.SerializerMethodField()
    area_ha = serializers.SerializerMethodField()
    geometry = serializers.SerializerMethodField()
    bounds = serializers.SerializerMethodField()
    accuracy = serializers.SerializerMethodField()
    risk_label = serializers.SerializerMethodField()
    risk_level_display = serializers.SerializerMethodField()
    computed_risk_level = serializers.SerializerMethodField()
    computed_risk_level_display = serializers.SerializerMethodField()
    risk_score = serializers.SerializerMethodField()
    risk_reason = serializers.SerializerMethodField()
    high_risk_plot_count = serializers.SerializerMethodField()
    medium_risk_plot_count = serializers.SerializerMethodField()
    low_risk_plot_count = serializers.SerializerMethodField()
    unknown_risk_plot_count = serializers.SerializerMethodField()
    total_plot_count = serializers.SerializerMethodField()
    high_risk_area = serializers.SerializerMethodField()
    medium_risk_area = serializers.SerializerMethodField()
    low_risk_area = serializers.SerializerMethodField()
    total_risk_area = serializers.SerializerMethodField()
    plots = serializers.SerializerMethodField()
    drone = serializers.SerializerMethodField()
    drone_id = serializers.SerializerMethodField()
    drones = serializers.SerializerMethodField()
    drone_ids = serializers.SerializerMethodField()

    class Meta:
        model = TerrainArea
        fields = (
            'id',
            'name',
            'type',
            'risk_level',
            'risk_label',
            'risk_level_display',
            'computed_risk_level',
            'computed_risk_level_display',
            'risk_score',
            'risk_reason',
            'area',
            'area_ha',
            'description',
            'center_lng',
            'center_lat',
            'boundary_json',
            'boundary_geojson',
            'geometry',
            'bounds',
            'accuracy',
            'plots',
            'drone',
            'drone_id',
            'drones',
            'drone_ids',
            'created_at',
            'updated_at',
            'is_deleted',
            'plot_count',
            'high_risk_plot_count',
            'medium_risk_plot_count',
            'low_risk_plot_count',
            'unknown_risk_plot_count',
            'total_plot_count',
            'high_risk_area',
            'medium_risk_area',
            'low_risk_area',
            'total_risk_area',
            'has_boundary',
            'spatial_status',
            'data_accuracy',
            'data_status',
            'bbox_min_lng',
            'bbox_min_lat',
            'bbox_max_lng',
            'bbox_max_lat',
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.context.get('exclude_status_fields'):
            self.fields.pop('spatial_status', None)
            self.fields.pop('data_status', None)

    def _get_spatial_meta(self, obj):
        if not hasattr(self, '_spatial_meta_cache'):
            self._spatial_meta_cache = {}

        cache_key = f'{obj.__class__.__name__}:{getattr(obj, "pk", id(obj))}'
        if cache_key in self._spatial_meta_cache:
            return self._spatial_meta_cache[cache_key]

        raw_boundary_geojson = getattr(obj, 'boundary_json', None) or getattr(obj, '_derived_boundary_geojson', None)
        normalized_geojson = self._normalize_geojson(raw_boundary_geojson)
        geometry = self._geometry_from_geojson(normalized_geojson)
        bbox = geometry.bounds if geometry else getattr(obj, '_active_plot_bbox', None)
        stored_area = self._coerce_float(getattr(obj, 'area', None))

        center_lat = self._coerce_float(getattr(obj, 'center_lat', None))
        center_lng = self._coerce_float(getattr(obj, 'center_lng', None))
        if not self._is_valid_center(center_lat, center_lng):
            center_lat = self._coerce_float(getattr(obj, '_derived_center_lat', None))
            center_lng = self._coerce_float(getattr(obj, '_derived_center_lng', None))
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

        area_ha = stored_area
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
        self._spatial_meta_cache[cache_key] = meta
        return meta

    def _get_terrain_risk(self, obj):
        cached = getattr(obj, '_terrain_risk_cache', None)
        if cached is not None:
            return cached
        payload = calculate_terrain_risk(obj, plots=getattr(obj, 'active_zones', None))
        obj._terrain_risk_cache = payload
        return payload

    def get_risk_level(self, obj):
        return self._get_terrain_risk(obj)['risk_level']

    def get_plot_count(self, obj):
        active_zones = getattr(obj, 'active_zones', None)
        if active_zones is not None:
            return len(active_zones)
        plot_count = getattr(obj, 'plot_count', None)
        if plot_count is not None:
            return int(plot_count)
        if hasattr(obj, 'zones'):
            return obj.zones.filter(is_deleted=False).count()
        return 0

    def get_area(self, obj):
        return self._coerce_float(getattr(obj, 'area', None))

    def get_area_ha(self, obj):
        return self._coerce_float(getattr(obj, 'area', None))

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

    def get_spatial_status(self, obj):
        has_boundary = self.get_has_boundary(obj)
        meta = self._get_spatial_meta(obj)
        has_center = meta['center_lat'] is not None and meta['center_lng'] is not None
        if has_boundary and has_center:
            return '边界与中心点完整'
        if has_boundary:
            return '边界完整，中心点待校准'
        if has_center:
            return '仅中心点定位'
        return '空间数据待补采'

    def get_data_status(self, obj):
        has_boundary = self.get_has_boundary(obj)
        plot_count = self.get_plot_count(obj)
        if has_boundary and plot_count > 0:
            return '专题数据就绪'
        if has_boundary:
            return '基础边界已接入'
        return '原始影像阶段'

    def get_data_accuracy(self, obj):
        score = 60
        if obj.name:
            score += 5
        meta = self._get_spatial_meta(obj)
        if meta['center_lat'] is not None and meta['center_lng'] is not None:
            score += 10
        if meta['has_boundary']:
            score += 15
        if self.get_plot_count(obj):
            score += 10
        return f'{min(score, 98)}%'

    def get_bbox_min_lng(self, obj):
        bbox = self._get_spatial_meta(obj)['bbox']
        return bbox[0] if bbox else None

    def get_bbox_min_lat(self, obj):
        bbox = self._get_spatial_meta(obj)['bbox']
        return bbox[1] if bbox else None

    def get_bbox_max_lng(self, obj):
        bbox = self._get_spatial_meta(obj)['bbox']
        return bbox[2] if bbox else None

    def get_bbox_max_lat(self, obj):
        bbox = self._get_spatial_meta(obj)['bbox']
        return bbox[3] if bbox else None

    def get_geometry(self, obj):
        return self._get_spatial_meta(obj)['boundary_geojson']

    def get_bounds(self, obj):
        bbox = self._get_spatial_meta(obj)['bbox']
        if bbox:
            return {
                "south_west": [bbox[0], bbox[1]],
                "north_east": [bbox[2], bbox[3]]
            }
        return None

    def get_accuracy(self, obj):
        score = 60
        if obj.name:
            score += 5
        meta = self._get_spatial_meta(obj)
        if meta['center_lat'] is not None and meta['center_lng'] is not None:
            score += 10
        if meta['has_boundary']:
            score += 15
        if self.get_plot_count(obj):
            score += 10
        return min(score, 98)

    def get_risk_label(self, obj):
        return self._get_terrain_risk(obj)['risk_level_display']

    def get_risk_level_display(self, obj):
        return self._get_terrain_risk(obj)['risk_level_display']

    def get_computed_risk_level(self, obj):
        return self._get_terrain_risk(obj)['risk_level']

    def get_computed_risk_level_display(self, obj):
        return self._get_terrain_risk(obj)['risk_level_display']

    def get_risk_score(self, obj):
        return self._get_terrain_risk(obj)['risk_score']

    def get_risk_reason(self, obj):
        return self._get_terrain_risk(obj)['reason']

    def get_high_risk_plot_count(self, obj):
        return self._get_terrain_risk(obj)['high_count']

    def get_medium_risk_plot_count(self, obj):
        return self._get_terrain_risk(obj)['medium_count']

    def get_low_risk_plot_count(self, obj):
        return self._get_terrain_risk(obj)['low_count']

    def get_unknown_risk_plot_count(self, obj):
        return self._get_terrain_risk(obj)['unknown_count']

    def get_total_plot_count(self, obj):
        return self._get_terrain_risk(obj)['total_count']

    def get_high_risk_area(self, obj):
        return self._get_terrain_risk(obj)['high_area']

    def get_medium_risk_area(self, obj):
        return self._get_terrain_risk(obj)['medium_area']

    def get_low_risk_area(self, obj):
        return self._get_terrain_risk(obj)['low_area']

    def get_total_risk_area(self, obj):
        return self._get_terrain_risk(obj)['total_area']

    def get_plots(self, obj):
        active_zones = getattr(obj, 'active_zones', None)
        if active_zones is not None:
            return TerrainZoneSerializer(active_zones, many=True).data
        if hasattr(obj, 'zones'):
            return TerrainZoneSerializer(obj.zones.filter(is_deleted=False), many=True).data
        return []

    def get_drone_id(self, obj):
        drone = Drone.objects.filter(terrain_id=obj.id).order_by('id').first()
        return drone.id if drone else 0

    def _serialize_drone_brief(self, drone):
        return {
            "id": drone.id,
            "drone_code": drone.drone_code,
            "drone_name": drone.drone_name,
            "model_name": drone.model_name,
            "status": getattr(drone, "status", "") or "",
            "updated_at": drone.updated_at.isoformat() if getattr(drone, "updated_at", None) else None,
            "purpose": getattr(drone, "purpose", None),
            "usage": getattr(drone, "usage", None),
            "usage_type": getattr(drone, "usage_type", None),
            "battery_level": getattr(drone, "battery_level", None),
        }

    def get_drone(self, obj):
        drone = Drone.objects.filter(terrain_id=obj.id).order_by('id').first()
        if drone:
            return self._serialize_drone_brief(drone)
        return None

    def get_drones(self, obj):
        queryset = Drone.objects.filter(terrain_id=obj.id).order_by('id')
        return [self._serialize_drone_brief(drone) for drone in queryset]

    def get_drone_ids(self, obj):
        return list(Drone.objects.filter(terrain_id=obj.id).order_by('id').values_list('id', flat=True))

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
    geometry = serializers.SerializerMethodField()
    type_label = serializers.SerializerMethodField()
    subtype = serializers.SerializerMethodField()
    subtype_label = serializers.SerializerMethodField()
    risk_level_display = serializers.SerializerMethodField()
    risk_level = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    
    class Meta:
        model = TerrainZone
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'is_deleted')

    def validate_category(self, value):
        normalized_value = normalize_plot_type_key(value, for_storage=True)
        allowed_categories = ['forest', 'farmland', 'water', 'road', 'building', 'bare']
        if normalized_value not in allowed_categories:
            raise serializers.ValidationError(f"Invalid land category: {value}")
        return normalized_value

    def validate_risk_level(self, value):
        normalized_value = normalize_risk_level(value)
        allowed_levels = ['none', 'low', 'medium', 'high']
        if normalized_value not in allowed_levels:
            raise serializers.ValidationError(f"Invalid risk level: {value}")
        return normalized_value

    def to_internal_value(self, data):
        mutable_data = data.copy() if hasattr(data, 'copy') else dict(data)
        if mutable_data.get('category') is not None:
            mutable_data['category'] = normalize_plot_type_key(mutable_data.get('category'), for_storage=True) or mutable_data.get('category')
        # 自动填充默认名称
        if not mutable_data.get('name'):
            mutable_data['name'] = "未命名地块"
        return super().to_internal_value(mutable_data)

    def get_geometry(self, obj):
        return self._get_geojson(obj)

    def get_type_label(self, obj):
        category = getattr(obj, 'category', None)
        return self._get_meta_value(obj, 'type_label') or get_plot_type_label(category)

    def get_subtype(self, obj):
        return getattr(obj, 'type', '') or ''

    def get_subtype_label(self, obj):
        subtype = getattr(obj, 'type', '') or ''
        return self._get_meta_value(obj, 'subtype_label') or self._get_meta_value(obj, 'subcategory_name') or subtype

    def get_risk_level_display(self, obj):
        return get_risk_level_display(getattr(obj, 'risk_level', None))

    def _get_geojson(self, obj):
        parsed = GeoJSONCompatibilityMixin()._normalize_geojson(getattr(obj, 'geom_json', None))
        return parsed

    def _get_meta_value(self, obj, key):
        meta = getattr(obj, 'meta_json', None)
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        if isinstance(meta, dict):
            value = meta.get(key)
            if value is not None:
                return value
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['category'] = normalize_plot_type_key(data.get('category')) or data.get('category')
        data['risk_level'] = normalize_risk_level(data.get('risk_level'))
        data['risk_level_display'] = data.get('risk_level_display') or get_risk_level_display(data.get('risk_level'))
        data['geometry'] = self.get_geometry(instance)
        data['type_label'] = self.get_type_label(instance)
        data['subtype'] = self.get_subtype(instance)
        data['subtype_label'] = self.get_subtype_label(instance)
        return data


class TerrainAreaPlotSerializer(GeoJSONCompatibilityMixin, serializers.ModelSerializer):
    plot_type = serializers.SerializerMethodField()
    sub_type = serializers.CharField(source='type', read_only=True)
    boundary_json = serializers.SerializerMethodField()
    boundary_geojson = serializers.SerializerMethodField()
    area = serializers.SerializerMethodField()
    geometry = serializers.SerializerMethodField()
    type = serializers.SerializerMethodField()
    type_label = serializers.SerializerMethodField()
    subtype = serializers.CharField(source='type', read_only=True)
    subtype_label = serializers.SerializerMethodField()
    risk_level_display = serializers.SerializerMethodField()

    class Meta:
        model = TerrainZone
        fields = (
            'id',
            'name',
            'type',
            'type_label',
            'plot_type',
            'subtype',
            'subtype_label',
            'sub_type',
            'area',
            'risk_level',
            'risk_level_display',
            'geometry',
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
        area_ha = stored_area
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

    def get_geometry(self, obj):
        return self._get_zone_spatial_meta(obj)['boundary_geojson']

    def get_plot_type(self, obj):
        return normalize_plot_type_key(getattr(obj, 'category', None)) or getattr(obj, 'category', '') or ''

    def get_type(self, obj):
        return self.get_plot_type(obj)

    def get_type_label(self, obj):
        meta = getattr(obj, 'meta_json', None)
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        if isinstance(meta, dict) and meta.get('type_label'):
            return get_plot_type_label(meta.get('type_label'))
        return get_plot_type_label(getattr(obj, 'category', None))

    def get_subtype_label(self, obj):
        meta = getattr(obj, 'meta_json', None)
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        if isinstance(meta, dict):
            return meta.get('subtype_label') or meta.get('subcategory_name') or getattr(obj, 'type', '') or ''
        return getattr(obj, 'type', '') or ''

    def get_risk_level_display(self, obj):
        return get_risk_level_display(getattr(obj, 'risk_level', None))
