// 农业管理地图逻辑

class AgriMap {
  constructor(mapId) {
    // 使用全局变量
    const initMap = window.initMap;
    const LayerManager = window.LayerManager;
    
    this.map = initMap(mapId);
    this.layerManager = new LayerManager(this.map);
    this.currentArea = null;
    this.areaPolygons = [];
    this.plotPolygons = [];
    this.pestMarkers = [];
    this.taskPaths = [];
    
    // 保存样式和工具函数
    this.polygonStyles = window.polygonStyles || {
      default: {
        fillColor: '#4caf50',
        weight: 2,
        opacity: 1,
        color: '#2e7d32',
        fillOpacity: 0.3
      },
      highlight: {
        fillColor: '#ffeb3b',
        weight: 3,
        opacity: 1,
        color: '#fbc02d',
        fillOpacity: 0.5
      }
    };
    
    this.markerStyles = window.markerStyles || {
      pest: {
        icon: L.divIcon({
          className: 'custom-marker pest-marker',
          html: '<i class="bi bi-bug"></i>',
          iconSize: [30, 30]
        })
      }
    };
    
    this.pathStyles = window.pathStyles || {
      task: {
        color: '#1b5e20',
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
    this.layerManager.addLayerGroup('areas');
    this.layerManager.addLayerGroup('pests');
    this.layerManager.addLayerGroup('tasks');
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
    const resetBtn = document.getElementById('resetMapBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.resetView();
        });
    }
    
    // 全屏按钮
    const fullBtn = document.getElementById('fullscreenBtn');
    if (fullBtn) {
        fullBtn.addEventListener('click', () => {
          this.toggleFullscreen();
        });
    }
  }
  
  // 加载区域数据
  loadAreas(areas) {
    this.clearAreas();
    
    areas.forEach(area => {
      let coords = area.coordinates;
      if (!coords && area.boundary_json) {
          try {
              const geojson = typeof area.boundary_json === 'string' ? JSON.parse(area.boundary_json) : area.boundary_json;
              if (geojson.coordinates) {
                if (geojson.type === 'Polygon') {
                    coords = geojson.coordinates[0].map(p => [p[1], p[0]]);
                } else if (geojson.type === 'MultiPolygon') {
                    coords = geojson.coordinates[0][0].map(p => [p[1], p[0]]);
                }
              }
          } catch(e) {}
      }

      if (coords && coords.length > 0) {
        const polygon = L.polygon(coords, {
          ...this.polygonStyles.default,
          className: `agri-polygon agri-${area.id}`
        });
        
        polygon.on('click', () => {
          this.selectArea(area);
        });
        
        polygon.bindPopup(`<strong>${area.area_name}</strong><br>面积: ${area.coverage_ha} 公顷`);
        
        this.layerManager.addLayer(`agri-${area.id}`, polygon, 'areas');
        this.areaPolygons.push(polygon);
      }
    });
    
    this.fitToAreas();
  }

  // 定位到指定区域
  focusOnArea(areaId) {
      const polygon = this.areaPolygons.find(p => p.options.className.includes(`agri-${areaId}`));
      if (polygon) {
          this.map.fitBounds(polygon.getBounds());
          this.highlightArea(areaId);
      }
  }

  // 加载并展示地块明细
  loadPlots(plots) {
    this.clearPlots();
    if (!plots || plots.length === 0) return;

    plots.forEach(plot => {
      let coords = null;
      if (plot.geom_json) {
        try {
          const geojson = typeof plot.geom_json === 'string' ? JSON.parse(plot.geom_json) : plot.geom_json;
          if (geojson.type === 'Polygon') {
            coords = geojson.coordinates[0].map(p => [p[1], p[0]]); 
          } else if (geojson.type === 'MultiPolygon') {
            coords = geojson.coordinates[0][0].map(p => [p[1], p[0]]);
          }
        } catch(e) {
          console.error('解析地块坐标失败:', e);
        }
      }

      if (coords) {
        const polygon = L.polygon(coords, {
          fillColor: '#8bc34a',
          weight: 1,
          opacity: 0.8,
          color: '#558b2f',
          fillOpacity: 0.4,
          className: `plot-polygon plot-${plot.id}`
        });
        
        polygon.bindPopup(`<strong>${plot.name}</strong><br>面积: ${plot.area} 公顷<br>风险等级: ${plot.risk_level}`);
        this.layerManager.addLayer(`plot-${plot.id}`, polygon, 'areas'); 
        this.plotPolygons.push(polygon);
      }
    });
  }

  clearPlots() {
    this.plotPolygons.forEach(p => {
      this.map.removeLayer(p);
    });
    this.plotPolygons = [];
  }
  
  // 加载病虫害数据
  loadPestAlerts(pestAlerts) {
    this.clearPests();
    pestAlerts.forEach(alert => {
      const lat = 29.5 + (Math.random() * 0.2);
      const lng = 106.5 + (Math.random() * 0.2);
      
      const marker = L.marker([lat, lng], {
        icon: this.markerStyles.pest.icon,
        className: `pest-marker pest-${alert.id}`
      });
      
      marker.bindPopup(`<strong>病虫害预警</strong><br>位置: ${alert.location}<br>时间: ${alert.time}<br>严重程度: ${alert.level}`);
      
      this.layerManager.addLayer(`pest-${alert.id}`, marker, 'pests');
      this.pestMarkers.push(marker);
    });
  }
  
  // 选择区域
  selectArea(area) {
    this.currentArea = area;
    const event = new CustomEvent('areaSelected', { detail: area });
    document.dispatchEvent(event);
    this.highlightArea(area.id);
  }
  
  // 高亮区域
  highlightArea(areaId) {
    this.areaPolygons.forEach(polygon => {
      polygon.setStyle(this.polygonStyles.default);
    });
    
    const selectedPolygon = this.areaPolygons.find(polygon => 
      polygon.options.className.includes(`agri-${areaId}`)
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
    this.map.setView([30.05, 107.60], 7);
  }
  
  // 全屏切换
  toggleFullscreen() {
    const mapContainer = document.getElementById('agriMap');
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
  
  // 适配区域范围
  fitToAreas() {
    if (this.areaPolygons.length > 0) {
      this.fitMapToLayers(this.map, this.areaPolygons);
    }
  }
  
  // 清空区域
  clearAreas() {
    this.areaPolygons.forEach(polygon => {
      this.map.removeLayer(polygon);
    });
    this.areaPolygons = [];
    this.clearPlots();
  }
  
  // 清空病虫害
  clearPests() {
    this.pestMarkers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.pestMarkers = [];
  }
}

// 将类暴露到全局
if (typeof window !== 'undefined') {
  window.AgriMap = AgriMap;
}
