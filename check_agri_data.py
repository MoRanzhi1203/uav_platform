import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uav_platform.settings')
django.setup()

from terrain.models import TerrainArea, TerrainZone

def check_agri_data():
    print("--- 检查地形数据库中的农业数据 ---")
    farm_areas = TerrainArea.objects.using('terrain').filter(type='farm')
    print(f"TerrainArea (type='farm') 数量: {farm_areas.count()}")
    for area in farm_areas:
        print(f"  - ID: {area.id}, 名称: {area.name}")

    farmland_zones = TerrainZone.objects.using('terrain').filter(category='farmland')
    print(f"TerrainZone (category='farmland') 数量: {farmland_zones.count()}")
    
    # 检查是否有 'agri' 类型的区域 (有些地方可能混用了 'farm' 和 'agri')
    agri_areas = TerrainArea.objects.using('terrain').filter(type='agri')
    print(f"TerrainArea (type='agri') 数量: {agri_areas.count()}")

if __name__ == "__main__":
    check_agri_data()
