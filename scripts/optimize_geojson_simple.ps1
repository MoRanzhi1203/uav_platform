# GeoJSON 优化脚本
# 使用 mapshaper 简化几何数据，减少文件大小

$geojsonDir = "E:\PythonWeb\uav_platform\static\geojson"

# 处理 buildings.json
Write-Host "处理 buildings.json..."
& mapshaper "$geojsonDir\buildings.json" -simplify 0.005 -o force "$geojsonDir\buildings.json"

# 处理 farmland.json
Write-Host "处理 farmland.json..."
& mapshaper "$geojsonDir\farmland.json" -simplify 0.01 -o force "$geojsonDir\farmland.json"

# 处理 roads.json
Write-Host "处理 roads.json..."
& mapshaper "$geojsonDir\roads.json" -simplify 0.001 -o force "$geojsonDir\roads.json"

# 处理 water.json
Write-Host "处理 water.json..."
& mapshaper "$geojsonDir\water.json" -simplify 0.01 -o force "$geojsonDir\water.json"

Write-Host "所有文件优化完成!"
