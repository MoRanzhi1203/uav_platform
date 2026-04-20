import logging
import traceback
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.db import transaction
from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from shapely.geometry import shape, mapping, MultiPolygon, Polygon
from shapely.ops import unary_union
from .models import TerrainArea, TerrainZone, TerrainElement, TerrainSubCategory
from .serializers import (
    GeoJSONCompatibilityMixin, TerrainAreaSerializer, TerrainZoneSerializer, TerrainAreaPlotSerializer,
    TerrainElementSerializer, TerrainSubCategorySerializer
)
from common.responses import api_response, api_error

logger = logging.getLogger(__name__)
SUBCATEGORY_CONFIG_PATH = Path(__file__).resolve().parent / "config" / "terrain_subcategories.json"
ADMIN_BOUNDARY_DERIVED_DIR = Path(__file__).resolve().parents[1] / "static" / "shp" / "chongqing" / "derived"
ADMIN_BOUNDARY_VERSION_FILE = ADMIN_BOUNDARY_DERIVED_DIR / "version.json"
ADMIN_BOUNDARY_DERIVED_FILES = (
    ADMIN_BOUNDARY_DERIVED_DIR / "chongqing_city_from_township.geojson",
    ADMIN_BOUNDARY_DERIVED_DIR / "chongqing_district_from_township.geojson",
    ADMIN_BOUNDARY_DERIVED_DIR / "chongqing_township_from_source.geojson",
)

ACTIVE_PLOT_EXCLUDED_ZONE_STATUSES = {
    "deleted",
    "inactive",
    "archived",
    "history",
    "historical",
    "invalid",
    "discarded",
    "disabled",
    "hidden",
    "draft",
}

SPATIAL_COMPAT = GeoJSONCompatibilityMixin()


def _get_zone_normalized_geometry(zone):
    normalized_geojson = SPATIAL_COMPAT._normalize_geojson(getattr(zone, "geom_json", None))
    geometry = SPATIAL_COMPAT._geometry_from_geojson(normalized_geojson)
    return normalized_geojson, geometry


def build_area_spatial_from_active_plots(area, active_plots=None):
    """基于当前有效地块重建 TerrainArea 顶层空间字段，避免旧 boundary_json 借尸还魂。"""
    plots = list(active_plots) if active_plots is not None else list(get_area_active_plots(area))
    geometries = []

    for zone in plots:
        _normalized_geojson, geometry = _get_zone_normalized_geometry(zone)
        if geometry and not geometry.is_empty:
            geometries.append(geometry)

    merged_geometry = unary_union(geometries) if geometries else None
    if merged_geometry and not merged_geometry.is_empty:
        boundary_geojson = {
            "type": "Feature",
            "geometry": mapping(merged_geometry),
            "properties": {},
        }
        centroid = merged_geometry.centroid
        center_lat = SPATIAL_COMPAT._coerce_float(getattr(centroid, "y", None))
        center_lng = SPATIAL_COMPAT._coerce_float(getattr(centroid, "x", None))
        if not SPATIAL_COMPAT._is_valid_center(center_lat, center_lng):
            center_lat = None
            center_lng = None
        area_ha = SPATIAL_COMPAT._calculate_area_ha(merged_geometry) or 0
        bbox = merged_geometry.bounds
    else:
        boundary_geojson = {}
        center_lat = None
        center_lng = None
        area_ha = 0
        bbox = None

    update_fields = []

    if boundary_geojson != area.boundary_json:
        area.boundary_json = boundary_geojson
        update_fields.append("boundary_json")

    if center_lng != area.center_lng:
        area.center_lng = center_lng
        update_fields.append("center_lng")

    if center_lat != area.center_lat:
        area.center_lat = center_lat
        update_fields.append("center_lat")

    try:
        normalized_area = Decimal(str(round(float(area_ha), 2)))
    except (TypeError, ValueError, InvalidOperation):
        normalized_area = None

    if normalized_area is not None and normalized_area != area.area:
        area.area = normalized_area
        update_fields.append("area")

    if update_fields:
        area.save(update_fields=update_fields)

    area.active_zones = plots
    area.plot_count = len(plots)
    area._active_plot_bbox = bbox

    return area


def build_area_spatial_from_zones(area):
    return build_area_spatial_from_active_plots(area)


