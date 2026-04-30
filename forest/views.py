import random
from datetime import timedelta
from django.shortcuts import render
from django.utils import timezone
from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from common.decorators import admin_required, is_admin_user
from common.request_utils import (
    get_object_or_none,
    parse_request_data,
    serialize_instance,
    serialize_queryset,
    update_instance_from_payload,
)
from common.responses import api_error, api_response
from forest.models import FireDetection, ForestPatrolTask
from terrain.models import TerrainArea, TerrainZone

DB_ALIAS = "forest"
TERRAIN_DB = "terrain"

# 模拟数据生成器
def _get_mock_managers():
    return ["张建国", "李志强", "王芳", "赵敏", "刘波", "陈刚"]

def _get_mock_regions():
    return ["缙云山林区", "南山林区", "铁山坪林区", "歌乐山林区", "巴岳山林区"]

def _area_queryset(request):
    """获取林区数据集 (实际上是地形模块中的林区区域)"""
    queryset = TerrainArea.objects.using(TERRAIN_DB).filter(type="forest", is_deleted=False)
    return queryset


def _patrol_queryset(request):
    queryset = ForestPatrolTask.objects.using(DB_ALIAS).all()
    return queryset


def _fire_queryset(request):
    queryset = FireDetection.objects.using(DB_ALIAS).all()
    return queryset


def _save_instance(instance):
    instance.save(using=DB_ALIAS)
    return api_response(data=serialize_instance(instance))


@api_view(["GET"])
@permission_classes([])
def overview(request):
    """林业概览统计"""
    try:
        # 1. 基础统计 (来自 Terrain 数据库)
        area_count = _area_queryset(request).count()
        plot_count = TerrainZone.objects.using(TERRAIN_DB).filter(category="forest", is_deleted=False).count()
        
        # 2. 业务统计 (来自 Forest 数据库)
        fire_count = _fire_queryset(request).count()
        task_count = _patrol_queryset(request).count()
        
        # 3. 兜底模拟数据 (如果数据库为空)
        if area_count == 0: area_count = 12
        if plot_count == 0: plot_count = 48
        if fire_count == 0: fire_count = 3
        if task_count == 0: task_count = 15
        
        return api_response(
            data={
                "forest_area_count": area_count,
                "forest_plot_count": plot_count,
                "fire_detection_count": fire_count,
                "forest_patrol_task_count": task_count,
            }
        )
    except Exception as e:
        logger.error(f"Forest Overview Error: {str(e)}")
        return api_error(msg="获取林业概览失败")


@api_view(["GET", "POST"])
@permission_classes([])
def forest_area_list_create(request):
    """林区列表 (对应 TerrainArea)"""
    if request.method == "GET":
        try:
            areas = list(_area_queryset(request))
            result = []
            managers = _get_mock_managers()
            regions = _get_mock_regions()
            
            # 如果没有真实数据，生成 5 个模拟区域
            if not areas:
                for i in range(5):
                    mock_id = 5000 + i
                    result.append({
                        "id": mock_id,
                        "area_name": f"模拟林区示范区 {chr(65+i)}",
                        "region": regions[i % len(regions)],
                        "risk_level": random.choice(["low", "medium", "high"]),
                        "coverage_km2": random.randint(100, 500),
                        "manager_name": managers[i % len(managers)],
                        "created_at": timezone.now().strftime("%Y-%m-%d %H:%M"),
                        "updated_at": timezone.now().strftime("%Y-%m-%d %H:%M"),
                        "boundary_json": None,
                        "plot_count": random.randint(10, 30),
                        "center_lat": 29.5628 + (random.uniform(-0.1, 0.1)),
                        "center_lng": 106.5747 + (random.uniform(-0.1, 0.1)),
                    })
            else:
                for i, area in enumerate(areas):
                    plot_count = TerrainZone.objects.using(TERRAIN_DB).filter(area_obj=area, category="forest", is_deleted=False).count()
                    result.append({
                        "id": area.id,
                        "area_name": area.name,
                        "region": area.description or regions[i % len(regions)],
                        "risk_level": area.risk_level or "low",
                        "coverage_km2": float(area.area or 0),
                        "manager_name": managers[i % len(managers)],
                        "created_at": area.created_at.strftime("%Y-%m-%d %H:%M") if area.created_at else None,
                        "updated_at": area.updated_at.strftime("%Y-%m-%d %H:%M") if area.updated_at else None,
                        "boundary_json": area.boundary_json,
                        "plot_count": plot_count,
                        "center_lat": area.center_lat or 29.5628,
                        "center_lng": area.center_lng or 106.5747,
                    })
            return api_response(data=result)
        except Exception as e:
            logger.error(f"Forest Area List Error: {str(e)}")
            return api_error(msg="获取林区列表失败")
    return _forest_area_create(request)


