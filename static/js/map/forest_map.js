// 林区地图逻辑

class ForestMap {
  constructor(mapId) {
    // 使用全局变量
    const initMap = window.initMap;
    const LayerManager = window.LayerManager;
    
    this.map = initMap(mapId);
    this.layerManager = new LayerManager(this.map);
    this.currentForest = null;
    this.forestPolygons = [];
    this.fireMarkers = [];
    this.patrolPaths = [];
    
    // 保存样式和工具函数
    this.polygonStyles = window.polygonStyles || {
      default: {
        fillColor: '#3498db',
        weight: 2,
        opacity: 1,
        color: '#2980b9',
        fillOpacity: 0.3
      },
      highlight: {
        fillColor: '#e74c3c',
        weight: 3,
        opacity: 1,
        color: '#c0392b',
        fillOpacity: 0.5
      }
    };
    
    this.markerStyles = window.markerStyles || {
      fire: {
        icon: L.divIcon({
          className: 'custom-marker fire-marker',
          html: '<i class="bi bi-fire"></i>',
          iconSize: [30, 30]
        })
      }
    };
    
    this.pathStyles = window.pathStyles || {
      patrol: {
        color: '#3498db',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 10'
      }
    };
    
    this.fitMapToLayers = window.fitMapToLayers || function(map, layers) {
      const bounds = L.latLngBounds();
      layers.forEach(layer => {
        if (layer.getBounds) {
          bounds.extend(layer.getBounds());
        } else if (layer.getLatLng) {
          bounds.extend(layer.getLatLng());
        }
      });
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    };
  }
  
  // 初始化地图
  init() {
    this.addLayerGroups();
    this.bindEvents();
  }
  
  // 添加图层组
  addLayerGroups() {
    this.layerManager.addLayerGroup('forests');
    this.layerManager.addLayerGroup('fires');
    this.layerManager.addLayerGroup('patrols');
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
  
  // 加载林区数据
  loadForests(forests) {
    // 清空现有林区图层
    this.clearForests();
    
    // 添加新的林区多边形
    forests.forEach(forest => {
      if (forest.coordinates && forest.coordinates.length > 0) {
        const polygon = L.polygon(forest.coordinates, {
          ...this.polygonStyles.default,
          className: `forest-polygon forest-${forest.id}`
        });
        
        // 添加点击事件
        polygon.on('click', () => {
          this.selectForest(forest);
        });
        
        // 添加弹出信息
        polygon.bindPopup(`<strong>${forest.name}</strong><br>面积: ${forest.area} 公顷`);
        
        this.layerManager.addLayer(`forest-${forest.id}`, polygon, 'forests');
        this.forestPolygons.push(polygon);
      }
    });
    
    // 自动适配地图范围
    this.fitToForests();
  }
  
  // 加载火点数据
  loadFireAlerts(fireAlerts) {
    // 清空现有火点图层
    this.clearFires();
    
    // 添加新的火点标记
    fireAlerts.forEach(alert => {
      // 模拟火点坐标
      const lat = 29.5 + (Math.random() * 0.2);
      const lng = 106.5 + (Math.random() * 0.2);
      
      const marker = L.marker([lat, lng], {
        icon: this.markerStyles.fire.icon,
        className: `fire-marker fire-${alert.id}`
      });
      
      // 添加弹出信息
      marker.bindPopup(`<strong>火点预警</strong><br>位置: ${alert.location}<br>时间: ${alert.time}<br>严重程度: ${alert.level}`);
      
      this.layerManager.addLayer(`fire-${alert.id}`, marker, 'fires');
      this.fireMarkers.push(marker);
    });
  }
  
  // 加载巡林路径
  loadPatrolPaths(patrols) {
    // 清空现有巡线路径
    this.clearPatrols();
    
    // 添加新的巡线路径
    patrols.forEach(patrol => {
      if (patrol.coordinates && patrol.coordinates.length > 0) {
        const path = L.polyline(patrol.coordinates, {
          ...this.pathStyles.patrol,
          className: `patrol-path patrol-${patrol.id}`
        });
        
        // 添加弹出信息
        path.bindPopup(`<strong>巡林任务</strong><br>时间: ${patrol.time}<br>状态: ${patrol.status}`);
        
        this.layerManager.addLayer(`patrol-${patrol.id}`, path, 'patrols');
        this.patrolPaths.push(path);
      }
    });
  }
  
  // 选择林区
  selectForest(forest) {
    this.currentForest = forest;
    
    // 触发林区选择事件
    const event = new CustomEvent('forestSelected', { detail: forest });
    document.dispatchEvent(event);
    
    // 高亮选中的林区
    this.highlightForest(forest.id);
  }
  
  // 高亮林区
  highlightForest(forestId) {
    // 重置所有林区样式
    this.forestPolygons.forEach(polygon => {
      polygon.setStyle(this.polygonStyles.default);
    });
    
    // 高亮选中的林区
    const selectedPolygon = this.forestPolygons.find(polygon => 
      polygon.options.className.includes(`forest-${forestId}`)
    );
    
    if (selectedPolygon) {
      selectedPolygon.setStyle(this.polygonStyles.highlight);
    }
  }
  
  // 切换图层
  toggleLayer(layer, visible) {
    this.layerManager.toggleLayerGroup(layer, visible);
  }
  
  // 重置视图
  resetView() {
    this.map.setView([29.55, 106.6], 12);
  }
  
  // 全屏切换
  toggleFullscreen() {
    const mapContainer = document.getElementById('forestMap');
    if (!document.fullscreenElement) {
      if (mapContainer.requestFullscreen) {
        mapContainer.requestFullscreen();
      } else if (mapContainer.mozRequestFullScreen) {
        mapContainer.mozRequestFullScreen();
      } else if (mapContainer.webkitRequestFullscreen) {
        mapContainer.webkitRequestFullscreen();
      } else if (mapContainer.msRequestFullscreen) {
        mapContainer.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }
  
  // 适配林区范围
  fitToForests() {
    if (this.forestPolygons.length > 0) {
      this.fitMapToLayers(this.map, this.forestPolygons);
    }
  }
  
  // 清空林区
  clearForests() {
    this.forestPolygons.forEach(polygon => {
      this.map.removeLayer(polygon);
    });
    this.forestPolygons = [];
  }
  
  // 清空火点
  clearFires() {
    this.fireMarkers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.fireMarkers = [];
  }
  
  // 清空巡线路径
  clearPatrols() {
    this.patrolPaths.forEach(path => {
      this.map.removeLayer(path);
    });
    this.patrolPaths = [];
  }
}

// 将类暴露到全局
if (typeof window !== 'undefined') {
  window.ForestMap = ForestMap;
}