def _parse_json_object(value):
    current = value
    for _ in range(2):
        if not isinstance(current, str):
            break
        try:
            current = json.loads(current)
        except json.JSONDecodeError:
            return {}
    return current if isinstance(current, dict) else {}


def _has_coordinate_pairs(value):
    if isinstance(value, (list, tuple)):
        if len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
            return True
        return any(_has_coordinate_pairs(item) for item in value)
    return False


def _zone_has_renderable_geometry(zone):
    geom_json = _parse_json_object(getattr(zone, "geom_json", None))
    if not geom_json:
        return False

    geometry = geom_json
    if geom_json.get("type") == "Feature":
        geometry = geom_json.get("geometry") or {}
    elif geom_json.get("type") == "FeatureCollection":
        return any(
            _has_coordinate_pairs(
                _parse_json_object(feature).get("geometry", {}).get("coordinates")
            )
            for feature in geom_json.get("features", [])
            if isinstance(feature, dict)
        )

    if not isinstance(geometry, dict):
        return False

    if geometry.get("type") == "GeometryCollection":
        return any(
            _has_coordinate_pairs(item.get("coordinates"))
            for item in geometry.get("geometries", [])
            if isinstance(item, dict)
        )

    return _has_coordinate_pairs(geometry.get("coordinates"))


def _get_area_plot_exclude_reason(zone, area_id):
    if getattr(zone, "is_deleted", False):
        return "is_deleted"

    if area_id and str(getattr(zone, "area_obj_id", "")) != str(area_id):
        return "area_mismatch"

    if not _zone_has_renderable_geometry(zone):
        return "missing_geometry"

    meta_json = _parse_json_object(getattr(zone, "meta_json", None))
    style_json = _parse_json_object(getattr(zone, "style_json", None))

    for key in (
        "hidden",
        "is_hidden",
        "archived",
        "is_archived",
        "history",
        "is_history",
        "historical",
        "is_historical",
        "invalid",
        "is_invalid",
        "disabled",
        "is_disabled",
        "draft",
        "is_draft",
    ):
        if meta_json.get(key) is True or style_json.get(key) is True:
            return f"flag:{key}"

    if style_json.get("visible") is False:
        return "style_hidden"

    for key in ("active", "is_active", "current", "is_current", "latest", "is_latest", "enabled", "is_enabled"):
        if key in meta_json and meta_json.get(key) is False:
            return f"flag:{key}=false"
        if key in style_json and style_json.get(key) is False:
            return f"flag:{key}=false"

    for key in ("status", "zone_status", "record_status", "state"):
        for payload in (meta_json, style_json):
            value = payload.get(key)
            if value is None:
                continue
            normalized = str(value).strip().lower()
            if normalized in ACTIVE_PLOT_EXCLUDED_ZONE_STATUSES:
                return f"status:{normalized}"

    return None


