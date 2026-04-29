# GeoJSON 优化脚本
# 使用 mapshaper 简化几何数据，减少文件大小

$geojsonDir = "E:\PythonWeb\uav_platform\static\geojson"
$backupDir = "E:\PythonWeb\uav_platform\static\geojson_backup"

# 创建备份目录
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force
    Write-Host "创建备份目录: $backupDir"
}

# 要处理的文件列表
$files = @(
    "buildings.json",
    "farmland.json",
    "roads.json",
    "water.json"
)

foreach ($file in $files) {
    $inputFile = Join-Path $geojsonDir $file
    $backupFile = Join-Path $backupDir $file
    $outputFile = Join-Path $geojsonDir $file
    
    if (Test-Path $inputFile) {
        # 备份原始文件
        Copy-Item -Path $inputFile -Destination $backupFile -Force
        Write-Host "备份文件: $file -> $backupFile"
        
        # 使用 mapshaper 简化几何
        # 对于不同类型的图层使用不同的简化参数
        if ($file -eq "roads.json") {
            # 道路图层，保留更多细节
            Write-Host "优化道路图层..."
            & mapshaper $inputFile -simplify 0.001 -o $outputFile
        } elseif ($file -eq "buildings.json") {
            # 建筑图层，中等简化
            Write-Host "优化建筑图层..."
            & mapshaper $inputFile -simplify 0.005 -o $outputFile
        } else {
            # 其他图层，适当简化
            Write-Host "优化 $file 图层..."
            & mapshaper $inputFile -simplify 0.01 -o $outputFile
        }
        
        # 检查优化前后的文件大小
        $originalSize = (Get-Item $backupFile).Length
        $optimizedSize = (Get-Item $outputFile).Length
        $reduction = [math]::Round((1 - $optimizedSize / $originalSize) * 100, 2)
        
        Write-Host "优化完成: $file"
        Write-Host "原始大小: $($originalSize / 1MB.ToString('0.00')) MB"
        Write-Host "优化大小: $($optimizedSize / 1MB.ToString('0.00')) MB"
        Write-Host "减少比例: $reduction%"
        Write-Host ""
    } else {
        Write-Host "文件不存在: $inputFile"
        Write-Host ""
    }
}

Write-Host "所有文件优化完成!"
