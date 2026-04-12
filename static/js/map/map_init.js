// 地图初始化配置
const mapConfig = {
  // 重庆中心坐标
  center: [29.5630, 106.5516],
  zoom: 12,
  minZoom: 8,
  maxZoom: 18
};

// 基础地图图层
const baseLayers = {
  // 简单灰色底图
  grayscale: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }),
  // 卫星地图
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  })
};

// 通用地图初始化函数
function initMap(mapId, options = {}) {
  const mapOptions = { ...mapConfig, ...options };
  const map = L.map(mapId, mapOptions);

  // 默认添加灰色底图
  baseLayers.grayscale.addTo(map);

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
  window.polygonStyles = polygonStyles;
  window.markerStyles = markerStyles;
  window.pathStyles = pathStyles;
  window.LayerManager = LayerManager;
  window.fitMapToLayers = fitMapToLayers;
} catch (e) {
  console.error('无法设置全局变量:', e);
}
