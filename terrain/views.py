import logging
import traceback
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path
from django.core.paginator import Paginator
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.db import transaction
from django.db.models import Case, Count, IntegerField, When
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from shapely.geometry import shape, mapping, MultiPolygon, Polygon
from shapely.ops import unary_union
from tasking.models import GlobalTask
from fleet.models import Drone
from .models import TerrainArea, TerrainZone, TerrainElement, TerrainSubCategory, SurveyShift
from .serializers import (
    GeoJSONCompatibilityMixin, TerrainAreaSerializer, TerrainZoneSerializer, TerrainAreaPlotSerializer,
    TerrainElementSerializer, TerrainSubCategorySerializer
)
from .services import (
    attach_terrain_risk,
    get_risk_level_display,
    normalize_risk_level,
    sync_terrain_risk_fields,
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

PLOT_TYPE_LABELS = {
    "forest": "林区",
    "farmland": "农田",
    "building": "建筑",
    "water": "水域",
    "road": "道路",
    "bare_land": "裸地",
}

PLOT_TYPE_ALIASES = {
    "forest": "forest",
    "林区": "forest",
    "farmland": "farmland",
    "农田": "farmland",
    "building": "building",
    "建筑": "building",
    "water": "water",
    "水域": "water",
    "road": "road",
    "道路": "road",
    "bare_land": "bare_land",
    "bare": "bare_land",
    "裸地": "bare_land",
    "open": "bare_land",
    "open_land": "bare_land",
    "empty_land": "bare_land",
    "unused_land": "bare_land",
    "空地": "bare_land",
    "开敞地": "bare_land",
}

RISK_LEVEL_LABELS = {
    "low": "低风险",
    "medium": "中风险",
    "high": "高风险",
    "none": "未评估",
}

TASK_STATUS_LABELS = {
    "pending": "未开始",
    "created": "未开始",
    "queued": "未开始",
    "running": "进行中",
    "in_progress": "进行中",
    "processing": "进行中",
    "completed": "已完成",
    "done": "已完成",
    "finished": "已完成",
    "success": "已完成",
    "failed": "异常",
    "error": "异常",
    "cancelled": "已取消",
}

TASK_SCENE_LABELS = {
    "forest": "林业区域",
    "agri": "农业区域",
    "mixed": "综合区域",
}


def _parse_positive_int(value, default, *, minimum=1, maximum=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = default
    if number < minimum:
        number = minimum
    if maximum is not None:
        number = min(number, maximum)
    return number


def _format_datetime_label(value):
    if not value:
        return ""
    dt_value = value
    if timezone.is_aware(dt_value):
        dt_value = timezone.localtime(dt_value)
    return dt_value.strftime("%Y-%m-%d %H:%M")


def _build_pagination_payload(page_obj):
    return {
        "page": page_obj.number,
        "page_size": page_obj.paginator.per_page,
        "total": page_obj.paginator.count,
        "total_pages": page_obj.paginator.num_pages,
        "has_previous": page_obj.has_previous(),
        "has_next": page_obj.has_next(),
    }


def _paginate_queryset(queryset_or_items, page, page_size):
    paginator = Paginator(queryset_or_items, page_size)
    page_obj = paginator.get_page(page)
    return page_obj, _build_pagination_payload(page_obj)


def _get_zone_area_ha(zone):
    try:
        return round(float(getattr(zone, "area", 0) or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _serialize_risk_zone(zone):
    area_ha = _get_zone_area_ha(zone)
    risk_level = normalize_risk_level(getattr(zone, "risk_level", None))
    return {
        "id": zone.id,
        "terrain_id": getattr(zone, "area_obj_id", None),
        "terrain_name": getattr(getattr(zone, "area_obj", None), "name", "") or "未绑定地形",
        "plot_name": getattr(zone, "name", "") or f"地块 {zone.id}",
        "risk_level": risk_level,
        "risk_level_label": get_risk_level_display(risk_level),
        "area_ha": area_ha,
        "area_label": f"{area_ha:.2f} 公顷" if area_ha > 0 else "-",
        "updated_at": zone.updated_at.isoformat() if getattr(zone, "updated_at", None) else None,
        "updated_at_label": _format_datetime_label(getattr(zone, "updated_at", None)),
        "description": getattr(zone, "description", "") or "",
        "detail_text": (
            getattr(zone, "description", "") or
            f"{getattr(getattr(zone, 'area_obj', None), 'name', '未绑定地形')} / "
            f"{RISK_LEVEL_LABELS.get(risk_level, '未评估')} / "
            f"{area_ha:.2f} 公顷"
        ),
    }


def _match_task_terrain_name(task, terrain_names):
    combined_text = " ".join(
        [
            str(getattr(task, "task_name", "") or ""),
            str(getattr(task, "description", "") or ""),
        ]
    ).strip().lower()
    if combined_text:
        for terrain_name in terrain_names:
            if terrain_name.lower() in combined_text:
                return terrain_name
    return TASK_SCENE_LABELS.get(getattr(task, "scene_type", ""), "未绑定地形")


def _serialize_survey_task(task, terrain_names):
    raw_status = str(getattr(task, "status", "") or "pending").strip().lower()
    status_label = TASK_STATUS_LABELS.get(raw_status, "未开始")
    
    # 获取班次信息
    shifts = SurveyShift.objects.filter(task_id=task.id).order_by("start_time")
    serialized_shifts = []
    for s in shifts:
        serialized_shifts.append({
            "id": s.id,
            "drone_id": s.drone_id,
            "drone_name": s.drone_name,
            "start_time": s.start_time.isoformat(),
            "end_time": s.end_time.isoformat(),
            "start_time_label": _format_datetime_label(s.start_time),
            "end_time_label": _format_datetime_label(s.end_time),
            "status": s.status,
        })

    return {
        "id": task.id,
        "terrain_name": _match_task_terrain_name(task, terrain_names),
        "task_name": getattr(task, "task_name", "") or getattr(task, "task_code", "") or f"任务 {task.id}",
        "status": raw_status,
        "status_label": status_label,
        "updated_at": task.updated_at.isoformat() if getattr(task, "updated_at", None) else None,
        "updated_at_label": _format_datetime_label(getattr(task, "updated_at", None)),
        "planned_start": task.planned_start.isoformat() if getattr(task, "planned_start", None) else None,
        "planned_end": task.planned_end.isoformat() if getattr(task, "planned_end", None) else None,
        "planned_start_label": _format_datetime_label(getattr(task, "planned_start", None)),
        "planned_end_label": _format_datetime_label(getattr(task, "planned_end", None)),
        "description": getattr(task, "description", "") or "",
        "detail_url": f"/tasking/detail/?task_id={task.id}",
        "api_detail_url": f"/api/tasking/global-tasks/{task.id}/",
        "scene_type": getattr(task, "scene_type", "") or "mixed",
        "scene_label": TASK_SCENE_LABELS.get(getattr(task, "scene_type", ""), "综合区域"),
        "shifts": serialized_shifts,
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
    if for_storage and normalized == "bare_land":
        return "bare"
    return normalized


def get_plot_type_label(type_key):
    normalized = normalize_plot_type_key(type_key) or ""
    return PLOT_TYPE_LABELS.get(normalized, normalized)


def _parse_json_payload(value, default=None):
    current = value
    for _ in range(3):
        if not isinstance(current, str):
            break
        try:
            current = json.loads(current)
        except json.JSONDecodeError:
            return default
    return current if current is not None else default


def normalize_plot_geometry(geometry, properties=None):
    parsed_geometry = _parse_json_payload(geometry, default=geometry)
    if not isinstance(parsed_geometry, dict):
        return None

    feature_properties = {}
    if parsed_geometry.get("type") == "Feature":
        feature_properties = parsed_geometry.get("properties") or {}
        parsed_geometry = {
            "type": "Feature",
            "geometry": parsed_geometry.get("geometry") or {},
            "properties": feature_properties,
        }
    elif parsed_geometry.get("type") in {"Polygon", "MultiPolygon"}:
        parsed_geometry = {
            "type": "Feature",
            "geometry": parsed_geometry,
            "properties": {},
        }
    else:
        return None

    merged_properties = {}
    if isinstance(feature_properties, dict):
        merged_properties.update(feature_properties)
    if isinstance(properties, dict):
        merged_properties.update({key: value for key, value in properties.items() if value not in (None, "")})
    parsed_geometry["properties"] = merged_properties
    return parsed_geometry


def normalize_plot_item(raw_plot):
    if not isinstance(raw_plot, dict):
        return None

    name = (
        raw_plot.get("name")
        or raw_plot.get("地块名称")
        or raw_plot.get("plot_name")
        or ""
    ).strip()
    if not name:
        return None

    raw_type = (
        raw_plot.get("type")
        or raw_plot.get("地块类型")
        or raw_plot.get("plot_type")
        or raw_plot.get("category")
        or raw_plot.get("type_label")
        or raw_plot.get("类型名称")
    )
    normalized_type = normalize_plot_type_key(raw_type)
    if not normalized_type:
        return None

    type_label = get_plot_type_label(
        raw_plot.get("type_label")
        or raw_plot.get("类型名称")
        or normalized_type
    )
    subtype = (
        raw_plot.get("subtype")
        or raw_plot.get("sub_type")
        or raw_plot.get("子类别")
        or raw_plot.get("子类别名称")
        or ""
    )
    subtype_label = (
        raw_plot.get("subtype_label")
        or raw_plot.get("sub_type_label")
        or raw_plot.get("子类别名称")
        or raw_plot.get("subcategory_name")
        or subtype
        or ""
    )

    geometry = normalize_plot_geometry(
        raw_plot.get("geometry")
        or raw_plot.get("边界数据")
        or raw_plot.get("geom_json")
        or raw_plot.get("boundary_geojson")
        or raw_plot.get("boundary_json"),
        properties={
            "name": name,
            "type": normalized_type,
            "type_label": type_label,
            "subtype": subtype,
            "subtype_label": subtype_label,
        },
    )
    if not geometry:
        return None

    area = raw_plot.get("area") or raw_plot.get("面积") or 0
    try:
        area = round(float(area), 4) if area not in ("", None) else 0
    except (TypeError, ValueError):
        area = 0

    return {
        "id": raw_plot.get("id"),
        "name": name,
        "type": normalized_type,
        "type_label": type_label,
        "subtype": str(subtype or "").strip(),
        "subtype_label": str(subtype_label or "").strip(),
        "area": area,
        "geometry": geometry,
    }


def normalize_plots_payload(raw_plots):
    parsed_plots = _parse_json_payload(raw_plots, default=raw_plots)
    if isinstance(parsed_plots, dict):
        if parsed_plots.get("type") == "FeatureCollection":
            parsed_plots = [
                {
                    **(feature.get("properties") or {}),
                    "geometry": feature,
                }
                for feature in parsed_plots.get("features", [])
                if isinstance(feature, dict)
            ]
        elif parsed_plots.get("type") == "Feature":
            parsed_plots = [{
                **(parsed_plots.get("properties") or {}),
                "geometry": parsed_plots,
            }]
    if not isinstance(parsed_plots, list):
        return []

    normalized_plots = []
    for raw_plot in parsed_plots:
        normalized_plot = normalize_plot_item(raw_plot)
        if normalized_plot:
            normalized_plots.append(normalized_plot)
    return normalized_plots


def sync_area_plots(area, plots, risk_level="low"):
    existing_zones = list(
        TerrainZone.objects.filter(area_obj=area, is_deleted=False).order_by("id")
    )
    existing_by_id = {str(zone.id): zone for zone in existing_zones}
    existing_by_signature = {}
    for zone in existing_zones:
        signature = (
            str(zone.name or "").strip(),
            str(zone.category or "").strip(),
            str(zone.type or "").strip(),
        )
        existing_by_signature.setdefault(signature, []).append(zone)

    saved_plots = []
    for plot in plots:
        storage_category = normalize_plot_type_key(plot.get("type"), for_storage=True)
        if not storage_category:
            raise ValueError(f"地块[{plot.get('name') or '未命名'}]类型无效")

        zone = None
        plot_id = plot.get("id")
        if plot_id is not None:
            zone = existing_by_id.get(str(plot_id))
        if zone is None:
            signature = (
                str(plot.get("name") or "").strip(),
                storage_category,
                str(plot.get("subtype") or "").strip(),
            )
            candidates = existing_by_signature.get(signature) or []
            zone = candidates.pop(0) if candidates else None

        payload = {
            "area_obj": area.id,
            "name": plot.get("name") or "未命名地块",
            "category": storage_category,
            "type": plot.get("subtype") or "",
            "risk_level": risk_level or "low",
            "area": plot.get("area") or 0,
            "geom_json": plot.get("geometry") or {},
            "grid_json": getattr(zone, "grid_json", {}) if zone else {},
            "style_json": {
                **(_parse_json_payload(getattr(zone, "style_json", None), default={}) if zone else {}),
                "fill_color": {
                    "forest": "#2ecc71",
                    "farmland": "#f39c12",
                    "building": "#475569",
                    "water": "#3498db",
                    "road": "#9CA3AF",
                    "bare": "#D97706",
                }.get(storage_category, "#64748b"),
                "visible": True,
                "layer_name": plot.get("name") or "未命名地块",
            },
            "meta_json": {
                **(_parse_json_payload(getattr(zone, "meta_json", None), default={}) if zone else {}),
                "type": normalize_plot_type_key(plot.get("type")) or "",
                "type_label": plot.get("type_label") or get_plot_type_label(plot.get("type")),
                "subtype": str(plot.get("subtype") or "").strip(),
                "subtype_label": plot.get("subtype_label") or plot.get("subtype") or "",
                "standard_type": normalize_plot_type_key(plot.get("type")) or "",
                "standard_type_label": get_plot_type_label(plot.get("type")),
                "area": plot.get("area") or 0,
            },
        }

        serializer = TerrainZoneSerializer(zone, data=payload, partial=bool(zone)) if zone else TerrainZoneSerializer(data=payload)
        if not serializer.is_valid():
            raise ValueError(f"地块[{payload['name']}]保存失败: {serializer.errors}")
        saved_plots.append(serializer.save())

    return saved_plots


def _get_zone_normalized_geometry(zone):
    normalized_geojson = SPATIAL_COMPAT._normalize_geojson(getattr(zone, "geom_json", None))
    geometry = SPATIAL_COMPAT._geometry_from_geojson(normalized_geojson)
    return normalized_geojson, geometry


def build_area_spatial_from_active_plots(area, active_plots=None):
    """同步当前有效地块到区域对象，但不反向覆盖 TerrainArea 的面积与边界。"""
    plots = list(active_plots) if active_plots is not None else list(get_area_active_plots(area))

    existing_boundary_geojson = SPATIAL_COMPAT._normalize_geojson(getattr(area, "boundary_json", None))
    existing_boundary_geometry = SPATIAL_COMPAT._geometry_from_geojson(existing_boundary_geojson)
    geometries = []

    for zone in plots:
        _normalized_geojson, geometry = _get_zone_normalized_geometry(zone)
        if geometry and not geometry.is_empty:
            geometries.append(geometry)

    merged_geometry = unary_union(geometries) if geometries else None
    plot_bbox = (
        merged_geometry.bounds
        if merged_geometry and not merged_geometry.is_empty
        else None
    )
    boundary_bbox = (
        existing_boundary_geometry.bounds
        if existing_boundary_geometry and not existing_boundary_geometry.is_empty
        else None
    )

    area.active_zones = plots
    area.plot_count = len(plots)
    area._active_plot_bbox = boundary_bbox or plot_bbox

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
            
            # 3. 解除无人机绑定 (不删除无人机)
            Drone.objects.filter(terrain_id=terrain.id).update(terrain_id=0)
            
        return api_response(msg="地形及其关联地块已成功删除，相关无人机已解除绑定", data={"terrain_id": pk})
    except Exception as e:
        logger.error(f"删除地形异常: {str(e)}")
        return api_error(msg=f"删除失败: {str(e)}", status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def list_areas(request):
    """区域列表接口"""
    try:
        page = _parse_positive_int(request.GET.get("page"), 1)
        page_size = _parse_positive_int(request.GET.get("page_size"), 20, maximum=100)
        
        queryset = (
            TerrainArea.objects.filter(is_deleted=False)
            .annotate(plot_count=Count('zones', distinct=True))
            .order_by('-updated_at', '-id')
        )
        
        page_obj, pagination = _paginate_queryset(queryset, page, page_size)
        items = list(page_obj.object_list)
        
        for area in items:
            active_plots = get_area_active_plots(area)
            build_area_spatial_from_active_plots(area, active_plots=active_plots)
            attach_terrain_risk(area, sync_terrain_risk_fields(area, save=False, plots=active_plots))

        serializer = TerrainAreaSerializer(
            items,
            many=True,
            context={'exclude_status_fields': True}
        )
        return api_response(data={
            "items": serializer.data,
            "pagination": pagination
        })
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
        terrain_risk = sync_terrain_risk_fields(area, save=False, plots=zones)
        attach_terrain_risk(area, terrain_risk)

        area_serializer = TerrainAreaSerializer(area)
        zones_serializer = TerrainZoneSerializer(zones, many=True)

        response_data = {
            "area": area_serializer.data,
            "zones": zones_serializer.data,
            "plots": area_serializer.data.get("plots", []),
            "terrain_risk": terrain_risk,
            "editor_payload": {
                "area": area_serializer.data,
                "zones": zones_serializer.data,
                "plots": area_serializer.data.get("plots", []),
                "terrain_risk": terrain_risk,
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


@api_view(['GET'])
@permission_classes([AllowAny])
def terrain_risk_area_list(request):
    """底部模块: 风险区域列表"""
    try:
        page = _parse_positive_int(request.GET.get("page"), 1)
        page_size = _parse_positive_int(request.GET.get("page_size"), 10, maximum=50)
        queryset = (
            TerrainZone.objects.select_related("area_obj")
            .filter(
                is_deleted=False,
                area_obj__is_deleted=False,
                risk_level__in=["high", "medium"],
            )
            .annotate(
                risk_sort=Case(
                    When(risk_level="high", then=0),
                    When(risk_level="medium", then=1),
                    default=2,
                    output_field=IntegerField(),
                )
            )
            .order_by("risk_sort", "-updated_at", "-id")
        )
        page_obj, pagination = _paginate_queryset(queryset, page, page_size)
        items = [_serialize_risk_zone(zone) for zone in page_obj.object_list]
        return api_response(
            data={
                "items": items,
                "pagination": pagination,
                "refreshed_at": timezone.now().isoformat(),
            }
        )
    except Exception as e:
        logger.error("获取风险区域列表异常: %s", str(e))
        return api_error(msg=str(e), status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
def terrain_survey_record_list(request):
    """底部模块: 最近测绘记录"""
    try:
        page = _parse_positive_int(request.GET.get("page"), 1)
        page_size = _parse_positive_int(request.GET.get("page_size"), 10, maximum=50)
        terrain_names = list(
            TerrainArea.objects.filter(is_deleted=False)
            .order_by("-updated_at", "-id")
            .values_list("name", flat=True)
        )
        terrain_names.sort(key=len, reverse=True)
        queryset = GlobalTask.objects.all().order_by("-updated_at", "-id")
        page_obj, pagination = _paginate_queryset(queryset, page, page_size)
        items = [_serialize_survey_task(task, terrain_names) for task in page_obj.object_list]
        return api_response(
            data={
                "items": items,
                "pagination": pagination,
                "refreshed_at": timezone.now().isoformat(),
            }
        )
    except Exception as e:
        logger.error("获取测绘记录列表异常: %s", str(e))
        return api_error(msg=str(e), status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
def terrain_risk_analysis(request):
    """底部模块: 风险等级统计分析"""
    try:
        active_zones = list(
            TerrainZone.objects.filter(
                is_deleted=False,
                area_obj__is_deleted=False,
            ).only("risk_level")
        )
        counts = {"low": 0, "medium": 0, "high": 0}
        for zone in active_zones:
            risk_level = str(getattr(zone, "risk_level", "") or "low")
            if risk_level not in counts:
                counts[risk_level] = 0
            counts[risk_level] += 1

        items = [
            {
                "risk_level": risk_level,
                "risk_level_label": RISK_LEVEL_LABELS[risk_level],
                "count": counts.get(risk_level, 0),
            }
            for risk_level in ("low", "medium", "high")
        ]
        return api_response(
            data={
                "items": items,
                "counts": counts,
                "total": sum(counts.values()),
                "refreshed_at": timezone.now().isoformat(),
            }
        )
    except Exception as e:
        logger.error("获取风险分析数据异常: %s", str(e))
        return api_error(msg=str(e), status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def execute_survey_task(request):
    """执行测绘任务：创建任务并自动分配班次"""
    try:
        data = request.data
        terrain_id = data.get('terrain_id')
        task_name = data.get('task_name')
        description = data.get('description', '')
        
        terrain = get_object_or_404(TerrainArea, id=terrain_id, is_deleted=False)
        drone = Drone.objects.filter(terrain_id=terrain.id).first()
        
        if not drone:
            return api_error(msg="该地形尚未绑定无人机，请先绑定无人机后再执行任务")
            
        # 创建全局任务
        task_code = f"SURVEY-{timezone.now().strftime('%Y%m%d%H%M%S')}-{terrain.id}"
        now = timezone.now()
        task = GlobalTask.objects.create(
            task_code=task_code,
            task_name=task_name or f"{terrain.name}测绘任务",
            scene_type="mixed",
            status="pending",
            description=description,
            planned_start=now,
            planned_end=now + timezone.timedelta(hours=4) # 默认4小时
        )
        
        # 自动计算班次 (多班次逻辑)
        # 假设每次飞行 1.5 小时，间隔 30 分钟充电
        flight_duration = 1.5
        rest_duration = 0.5
        total_shifts = 2 # 演示用，固定2个班次
        
        for i in range(total_shifts):
            shift_start = now + timezone.timedelta(hours=(flight_duration + rest_duration) * i)
            shift_end = shift_start + timezone.timedelta(hours=flight_duration)
            SurveyShift.objects.create(
                task_id=task.id,
                drone_id=drone.id,
                drone_name=drone.drone_name,
                start_time=shift_start,
                end_time=shift_end,
                status="pending"
            )
            
        return api_response(data={
            "task_id": task.id,
            "task_code": task_code,
            "shifts_count": total_shifts
        }, msg="测绘任务创建成功")
    except Exception as e:
        logger.error(f"创建测绘任务异常: {str(e)}")
        return api_error(msg=str(e), status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_available_drones(request):
    """获取可用于绑定的无人机列表"""
    try:
        # 返回未绑定或已绑定到当前地形的无人机
        terrain_id = request.GET.get('terrain_id')
        if terrain_id:
            queryset = Drone.objects.filter(models.Q(terrain_id=0) | models.Q(terrain_id=terrain_id))
        else:
            queryset = Drone.objects.filter(terrain_id=0)
            
        data = [
            {
                "id": d.id,
                "drone_code": d.drone_code,
                "drone_name": d.drone_name,
                "model_name": d.model_name,
                "terrain_id": d.terrain_id
            }
            for d in queryset
        ]
        return api_response(data=data)
    except Exception as e:
        logger.error(f"获取无人机列表异常: {str(e)}")
        return api_error(msg=str(e), status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def unbind_drone(request):
    """解除无人机绑定"""
    try:
        drone_id = request.data.get('drone_id')
        Drone.objects.filter(id=drone_id).update(terrain_id=0)
        return api_response(msg="解除绑定成功")
    except Exception as e:
        logger.error(f"解除绑定异常: {str(e)}")
        return api_error(msg=str(e), status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def import_template(request):
    """下载地形批量导入模板"""
    template = [
        {
            "name": "示例地形区域",
            "risk_level": "low",
            "area": 77.8,
            "accuracy": 98,
            "description": "示例导入数据",
            "bounds": {
                "south_west": [106.09, 29.09],
                "north_east": [106.11, 29.11]
            },
            "geometry": {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [106.09, 29.09],
                            [106.11, 29.09],
                            [106.11, 29.11],
                            [106.09, 29.11],
                            [106.09, 29.09]
                        ]
                    ]
                },
                "properties": {}
            },
            "plots": [
                {
                    "name": "示例农田地块",
                    "type": "farmland",
                    "type_label": "农田",
                    "subtype": "dry_field",
                    "subtype_label": "旱地",
                    "area": 35.2,
                    "geometry": {
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [
                                [
                                    [106.0914, 29.0914],
                                    [106.0988, 29.0914],
                                    [106.0988, 29.1086],
                                    [106.0914, 29.1086],
                                    [106.0914, 29.0914]
                                ]
                            ]
                        },
                        "properties": {
                            "name": "示例农田地块",
                            "type": "farmland",
                            "type_label": "农田",
                            "subtype": "dry_field",
                            "subtype_label": "旱地"
                        }
                    }
                },
                {
                    "name": "示例林区地块",
                    "type": "forest",
                    "type_label": "林区",
                    "subtype": "mixed_forest",
                    "subtype_label": "混交林",
                    "area": 42.6,
                    "geometry": {
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [
                                [
                                    [106.0996, 29.0914],
                                    [106.1086, 29.0914],
                                    [106.1086, 29.1086],
                                    [106.0996, 29.1086],
                                    [106.0996, 29.0914]
                                ]
                            ]
                        },
                        "properties": {
                            "name": "示例林区地块",
                            "type": "forest",
                            "type_label": "林区",
                            "subtype": "mixed_forest",
                            "subtype_label": "混交林"
                        }
                    }
                }
            ]
        }
    ]
    return JsonResponse(template, safe=False, json_dumps_params={'ensure_ascii': False, 'indent': 2})

def normalize_import_item(item):
    """将导入数据标准化为统一的结构"""
    normalized = {}
    
    # id
    normalized['id'] = item.get('id') or item.get('地形 ID')
    
    # name
    normalized['name'] = item.get('name') or item.get('地形名称') or item.get('terrain_name') or ''
    
    # risk_level
    raw_risk = item.get('risk_level') or item.get('风险等级') or 'low'
    risk_map = {
        '低风险': 'low',
        '中风险': 'medium',
        '高风险': 'high',
        '低': 'low',
        '中': 'medium',
        '高': 'high'
    }
    normalized['risk_level'] = risk_map.get(raw_risk, raw_risk if raw_risk in ['low', 'medium', 'high'] else 'low')
    
    # area
    normalized['area'] = item.get('area') or item.get('面积(公顷)') or 0
    
    # accuracy
    raw_acc = item.get('accuracy') or item.get('data_accuracy') or item.get('数据精度')
    if isinstance(raw_acc, str) and '%' in raw_acc:
        try:
            normalized['accuracy'] = float(raw_acc.replace('%', '').strip())
        except ValueError:
            normalized['accuracy'] = 0
    else:
        try:
            normalized['accuracy'] = float(raw_acc) if raw_acc is not None else 0
        except ValueError:
            normalized['accuracy'] = 0
            
    # description
    normalized['description'] = item.get('description') or item.get('描述') or ''
    
    # geometry
    geom = item.get('geometry') or item.get('boundary') or item.get('边界数据') or item.get('boundary_json')
    if isinstance(geom, str):
        try:
            geom = json.loads(geom)
        except Exception:
            pass
    if isinstance(geom, dict):
        geo_type = geom.get('type')
        if geo_type in ['Polygon', 'MultiPolygon']:
            geom = {
                "type": "Feature",
                "geometry": geom,
                "properties": {}
            }
    normalized['geometry'] = geom
    
    # plots
    plots = (
        item.get('plots')
        or item.get('地块数据')
        or item.get('blocks')
        or item.get('layers')
        or item.get('features')
        or item.get('plot_data')
        or []
    )
    normalized['plots'] = normalize_plots_payload(plots)
    
    # bounds
    bounds = item.get('bounds')
    if not bounds:
        sw_coord = item.get('左下角坐标')
        ne_coord = item.get('右上角坐标')
        if sw_coord and ne_coord:
            try:
                min_lng, min_lat = map(float, sw_coord.split(','))
                max_lng, max_lat = map(float, ne_coord.split(','))
                bounds = {
                    "south_west": [min_lng, min_lat],
                    "north_east": [max_lng, max_lat]
                }
            except Exception:
                pass
                
    if not bounds and geom and isinstance(geom, dict):
        try:
            from shapely.geometry import shape
            geom_obj = None
            if geom.get('type') == 'Feature':
                geom_obj = shape(geom.get('geometry', {}))
            else:
                geom_obj = shape(geom)
            if geom_obj and not geom_obj.is_empty:
                minx, miny, maxx, maxy = geom_obj.bounds
                bounds = {
                    "south_west": [minx, miny],
                    "north_east": [maxx, maxy]
                }
        except Exception:
            pass
            
    normalized['bounds'] = bounds or None
    
    return normalized

def build_area_payload(item, area_val, geom_json, center_lat, center_lng, is_update=False):
    """构建用于创建/更新的 TerrainArea 字典数据，清理不支持的字段"""
    payload = {
        "name": item.get("name") or item.get("terrain_name") or "",
        "risk_level": item.get("risk_level") or "low",
        "description": item.get("description") or "",
        "area": area_val,
        # geometry、bounds、plots 等字段在此处处理为对应模型字段或忽略
        # 模型中存在 boundary_json, center_lat, center_lng 字段，予以映射保存
        # accuracy 不存在于模型，因此直接忽略，不传入 payload
    }
    
    if geom_json:
        payload["boundary_json"] = geom_json
    elif not is_update:
        payload["boundary_json"] = {}
        
    if center_lat is not None:
        payload["center_lat"] = center_lat
    if center_lng is not None:
        payload["center_lng"] = center_lng
        
    return payload

@api_view(['POST'])
@permission_classes([AllowAny])
def import_areas(request):
    """批量导入地形区域"""
    try:
        if 'file' not in request.FILES:
            return api_error(msg="缺少 file 字段")
        
        uploaded_file = request.FILES['file']
        filename = uploaded_file.name.lower()
        
        data_list = []
        if filename.endswith('.json') or filename.endswith('.geojson'):
            try:
                content = uploaded_file.read().decode('utf-8')
                parsed_data = json.loads(content)
                if (
                    isinstance(parsed_data, dict)
                    and parsed_data.get('type') == 'FeatureCollection'
                    and 'features' in parsed_data
                ):
                    # GeoJSON FeatureCollection
                    for feature in parsed_data['features']:
                        props = feature.get('properties', {})
                        geom = feature.get('geometry') or feature.get('boundary') or feature.get('geojson')
                        item = {
                            'id': props.get('id'),
                            'name': props.get('name', ''),
                            'risk_level': props.get('risk_level', 'low'),
                            'area': props.get('area'),
                            'description': props.get('description', ''),
                            'geometry': geom,
                            'bounds': props.get('bounds'),
                            'plots': props.get('plots') or props.get('地块数据') or []
                        }
                        data_list.append(item)
                elif isinstance(parsed_data, list):
                    data_list = parsed_data
                else:
                    data_list = [parsed_data]
            except json.JSONDecodeError:
                return api_error(msg="JSON 解析失败，请检查文件格式")
        elif filename.endswith('.csv'):
            import csv
            import io
            content = uploaded_file.read().decode('utf-8')
            reader = csv.DictReader(io.StringIO(content))
            for row in reader:
                item = {
                    'id': row.get('id'),
                    'name': row.get('name', ''),
                    'risk_level': row.get('risk_level', 'low'),
                    'area': row.get('area'),
                    'description': row.get('description', ''),
                }
                
                min_lng = row.get('min_lng')
                min_lat = row.get('min_lat')
                max_lng = row.get('max_lng')
                max_lat = row.get('max_lat')
                
                if min_lng and min_lat and max_lng and max_lat:
                    try:
                        item['geometry'] = {
                            "type": "Polygon",
                            "coordinates": [[
                                [float(min_lng), float(min_lat)],
                                [float(max_lng), float(min_lat)],
                                [float(max_lng), float(max_lat)],
                                [float(min_lng), float(max_lat)],
                                [float(min_lng), float(min_lat)]
                            ]]
                        }
                    except ValueError:
                        pass
                data_list.append(item)
        else:
            return api_error(msg="不支持的文件格式，仅支持 .json, .geojson, .csv")

        result = {
            "success": True,
            "message": "批量导入成功",
            "created": 0,
            "updated": 0,
            "failed": 0,
            "errors": [],
            "warnings": [],
        }
        
        with transaction.atomic():
            for idx, raw_item in enumerate(data_list):
                row_num = idx + 1
                try:
                    with transaction.atomic():
                        item = normalize_import_item(raw_item)

                        name = item.get('name', '').strip()
                        if not name:
                            raise ValueError(f"第 {row_num} 行缺少地形名称")

                        area_id = item.get('id')
                        geometry = item.get('geometry')
                        bounds = item.get('bounds')
                        plots = item.get("plots") or raw_item.get("plots") or raw_item.get("地块数据") or []
                        plots = normalize_plots_payload(plots)

                        if not geometry and isinstance(bounds, dict):
                            sw = bounds.get('south_west') or bounds.get('southWest')
                            ne = bounds.get('north_east') or bounds.get('northEast')
                            if isinstance(sw, list) and isinstance(ne, list) and len(sw) == 2 and len(ne) == 2:
                                min_lng, min_lat = sw[0], sw[1]
                                max_lng, max_lat = ne[0], ne[1]
                                if all(v is not None for v in (min_lng, min_lat, max_lng, max_lat)):
                                    try:
                                        geometry = {
                                            "type": "Feature",
                                            "geometry": {
                                                "type": "Polygon",
                                                "coordinates": [[
                                                    [float(min_lng), float(min_lat)],
                                                    [float(max_lng), float(min_lat)],
                                                    [float(max_lng), float(max_lat)],
                                                    [float(min_lng), float(max_lat)],
                                                    [float(min_lng), float(min_lat)]
                                                ]]
                                            },
                                            "properties": {}
                                        }
                                    except ValueError:
                                        pass

                        geom_json = None
                        area_ha = item.get('area')
                        center_lat = None
                        center_lng = None

                        if geometry:
                            geom_json = geometry
                            try:
                                geom_obj = SPATIAL_COMPAT._geometry_from_geojson(geom_json)
                                if geom_obj and not geom_obj.is_empty:
                                    if not area_ha:
                                        calc_area = SPATIAL_COMPAT._calculate_area_ha(geom_obj)
                                        if calc_area:
                                            area_ha = calc_area
                                    centroid = geom_obj.centroid
                                    center_lat = SPATIAL_COMPAT._coerce_float(getattr(centroid, "y", None))
                                    center_lng = SPATIAL_COMPAT._coerce_float(getattr(centroid, "x", None))
                            except Exception:
                                pass

                        try:
                            area_val = Decimal(str(round(float(area_ha), 2))) if area_ha else Decimal('0.00')
                        except (TypeError, ValueError, InvalidOperation):
                            area_val = Decimal('0.00')

                        terrain = None
                        is_update = False
                        if area_id:
                            terrain = TerrainArea.objects.filter(id=area_id, is_deleted=False).first()
                        if not terrain:
                            terrain = TerrainArea.objects.filter(name=name, is_deleted=False).first()
                        if terrain:
                            is_update = True

                        payload = {
                            "name": name,
                            "type": getattr(terrain, "type", None) or "farm",
                            "risk_level": item.get("risk_level") or "low",
                            "description": item.get("description") or "",
                            "area": area_val,
                        }

                        if geom_json:
                            payload["boundary_json"] = geom_json
                        elif not is_update:
                            payload["boundary_json"] = {}

                        if center_lat is not None:
                            payload["center_lat"] = center_lat
                        if center_lng is not None:
                            payload["center_lng"] = center_lng

                        if is_update:
                            for key, value in payload.items():
                                setattr(terrain, key, value)
                            terrain.save()
                            result['updated'] += 1
                        else:
                            terrain = TerrainArea.objects.create(**payload)
                            result['created'] += 1

                        if hasattr(terrain, "zones"):
                            saved_plots = sync_area_plots(
                                terrain,
                                plots,
                                risk_level=item.get("risk_level") or "low",
                            )
                            terrain.active_zones = saved_plots
                            terrain.plot_count = len(saved_plots)
                            sync_terrain_risk_fields(terrain, save=True, plots=saved_plots)
                        elif plots:
                            result["warnings"].append("当前模型未配置地块保存字段，plots 已跳过")

                except Exception as row_error:
                    result['failed'] += 1
                    result['errors'].append(str(row_error))

        if result['failed'] > 0 and result['created'] == 0 and result['updated'] == 0:
            result['success'] = False
            result['message'] = "导入失败"
            # Return HTTP 200 with success=False JSON structure to let frontend handle errors
            return JsonResponse(result)
            
        return JsonResponse(result)
        
    except Exception as e:
        logger.error(f"批量导入异常: {str(e)}\n{traceback.format_exc()}")
        error_msg = str(e)
        if "unexpected keyword argument" in error_msg:
            # 提取出字段名
            import re
            match = re.search(r"unexpected keyword argument '(.+)'", error_msg)
            if match:
                field = match.group(1)
                error_msg = f"导入字段与数据库模型不一致，请检查字段：{field}"
            else:
                error_msg = "导入字段与数据库模型不一致，请检查模板字段是否匹配"
        
        return JsonResponse({
            "success": False,
            "message": "导入处理异常",
            "errors": [error_msg]
        })

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
        drone_id = terrain_data.get('drone_id')

        if not terrain_data.get('name'):
            return api_error(msg="地形名称不能为空")

        with transaction.atomic():
            # 1. 处理地形 (TerrainArea)
            terrain_id = terrain_data.get('id')
            declared_area = terrain_data.get('area', 0)
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

            # 处理无人机绑定
            # 1. 解除该地形之前绑定的所有无人机
            Drone.objects.filter(terrain_id=terrain.id).update(terrain_id=0)
            # 2. 如果提供了新的 drone_id，则绑定它
            if drone_id:
                Drone.objects.filter(id=drone_id).update(terrain_id=terrain.id)

            # 2. 批量处理地块 (TerrainZone)
            saved_plots = []
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
                    saved_plots.append(plot)
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

            terrain = build_area_spatial_from_active_plots(terrain, active_plots=saved_plots)

            total_plot_area = Decimal('0.00')
            for plot in saved_plots:
                try:
                    total_plot_area += Decimal(str(getattr(plot, 'area', 0) or 0))
                except (TypeError, ValueError, InvalidOperation):
                    continue

            try:
                declared_area_decimal = Decimal(str(declared_area or 0))
            except (TypeError, ValueError, InvalidOperation):
                declared_area_decimal = Decimal('0.00')

            terrain.area = (
                total_plot_area if total_plot_area > 0 else declared_area_decimal
            ).quantize(Decimal('0.01'))
            terrain.save(update_fields=['area', 'updated_at'])

            active_plots = get_area_active_plots(terrain)
            terrain = build_area_spatial_from_active_plots(terrain, active_plots=active_plots)
            terrain_risk = sync_terrain_risk_fields(terrain, save=True, plots=active_plots)
            terrain_serializer = TerrainAreaSerializer(terrain)

            return api_response(data={
                "terrain": terrain_serializer.data,
                "plots": TerrainZoneSerializer(saved_plots, many=True).data,
                "terrain_risk": terrain_risk,
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
            terrain_risk = None
            if getattr(zone, "area_obj", None):
                terrain_risk = sync_terrain_risk_fields(zone.area_obj, save=True)
            return api_response(data={
                "zone": TerrainZoneSerializer(zone).data,
                "terrain_risk": terrain_risk,
            }, msg=msg)
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
        terrain = getattr(zone, "area_obj", None)
        zone.is_deleted = True
        zone.save()
        terrain_risk = sync_terrain_risk_fields(terrain, save=True) if terrain else None
        return api_response(data={"terrain_risk": terrain_risk}, msg="地块已删除")
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
        requested_category = request.query_params.get('category')
        category = normalize_plot_type_key(requested_category, for_storage=True) or requested_category
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
            "category": normalize_plot_type_key(requested_category) or requested_category,
            "subcategories": subcategories
        })
    except Exception as e:
        return api_error(msg=str(e), status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def add_subcategory(request):
    """新增子类别"""
    try:
        requested_category = request.data.get('category')
        category = normalize_plot_type_key(requested_category, for_storage=True) or requested_category
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
            "category": normalize_plot_type_key(requested_category) or requested_category,
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

