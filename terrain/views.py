import logging
import traceback
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from .models import Terrain, TerrainPlot
from .serializers import TerrainPlotSerializer
from common.responses import api_response, api_error

logger = logging.getLogger(__name__)

# 地形管理主页
def terrain_index(request):
    return render(request, 'terrain/index.html')

# 地块编辑器页面
def terrain_editor(request):
    return render(request, 'terrain/editor.html')

# --- TerrainPlot API ---

@api_view(['POST'])
@permission_classes([AllowAny])
def create_plot(request):
    """创建地块"""
    try:
        # 记录请求内容，便于排错
        logger.info(f"收到创建地块请求, data: {request.data}")
        
        serializer = TerrainPlotSerializer(data=request.data)
        if serializer.is_valid():
            plot = serializer.save()
            logger.info(f"地块创建成功, ID: {plot.id}")
            return api_response(data=serializer.data, msg="地块创建成功")
        
        # 校验失败时返回详细错误信息
        logger.warning(f"地块数据校验失败: {serializer.errors}")
        return api_error(msg="数据校验失败", data=serializer.errors)
    except Exception as e:
        logger.error(f"创建地块发生系统异常: {str(e)}")
        logger.error(traceback.format_exc())
        return api_error(msg=f"服务器内部错误: {str(e)}", status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def list_plots(request):
    """地块列表"""
    try:
        map_id = request.query_params.get('map_id')
        queryset = TerrainPlot.objects.filter(is_deleted=False)
        if map_id:
            queryset = queryset.filter(map_id=map_id)
        
        serializer = TerrainPlotSerializer(queryset, many=True)
        return api_response(data=serializer.data)
    except Exception as e:
        logger.error(f"获取地块列表异常: {str(e)}")
        return api_error(msg=str(e), status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def plot_detail(request, pk):
    """地块详情"""
    try:
        plot = get_object_or_404(TerrainPlot, pk=pk, is_deleted=False)
        serializer = TerrainPlotSerializer(plot)
        return api_response(data=serializer.data)
    except Exception as e:
        return api_error(msg=str(e), status=500)

@api_view(['POST', 'PUT'])
@permission_classes([AllowAny])
def update_plot(request, pk):
    """更新地块"""
    try:
        plot = get_object_or_404(TerrainPlot, pk=pk, is_deleted=False)
        serializer = TerrainPlotSerializer(plot, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return api_response(data=serializer.data, msg="地块更新成功")
        return api_error(msg="数据校验失败", data=serializer.errors)
    except Exception as e:
        logger.error(f"更新地块异常: {str(e)}")
        return api_error(msg=str(e), status=500)

@api_view(['POST', 'DELETE'])
@permission_classes([AllowAny])
def delete_plot(request, pk):
    """删除地块 (逻辑删除)"""
    try:
        plot = get_object_or_404(TerrainPlot, pk=pk)
        plot.is_deleted = True
        plot.save()
        return api_response(msg="地块已删除")
    except Exception as e:
        return api_error(msg=str(e), status=500)

# --- 原有逻辑 (保留或重写) ---

# 保存地块数据 (旧逻辑，如果不再使用可以后续清理)
def save_plot(request):
    if request.method == 'POST':
        try:
            # 获取表单数据
            name = request.POST.get('name')
            plot_type = request.POST.get('type')
            risk_level = request.POST.get('riskLevel')
            description = request.POST.get('description')
            area = request.POST.get('area')
            coordinates = request.POST.get('coordinates')
            
            # 创建新地形
            terrain = Terrain(
                name=name,
                type=plot_type,
                risk_level=risk_level,
                description=description,
                area=area,
                coordinates=coordinates
            )
            terrain.save()
            
            return JsonResponse({'success': True, 'id': terrain.id})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    return JsonResponse({'success': False, 'error': 'Invalid request method'})

# 获取地形数据 (旧逻辑)
def get_terrain_data(request):
    try:
        # 获取所有地形数据
        terrains = Terrain.objects.all()
        terrain_data = []
        
        for terrain in terrains:
            terrain_data.append({
                'id': terrain.id,
                'name': terrain.name,
                'type': terrain.type,
                'risk_level': terrain.risk_level,
                'area': terrain.area,
                'description': terrain.description,
                'coordinates': terrain.coordinates,
                'created_at': terrain.created_at.isoformat()
            })
        
        return JsonResponse({'success': True, 'data': terrain_data})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})
