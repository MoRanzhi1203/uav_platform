import logging
import traceback
import json
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.db import transaction
from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from shapely.geometry import shape, mapping, MultiPolygon, Polygon
from .models import TerrainArea, TerrainZone, TerrainElement, TerrainSubCategory
from .serializers import (
    TerrainAreaSerializer, TerrainZoneSerializer, 
    TerrainElementSerializer, TerrainSubCategorySerializer
)
from common.responses import api_response, api_error

logger = logging.getLogger(__name__)

# 地形管理主页 (区域列表页)
def terrain_index(request):
    return render(request, 'terrain/index.html')

# 地块编辑器页面 (区域编辑详情页)
def terrain_editor(request):
    return render(request, 'terrain/editor.html')

# --- TerrainArea API ---

@api_view(['GET'])
@permission_classes([AllowAny])
def list_areas(request):
    """区域列表接口"""
    try:
        queryset = TerrainArea.objects.all().order_by('-created_at')
        serializer = TerrainAreaSerializer(queryset, many=True)
        return api_response(data=serializer.data)
    except Exception as e:
        logger.error(f"获取区域列表异常: {str(e)}")
        return api_error(msg=str(e), status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def area_edit_detail(request, area_id):
    """地块编辑页接口: 返回该区域下所有地块和 Element"""
    try:
        area = get_object_or_404(TerrainArea, id=area_id)
        # 获取该区域下所有未删除的地块，并预加载 elements
        zones = TerrainZone.objects.filter(area_obj=area, is_deleted=False).prefetch_related('elements')
        
        area_serializer = TerrainAreaSerializer(area)
        zones_serializer = TerrainZoneSerializer(zones, many=True)
        
        return api_response(data={
            "area": area_serializer.data,
            "zones": zones_serializer.data
        })
    except Exception as e:
        logger.error(f"获取区域编辑详情异常: {str(e)}")
        return api_error(msg=str(e), status=500)

# --- TerrainZone API ---

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
    """要素创建或更新"""
    try:
        element_id = request.data.get('id')
        if element_id:
            element = get_object_or_404(TerrainElement, id=element_id)
            serializer = TerrainElementSerializer(element, data=request.data, partial=True)
            msg = "要素更新成功"
        else:
            serializer = TerrainElementSerializer(data=request.data)
            msg = "要素创建成功"

        if serializer.is_valid():
            element = serializer.save()
            return api_response(data=TerrainElementSerializer(element).data, msg=msg)
        return api_error(msg="数据校验失败", data=serializer.errors)
    except Exception as e:
        logger.error(f"保存要素异常: {str(e)}")
        return api_error(msg=str(e), status=500)

@api_view(['DELETE', 'POST'])
@permission_classes([AllowAny])
def delete_element(request, pk):
    """要素物理删除"""
    try:
        element = get_object_or_404(TerrainElement, id=pk)
        element.delete()
        return api_response(msg="要素已删除")
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
    """合并地块: 检查 Elements 是否一致"""
    try:
        zone_ids = request.data.get('ids', [])
        if len(zone_ids) < 2:
            return api_error(msg="请选择至少两个地块进行合并")
            
        zones = TerrainZone.objects.filter(id__in=zone_ids, is_deleted=False)
        if zones.count() < 2:
            return api_error(msg="部分地块不存在或已被删除")
            
        # 检查 Elements 是否一致 (简单通过名称和类型比对)
        first_elements = set(zones[0].elements.values_list('name', 'type'))
        for zone in zones[1:]:
            curr_elements = set(zone.elements.values_list('name', 'type'))
            if first_elements != curr_elements:
                return api_error(msg="所选地块的要素(Elements)不一致，无法合并")
                
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
        
        # 获取所有子类别
        subcats = TerrainSubCategory.objects.filter(category=category)
        
        # 统计 m (全数据库数量)
        total_counts = TerrainZone.objects.filter(category=category, is_deleted=False).values('type').annotate(m=Count('id'))
        m_map = {item['type']: item['m'] for item in total_counts if item['type']}
        
        # 统计 n (当前区域数量)
        current_counts = TerrainZone.objects.filter(category=category, area_obj_id=area_id, is_deleted=False).values('type').annotate(n=Count('id'))
        n_map = {item['type']: item['n'] for item in current_counts if item['type']}
        
        data = []
        for sc in subcats:
            data.append({
                "id": sc.id,
                "name": sc.name,
                "n": n_map.get(sc.name, 0),
                "m": m_map.get(sc.name, 0)
            })
            
        return api_response(data=data)
    except Exception as e:
        return api_error(msg=str(e), status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def add_subcategory(request):
    """新增子类别"""
    try:
        category = request.data.get('category')
        name = request.data.get('name')
        if not category or not name:
            return api_error(msg="参数不完整")
            
        subcat, created = TerrainSubCategory.objects.get_or_create(category=category, name=name)
        return api_response(data=TerrainSubCategorySerializer(subcat).data, msg="子类别已新增")
    except Exception as e:
        return api_error(msg=str(e), status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def delete_subcategory(request):
    """删除子类别"""
    try:
        subcat_id = request.data.get('id')
        subcat = get_object_or_404(TerrainSubCategory, id=subcat_id)
        subcat.delete()
        return api_response(msg="子类别已删除")
    except Exception as e:
        return api_error(msg=str(e), status=500)

# --- 为了兼容旧代码的占位符 (如果需要) ---
def create_plot(request): return create_or_update_zone(request)
def list_plots(request): 
    # 临时兼容
    queryset = TerrainZone.objects.filter(is_deleted=False)
    serializer = TerrainZoneSerializer(queryset, many=True)
    return api_response(data=serializer.data)
def plot_detail(request, pk):
    zone = get_object_or_404(TerrainZone, pk=pk, is_deleted=False)
    return api_response(data=TerrainZoneSerializer(zone).data)
def update_plot(request, pk):
    request.data['id'] = pk
    return create_or_update_zone(request)
