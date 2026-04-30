import random
import logging
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
from agri.models import AgriTask, FarmPlot, PestMonitor
from terrain.models import TerrainArea, TerrainZone

logger = logging.getLogger(__name__)

DB_ALIAS = "agri"
TERRAIN_DB = "terrain"

# 模拟数据生成器
def _get_mock_managers():
    return ["张建国", "李志强", "王芳", "赵敏", "刘波", "陈刚"]

def _get_mock_regions():
    return ["重庆农业示范区", "江北现代农业园", "九龙坡农耕地", "渝北智慧农场", "巴南生态农业带"]

def _area_queryset(request):
    """获取农田数据集 (实际上是地形模块中的农田区域)"""
    queryset = TerrainArea.objects.using(TERRAIN_DB).filter(type="farm", is_deleted=False)
    return queryset


def _normalize_filter_value(value):
    text = str(value or "").strip()
    if text.lower() in {"", "all", "undefined", "null"}:
        return ""
    if text in {"全部等级", "全部时间"}:
        return ""
    return text


def _task_queryset(request):
    queryset = AgriTask.objects.using(DB_ALIAS).all()
    return queryset


def _pest_queryset(request):
    queryset = PestMonitor.objects.using(DB_ALIAS).all()
    return queryset


def _save_instance(instance):
    instance.save(using=DB_ALIAS)
    return api_response(data=serialize_instance(instance))


@api_view(["GET"])
@permission_classes([])
def overview(request):
    """农业概览统计"""
    try:
        # 1. 基础统计 (来自 Terrain 数据库)
        area_count = _area_queryset(request).count()
        plot_count = TerrainZone.objects.using(TERRAIN_DB).filter(category="farmland", is_deleted=False).count()
        
        # 2. 业务统计 (来自 Agri 数据库)
        pest_count = _pest_queryset(request).count()
        task_count = _task_queryset(request).count()
        
        # 3. 兜底模拟数据 (如果数据库为空)
        if area_count == 0: area_count = 5
        if plot_count == 0: plot_count = 24
        if pest_count == 0: pest_count = 8
        if task_count == 0: task_count = 12
        
        return api_response(
            data={
                "farm_area_count": area_count,
                "farm_plot_count": plot_count,
                "pest_monitor_count": pest_count,
                "agri_task_count": task_count,
            }
        )
    except Exception as e:
        logger.error(f"Agri Overview Error: {str(e)}")
        return api_error(msg="获取农业概览失败")