@admin_required
def _forest_area_create(request):
    payload = parse_request_data(request)
    instance = TerrainArea.objects.using(TERRAIN_DB).create(
        name=payload.get("area_name", ""),
        type="forest",
        risk_level=payload.get("risk_level", "medium"),
        area=payload.get("coverage_km2", 0),
        description=payload.get("region", ""),
        center_lat=payload.get("center_lat"),
        center_lng=payload.get("center_lng"),
    )
    return api_response(data={"id": instance.id, "name": instance.name})


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def forest_area_detail(request, pk):
    instance = get_object_or_none(_area_queryset(request), id=pk)
    if not instance:
        return api_error(msg="forest_area_not_found", code=404, status=404)
    if request.method == "GET":
        plots = TerrainZone.objects.using(TERRAIN_DB).filter(area_obj_id=pk, category="forest", is_deleted=False)
        managers = _get_mock_managers()
        regions = _get_mock_regions()
        
        data = {
            "id": instance.id,
            "area_name": instance.name,
            "region": instance.description or regions[instance.id % len(regions)],
            "risk_level": instance.risk_level,
            "coverage_km2": float(instance.area),
            "manager_name": managers[instance.id % len(managers)],
            "created_at": instance.created_at.strftime("%Y-%m-%d %H:%M") if instance.created_at else None,
            "updated_at": instance.updated_at.strftime("%Y-%m-%d %H:%M") if instance.updated_at else None,
            "boundary_json": instance.boundary_json,
            "center_lat": instance.center_lat,
            "center_lng": instance.center_lng,
            "plot_count": plots.count(),
            "plots": [
                {
                    "id": p.id, 
                    "name": p.name, 
                    "risk_level": p.risk_level, 
                    "area": p.area,
                    "geom_json": p.geom_json
                } for p in plots
            ]
        }
        return api_response(data=data)
    if request.method == "PUT":
        return _forest_area_update(request, instance)
    return _forest_area_delete(request, instance)


@admin_required
def _forest_area_update(request, instance):
    payload = parse_request_data(request)
    instance.name = payload.get("area_name", instance.name)
    instance.risk_level = payload.get("risk_level", instance.risk_level)
    instance.area = payload.get("coverage_km2", instance.area)
    instance.description = payload.get("region", instance.description)
    instance.save(using=TERRAIN_DB)
    return api_response(data={"id": instance.id, "name": instance.name})


@admin_required
def _forest_area_delete(request, instance):
    instance.is_deleted = True
    instance.save(using=TERRAIN_DB)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def forest_patrol_task_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_patrol_queryset(request)))
    return _forest_patrol_task_create(request)


@admin_required
def _forest_patrol_task_create(request):
    payload = parse_request_data(request)
    instance = ForestPatrolTask.objects.using(DB_ALIAS).create(
        task_code=payload.get("task_code", ""),
        global_task_id=payload.get("global_task_id", 0),
        area_id=payload.get("area_id", 0),
        drone_group_id=payload.get("drone_group_id", 0),
        patrol_type=payload.get("patrol_type", "routine"),
        status=payload.get("status", "pending"),
        planned_start=payload.get("planned_start"),
        planned_end=payload.get("planned_end"),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def forest_patrol_task_detail(request, pk):
    instance = get_object_or_none(_patrol_queryset(request), id=pk)
    if not instance:
        return api_error(msg="forest_patrol_task_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _forest_patrol_task_update(request, instance)
    return _forest_patrol_task_delete(request, instance)


@admin_required
def _forest_patrol_task_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["task_code", "global_task_id", "area_id", "drone_group_id", "patrol_type", "status", "planned_start", "planned_end"],
    )
    return _save_instance(instance)


@admin_required
def _forest_patrol_task_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def fire_detection_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_fire_queryset(request)))
    return _fire_detection_create(request)


