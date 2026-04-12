from django.shortcuts import render
from django.http import JsonResponse
from .models import Terrain

# 地形管理主页
def terrain_index(request):
    return render(request, 'terrain/index.html')

# 地块编辑器页面
def terrain_editor(request):
    return render(request, 'terrain/editor.html')

# 保存地块数据
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

# 获取地形数据
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