@api_view(["GET", "POST"])
@permission_classes([])
def farm_plot_list_create(request):
    """农田示范区列表 (对应 TerrainArea)"""
    if request.method == "GET":
        try:
            name = _normalize_filter_value(request.GET.get("name") or request.GET.get("keyword"))
            risk_level = _normalize_filter_value(request.GET.get("risk_level"))
            page = int(request.GET.get("page", 1) or 1)
            page_size = int(request.GET.get("page_size", 100) or 100)

            queryset = _area_queryset(request)
            if name:
                queryset = queryset.filter(name__icontains=name)
            if risk_level:
                queryset = queryset.filter(risk_level=risk_level)

            total_count = queryset.count()
            start = max(page - 1, 0) * page_size
            end = start + page_size
            areas = list(queryset.order_by("-updated_at", "-id")[start:end])
            result = []
            managers = _get_mock_managers()
            regions = _get_mock_regions()
            
            # 如果没有真实数据，生成 5 个模拟区域
            if not areas:
                total_count = 5
                for i in range(5):
                    mock_id = 5000 + i
                    result.append({
                        "id": mock_id,
                        "area_name": f"模拟农业示范区 {chr(65+i)}",
                        "region": regions[i % len(regions)],
                        "risk_level": random.choice(["low", "medium", "high"]),
                        "coverage_ha": random.randint(50, 200),
                        "manager_name": managers[i % len(managers)],
                        "created_at": timezone.now().strftime("%Y-%m-%d %H:%M"),
                        "updated_at": timezone.now().strftime("%Y-%m-%d %H:%M"),
                        "boundary_json": None,
                        "plot_count": random.randint(5, 15),
                        "center_lat": 29.5628 + (random.uniform(-0.05, 0.05)),
                        "center_lng": 106.5747 + (random.uniform(-0.05, 0.05)),
                    })
            else:
                for i, area in enumerate(areas):
                    plot_count = TerrainZone.objects.using(TERRAIN_DB).filter(area_obj=area, category="farmland", is_deleted=False).count()
                    result.append({
                        "id": area.id,
                        "name": area.name,
                        "area_name": area.name,
                        "region": area.description or regions[i % len(regions)],
                        "risk_level": area.risk_level or "low",
                        "area": float(area.area or 0),
                        "coverage_ha": float(area.area or 0),
                        "manager": managers[i % len(managers)],
                        "manager_name": managers[i % len(managers)],
                        "description": area.description or "",
                        "created_at": timezone.localtime(area.created_at).strftime("%Y-%m-%d %H:%M") if area.created_at else None,
                        "updated_at": timezone.localtime(area.updated_at).strftime("%Y-%m-%d %H:%M") if area.updated_at else None,
                        "boundary_json": area.boundary_json,
                        "plot_count": plot_count,
                        "center_lat": area.center_lat or 29.5628,
                        "center_lng": area.center_lng or 106.5747,
                    })
            return api_response(data={"count": total_count, "results": result})
        except Exception as e:
            logger.error(f"Agri Area List Error: {str(e)}")
            return api_error(msg="获取示范区列表失败")
    return _farm_plot_create(request)


@admin_required
def _farm_plot_create(request):
    payload = parse_request_data(request)
    instance = TerrainArea.objects.using(TERRAIN_DB).create(
        name=payload.get("area_name", ""),
        type="farm",
        risk_level=payload.get("risk_level", "medium"),
        area=payload.get("coverage_ha", 0),
        description=payload.get("region", ""),
        center_lat=payload.get("center_lat"),
        center_lng=payload.get("center_lng"),
    )
    return api_response(data={"id": instance.id, "name": instance.name})


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([])
def farm_plot_detail(request, pk):
    instance = get_object_or_none(_area_queryset(request), id=pk)
    managers = _get_mock_managers()
    regions = _get_mock_regions()

    if not instance:
        # 如果是模拟 ID (>= 5000)，返回模拟详情
        if pk >= 5000:
            mock_id = pk - 5000
            return api_response(data={
                "id": pk,
                "area_name": f"模拟农业示范区 {chr(65+mock_id)}",
                "region": regions[mock_id % len(regions)],
                "risk_level": "medium",
                "coverage_ha": 120.5,
                "manager_name": managers[mock_id % len(managers)],
                "created_at": timezone.now().strftime("%Y-%m-%d %H:%M"),
                "updated_at": timezone.now().strftime("%Y-%m-%d %H:%M"),
                "boundary_json": {},
                "center_lat": 29.5628,
                "center_lng": 106.5747,
                "plot_count": 8,
                "plots": [
                    {"id": 6000+j, "name": f"模拟地块 {j+1}", "risk_level": random.choice(["low", "medium"]), "area": 15.0, "geom_json": {}}
                    for j in range(8)
                ]
            })
        return api_error(msg="farm_plot_not_found", code=404, status=404)
    
    if request.method == "GET":
        try:
            plots = TerrainZone.objects.using(TERRAIN_DB).filter(area_obj_id=pk, category="farmland", is_deleted=False)
            data = {
                "id": instance.id,
                "name": instance.name,
                "area_name": instance.name,
                "region": instance.description or regions[instance.id % len(regions)],
                "risk_level": instance.risk_level,
                "area": float(instance.area),
                "coverage_ha": float(instance.area),
                "manager": managers[instance.id % len(managers)],
                "manager_name": managers[instance.id % len(managers)],
                "description": instance.description or "",
                "created_at": timezone.localtime(instance.created_at).strftime("%Y-%m-%d %H:%M") if instance.created_at else None,
                "updated_at": timezone.localtime(instance.updated_at).strftime("%Y-%m-%d %H:%M") if instance.updated_at else None,
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
        except Exception as e:
            logger.error(f"Agri Area Detail Error: {str(e)}")
            return api_error(msg=str(e))

    if request.method == "PUT":
        return _farm_plot_update(request, instance)
    return _farm_plot_delete(request, instance)


@admin_required
def _farm_plot_update(request, instance):
    payload = parse_request_data(request)
    instance.name = payload.get("area_name", instance.name)
    instance.risk_level = payload.get("risk_level", instance.risk_level)
    instance.area = payload.get("coverage_ha", instance.area)
    instance.description = payload.get("region", instance.description)
    instance.save(using=TERRAIN_DB)
    return api_response(data={"id": instance.id, "name": instance.name})


@admin_required
def _farm_plot_delete(request, instance):
    instance.is_deleted = True
    instance.save(using=TERRAIN_DB)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def agri_task_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_task_queryset(request)))
    return _agri_task_create(request)


