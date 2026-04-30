import os
import django
import json
import sys

# 设置项目根目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uav_platform.settings')
django.setup()

from terrain.models import TerrainArea, TerrainZone

def check_agri_data():
    print("--- 详细检查农业数据 ---")
    
    # 1. 检查 TerrainArea
    all_areas = TerrainArea.objects.using('terrain').all()
    print(f"TerrainArea 总数: {all_areas.count()}")
    
    farm_areas = TerrainArea.objects.using('terrain').filter(type='farm')
    print(f"TerrainArea (type='farm') 数量: {farm_areas.count()}")
    for area in farm_areas:
        print(f"  - ID: {area.id}, 名称: {area.name}, is_deleted: {area.is_deleted}")

    # 2. 检查 TerrainZone
    farmland_zones = TerrainZone.objects.using('terrain').filter(category='farmland')
    print(f"TerrainZone (category='farmland') 数量: {farmland_zones.count()}")
    if farmland_zones.exists():
        zone = farmland_zones.first()
        print(f"  - 示例 Zone: {zone.name}, category: {zone.category}, area_obj_id: {zone.area_obj_id}")

    # 3. 模拟 API 调用逻辑
    print("\n--- 模拟 API 返回数据 ---")
    result = []
    active_farm_areas = farm_areas.filter(is_deleted=False)
    for i, area in enumerate(active_farm_areas):
        plot_count = TerrainZone.objects.using('terrain').filter(area_obj=area, category="farmland", is_deleted=False).count()
        result.append({
            "id": area.id,
            "area_name": area.name,
            "plot_count": plot_count,
        })
    
    if not result:
        print("警告: 没有任何活跃的农田区域 (is_deleted=False)!")
        print("这解释了为什么页面没有数据。")
    else:
        print(f"API 将返回的示范区数量: {len(result)}")
        print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    check_agri_data()
