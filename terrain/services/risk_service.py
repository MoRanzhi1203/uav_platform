import json
import logging
from typing import Iterable, List, Optional

from pyproj import Geod
from shapely.geometry import shape
from shapely.ops import unary_union


logger = logging.getLogger(__name__)

WGS84_GEOD = Geod(ellps="WGS84")

RISK_LEVEL_DISPLAY = {
    "high": "高风险",
    "medium": "中风险",
    "low": "低风险",
    "none": "未评估",
}

RISK_LEVEL_ALIASES = {
    "high": "high",
    "medium": "medium",
    "low": "low",
    "none": "none",
    "unknown": "none",
    "null": "none",
    "": "none",
    "高风险": "high",
    "高": "high",
    "high_risk": "high",
    "medium_risk": "medium",
    "中风险": "medium",
    "中": "medium",
    "低风险": "low",
    "低": "low",
    "普通": "low",
    "一般": "low",
    "normal": "low",
    "common": "low",
    "safe": "low",
    "未评估": "none",
    "未标记": "none",
    "未标注": "none",
    "无": "none",
    "未知": "none",
}

RISK_FIELD_CANDIDATES = (
    "risk_level",
    "risk",
    "danger_level",
    "risk_type",
    "hazard_level",
    "warning_level",
    "level",
)

AREA_FIELD_CANDIDATES = (
    "area",
    "area_mu",
    "area_hectare",
    "size",
    "geometry_area",
)

GEOMETRY_FIELD_CANDIDATES = (
    "geom_json",
    "geometry",
    "boundary_json",
    "boundary_geojson",
)

