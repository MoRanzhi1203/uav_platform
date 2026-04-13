import geopandas as gpd
import pandas as pd
import os

# 输入和输出路径
shp_dir = 'static/shp/chongqing-260411-free.shp'
geojson_dir = 'static/geojson'

# 确保输出目录存在
os.makedirs(geojson_dir, exist_ok=True)

# 处理林区
print("处理林区数据...")
landuse = gpd.read_file(os.path.join(shp_dir, 'gis_osm_landuse_a_free_1.shp'))
natural = gpd.read_file(os.path.join(shp_dir, 'gis_osm_natural_a_free_1.shp'))

# 筛选林区数据
forest_landuse = landuse[(landuse['fclass'] == 'forest')]
forest_natural = natural[(natural['fclass'] == 'wood')]

# 合并林区数据
forest = gpd.GeoDataFrame(pd.concat([forest_landuse, forest_natural], ignore_index=True))

# 保存为 GeoJSON
forest.to_file(os.path.join(geojson_dir, 'forest.json'), driver='GeoJSON', encoding='utf-8')
print(f"林区数据已保存到: {os.path.join(geojson_dir, 'forest.json')}")

# 处理农田
print("处理农田数据...")
# 筛选农田数据
farmland = landuse[(landuse['fclass'].isin(['farmland', 'orchard', 'farmyard']))]

# 保存为 GeoJSON
farmland.to_file(os.path.join(geojson_dir, 'farmland.json'), driver='GeoJSON', encoding='utf-8')
print(f"农田数据已保存到: {os.path.join(geojson_dir, 'farmland.json')}")

# 处理水域
print("处理水域数据...")
waterways = gpd.read_file(os.path.join(shp_dir, 'gis_osm_waterways_free_1.shp'))
waterareas = gpd.read_file(os.path.join(shp_dir, 'gis_osm_water_a_free_1.shp'))

# 筛选水域数据
water_natural = natural[(natural['fclass'] == 'water')]
water = gpd.GeoDataFrame(pd.concat([water_natural, waterways, waterareas], ignore_index=True))

# 保存为 GeoJSON
water.to_file(os.path.join(geojson_dir, 'water.json'), driver='GeoJSON', encoding='utf-8')
print(f"水域数据已保存到: {os.path.join(geojson_dir, 'water.json')}")

# 处理道路
print("处理道路数据...")
roads = gpd.read_file(os.path.join(shp_dir, 'gis_osm_roads_free_1.shp'))

# 保存为 GeoJSON
roads.to_file(os.path.join(geojson_dir, 'roads.json'), driver='GeoJSON', encoding='utf-8')
print(f"道路数据已保存到: {os.path.join(geojson_dir, 'roads.json')}")

# 处理建筑/居住区
print("处理建筑/居住区数据...")
buildings = gpd.read_file(os.path.join(shp_dir, 'gis_osm_buildings_a_free_1.shp'))
residential = landuse[(landuse['fclass'] == 'residential')]

# 合并建筑/居住区数据
buildings_residential = gpd.GeoDataFrame(pd.concat([buildings, residential], ignore_index=True))

# 保存为 GeoJSON
buildings_residential.to_file(os.path.join(geojson_dir, 'buildings.json'), driver='GeoJSON', encoding='utf-8')
print(f"建筑/居住区数据已保存到: {os.path.join(geojson_dir, 'buildings.json')}")

print("所有数据处理完成！")
