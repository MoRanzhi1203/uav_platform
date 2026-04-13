import logging
import traceback
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from .models import TerrainArea, TerrainZone, TerrainElement
from .serializers import TerrainAreaSerializer, TerrainZoneSerializer, TerrainElementSerializer
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