DELETED_FLAG_CANDIDATES = ("is_deleted", "deleted")
VISIBLE_FLAG_CANDIDATES = ("visible", "is_visible")
HIDDEN_FLAG_CANDIDATES = (
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
)
STATUS_FIELD_CANDIDATES = ("status", "zone_status", "record_status", "state")
EXCLUDED_STATUSES = {
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
TERRAIN_RISK_SYNC_FIELDS = ("risk_level", "risk", "risk_type", "danger_level")


def normalize_risk_level(value) -> str:
    if value is None:
        return "none"
    text = str(value).strip()
    if not text:
        return "none"
    return RISK_LEVEL_ALIASES.get(text, RISK_LEVEL_ALIASES.get(text.lower(), "none"))


def get_risk_level_display(value) -> str:
    return RISK_LEVEL_DISPLAY.get(normalize_risk_level(value), RISK_LEVEL_DISPLAY["none"])


def _parse_json_like(value):
    current = value
    for _ in range(3):
        if not isinstance(current, str):
            break
        stripped = current.strip()
        if stripped in ("", "null", "None", "{}", "[]"):
            return None
        try:
            current = json.loads(stripped)
        except (TypeError, ValueError, json.JSONDecodeError):
            return None
    return current


def _coerce_float(value) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def _mercator_to_lng_lat(x, y):
    lng = (x / 20037508.34) * 180
    lat = (y / 20037508.34) * 180
    lat = (180 / 3.141592653589793) * (
        2 * __import__("math").atan(__import__("math").exp((lat * 3.141592653589793) / 180))
        - 3.141592653589793 / 2
    )
    return [lng, lat]


def _convert_coordinates(coordinates):
    if not isinstance(coordinates, list):
        return coordinates
    if (
        len(coordinates) >= 2
        and isinstance(coordinates[0], (int, float))
        and isinstance(coordinates[1], (int, float))
    ):
        x = float(coordinates[0])
        y = float(coordinates[1])
        if abs(x) > 180 or abs(y) > 90:
            return _mercator_to_lng_lat(x, y)
        return [x, y, *coordinates[2:]]
    return [_convert_coordinates(item) for item in coordinates]


def _normalize_geojson(value):
    parsed = _parse_json_like(value)
    if not isinstance(parsed, dict):
        return None

    geo_type = parsed.get("type")
    if geo_type == "FeatureCollection":
        features = [_normalize_geojson(feature) for feature in parsed.get("features", [])]
        features = [feature for feature in features if feature]
        if not features:
            return None
        return {**parsed, "features": features}

    if geo_type == "Feature":
        geometry = _normalize_geojson(parsed.get("geometry"))
        if not geometry:
            return None
        payload = dict(parsed)
        payload["geometry"] = geometry
        return payload

    if geo_type and isinstance(parsed.get("coordinates"), list):
        payload = dict(parsed)
        payload["coordinates"] = _convert_coordinates(parsed["coordinates"])
        return payload

    if isinstance(parsed.get("geometry"), dict):
        return _normalize_geojson(parsed["geometry"])

    return None


def _geometry_from_geojson(value):
    normalized = _normalize_geojson(value)
    if not isinstance(normalized, dict):
        return None

    geo_type = normalized.get("type")
    if geo_type == "FeatureCollection":
        geometries = [_geometry_from_geojson(feature) for feature in normalized.get("features", [])]
        geometries = [geometry for geometry in geometries if geometry and not geometry.is_empty]
        if not geometries:
            return None
        return unary_union(geometries)

    if geo_type == "Feature":
        return _geometry_from_geojson(normalized.get("geometry"))

    try:
        geometry = shape(normalized)
    except Exception:
        return None
    return geometry if geometry and not geometry.is_empty else None


def _calculate_area_ha_from_geometry(value) -> Optional[float]:
    geometry = _geometry_from_geojson(value)
    if not geometry or geometry.is_empty:
        return None
    try:
        area_sq_m, _ = WGS84_GEOD.geometry_area_perimeter(geometry)
    except Exception:
        return None
    if area_sq_m is None:
        return None
    return abs(area_sq_m) / 10000


def _extract_payload_dicts(plot) -> List[dict]:
    payloads = []
    for field_name in ("meta_json", "meta", "metadata", "style_json", "style"):
        if not hasattr(plot, field_name):
            continue
        parsed = _parse_json_like(getattr(plot, field_name, None))
        if isinstance(parsed, dict):
            payloads.append(parsed)
    return payloads


def _is_plot_excluded(plot) -> bool:
    for field_name in DELETED_FLAG_CANDIDATES:
        if hasattr(plot, field_name) and getattr(plot, field_name) is True:
            return True

    for field_name in VISIBLE_FLAG_CANDIDATES:
        if hasattr(plot, field_name) and getattr(plot, field_name) is False:
            return True

    payloads = _extract_payload_dicts(plot)
    for payload in payloads:
        for field_name in HIDDEN_FLAG_CANDIDATES:
            if payload.get(field_name) is True:
                return True
        if payload.get("visible") is False:
            return True
        for field_name in VISIBLE_FLAG_CANDIDATES:
            if field_name in payload and payload.get(field_name) is False:
                return True
        for field_name in STATUS_FIELD_CANDIDATES:
            value = payload.get(field_name)
            if value is None:
                continue
            if str(value).strip().lower() in EXCLUDED_STATUSES:
                return True
    return False


def _read_plot_risk(plot) -> str:
    for field_name in RISK_FIELD_CANDIDATES:
        if hasattr(plot, field_name):
            normalized = normalize_risk_level(getattr(plot, field_name, None))
            if normalized != "none" or getattr(plot, field_name, None) in ("", None):
                return normalized

    for payload in _extract_payload_dicts(plot):
        for field_name in RISK_FIELD_CANDIDATES:
            if field_name in payload:
                return normalize_risk_level(payload.get(field_name))
    return "none"


def _extract_area_from_plot(plot) -> float:
    for field_name in AREA_FIELD_CANDIDATES:
        if hasattr(plot, field_name):
            number = _coerce_float(getattr(plot, field_name, None))
            if number is not None and number > 0:
                return round(number, 6)

    for payload in _extract_payload_dicts(plot):
        for field_name in AREA_FIELD_CANDIDATES:
            number = _coerce_float(payload.get(field_name))
            if number is not None and number > 0:
                return round(number, 6)

    for field_name in GEOMETRY_FIELD_CANDIDATES:
        if hasattr(plot, field_name):
            calculated = _calculate_area_ha_from_geometry(getattr(plot, field_name, None))
            if calculated and calculated > 0:
                return round(calculated, 6)
    return 0.0


def _resolve_related_plots(terrain, plots: Optional[Iterable] = None) -> List:
    if plots is not None:
        return list(plots)

    active_plots = getattr(terrain, "active_zones", None)
    if active_plots is not None:
        return list(active_plots)

    for accessor_name in ("zones", "plots", "parcels", "blocks", "land_parcels"):
        relation = getattr(terrain, accessor_name, None)
        if relation is None:
            continue
        if hasattr(relation, "all"):
            queryset = relation.all()
            if hasattr(queryset, "filter") and hasattr(queryset.model, "_meta"):
                if any(field.name == "is_deleted" for field in queryset.model._meta.concrete_fields):
                    queryset = queryset.filter(is_deleted=False)
            return list(queryset)
        if isinstance(relation, (list, tuple)):
            return list(relation)

    for field in terrain._meta.get_fields():
        if not getattr(field, "auto_created", False) or getattr(field, "concrete", False):
            continue
        accessor_name = getattr(field, "get_accessor_name", lambda: None)()
        if not accessor_name:
            continue
        relation = getattr(terrain, accessor_name, None)
        if hasattr(relation, "all"):
            return list(relation.all())

    return []


def _build_reason(level, stats) -> str:
    high_count = stats["high_count"]
    medium_count = stats["medium_count"]
    low_count = stats["low_count"]
    unknown_count = stats["unknown_count"]
    effective_count = stats["effective_count"]
    active_count = stats["total_count"]
    high_ratio_pct = stats["high_ratio"] * 100
    medium_ratio_pct = stats["medium_ratio"] * 100
    high_area_ratio_pct = stats["high_area_ratio"] * 100
    medium_area_ratio_pct = stats["medium_area_ratio"] * 100
    risk_score = stats["risk_score"]

    if level == "high":
        reasons = []
        if high_count > 0:
            reasons.append(f"存在 {high_count} 个高风险地块")
        if stats["high_ratio"] >= 0.10:
            reasons.append(f"高风险地块数量占比 {high_ratio_pct:.2f}%")
        if stats["high_area_ratio"] >= 0.05:
            reasons.append(f"高风险地块面积占比 {high_area_ratio_pct:.2f}%")
        if effective_count:
            reasons.append(f"有效标记地块 {effective_count} 个")
        return "，".join(reasons[:3] or ["满足高风险判定条件"]) + f"，风险分值 {risk_score}，判定为高风险"

    if level == "medium":
        reasons = []
        if medium_count > 0:
            reasons.append(f"存在 {medium_count} 个中风险地块")
        if stats["medium_ratio"] >= 0.20:
            reasons.append(f"中风险地块数量占比 {medium_ratio_pct:.2f}%")
        if stats["medium_area_ratio"] >= 0.15:
            reasons.append(f"中风险地块面积占比 {medium_area_ratio_pct:.2f}%")
        if effective_count:
            reasons.append(f"有效标记地块 {effective_count} 个")
        return "，".join(reasons[:3] or ["满足中风险判定条件"]) + f"，风险分值 {risk_score}，判定为中风险"

    if level == "low":
        return (
            f"无高风险和中风险地块，存在 {low_count} 个低风险或普通地块，"
            f"有效标记地块 {effective_count} 个，风险分值 {risk_score}，判定为低风险"
        )

    if active_count == 0:
        return "该地形区域下没有任何有效地块，判定为未评估"
    if unknown_count == active_count:
        return f"该地形区域下 {unknown_count} 个有效地块均未标记风险，风险分值 0，判定为未评估"
    return "地块数据无法形成有效风险判定，判定为未评估"


def calculate_terrain_risk(terrain, plots: Optional[Iterable] = None) -> dict:
    related_plots = _resolve_related_plots(terrain, plots=plots)
    active_plots = [plot for plot in related_plots if not _is_plot_excluded(plot)]

    counts = {"high": 0, "medium": 0, "low": 0, "none": 0}
    areas = {"high": 0.0, "medium": 0.0, "low": 0.0, "none": 0.0}

    for plot in active_plots:
        risk_level = _read_plot_risk(plot)
        area_ha = _extract_area_from_plot(plot)
        counts[risk_level] += 1
        areas[risk_level] += area_ha

    total_count = sum(counts.values())
    total_area = round(sum(areas.values()), 6)
    effective_count = counts["high"] + counts["medium"] + counts["low"]
    effective_area = round(areas["high"] + areas["medium"] + areas["low"], 6)

    high_ratio = counts["high"] / effective_count if effective_count else 0.0
    medium_ratio = counts["medium"] / effective_count if effective_count else 0.0
    high_area_ratio = areas["high"] / effective_area if effective_area > 0 else 0.0
    medium_area_ratio = areas["medium"] / effective_area if effective_area > 0 else 0.0

    area_ratio_available = effective_area > 0
    ratio_high_component = high_area_ratio if area_ratio_available else high_ratio
    ratio_medium_component = medium_area_ratio if area_ratio_available else medium_ratio
    risk_score = min(
        100,
        int(round(
            counts["high"] * 60
            + counts["medium"] * 25
            + counts["low"] * 5
            + ratio_high_component * 100
            + ratio_medium_component * 40
        )),
    )

    score_based_level = "none"
    if risk_score >= 70:
        score_based_level = "high"
    elif risk_score >= 35:
        score_based_level = "medium"
    elif risk_score > 0:
        score_based_level = "low"

    if total_count == 0 or effective_count == 0:
        risk_level = "none"
    elif counts["high"] > 0 or high_ratio >= 0.10 or high_area_ratio >= 0.05:
        risk_level = "high"
    elif counts["medium"] > 0 or medium_ratio >= 0.20 or medium_area_ratio >= 0.15:
        risk_level = "medium"
    elif counts["low"] > 0:
        risk_level = "low"
    else:
        risk_level = score_based_level

    result = {
        "risk_level": risk_level,
        "risk_level_display": get_risk_level_display(risk_level),
        "high_count": counts["high"],
        "medium_count": counts["medium"],
        "low_count": counts["low"],
        "unknown_count": counts["none"],
        "total_count": total_count,
        "effective_count": effective_count,
        "high_area": round(areas["high"], 4),
        "medium_area": round(areas["medium"], 4),
        "low_area": round(areas["low"], 4),
        "unknown_area": round(areas["none"], 4),
        "total_area": round(total_area, 4),
        "effective_area": round(effective_area, 4),
        "high_ratio": round(high_ratio, 4),
        "medium_ratio": round(medium_ratio, 4),
        "high_area_ratio": round(high_area_ratio, 4),
        "medium_area_ratio": round(medium_area_ratio, 4),
        "area_ratio_source": "area" if area_ratio_available else "count",
        "risk_score": risk_score,
    }
    result["reason"] = _build_reason(risk_level, result)
    result["risk_reason"] = result["reason"]
    result["high_risk_plot_count"] = result["high_count"]
    result["medium_risk_plot_count"] = result["medium_count"]
    result["low_risk_plot_count"] = result["low_count"]
    result["unknown_risk_plot_count"] = result["unknown_count"]
    result["total_plot_count"] = result["total_count"]
    result["high_risk_area"] = result["high_area"]
    result["medium_risk_area"] = result["medium_area"]
    result["low_risk_area"] = result["low_area"]
    result["unknown_risk_area"] = result["unknown_area"]
    result["total_risk_area"] = result["total_area"]
    return result


def attach_terrain_risk(terrain, risk_payload: Optional[dict] = None) -> dict:
    payload = risk_payload or calculate_terrain_risk(terrain)
    terrain._terrain_risk_cache = payload
    terrain.computed_risk_level = payload["risk_level"]
    terrain.computed_risk_level_display = payload["risk_level_display"]
    terrain.risk_score = payload["risk_score"]
    terrain.risk_reason = payload["reason"]
    terrain.high_risk_plot_count = payload["high_count"]
    terrain.medium_risk_plot_count = payload["medium_count"]
    terrain.low_risk_plot_count = payload["low_count"]
    terrain.unknown_risk_plot_count = payload["unknown_count"]
    terrain.total_plot_count = payload["total_count"]
    terrain.high_risk_area = payload["high_area"]
    terrain.medium_risk_area = payload["medium_area"]
    terrain.low_risk_area = payload["low_area"]
    terrain.total_risk_area = payload["total_area"]
    return payload


def sync_terrain_risk_fields(
    terrain,
    risk_payload: Optional[dict] = None,
    *,
    save: bool = True,
    plots: Optional[Iterable] = None,
) -> dict:
    payload = attach_terrain_risk(terrain, risk_payload or calculate_terrain_risk(terrain, plots=plots))
    update_fields = []
    concrete_field_names = {field.name for field in terrain._meta.concrete_fields}

    for field_name in TERRAIN_RISK_SYNC_FIELDS:
        if field_name not in concrete_field_names:
            continue
        field = terrain._meta.get_field(field_name)
        valid_choices = {choice[0] for choice in getattr(field, "choices", []) if choice and choice[0] is not None}
        next_value = payload["risk_level"]
        if valid_choices and next_value not in valid_choices:
            logger.info(
                "跳过同步地形风险字段 %s.%s=%s，原因：字段 choices 不包含该值",
                terrain.__class__.__name__,
                field_name,
                next_value,
            )
            continue
        if getattr(terrain, field_name, None) != next_value:
            setattr(terrain, field_name, next_value)
            update_fields.append(field_name)

    if save and update_fields:
        if "updated_at" in concrete_field_names and "updated_at" not in update_fields:
            update_fields.append("updated_at")
        terrain.save(update_fields=update_fields)

    return payload
