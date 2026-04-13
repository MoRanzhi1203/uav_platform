// 地图初始化配置
const mapConfig = {
  // 重庆市地理中心坐标，确保初始加载时位于画面中心
  center: [30.05, 107.60],
  // 初始缩放级别调整，使重庆全境在画面中占约 1/3 高度和宽度
  zoom: 7,
  minZoom: 5,
  maxZoom: 18,
  attributionControl: false // 禁用右下角 Leaflet 归属说明
};

// 基础地图图层配置 (供参考，实际使用时请通过 getBaseLayer 获取新实例)
const baseLayerConfig = {
  grayscale: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 20,
      maxNativeZoom: 19
    }
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 20,
      maxNativeZoom: 18
    }
  }
};

// 获取底图新实例的辅助函数 (解决多个地图实例共用图层对象的问题)
function getBaseLayer(type) {
  const config = baseLayerConfig[type] || baseLayerConfig.grayscale;
  return L.tileLayer(config.url, config.options);
}

// 基础地图图层实例管理 (保留旧变量名以兼容现有代码，但建议使用 getBaseLayer)
const baseLayers = {
  get grayscale() { return getBaseLayer('grayscale'); },
  get satellite() { return getBaseLayer('satellite'); }
};

// 辅助图层
const overlayLayers = {
  // 等高线图层
  contours: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    maxZoom: 17,
    opacity: 0.5
  }),
  // 交通图层
  traffic: L.tileLayer('https://{s}.tile.thunderforest.com/traffic/{z}/{x}/{y}.png?apikey=YOUR_API_KEY', {
    attribution: '&copy; <a href="https://www.thunderforest.com">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
    opacity: 0.6
  })
};

// 通用地图初始化函数
function initMap(mapId, options = {}) {
  const mapOptions = { ...mapConfig, ...options };
  const map = L.map(mapId, mapOptions);

  // 默认添加卫星底图 (确保是新实例)
  getBaseLayer('satellite').addTo(map);

  return map;
}

// 通用多边形样式
const polygonStyles = {
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
  },
  warning: {
    fillColor: '#f39c12',
    weight: 2,
    opacity: 1,
    color: '#e67e22',
    fillOpacity: 0.4
  },
  danger: {
    fillColor: '#e74c3c',
    weight: 2,
    opacity: 1,
    color: '#c0392b',
    fillOpacity: 0.4
  }
};

// 通用标记样式
const markerStyles = {
  fire: {
    icon: L.divIcon({
      className: 'custom-marker fire-marker',
      html: '<i class="bi bi-fire"></i>',
      iconSize: [30, 30]
    })
  },
  pest: {
    icon: L.divIcon({
      className: 'custom-marker pest-marker',
      html: '<i class="bi bi-bug"></i>',
      iconSize: [30, 30]
    })
  },
  risk: {
    icon: L.divIcon({
      className: 'custom-marker risk-marker',
      html: '<i class="bi bi-exclamation-triangle"></i>',
      iconSize: [30, 30]
    })
  },
  takeoff: {
    icon: L.divIcon({
      className: 'custom-marker takeoff-marker',
      html: '<i class="bi bi-airplane-engines"></i>',
      iconSize: [30, 30]
    })
  }
};

// 通用路径样式
const pathStyles = {
  patrol: {
    color: '#3498db',
    weight: 3,
    opacity: 0.7,
    dashArray: '5, 10'
  },
  spray: {
    color: '#27ae60',
    weight: 3,
    opacity: 0.7,
    dashArray: '3, 7'
  },
  survey: {
    color: '#9b59b6',
    weight: 3,
    opacity: 0.7,
    dashArray: '2, 5'
  }
};

// 自动适配地图范围到所有图层
function fitMapToLayers(map, layers) {
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
}

// 图层管理类
class LayerManager {
  constructor(map) {
    this.map = map;
    this.layers = {};
    this.layerGroups = {};
  }

  // 添加图层组
  addLayerGroup(name) {
    if (!this.layerGroups[name]) {
      this.layerGroups[name] = L.layerGroup();
      this.layerGroups[name].addTo(this.map);
    }
    return this.layerGroups[name];
  }

  // 添加图层到指定组
  addLayer(name, layer, groupName) {
    this.layers[name] = layer;
    if (groupName && this.layerGroups[groupName]) {
      this.layerGroups[groupName].addLayer(layer);
    } else {
      layer.addTo(this.map);
    }
  }

  // 移除图层
  removeLayer(name) {
    if (this.layers[name]) {
      this.map.removeLayer(this.layers[name]);
      delete this.layers[name];
    }
  }

  // 切换图层可见性
  toggleLayerGroup(groupName, visible) {
    if (this.layerGroups[groupName]) {
      if (visible) {
        this.layerGroups[groupName].addTo(this.map);
      } else {
        this.map.removeLayer(this.layerGroups[groupName]);
      }
    }
  }

  // 清空所有图层
  clearAll() {
    Object.values(this.layers).forEach(layer => {
      this.map.removeLayer(layer);
    });
    Object.values(this.layerGroups).forEach(group => {
      this.map.removeLayer(group);
    });
    this.layers = {};
    this.layerGroups = {};
  }

  // 获取所有图层
  getAllLayers() {
    return Object.values(this.layers);
  }
}

// 全局变量
try {
  window.initMap = initMap;
  window.baseLayers = baseLayers;
  window.polygonStyles = polygonStyles;
  window.markerStyles = markerStyles;
  window.pathStyles = pathStyles;
  window.LayerManager = LayerManager;
  window.fitMapToLayers = fitMapToLayers;
} catch (e) {
  console.error('无法设置全局变量:', e);
}
