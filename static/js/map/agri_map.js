// 农田地图逻辑

class AgriMap {
  constructor(mapId) {
    // 使用全局变量
    const initMap = window.initMap;
    const LayerManager = window.LayerManager;
    
    this.map = initMap(mapId);
    this.layerManager = new LayerManager(this.map);
    this.currentFarm = null;
    this.farmPolygons = [];
    this.pestMarkers = [];
    this.sprayPaths = [];
    
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
    this.layerManager.addLayerGroup('farms');
    this.layerManager.addLayerGroup('pests');
    this.layerManager.addLayerGroup('sprays');
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

  // 加载农田数据
  loadFarms(farms) {
    // 清空现有农田图层
    this.clearFarms();
    
    // 添加新的农田多边形
    farms.forEach(farm => {
      const polygon = L.polygon(farm.coordinates, {
        ...this.polygonStyles.default,
        className: `farm-polygon farm-${farm.id}`
      });
      
      // 添加点击事件
      polygon.on('click', () => {
        this.selectFarm(farm);
      });
      
      // 添加弹出信息
      polygon.bindPopup(`<strong>${farm.name}</strong><br>面积: ${farm.area} 公顷<br>作物: ${farm.crop_type}`);
      
      this.layerManager.addLayer(`farm-${farm.id}`, polygon, 'farms');
      this.farmPolygons.push(polygon);
    });

    // 自动适配地图范围
    this.fitToFarms();
  }

  // 加载病虫害数据
  loadPestAlerts(pestAlerts) {
    // 清空现有病虫害图层
    this.clearPests();
    
    // 添加新的病虫害标记
    pestAlerts.forEach(alert => {
      const marker = L.marker([alert.latitude, alert.longitude], {
        icon: this.markerStyles.pest.icon,
        className: `pest-marker pest-${alert.id}`
      });
      
      // 添加弹出信息
      marker.bindPopup(`<strong>病虫害预警</strong><br>位置: ${alert.location}<br>时间: ${alert.time}<br>类型: ${alert.type}<br>严重程度: ${alert.level}`);
      
      this.layerManager.addLayer(`pest-${alert.id}`, marker, 'pests');
      this.pestMarkers.push(marker);
    });
  }

  // 加载植保轨迹
  loadSprayPaths(sprays) {
    // 清空现有植保轨迹
    this.clearSprays();
    
    // 添加新的植保轨迹
    sprays.forEach(spray => {
      const path = L.polyline(spray.coordinates, {
        ...this.pathStyles.spray,
        className: `spray-path spray-${spray.id}`
      });
      
      // 添加弹出信息
      path.bindPopup(`<strong>植保任务</strong><br>任务名称: ${spray.name}<br>开始时间: ${spray.start_time}<br>结束时间: ${spray.end_time}`);
      
      this.layerManager.addLayer(`spray-${spray.id}`, path, 'sprays');
      this.sprayPaths.push(path);
    });
  }

  // 选择农田
  selectFarm(farm) {
    // 取消之前选中的农田
    if (this.currentFarm) {
      const previousPolygon = this.farmPolygons.find(p => p._path.classList.contains(`farm-${this.currentFarm.id}`));
      if (previousPolygon) {
        previousPolygon.setStyle(this.polygonStyles.default);
      }
    }

    // 高亮当前选中的农田
    this.currentFarm = farm;
    const currentPolygon = this.farmPolygons.find(p => p._path.classList.contains(`farm-${farm.id}`));
    if (currentPolygon) {
      currentPolygon.setStyle(this.polygonStyles.highlight);
    }

    // 触发农田选择事件
    const event = new CustomEvent('farmSelected', { detail: farm });
    document.dispatchEvent(event);

    // 定位到选中的农田
    if (currentPolygon) {
      this.map.fitBounds(currentPolygon.getBounds(), { padding: [50, 50] });
    }
  }

  // 切换图层可见性
  toggleLayer(layer, visible) {
    switch (layer) {
      case 'farm':
        this.layerManager.toggleLayer('farms', visible);
        break;
      case 'pest':
        this.layerManager.toggleLayer('pests', visible);
        break;
      case 'spray':
        this.layerManager.toggleLayer('sprays', visible);
        break;
    }
  }

  // 重置地图视图
  resetView() {
    this.fitToFarms();
  }

  // 适配到所有农田
  fitToFarms() {
    if (this.farmPolygons.length > 0) {
      this.fitMapToLayers(this.map, this.farmPolygons);
    }
  }

  // 切换全屏
  toggleFullscreen() {
    const mapContainer = document.getElementById('farmMap');
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

  // 清空农田
  clearFarms() {
    this.farmPolygons.forEach(polygon => {
      this.layerManager.removeLayer(polygon._leaflet_id.toString());
    });
    this.farmPolygons = [];
  }

  // 清空病虫害
  clearPests() {
    this.pestMarkers.forEach(marker => {
      this.layerManager.removeLayer(marker._leaflet_id.toString());
    });
    this.pestMarkers = [];
  }

  // 清空植保轨迹
  clearSprays() {
    this.sprayPaths.forEach(path => {
      this.layerManager.removeLayer(path._leaflet_id.toString());
    });
    this.sprayPaths = [];
  }

  // 清空所有数据
  clearAll() {
    this.clearFarms();
    this.clearPests();
    this.clearSprays();
    this.currentFarm = null;
  }
}

// 全局变量
try {
  window.AgriMap = AgriMap;
} catch (e) {
  console.error('无法设置全局变量:', e);
}