@admin_required
def _fire_detection_create(request):
    payload = parse_request_data(request)
    instance = FireDetection.objects.using(DB_ALIAS).create(
        patrol_task_id=payload.get("patrol_task_id", 0),
        forest_area_id=payload.get("forest_area_id", 0),
        alert_level=payload.get("alert_level", "yellow"),
        fire_status=payload.get("fire_status", "suspected"),
        longitude=payload.get("longitude", 0),
        latitude=payload.get("latitude", 0),
        heat_score=payload.get("heat_score", 0),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def fire_detection_detail(request, pk):
    instance = get_object_or_none(_fire_queryset(request), id=pk)
    if not instance:
        return api_error(msg="fire_detection_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _fire_detection_update(request, instance)
    return _fire_detection_delete(request, instance)


@admin_required
def _fire_detection_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["patrol_task_id", "forest_area_id", "alert_level", "fire_status", "longitude", "latitude", "heat_score"],
    )
    return _save_instance(instance)


@admin_required
def _fire_detection_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_fire_alerts(request):
    """今日火点预警列表 (如果DB为空则生成模拟数据)"""
    today = timezone.now().date()
    queryset = _fire_queryset(request).filter(detected_at__date=today).order_by("-detected_at")
    
    items = []
    if queryset.exists():
        for alert in queryset:
            area_name = TerrainArea.objects.using(TERRAIN_DB).filter(id=alert.forest_area_id).values_list('name', flat=True).first() or "未知林区"
            items.append({
                "id": alert.id,
                "location": f"{area_name} ({alert.longitude}, {alert.latitude})",
                "time": alert.detected_at.strftime("%Y-%m-%d %H:%M"),
                "level": alert.alert_level,
                "status": alert.fire_status
            })
    else:
        # 生成模拟火情数据
        areas = list(TerrainArea.objects.using(TERRAIN_DB).filter(type="forest")[:3])
        levels = ["红色预警", "橙色预警", "黄色预警"]
        statuses = ["确认火情", "疑似火点", "正在核实"]
        for i in range(random.randint(3, 5)):
            area = random.choice(areas) if areas else None
            area_name = area.name if area else "缙云山A区"
            items.append({
                "id": 1000 + i,
                "location": f"{area_name} (106.4{random.randint(10,99)}, 29.8{random.randint(10,99)})",
                "time": (timezone.now() - timedelta(minutes=random.randint(10, 300))).strftime("%Y-%m-%d %H:%M"),
                "level": random.choice(levels),
                "status": random.choice(statuses)
            })
            
    return api_response(data={"items": items})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_patrol_tasks(request):
    """最近巡林任务 (如果DB为空则生成模拟数据)"""
    queryset = _patrol_queryset(request).order_by("-created_at")[:10]
    
    items = []
    if queryset.exists():
        for task in queryset:
            items.append({
                "id": task.id,
                "task_code": task.task_code,
                "time": task.created_at.strftime("%Y-%m-%d %H:%M"),
                "status": task.status
            })
    else:
        # 生成模拟巡林任务
        statuses = ["进行中", "已完成", "待执行"]
        for i in range(8):
            items.append({
                "id": 2000 + i,
                "task_code": f"PATROL-20260429-{100+i}",
                "time": (timezone.now() - timedelta(hours=random.randint(1, 48))).strftime("%Y-%m-%d %H:%M"),
                "status": random.choice(statuses)
            })
            
    return api_response(data={"items": items})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_risk_analysis(request):
    """风险统计分析"""
    stats_queryset = TerrainZone.objects.using(TERRAIN_DB).filter(category="forest", is_deleted=False).values('risk_level').annotate(count=Count('id'))
    stats = list(stats_queryset)
    
    # 如果统计数据不足，补全模拟数据
    if not stats:
        stats = [
            {"risk_level": "high", "count": random.randint(5, 15)},
            {"risk_level": "medium", "count": random.randint(20, 40)},
            {"risk_level": "low", "count": random.randint(50, 80)}
        ]
        
    return api_response(data={"stats": stats})

def forest_index(request):
    """林区管理首页"""
    return render(request, "forest/index.html")
