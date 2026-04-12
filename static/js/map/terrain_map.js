// 地形地图逻辑

class TerrainMap {
  constructor(mapId) {
    // 使用全局变量
    const initMap = window.initMap;
    const LayerManager = window.LayerManager;
    
    this.map = initMap(mapId);
    this.layerManager = new LayerManager(this.map);
    this.currentTerrain = null;
    this.terrainPolygons = [];
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
    // 清空现有地形图层
    this.clearTerrains();
    
    // 添加新的地形多边形
    terrains.forEach(terrain => {
      // 根据风险等级设置不同的样式
      let style = this.polygonStyles.default;
      if (terrain.risk_level === '高') {
        style = this.polygonStyles.danger;
      } else if (terrain.risk_level === '中等') {
        style = this.polygonStyles.warning;
      }

      const polygon = L.polygon(terrain.coordinates, {
        ...style,
        className: `terrain-polygon terrain-${terrain.id}`
      });
      
      // 添加点击事件
      polygon.on('click', () => {
        this.selectTerrain(terrain);
      });
      
      // 添加弹出信息
      polygon.bindPopup(`<strong>${terrain.name}</strong><br>面积: ${terrain.area} 公顷<br>类型: ${terrain.type}<br>风险等级: ${terrain.risk_level}`);
      
      this.layerManager.addLayer(`terrain-${terrain.id}`, polygon, 'terrains');
      this.terrainPolygons.push(polygon);
    });

    // 自动适配地图范围
    this.fitToTerrains();
  }

  // 加载风险区域数据
  loadRiskAreas(riskAreas) {
    // 清空现有风险区域图层
    this.clearRisks();
    
    // 添加新的风险区域多边形
    riskAreas.forEach(area => {
      const polygon = L.polygon(area.coordinates, {
        ...this.polygonStyles.danger,
        className: `risk-polygon risk-${area.id}`
      });
      
      // 添加弹出信息
      polygon.bindPopup(`<strong>风险区域</strong><br>名称: ${area.name}<br>所属地形: ${area.terrain_name}<br>风险等级: ${area.risk_level}<br>面积: ${area.area} 公顷`);
      
      this.layerManager.addLayer(`risk-${area.id}`, polygon, 'risks');
      this.riskPolygons.push(polygon);
    });
  }

  // 加载测绘轨迹
  loadSurveyPaths(surveys) {
    // 清空现有测绘轨迹
    this.clearSurveys();
    
    // 添加新的测绘轨迹
    surveys.forEach(survey => {
      const path = L.polyline(survey.coordinates, {
        ...this.pathStyles.survey,
        className: `survey-path survey-${survey.id}`
      });
      
      // 添加弹出信息
      path.bindPopup(`<strong>测绘任务</strong><br>任务名称: ${survey.name}<br>开始时间: ${survey.start_time}<br>结束时间: ${survey.end_time}<br>数据精度: ${survey.accuracy}%`);
      
      this.layerManager.addLayer(`survey-${survey.id}`, path, 'surveys');
      this.surveyPaths.push(path);
    });
  }

  // 选择地形
  selectTerrain(terrain) {
    // 取消之前选中的地形
    if (this.currentTerrain) {
      const previousPolygon = this.terrainPolygons.find(p => p._path.classList.contains(`terrain-${this.currentTerrain.id}`));
      if (previousPolygon) {
        // 恢复原始样式
        let style = this.polygonStyles.default;
        if (this.currentTerrain.risk_level === '高') {
          style = this.polygonStyles.danger;
        } else if (this.currentTerrain.risk_level === '中等') {
          style = this.polygonStyles.warning;
        }
        previousPolygon.setStyle(style);
      }
    }

    // 高亮当前选中的地形
    this.currentTerrain = terrain;
    const currentPolygon = this.terrainPolygons.find(p => p._path.classList.contains(`terrain-${terrain.id}`));
    if (currentPolygon) {
      currentPolygon.setStyle(this.polygonStyles.highlight);
    }

    // 触发地形选择事件
    const event = new CustomEvent('terrainSelected', { detail: terrain });
    document.dispatchEvent(event);

    // 定位到选中的地形
    if (currentPolygon) {
      this.map.fitBounds(currentPolygon.getBounds(), { padding: [50, 50] });
    }
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
    if (this.terrainPolygons.length > 0) {
      this.fitMapToLayers(this.map, this.terrainPolygons);
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
    this.terrainPolygons.forEach(polygon => {
      this.layerManager.removeLayer(polygon._leaflet_id.toString());
    });
    this.terrainPolygons = [];
  }

  // 清空风险区域
  clearRisks() {
    this.riskPolygons.forEach(polygon => {
      this.layerManager.removeLayer(polygon._leaflet_id.toString());
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