// 地形地图逻辑

class TerrainMap {
  constructor(mapId) {
    // 使用全局变量
    const initMap = window.initMap;
    const LayerManager = window.LayerManager;
    
    this.map = initMap(mapId);
    this.layerManager = new LayerManager(this.map);
    this.currentTerrain = null;
    this.terrainLayers = new Map(); // 使用 Map 存储地形图层，方便根据 ID 查找
    this.riskPolygons = [];
    this.surveyPaths = [];
    
    // 保存样式和工具函数
    this.polygonStyles = window.polygonStyles;
    this.markerStyles = window.markerStyles;
    this.pathStyles = window.pathStyles;
    this.fitMapToLayers = window.fitMapToLayers;
  }

  // 初始化地图
  init() {
    this.addLayerGroups();
    this.bindEvents();
  }

  // 添加图层组
  addLayerGroups() {
    this.layerManager.addLayerGroup('terrains');
    this.layerManager.addLayerGroup('risks');
    this.layerManager.addLayerGroup('surveys');
  }

  // 绑定事件
  bindEvents() {
    // 图层切换按钮事件
    document.querySelectorAll('[data-layer]').forEach(button => {
      button.addEventListener('click', () => {
        const layer = button.getAttribute('data-layer');
        this.toggleLayer(layer, button.classList.toggle('active'));
      });
    });

    // 重置地图按钮
    document.getElementById('resetMapBtn').addEventListener('click', () => {
      this.resetView();
    });

    // 全屏按钮
    document.getElementById('fullscreenBtn').addEventListener('click', () => {
      this.toggleFullscreen();
    });
  }

