import json
import os
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uav_platform.settings')
django.setup()

from terrain.models import TerrainType, Terrain, TerrainFeature

def import_terrain_data(geojson_file):
    with open(geojson_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 导入地形类型
    terrain_type_map = {}
    for type_data in data.get('terrain_types', []):
        terrain_type, created = TerrainType.objects.get_or_create(
            type_code=type_data['type_code'],
            defaults={
                'type_name': type_data['type_name'],
                'description': type_data['description']
            }
        )
        terrain_type_map[type_data['type_code']] = terrain_type.id
        print(f"{'Created' if created else 'Updated'} terrain type: {type_data['type_name']}")
    
    # 导入地形数据
    for feature in data.get('features', []):
        properties = feature['properties']
        geometry = feature['geometry']
        
        # 获取地形类型ID
        terrain_type_code = properties['terrain_type_code']
        terrain_type_id = terrain_type_map.get(terrain_type_code, 0)
        
        # 创建地形
        terrain, created = Terrain.objects.get_or_create(
            terrain_code=properties['terrain_code'],
            defaults={
                'terrain_name': properties['terrain_name'],
                'terrain_type_id': terrain_type_id,
                'region': properties['region'],
                'area_mu': properties['area_mu'],
                'longitude': geometry['coordinates'][0],
                'latitude': geometry['coordinates'][1],
                'farm_plot_id': properties['farm_plot_id'],
                'forest_area_id': properties['forest_area_id'],
                'description': properties['description']
            }
        )
        print(f"{'Created' if created else 'Updated'} terrain: {properties['terrain_name']}")
        
        # 创建地形特征
        feature_data = properties.get('feature', {})
        if feature_data:
            terrain_feature, feature_created = TerrainFeature.objects.get_or_create(
                terrain_id=terrain.id,
                defaults={
                    'slope': feature_data.get('slope', 0),
                    'elevation': feature_data.get('elevation', 0),
                    'soil_type': feature_data.get('soil_type', ''),
                    'vegetation_coverage': feature_data.get('vegetation_coverage', 0)
                }
            )
            print(f"{'Created' if feature_created else 'Updated'} terrain feature for: {properties['terrain_name']}")

if __name__ == '__main__':
    import_terrain_data('terrain_data.geojson')
    print("Terrain data import completed!")