def _build_area_plot_dedupe_key(zone):
    geom_json = _parse_json_object(getattr(zone, "geom_json", None))
    geometry = geom_json.get("geometry") if geom_json.get("type") == "Feature" else geom_json
    geometry_key = json.dumps(
        geometry or {},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return "|".join(
        [
            str(getattr(zone, "area_obj_id", "") or ""),
            str(getattr(zone, "category", "") or ""),
            str(getattr(zone, "type", "") or ""),
            geometry_key,
        ]
    )


def get_area_active_plots(area):
    raw_zones = list(
        TerrainZone.objects.filter(area_obj=area, is_deleted=False)
        .prefetch_related("elements")
        .order_by("-updated_at", "-id")
    )

    filtered_zones = []
    skipped_zones = []
    seen_keys = set()

    for zone in raw_zones:
        exclude_reason = _get_area_plot_exclude_reason(zone, area.id)
        if exclude_reason:
            skipped_zones.append((zone.id, exclude_reason))
            continue

        dedupe_key = _build_area_plot_dedupe_key(zone)
        if dedupe_key in seen_keys:
            skipped_zones.append((zone.id, "duplicate_geometry"))
            continue

        seen_keys.add(dedupe_key)
        filtered_zones.append(zone)

    if skipped_zones:
        logger.warning(
            "区域[%s] 有效地块过滤: 原始=%s, 保留=%s, 剔除=%s, 明细=%s",
            area.id,
            len(raw_zones),
            len(filtered_zones),
            len(skipped_zones),
            skipped_zones,
        )
    else:
        logger.info(
            "区域[%s] 有效地块过滤: 原始=%s, 保留=%s",
            area.id,
            len(raw_zones),
            len(filtered_zones),
        )

    return filtered_zones


def get_editor_active_zones(area):
    return get_area_active_plots(area)


def load_subcategory_config():
    """读取并标准化子类别 JSON 配置。"""
    if not SUBCATEGORY_CONFIG_PATH.exists():
        return {}

    try:
        with SUBCATEGORY_CONFIG_PATH.open("r", encoding="utf-8") as fp:
            config = json.load(fp)
    except (OSError, json.JSONDecodeError):
        logger.warning("Failed to read subcategory config: %s", SUBCATEGORY_CONFIG_PATH)
        return {}

    if not isinstance(config, dict):
        return {}

    normalized_config = {}
    for category, raw_items in config.items():
        if not isinstance(raw_items, list):
            continue

        seen_names = set()
        normalized_items = []
        for raw_item in raw_items:
            if isinstance(raw_item, str):
                name = raw_item.strip()
                description = ""
            elif isinstance(raw_item, dict):
                raw_name = raw_item.get("name", "")
                raw_description = raw_item.get("description", "")
                if not isinstance(raw_name, str):
                    continue
                if raw_description is None:
                    raw_description = ""
                if not isinstance(raw_description, str):
                    raw_description = str(raw_description)
                name = raw_name.strip()
                description = raw_description.strip()
            else:
                continue

            if not name or name in seen_names:
                continue

            seen_names.add(name)
            normalized_items.append({
                "name": name,
                "description": description,
            })

        normalized_config[category] = normalized_items

    return normalized_config


def save_subcategory_config(config):
    """保存子类别 JSON 配置。"""
    try:
        with SUBCATEGORY_CONFIG_PATH.open("w", encoding="utf-8") as fp:
            json.dump(config, fp, ensure_ascii=False, indent=2)
            fp.write("\n")
    except OSError:
        logger.warning("Failed to write subcategory config: %s", SUBCATEGORY_CONFIG_PATH)


def upsert_subcategory_in_config(category, name, description=""):
    """新增或更新 JSON 配置中的子类别及说明。"""
    config = load_subcategory_config()
    clean_name = (name or "").strip()
    clean_description = (description or "").strip()
    if not clean_name:
        return ""

    category_items = config.setdefault(category, [])
    for item in category_items:
        if item["name"] == clean_name:
            item["description"] = clean_description
            save_subcategory_config(config)
            return clean_description

    category_items.append({
        "name": clean_name,
        "description": clean_description,
    })
    save_subcategory_config(config)
    return clean_description


def remove_subcategory_from_config(category, name):
    """删除 JSON 配置中的子类别，避免后续同步命令重新创建。"""
    config = load_subcategory_config()
    category_items = config.get(category, [])
    updated_items = [item for item in category_items if item["name"] != name]
    if updated_items == category_items:
        return

    config[category] = updated_items
    save_subcategory_config(config)


def get_admin_boundary_data_version():
    """读取行政区划 derived 数据版本号，用于前端缓存失效。"""
    try:
        if ADMIN_BOUNDARY_VERSION_FILE.exists():
            with ADMIN_BOUNDARY_VERSION_FILE.open("r", encoding="utf-8") as fp:
                payload = json.load(fp)
            version = payload.get("version")
            if version is not None:
                return str(version)
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        logger.warning("Failed to read admin boundary version file: %s", ADMIN_BOUNDARY_VERSION_FILE)

    derived_timestamps = [
        int(path.stat().st_mtime)
        for path in ADMIN_BOUNDARY_DERIVED_FILES
        if path.exists()
    ]
    if derived_timestamps:
        return str(max(derived_timestamps))

    return "0"

# 地形管理主页 (区域列表页)
def terrain_index(request):
    return render(request, 'terrain/index.html')

# 地块编辑器页面 (区域编辑详情页)
def terrain_editor(request):
    context = {
        "admin_boundary_data_version": get_admin_boundary_data_version(),
    }
    return render(request, 'terrain/editor.html', context)

# --- TerrainArea API ---

@api_view(['POST'])
@permission_classes([AllowAny])
def delete_terrain(request, pk):
    """地形逻辑删除：同步删除关联地块"""
    try:
        terrain = get_object_or_404(TerrainArea, id=pk)
        with transaction.atomic():
            # 1. 逻辑删除地形
            terrain.is_deleted = True
            terrain.save()
            
            # 2. 逻辑删除下属所有地块
            TerrainZone.objects.filter(area_obj=terrain).update(is_deleted=True)
            
        return api_response(msg="地形及其关联地块已成功删除", data={"terrain_id": pk})
    except Exception as e:
        logger.error(f"删除地形异常: {str(e)}")
        return api_error(msg=f"删除失败: {str(e)}", status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def list_areas(request):
    """区域列表接口"""
    try:
        queryset = list(
            TerrainArea.objects.filter(is_deleted=False)
            .annotate(plot_count=Count('zones', distinct=True))
            .order_by('-updated_at', '-id')
        )
        for area in queryset:
            active_plots = get_area_active_plots(area)
            build_area_spatial_from_active_plots(area, active_plots=active_plots)

        serializer = TerrainAreaSerializer(
            queryset,
            many=True,
            context={'exclude_status_fields': True}
        )
        return api_response(data=serializer.data)
    except Exception as e:
        logger.error(f"获取区域列表异常: {str(e)}")
        return api_error(msg=str(e), status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
def area_plots(request, area_id):
    """按地形加载下属混合地块专题"""
    try:
        area = get_object_or_404(TerrainArea, id=area_id, is_deleted=False)
        plots = get_area_active_plots(area)
        serializer = TerrainAreaPlotSerializer(plots, many=True)
        return api_response(data=serializer.data)
    except Exception as e:
        logger.error(f"获取区域地块专题异常: {str(e)}")
        return api_error(msg=str(e), status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def area_edit_detail(request, area_id):
    """地块编辑页接口: 仅返回当前区域下可编辑的有效地块和 Element"""
    try:
        area = get_object_or_404(TerrainArea, id=area_id, is_deleted=False)
        zones = get_editor_active_zones(area)
        area.active_zones = zones
        area.plot_count = len(zones)

        area_serializer = TerrainAreaSerializer(area)
        zones_serializer = TerrainZoneSerializer(zones, many=True)

        response_data = {
            "area": area_serializer.data,
            "zones": zones_serializer.data,
            "editor_payload": {
                "area": area_serializer.data,
                "zones": zones_serializer.data,
                "view_meta": {
                    "area_id": area.id,
                    "plot_count": len(zones_serializer.data),
                },
            },
        }
        logger.info(f"--- 加载区域编辑详情返回 ---: {len(zones_serializer.data)} 个地块")
        
        return api_response(data=response_data)
    except Exception as e:
        logger.error(f"获取区域编辑详情异常: {str(e)}")
        return api_error(msg=str(e), status=500)

# --- TerrainZone API ---

@api_view(['POST'])
@permission_classes([AllowAny])
def unified_save_terrain(request):
    """
    统一保存接口：地形 + 多地块 + 子类别
    支持一次性创建或更新顶层地形，并同步保存所有关联地块
    """
    try:
        data = request.data
        logger.info(f"--- 统一保存请求数据 ---: {json.dumps(data, ensure_ascii=False)}")
        terrain_data = data.get('terrain', {})
        plots_data = data.get('plots', []) # 支持批量地块

        if not terrain_data.get('name'):
            return api_error(msg="地形名称不能为空")

        with transaction.atomic():
            # 1. 处理地形 (TerrainArea)
            terrain_id = terrain_data.get('id')
            if terrain_id:
                terrain = get_object_or_404(TerrainArea, id=terrain_id, is_deleted=False)
                terrain.name = terrain_data.get('name')
                terrain.description = terrain_data.get('description', '')
                if terrain_data.get('type'):
                    terrain.type = terrain_data.get('type')
                if terrain_data.get('risk_level'):
                    terrain.risk_level = terrain_data.get('risk_level')
                terrain.save()
                msg = "地形与地块已成功更新"
            else:
                terrain = TerrainArea.objects.create(
                    name=terrain_data.get('name'),
                    description=terrain_data.get('description', ''),
                    type=terrain_data.get('type', 'farm'),
                    risk_level=terrain_data.get('risk_level', 'low')
                )
                msg = "地形与地块已成功创建"

            # 2. 批量处理地块 (TerrainZone)
            saved_plot_ids = []
            for plot_item in plots_data:
                plot_id = plot_item.get('id')
                plot_item['area_obj'] = terrain.id # 强制关联到当前地形
                
                if plot_id:
                    # 更新已有地块
                    plot = get_object_or_404(TerrainZone, id=plot_id, is_deleted=False)
                    serializer = TerrainZoneSerializer(plot, data=plot_item, partial=True)
                else:
                    # 创建新地块
                    serializer = TerrainZoneSerializer(data=plot_item)

                if serializer.is_valid():
                    plot = serializer.save()
                    saved_plot_ids.append(plot.id)
                else:
                    # 如果任何地块校验失败，回滚整个事务
                    transaction.set_rollback(True)
                    return api_error(msg=f"地块[{plot_item.get('name')}]校验失败", data=serializer.errors)

            # 3. 处理删除：如果地块不在本次提交列表中，标记为已删除
            # 注意：只针对当前 TerrainArea 下的地块
            deleted_count = TerrainZone.objects.filter(
                area_obj=terrain, 
                is_deleted=False
            ).exclude(id__in=saved_plot_ids).update(is_deleted=True)
            
            if deleted_count > 0:
                logger.info(f"清理了 {deleted_count} 个未在保存列表中的旧地块")

            terrain = build_area_spatial_from_active_plots(terrain)

            # 重新获取最新的已保存地块数据返回给前端
            final_plots = TerrainZone.objects.filter(id__in=saved_plot_ids).prefetch_related('elements')
            return api_response(data={
                "terrain": TerrainAreaSerializer(terrain).data,
                "plots": TerrainZoneSerializer(final_plots, many=True).data
            }, msg=msg)

    except Exception as e:
        logger.error(f"统一保存异常: {str(e)}\n{traceback.format_exc()}")
        return api_error(msg=str(e), status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def create_or_update_zone(request):
    """地块创建或更新"""
    try:
        zone_id = request.data.get('id')
        if zone_id:
            zone = get_object_or_404(TerrainZone, id=zone_id, is_deleted=False)
            serializer = TerrainZoneSerializer(zone, data=request.data, partial=True)
            msg = "地块更新成功"
        else:
            serializer = TerrainZoneSerializer(data=request.data)
            msg = "地块创建成功"

        if serializer.is_valid():
            zone = serializer.save()
            return api_response(data=TerrainZoneSerializer(zone).data, msg=msg)
        return api_error(msg="数据校验失败", data=serializer.errors)
    except Exception as e:
        logger.error(f"保存地块异常: {str(e)}")
        return api_error(msg=str(e), status=500)

@api_view(['DELETE', 'POST'])
@permission_classes([AllowAny])
def delete_zone(request, pk):
    """地块逻辑删除"""
    try:
        zone = get_object_or_404(TerrainZone, id=pk)
        zone.is_deleted = True
        zone.save()
        return api_response(msg="地块已删除")
    except Exception as e:
        return api_error(msg=str(e), status=500)

# --- TerrainElement API ---

@api_view(['POST'])
@permission_classes([AllowAny])
def create_or_update_element(request):
    """标记创建或更新"""
    try:
        element_id = request.data.get('id')
        if element_id:
            element = get_object_or_404(TerrainElement, id=element_id)
            serializer = TerrainElementSerializer(element, data=request.data, partial=True)
            msg = "标记更新成功"
        else:
            serializer = TerrainElementSerializer(data=request.data)
            msg = "标记创建成功"

        if serializer.is_valid():
            element = serializer.save()
            return api_response(data=TerrainElementSerializer(element).data, msg=msg)
        return api_error(msg="数据校验失败", data=serializer.errors)
    except Exception as e:
        logger.error(f"保存标记异常: {str(e)}")
        return api_error(msg=str(e), status=500)

@api_view(['DELETE', 'POST'])
@permission_classes([AllowAny])
def delete_element(request, pk):
    """标记物理删除"""
    try:
        element = get_object_or_404(TerrainElement, id=pk)
        element.delete()
        return api_response(msg="标记已删除")
    except Exception as e:
        return api_error(msg=str(e), status=500)

# --- 新增功能: 拆分、合并、布尔运算、子类别管理 ---

@api_view(['POST'])
@permission_classes([AllowAny])
def split_zone(request, pk):
    """拆分地块: 自动计算不相连的部分"""
    try:
        zone = get_object_or_404(TerrainZone, id=pk)
        geojson = zone.geom_json
        # 获取 Geometry 部分
        geom_data = geojson.get('geometry', geojson)
        poly_shape = shape(geom_data)
        
        if poly_shape.is_empty:
            return api_error(msg="地块几何数据为空")
            
        # 如果是 MultiPolygon，拆分为多个 Polygon
        new_zones = []
        if isinstance(poly_shape, MultiPolygon):
            with transaction.atomic():
                for i, p in enumerate(poly_shape.geoms):
                    new_zone = TerrainZone.objects.create(
                        area_obj=zone.area_obj,
                        name=f"{zone.name}_拆分_{i+1}",
                        category=zone.category,
                        type=zone.type,
                        risk_level=zone.risk_level,
                        area=p.area * 10**10, # 这里的面积计算可能需要根据投影调整，暂时简化
                        geom_json={"type": "Feature", "geometry": mapping(p), "properties": {}},
                        grid_json=zone.grid_json,
                        style_json=zone.style_json,
                        meta_json=zone.meta_json
                    )
                    new_zones.append(TerrainZoneSerializer(new_zone).data)
                zone.is_deleted = True
                zone.save()
            return api_response(data=new_zones, msg="地块拆分成功")
        else:
            return api_response(data=[TerrainZoneSerializer(zone).data], msg="地块是连续的，无需拆分")
    except Exception as e:
        logger.error(f"拆分地块异常: {str(e)}")
        return api_error(msg=str(e), status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def merge_zones(request):
    """合并地块: 检查标记项是否一致"""
    try:
        zone_ids = request.data.get('ids', [])
        if len(zone_ids) < 2:
            return api_error(msg="请选择至少两个地块进行合并")
            
        zones = TerrainZone.objects.filter(id__in=zone_ids, is_deleted=False)
        if zones.count() < 2:
            return api_error(msg="部分地块不存在或已被删除")
            
        # 检查标记项是否一致 (简单通过名称和类型比对)
        first_elements = set(zones[0].elements.values_list('name', 'type'))
        for zone in zones[1:]:
            curr_elements = set(zone.elements.values_list('name', 'type'))
            if first_elements != curr_elements:
                return api_error(msg="所选地块的标记项不一致，无法合并")
                
        # 执行几何合并
        with transaction.atomic():
            combined_shape = None
            for zone in zones:
                geom_data = zone.geom_json.get('geometry', zone.geom_json)
                curr_shape = shape(geom_data)
                if combined_shape is None:
                    combined_shape = curr_shape
                else:
                    combined_shape = combined_shape.union(curr_shape)
            
            # 创建新地块
            main_zone = zones[0]
            new_zone = TerrainZone.objects.create(
                area_obj=main_zone.area_obj,
                name=f"{main_zone.name}_合并",
                category=main_zone.category,
                type=main_zone.type,
                risk_level=main_zone.risk_level,
                geom_json={"type": "Feature", "geometry": mapping(combined_shape), "properties": {}},
                grid_json=main_zone.grid_json,
                style_json=main_zone.style_json,
                meta_json=main_zone.meta_json
            )
            # 标记旧地块为删除
            zones.update(is_deleted=True)
            
        return api_response(data=TerrainZoneSerializer(new_zone).data, msg="地块合并成功")
    except Exception as e:
        logger.error(f"合并地块异常: {str(e)}")
        return api_error(msg=str(e), status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def boolean_subtract(request):
    """布尔运算: A 减去 B"""
    try:
        zone_a_id = request.data.get('zone_a_id')
        zone_b_id = request.data.get('zone_b_id')
        
        zone_a = get_object_or_404(TerrainZone, id=zone_a_id)
        zone_b = get_object_or_404(TerrainZone, id=zone_b_id)
        
        shape_a = shape(zone_a.geom_json.get('geometry', zone_a.geom_json))
        shape_b = shape(zone_b.geom_json.get('geometry', zone_b.geom_json))
        
        result_shape = shape_a.difference(shape_b)
        
        if result_shape.is_empty:
            return api_error(msg="运算结果为空")
            
        zone_a.geom_json = {"type": "Feature", "geometry": mapping(result_shape), "properties": {}}
        zone_a.save()
        
        return api_response(data=TerrainZoneSerializer(zone_a).data, msg="布尔减法执行成功")
    except Exception as e:
        logger.error(f"布尔运算异常: {str(e)}")
        return api_error(msg=str(e), status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def subcategory_list(request):
    """获取子类别列表及统计数据 (n/m)"""
    try:
        category = request.query_params.get('category')
        area_id = request.query_params.get('area_id')
        config = load_subcategory_config()
        
        # 获取所有子类别
        subcats = list(TerrainSubCategory.objects.filter(category=category).order_by('id'))
        config_items = config.get(category, [])
        config_name_set = {item["name"] for item in config_items}
        
        # 统计 m (全数据库数量 - count_db)
        total_counts = TerrainZone.objects.filter(category=category, is_deleted=False).values('type').annotate(count_db=Count('id'))
        m_map = {item['type']: item['count_db'] for item in total_counts if item['type']}
        
        # 统计 n (当前区域数量 - count_area)
        # 修复: 只有在 area_id 存在且为有效数字时才进行当前区域统计，否则默认为空
        n_map = {}
        if area_id and str(area_id).isdigit():
            current_counts = TerrainZone.objects.filter(category=category, area_obj_id=area_id, is_deleted=False).values('type').annotate(count_area=Count('id'))
            n_map = {item['type']: item['count_area'] for item in current_counts if item['type']}
        
        subcategories = []
        subcat_map = {sc.name: sc for sc in subcats}

        for item in config_items:
            sc = subcat_map.pop(item["name"], None)
            if not sc:
                continue

            subcategories.append({
                "id": sc.id,
                "name": sc.name,
                "description": item.get("description", ""),
                "is_default": sc.is_default,
                "count_area": n_map.get(sc.name, 0),
                "count_db": m_map.get(sc.name, 0)
            })

        for sc in subcats:
            if sc.name not in config_name_set:
                subcategories.append({
                    "id": sc.id,
                    "name": sc.name,
                    "description": "",
                    "is_default": sc.is_default,
                    "count_area": n_map.get(sc.name, 0),
                    "count_db": m_map.get(sc.name, 0)
                })
            
        return api_response(data={
            "category": category,
            "subcategories": subcategories
        })
    except Exception as e:
        return api_error(msg=str(e), status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def add_subcategory(request):
    """新增子类别"""
    try:
        category = request.data.get('category')
        name = request.data.get('name')
        description = request.data.get('description', '')
        if not category or not name:
            return api_error(msg="参数不完整")

        clean_name = str(name).strip()
        clean_description = str(description or '').strip()
        subcat, created = TerrainSubCategory.objects.get_or_create(
            category=category,
            name=clean_name,
            defaults={"is_default": True},
        )
        if not created and not subcat.is_default:
            subcat.is_default = True
            subcat.save(update_fields=["is_default"])

        upsert_subcategory_in_config(category, clean_name, clean_description)
        return api_response(data={
            **TerrainSubCategorySerializer(subcat).data,
            "description": clean_description,
        }, msg="子类别已新增")
    except Exception as e:
        return api_error(msg=str(e), status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def delete_subcategory(request):
    """删除子类别"""
    try:
        subcat_id = request.data.get('id')
        subcat = get_object_or_404(TerrainSubCategory, id=subcat_id)

        # 业务规则检查：是否有地块正在使用此子类别
        # 我们在地块中存储的是 sub_type (字符串名称)，而不是外键，所以需要查名称
        usage_count = TerrainZone.objects.filter(category=subcat.category, type=subcat.name, is_deleted=False).count()
        if usage_count > 0:
            return api_error(msg=f"无法删除：当前有 {usage_count} 个地块正使用该子类别。请先修改这些地块的分类。")

        remove_subcategory_from_config(subcat.category, subcat.name)
        subcat.delete()
        return api_response(msg="子类别已删除")
    except Exception as e:
        return api_error(msg=str(e), status=500)

# --- 为了兼容旧代码的占位符 (如果需要) ---
def create_plot(request): return create_or_update_zone(request)
def list_plots(request): 
    # 临时兼容
    queryset = TerrainZone.objects.filter(is_deleted=False)
    area_id = request.GET.get('area_id')
    if area_id and str(area_id).isdigit():
        queryset = queryset.filter(area_obj_id=area_id)
    serializer = TerrainZoneSerializer(queryset, many=True)
    return api_response(data=serializer.data)
def plot_detail(request, pk):
    zone = get_object_or_404(TerrainZone, pk=pk, is_deleted=False)
    return api_response(data=TerrainZoneSerializer(zone).data)
def update_plot(request, pk):
    request.data['id'] = pk
    return create_or_update_zone(request)