  // 加载地形数据
  loadTerrains(terrains) {
    console.log('加载地形列表:', terrains.length, '个');
    // 清空现有地形图层
    this.clearTerrains();
    
    // 添加新的地形多边形
    terrains.forEach(terrain => {
      // 检查是否有边界数据
      const hasBoundary = terrain.boundary_json && terrain.boundary_json.type;
      
      if (!hasBoundary) {
        console.warn(`地形 ${terrain.name} (ID: ${terrain.id}) 缺少有效的边界数据`);
        return;
      }

      // 根据风险等级设置不同的样式
      let style = this.getTerrainStyle(terrain.riskLevelRaw || terrain.risk_level);

      const geoJsonLayer = L.geoJSON(terrain.boundary_json, {
        style: style,
        onEachFeature: (feature, layer) => {
          layer.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            this.selectTerrain(terrain);
          });
          layer.bindPopup(`<strong>${terrain.name}</strong><br>面积: ${parseFloat(terrain.area).toFixed(2)} 公顷<br>地块数: ${terrain.zone_count}<br>风险等级: ${terrain.risk_level}`);
        }
      });
      
      this.layerManager.addLayer(`terrain-${terrain.id}`, geoJsonLayer, 'terrains');
      // 统一使用数字 ID 存储，提高查找稳定性
      this.terrainLayers.set(Number(terrain.id), geoJsonLayer);
    });

    // 自动适配地图范围
    this.fitToTerrains();
  }

  getTerrainStyle(riskLevel) {
    if (riskLevel === 'high' || riskLevel === '高') {
      return this.polygonStyles.danger;
    } else if (riskLevel === 'medium' || riskLevel === '中') {
      return this.polygonStyles.warning;
    }
    return this.polygonStyles.default;
  }

  // 加载风险区域数据
  loadRiskAreas(riskAreas) {
    this.clearRisks();
    riskAreas.forEach(area => {
      const geoJsonLayer = L.geoJSON(area.boundary_json || area.geojson, {
        style: this.polygonStyles.danger,
        onEachFeature: (feature, layer) => {
          layer.bindPopup(`<strong>风险区域</strong><br>名称: ${area.name}<br>所属地形: ${area.terrain_name}<br>风险等级: ${area.risk_level}<br>面积: ${area.area} 公顷`);
        }
      });
      this.layerManager.addLayer(`risk-${area.id}`, geoJsonLayer, 'risks');
      this.riskPolygons.push(geoJsonLayer);
    });
  }

  // 加载测绘轨迹
  loadSurveyPaths(surveys) {
    this.clearSurveys();
    surveys.forEach(survey => {
      const path = L.polyline(survey.coordinates, {
        ...this.pathStyles.survey,
        className: `survey-path survey-${survey.id}`
      });
      path.bindPopup(`<strong>测绘任务</strong><br>任务名称: ${survey.name}<br>开始时间: ${survey.start_time}<br>结束时间: ${survey.end_time}<br>数据精度: ${survey.accuracy}%`);
      this.layerManager.addLayer(`survey-${survey.id}`, path, 'surveys');
      this.surveyPaths.push(path);
    });
  }

  // 选择地形
  async selectTerrain(terrain) {
    if (!terrain || !terrain.id) return;

    console.log('选择地形:', terrain.name, 'ID:', terrain.id);

    // 取消之前选中的地形高亮
    if (this.currentTerrain) {
      const prevLayer = this.terrainLayers.get(Number(this.currentTerrain.id)) || this.terrainLayers.get(String(this.currentTerrain.id));
      if (prevLayer) {
        prevLayer.setStyle(this.getTerrainStyle(this.currentTerrain.riskLevelRaw || this.currentTerrain.risk_level));
      }
    }

    // 更新当前选中
    this.currentTerrain = terrain;
    
    // 查找并高亮 Area 图层
    const terrainId = Number(terrain.id);
    const currentLayer = this.terrainLayers.get(terrainId);
    
    if (currentLayer) {
      currentLayer.setStyle(this.polygonStyles.highlight);
      currentLayer.bringToFront();
    }

    // --- 核心增强：加载并展示该区域下的具体地块（Zones） ---
    try {
      const response = await fetch(`/terrain/api/areas/${terrainId}/edit/`);
      const result = await response.json();
      
      if (result.code === 0 && result.data.zones) {
        console.log(`加载到 ${result.data.zones.length} 个地块`);
        this.loadZones(result.data.zones);
        
        // 如果有地块，优先缩放到所有地块的范围
        if (this.riskPolygons.length > 0) {
          const group = L.featureGroup(this.riskPolygons);
          const bounds = group.getBounds();
          if (bounds.isValid()) {
            this.map.fitBounds(bounds, { padding: [100, 100], animate: true });
            return; // 成功缩放到地块范围，直接返回
          }
        }
      }
    } catch (err) {
      console.error('加载区域地块详情失败:', err);
    }

    // 备选方案：如果没能加载地块或地块无范围，则尝试缩放 Area 图层或定位中心点
    if (currentLayer) {
      const bounds = currentLayer.getBounds();
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [120, 120], maxZoom: 16, animate: true });
      }
    } else if (terrain.center && terrain.center[0]) {
      this.map.setView(terrain.center, 15, { animate: true });
    }

    // 触发外部联动事件
    const event = new CustomEvent('terrainSelected', { detail: terrain });
    document.dispatchEvent(event);
  }

  // 新增：加载具体地块（Zones）到地图
  loadZones(zones) {
    this.clearRisks(); // 清除之前的地块图层
    
    zones.forEach(zone => {
      if (!zone.geom_json || !zone.geom_json.type) return;

      const geoJsonLayer = L.geoJSON(zone.geom_json, {
        style: (feature) => {
          // 根据地块分类设置颜色（如果需要）
          return {
            fillColor: this.getZoneColor(zone.category),
            fillOpacity: 0.5,
            color: '#ffffff',
            weight: 1
          };
        },
        onEachFeature: (feature, layer) => {
          layer.bindPopup(`<strong>地块: ${zone.name}</strong><br>分类: ${zone.category}<br>面积: ${zone.area.toFixed(2)} 公顷`);
        }
      });
      
      this.layerManager.addLayer(`zone-${zone.id}`, geoJsonLayer, 'risks'); // 复用 risks 图层组
      this.riskPolygons.push(geoJsonLayer);
    });
  }

  // 根据地块分类获取颜色
  getZoneColor(category) {
    const colors = {
      'forest': '#10b981', // 绿
      'farmland': '#f59e0b', // 橙
      'water': '#3b82f6', // 蓝
      'building': '#6b7280', // 灰
      'road': '#9ca3af', // 浅灰
      'bare': '#d1d5db' // 极浅灰
    };
    return colors[category] || '#3b82f6';
  }

  // 切换图层可见性
  toggleLayer(layer, visible) {
    switch (layer) {
      case 'terrain':
        this.layerManager.toggleLayer('terrains', visible);
        break;
      case 'risk':
        this.layerManager.toggleLayer('risks', visible);
        break;
      case 'survey':
        this.layerManager.toggleLayer('surveys', visible);
        break;
    }
  }

  // 重置地图视图
  resetView() {
    this.fitToTerrains();
  }

  // 适配到所有地形
  fitToTerrains() {
    const allLayers = Array.from(this.terrainLayers.values());
    if (allLayers.length > 0) {
      const group = L.featureGroup(allLayers);
      this.map.fitBounds(group.getBounds(), { padding: [50, 50], animate: true });
    }
  }

  // 切换全屏
  toggleFullscreen() {
    const mapContainer = document.getElementById('terrainMap');
    if (!document.fullscreenElement) {
      mapContainer.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  // 清空地形
  clearTerrains() {
    this.terrainLayers.forEach((layer, id) => {
      this.layerManager.removeLayer(`terrain-${id}`);
    });
    this.terrainLayers.clear();
  }

  // 清空风险区域
  clearRisks() {
    this.riskPolygons.forEach(layer => {
      this.layerManager.removeLayer(layer._leaflet_id.toString());
    });
    this.riskPolygons = [];
  }

  // 清空测绘轨迹
  clearSurveys() {
    this.surveyPaths.forEach(path => {
      this.layerManager.removeLayer(path._leaflet_id.toString());
    });
    this.surveyPaths = [];
  }

  // 清空所有数据
  clearAll() {
    this.clearTerrains();
    this.clearRisks();
    this.clearSurveys();
    this.currentTerrain = null;
  }
}

// 全局变量
try {
  window.TerrainMap = TerrainMap;
} catch (e) {
  console.error('无法设置全局变量:', e);
}