@admin_required
def _agri_task_create(request):
    payload = parse_request_data(request)
    instance = AgriTask.objects.using(DB_ALIAS).create(
        task_code=payload.get("task_code", ""),
        global_task_id=payload.get("global_task_id", 0),
        farm_plot_id=payload.get("farm_plot_id", 0),
        drone_group_id=payload.get("drone_group_id", 0),
        task_type=payload.get("task_type", "spray"),
        pesticide_name=payload.get("pesticide_name", ""),
        status=payload.get("status", "pending"),
        planned_start=payload.get("planned_start"),
        planned_end=payload.get("planned_end"),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def agri_task_detail(request, pk):
    instance = get_object_or_none(_task_queryset(request), id=pk)
    if not instance:
        return api_error(msg="agri_task_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _agri_task_update(request, instance)
    return _agri_task_delete(request, instance)


@admin_required
def _agri_task_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["task_code", "global_task_id", "farm_plot_id", "drone_group_id", "task_type", "pesticide_name", "status", "planned_start", "planned_end"],
    )
    return _save_instance(instance)


@admin_required
def _agri_task_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def pest_monitor_list_create(request):
    if request.method == "GET":
        return api_response(data=serialize_queryset(_pest_queryset(request)))
    return _pest_monitor_create(request)


@admin_required
def _pest_monitor_create(request):
    payload = parse_request_data(request)
    instance = PestMonitor.objects.using(DB_ALIAS).create(
        agri_task_id=payload.get("agri_task_id", 0),
        farm_plot_id=payload.get("farm_plot_id", 0),
        pest_type=payload.get("pest_type", "unknown"),
        severity=payload.get("severity", "medium"),
        coverage_ratio=payload.get("coverage_ratio", 0),
    )
    return api_response(data=serialize_instance(instance))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def pest_monitor_detail(request, pk):
    instance = get_object_or_none(_pest_queryset(request), id=pk)
    if not instance:
        return api_error(msg="pest_monitor_not_found", code=404, status=404)
    if request.method == "GET":
        return api_response(data=serialize_instance(instance))
    if request.method == "PUT":
        return _pest_monitor_update(request, instance)
    return _pest_monitor_delete(request, instance)


@admin_required
def _pest_monitor_update(request, instance):
    payload = parse_request_data(request)
    update_instance_from_payload(
        instance,
        payload,
        ["agri_task_id", "farm_plot_id", "pest_type", "severity", "coverage_ratio"],
    )
    return _save_instance(instance)


@admin_required
def _pest_monitor_delete(request, instance):
    instance.delete(using=DB_ALIAS)
    return api_response(data={"deleted": True})


@api_view(["GET"])
@permission_classes([])
def dashboard_pest_alerts(request):
    """今日病虫害预警 (如果DB为空则生成模拟数据)"""
    try:
        local_now = timezone.localtime()
        start_of_day = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        queryset = _pest_queryset(request).filter(
            detected_at__gte=start_of_day,
            detected_at__lt=end_of_day,
        ).order_by("-detected_at")
        
        items = []
        if queryset.exists():
            for alert in queryset:
                area_name = TerrainArea.objects.using(TERRAIN_DB).filter(id=alert.farm_plot_id).values_list('name', flat=True).first() or "未知地块"
                items.append({
                    "id": alert.id,
                    "location": f"{area_name}",
                    "time": timezone.localtime(alert.detected_at).strftime("%Y-%m-%d %H:%M"),
                    "level": alert.severity,
                    "status": alert.pest_type
                })
        else:
            # 生成模拟病虫害数据
            areas = list(TerrainArea.objects.using(TERRAIN_DB).filter(type="farm")[:3])
            levels = ["红色预警", "橙色预警", "黄色预警"]
            pests = ["稻飞虱", "小麦条锈病", "玉米螟", "粘虫", "红蜘蛛"]
            for i in range(random.randint(4, 7)):
                area = random.choice(areas) if areas else None
                area_name = area.name if area else "示范区A区"
                items.append({
                    "id": 3000 + i,
                    "location": f"{area_name} {random.randint(1,10)}号地块",
                    "time": (timezone.now() - timedelta(minutes=random.randint(10, 300))).strftime("%Y-%m-%d %H:%M"),
                    "level": random.choice(levels),
                    "status": random.choice(pests)
                })
                
        return api_response(data={"items": items})
    except Exception as e:
        logger.error(f"Agri Pest Alerts Error: {str(e)}")
        return api_error(msg=str(e))


@api_view(["GET"])
@permission_classes([])
def dashboard_agri_tasks(request):
    """最近植保任务 (如果DB为空则生成模拟数据)"""
    try:
        queryset = _task_queryset(request).order_by("-created_at")[:10]
        
        items = []
        if queryset.exists():
            for task in queryset:
                items.append({
                    "id": task.id,
                    "task_code": task.task_code,
                    "time": timezone.localtime(task.created_at).strftime("%Y-%m-%d %H:%M"),
                    "status": task.status
                })
        else:
            # 生成模拟植保任务
            statuses = ["进行中", "已完成", "待执行"]
            for i in range(8):
                items.append({
                    "id": 4000 + i,
                    "task_code": f"AGRI-20260430-{100+i}",
                    "time": (timezone.now() - timedelta(hours=random.randint(1, 48))).strftime("%Y-%m-%d %H:%M"),
                    "status": random.choice(statuses)
                })
                
        return api_response(data={"items": items})
    except Exception as e:
        logger.error(f"Agri Tasks Error: {str(e)}")
        return api_error(msg=str(e))


@api_view(["GET"])
@permission_classes([])
def dashboard_risk_analysis(request):
    """风险统计分析"""
    try:
        stats_queryset = TerrainZone.objects.using(TERRAIN_DB).filter(category="farmland", is_deleted=False).values('risk_level').annotate(count=Count('id'))
        stats = list(stats_queryset)
        
        # 如果统计数据不足，补全模拟数据
        if not stats:
            stats = [
                {"risk_level": "high", "count": random.randint(3, 10)},
                {"risk_level": "medium", "count": random.randint(15, 30)},
                {"risk_level": "low", "count": random.randint(40, 60)}
            ]
            
        return api_response(data={"stats": stats})
    except Exception as e:
        logger.error(f"Agri Risk Analysis Error: {str(e)}")
        return api_error(msg=str(e))


from django.contrib.auth.decorators import login_required

@login_required(login_url="/login/")
def agri_index(request):
    """农田管理首页"""
    return render(request, "agri/index.html")
