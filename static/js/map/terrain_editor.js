// 地形编辑器类
class TerrainEditor {
  constructor(mapId) {
    // 初始化地图
    this.map = window.initMap(mapId, {
      center: [30.05, 107.60],
      zoom: 7,
      minZoom: 5,
      maxZoom: 18,
      zoomSnap: 0.1, // 允许更精细的缩放级别以精确匹配重庆占比
    });
    
    // 默认缩放占比配置
    this.viewportConfig = {
      targetHeightRatio: 1/3,
      targetWidthRatio: 1/2,
      chongqingBounds: [[28.16, 105.18], [32.20, 110.19]]
    };

    this.layerManager = new window.LayerManager(this.map);
    
    // 底图管理 (使用实例存储)
    this.baseLayers = window.baseLayers;
    this.currentBasemap = 'satellite';
    this.activeBaseLayer = null; // 存储当前正在使用的底图实例
    
    // 等高线叠加管理
    this.isContourOverlayEnabled = false;
    this.contourLayer = null;
    
    // 状态管理
    this.currentTool = 'brush';
    this.eraserMode = 'block'; // 'block' 或 'brush'
    this.selectedFeatures = [];
    this.userPlots = [];
    this.activePlotId = null;
    this.history = [];
    this.historyIndex = -1;
    this.areaId = null; // 当前正在编辑的区域 ID
    this.areaData = null; // 区域基础信息
    
    // 网格配置 (10m x 10m)
    this.gridLatStep = 0.0000898;
    this.gridLngStep = 0.0001037;
    
    // 中尺度网格步长 (1000m)
    this.gridLatStep1km = 0.00898;
    this.gridLngStep1km = 0.01037;

    this.brushSize = 1;
    
    // 渲染器
    this.canvasRenderer = L.canvas({ padding: 0.5 });
    
    // 图层管理
    this.layers = {
      base: {},
      working: {},
      temp: {}
    };
    
    // 颜色方案配置
    this.colorScheme = {
      forest: '#2ecc71',      // 林区 - 绿色
      farmland: '#f39c12',    // 农田 - 橙色
      buildings: '#7f8c8d',   // 建筑 - 深灰色
      water: '#3498db',       // 水域 - 蓝色
      roads: '#95a5a6',       // 道路 - 灰色
      mixed: '#9b59b6',       // 混合 - 紫色
      selected: '#0d6efd',    // 选中 - 蓝色
      editing: '#ffc107',     // 编辑中 - 黄色
      highlight: '#198754'    // 高亮 - 绿色
    };
    
    // 样式
    this.styles = {
      selected: {
        color: this.colorScheme.selected,
        weight: 3,
        fillColor: this.colorScheme.selected,
        fillOpacity: 0.2
      },
      editing: {
        color: this.colorScheme.editing,
        weight: 2,
        fillColor: this.colorScheme.editing,
        fillOpacity: 0.1
      },
      highlight: {
        color: this.colorScheme.highlight,
        weight: 4,
        fillColor: this.colorScheme.highlight,
        fillOpacity: 0.3
      }
    };

    this._handlers = {
      brushStart: this.startBrush.bind(this),
      brushMove: this.handleBrush.bind(this),
      brushEnd: this.endBrush.bind(this),
      eraserStart: this.startEraserBrush.bind(this),
      eraserMove: this.handleEraserBrush.bind(this),
      eraserEnd: this.endEraserBrush.bind(this),
      eraserClick: this.handleEraserClick.bind(this)
    };
    
    // 初始化
    this.init();
  }
  
  // 初始化
  init() {
    this.addLayerGroups();
    this.initReferenceGrid();
    this.bindEvents();
    
    // 强制切换一次卫星底图，确保实例被正确管理和显示
    this.currentBasemap = null; 
    this.switchBasemap('satellite');
    
    this.captureHistorySnapshot();
  }
  
  /**
   * 计算并设置地图视口，使当前区域或重庆市在画面中居中并按指定比例显示
   * @param {Object} boundaryGeoJSON 区域边界 GeoJSON
   */
  updateMapViewport(boundaryGeoJSON) {
    let bounds;
    if (boundaryGeoJSON && typeof turf !== 'undefined') {
      try {
        const bbox = turf.bbox(boundaryGeoJSON);
        bounds = L.latLngBounds([bbox[1], bbox[0]], [bbox[3], bbox[2]]);
      } catch (e) {
        console.error('计算区域边界失败:', e);
      }
    }
    
    if (!bounds) {
      bounds = L.latLngBounds(this.viewportConfig.chongqingBounds);
    }
    
    const center = bounds.getCenter();
    
    // 获取地图容器大小
    const container = this.map.getContainer();
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    // 只有在容器大小有效时才进行计算，否则等待一会
    if (containerWidth === 0 || containerHeight === 0) {
      setTimeout(() => this.updateMapViewport(boundaryGeoJSON), 100);
      return;
    }
    
    const paddingY = (1 - this.viewportConfig.targetHeightRatio) / 2 * containerHeight;
    const paddingX = (1 - this.viewportConfig.targetWidthRatio) / 2 * containerWidth;
    
    const optimalZoom = this.map.getBoundsZoom(bounds, false, [paddingX, paddingY]);
    
    this.map.setMinZoom(optimalZoom);
    this.map.setMaxZoom(18);
    this.map.setView(center, optimalZoom);
    
    this.map.once('moveend', () => {
      const initialBounds = this.map.getBounds();
      this.map.setMaxBounds(initialBounds);
    });
  }
  
  // 初始化参考网格 (10m, 1km)
  initReferenceGrid() {
    this.refGridLayer10m = L.layerGroup();
    this.refGridLayer1km = L.layerGroup();
    this.adminBoundaryLayer = L.layerGroup();
    
    // 监听缩放和移动事件来重绘网格
    const redrawGrids = () => {
      if (this.map.hasLayer(this.refGridLayer10m)) this.drawReferenceGrid10m();
      if (this.map.hasLayer(this.refGridLayer1km)) this.drawReferenceGrid1km();
    };

    this.map.on('moveend', redrawGrids);
    this.map.on('zoomend', redrawGrids);
    
    // 初始化行政区划边界层 (独立于参考网格管理)
    this.adminBoundaryLayer = L.layerGroup();
    this.loadAdminBoundaries();
  }
  
  // 加载行政区划边界 (调用 shp 文件)
  async loadAdminBoundaries() {
    try {
      if (typeof shp === 'undefined') {
        console.error('shpjs 库未找到，请确保已正确引入');
        return;
      }

      // 确保 Proj4 已定义，这对 3857 -> 4326 转换至关重要
      if (typeof proj4 !== 'undefined') {
        // 定义 EPSG:3857 (Web Mercator) 的投影参数
        proj4.defs("EPSG:3857","+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs");
      }

      // 指向 static 下的 shp 文件目录
      // 使用绝对路径避免 URL 构造失败问题
      const shpUrl = window.location.origin + '/static/shp/chongqing_admin_3857/chongqing_admin_3857';
      this.adminBoundaryColor = document.getElementById('adminBoundaryColor')?.value || '#4a90e2';
      
      console.log('正在请求行政区划边界 (SHP):', shpUrl);
      
      // 使用 shpjs 的通用方法加载并转换 GeoJSON
      // 由于已配置 Proj4，shpjs 应该能够根据 .prj 文件自动完成转换
      const geojson = await shp(shpUrl);
      
      if (geojson) {
        const data = Array.isArray(geojson) ? geojson[0] : geojson;
        if (data && data.features && data.features.length > 0) {
          // 智能过滤：仅保留区县级行政区划，过滤掉密集的乡镇和街道
          let allFeatures = data.features;
          let districts = allFeatures.filter(f => {
            const p = f.properties;
            // 1. 优先使用 admin_level (6 通常代表区县)
            if (p.admin_level !== undefined) {
              return parseInt(p.admin_level) <= 6;
            }
            // 2. 检查 fclass 字段 (OSM 数据常见)
            if (p.fclass) {
              return p.fclass === 'admin_level6' || p.fclass === 'district' || p.fclass === 'county';
            }
            // 3. 根据名称后缀兜底过滤（排除乡、镇、街道、社区）
            const name = p.name || p.NAME || '';
            const isSubLevel = /街道$|镇$|乡$|社区$|村$/.test(name);
            return !isSubLevel;
          });

          // 如果过滤后一个都没剩，则退回到显示全部（防止数据源定义不规范导致空白）
          if (districts.length === 0) {
            console.warn('行政区划层级过滤未命中，退回到全量显示');
            districts = allFeatures;
          }

          console.log(`成功解析行政区划数据，原始数量: ${allFeatures.length}，过滤后区县数量: ${districts.length}`);
          
          // 增加强制手动转换逻辑，确保数据一定能落在 4326 范围内
          if (typeof proj4 !== 'undefined') {
            districts.forEach(f => {
              if (f.geometry && f.geometry.coordinates) {
                this._transformGeometry(f.geometry);
              }
            });
            console.log('坐标系强制转换/检查完成 (3857 -> 4326)');
          }

          // 分块渲染以避免 UI 卡顿
          const chunkSize = 50;
          let index = 0;
          
          const loadChunk = () => {
            const chunk = districts.slice(index, index + chunkSize);
            if (chunk.length === 0) {
              console.log('行政区划边界渲染完成');
              // 如果勾选框默认是开着的，直接添加到地图
              const adminToggle = document.getElementById('adminBoundaryToggle');
              if (adminToggle && adminToggle.checked) {
                this.adminBoundaryLayer.addTo(this.map);
              }
              return;
            }
            
            L.geoJSON({ type: 'FeatureCollection', features: chunk }, {
              style: () => ({
                color: this.adminBoundaryColor,
                weight: 2.5,      // 稍微加粗区县边界
                opacity: 0.9,
                fillOpacity: 0.03,
                fillColor: this.adminBoundaryColor,
                dashArray: '8, 8', // 更长的虚线
                interactive: false
              }),
              onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const name = props.name || props.NAME || props.district || props.city || props.COUNTY;
                
                if (name) {
                  // 优化标签：只有区县级才显示永久标签，且增加背景阴影防止重叠
                  layer.bindTooltip(name, {
                    permanent: true,
                    direction: 'center',
                    className: 'admin-label-large', // 使用更大的样式名
                    opacity: 1.0,
                    interactive: false
                  });
                }
              }
            }).addTo(this.adminBoundaryLayer);
            
            index += chunkSize;
            setTimeout(loadChunk, 10);
          };
          
          loadChunk();
        } else {
          console.error('GeoJSON 数据解析失败或要素为空');
        }
      }
    } catch (error) {
      console.error('行政区划边界加载或渲染失败:', error);
      console.warn('如果是 404，请确认 Django 是否开启了 static 目录下的 .shp 文件访问权限');
    }
  }

  // 内部辅助方法：递归转换几何坐标
  _transformGeometry(geometry) {
    if (!geometry || !geometry.coordinates) return;
    
    const transformPoint = (coord) => {
      // 检查是否已经是 4326 (经纬度通常在 -180 到 180 之间)
      if (Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90) {
        // 只有在坐标值明显偏大时才执行转换
        const converted = proj4('EPSG:3857', 'EPSG:4326', [coord[0], coord[1]]);
        coord[0] = converted[0];
        coord[1] = converted[1];
      }
    };

    const processCoords = (coords) => {
      if (typeof coords[0] === 'number') {
        transformPoint(coords);
      } else {
        coords.forEach(processCoords);
      }
    };

    processCoords(geometry.coordinates);
  }

  // 更新行政边界颜色
  updateAdminBoundaryColor(color) {
    this.adminBoundaryColor = color;
    if (this.adminBoundaryLayer) {
      this.adminBoundaryLayer.eachLayer(layer => {
        if (layer.setStyle) {
          layer.setStyle({
            color: color,
            fillColor: color
          });
        }
      });
    }
  }

  // 切换行政区划边界
  toggleAdminBoundaries(visible) {
    if (visible) {
      this.adminBoundaryLayer.addTo(this.map);
    } else {
      this.map.removeLayer(this.adminBoundaryLayer);
    }
  }

  // 切换参考网格
  toggleReferenceGrid(type, visible) {
    let layer;
    let redrawFn;
    
    switch(type) {
      case '10m': layer = this.refGridLayer10m; redrawFn = this.drawReferenceGrid10m; break;
      case '1km': layer = this.refGridLayer1km; redrawFn = this.drawReferenceGrid1km; break;
    }

    if (visible) {
      layer.addTo(this.map);
      redrawFn.call(this);
    } else {
      this.map.removeLayer(layer);
      layer.clearLayers();
    }
  }

  // 绘制 10m x 10m 参考网格
  drawReferenceGrid10m() {
    this.refGridLayer10m.clearLayers();
    // 仅在足够大的缩放级别下显示 10m 网格，避免渲染压力
    if (this.map.getZoom() < 16) return;
    
    this._drawGridGeneric(this.refGridLayer10m, this.gridLatStep, this.gridLngStep, {
      color: '#888888',
      weight: 0.5, 
      opacity: 0.3
    });
  }

  // 绘制 1km x 1km 参考网格
  drawReferenceGrid1km() {
    this.refGridLayer1km.clearLayers();
    // 仅在足够大的缩放级别下显示 1km 网格
    if (this.map.getZoom() < 10) return;

    this._drawGridGeneric(this.refGridLayer1km, this.gridLatStep1km, this.gridLngStep1km, {
      color: '#4a90e2',
      weight: 1.2,
      opacity: 0.5,
      dashArray: '10, 10'
    });
  }

  // 通用网格绘制逻辑
  _drawGridGeneric(layerGroup, latStep, lngStep, style) {
    const bounds = this.map.getBounds().pad(0.5); // 增加 50% 的填充，减少频繁重绘感
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();
    
    // 对齐到步长
    const startLat = Math.floor(south / latStep) * latStep;
    const endLat = Math.ceil(north / latStep) * latStep;
    const startLng = Math.floor(west / lngStep) * lngStep;
    const endLng = Math.ceil(east / lngStep) * lngStep;
    
    const gridStyle = { ...style, interactive: false };
    
    // 限制绘制数量以保证性能
    let count = 0;
    const maxLines = 500; // 稍微增加限制

    // 绘制纬线 (水平线)
    for (let lat = startLat; lat <= endLat && count < maxLines; lat += latStep) {
      // 确保经度范围覆盖当前视图
      L.polyline([[lat, west], [lat, east]], gridStyle).addTo(layerGroup);
      count++;
    }
    
    // 绘制经线 (垂直线)
    count = 0;
    for (let lng = startLng; lng <= endLng && count < maxLines; lng += lngStep) {
      // 确保纬度范围覆盖当前视图
      L.polyline([[south, lng], [north, lng]], gridStyle).addTo(layerGroup);
      count++;
    }
  }

  // 切换历史地块提示
  toggleHistoryHints(visible) {
    if (visible) {
      if (!this.layers.base.historyHints) {
        this.layers.base.historyHints = L.layerGroup();
        // 此处留空，待接入后端真实历史数据接口
      }
      this.layers.base.historyHints.addTo(this.map);
    } else {
      if (this.layers.base.historyHints) {
        this.map.removeLayer(this.layers.base.historyHints);
      }
    }
  }

  // 调整地图视野到所有 GeoJSON 图层
  fitMapToGeoJSONLayers() {
    console.log('=== 调整地图视野到 GeoJSON 图层 ===');
    
    // 设置默认中心为重庆的大致位置
    this.map.setView([30.05, 107.60], 7);
  }
  
  // 显示要素信息
  showFeatureInfo(feature) {
    console.log('要素信息:', feature.properties);
    // 这里可以实现显示要素属性的逻辑
    // 例如更新右侧属性面板
  }
  
  // 添加图层组
  addLayerGroups() {
    this.layerManager.addLayerGroup('base');
    this.layerManager.addLayerGroup('working');
  }
  
  // 绑定事件
  bindEvents() {
    // 鼠标移动事件
    this.map.on('mousemove', (e) => {
      this.updateCursorPosition(e.latlng);
    });
  }
  
  // 初始化绘制控件
  initDrawControls() {
    const drawnItems = new L.FeatureGroup();
    this.map.addLayer(drawnItems);
    
    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems
      },
      draw: {
        polygon: {
          allowIntersection: false,
          drawError: {
            color: '#e1e100',
            message: '不能自交！'
          },
          shapeOptions: {
            color: '#0d6efd'
          }
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false
      }
    });
    
    this.map.addControl(drawControl);
    
    // 绘制完成事件
    this.map.on(L.Draw.Event.CREATED, (e) => {
      const layer = e.layer;
      drawnItems.addLayer(layer);
      this.selectedFeatures.push(layer);
      this.updateSelectedArea();
    });
  }
  
  // 处理地图点击
  handleMapClick(e) {
    switch (this.currentTool) {
      case 'select':
        this.selectFeature(e.latlng);
        break;
      case 'smart-select':
        this.smartSelect(e.latlng);
        break;
      case 'multiselect':
        this.multiSelect(e.latlng);
        break;
    }
  }
  
  // 选择工具
  selectFeature(latlng) {
    const layers = this.map.layers;
    let selectedLayer = null;
    
    // 检查所有图层
    for (const layerGroup in this.layers) {
      if (this.layers[layerGroup]) {
        for (const layerKey in this.layers[layerGroup]) {
          const layer = this.layers[layerGroup][layerKey];
          if (layer && layer.contains && layer.contains(latlng)) {
            selectedLayer = layer;
            break;
          }
        }
      }
    }
    
    if (selectedLayer) {
      this.selectLayer(selectedLayer);
    }
  }
  
  // 智能选区工具
  smartSelect(latlng) {
    console.log('=== 智能选区开始 ===');
    console.log('点击坐标:', latlng);
    
    // 1. 首先检查 GeoJSON 业务图层
    const geoJSONFeature = this.findFeatureInGeoJSONLayers(latlng);
    if (geoJSONFeature) {
      console.log('=== 命中 GeoJSON 业务图层 ===');
      console.log('地块类型:', geoJSONFeature.layerName);
      
      // 创建多边形
      const polygon = L.polygon(geoJSONFeature.coordinates, this.styles.selected);
      polygon.layerName = geoJSONFeature.layerName;
      polygon.properties = geoJSONFeature.properties;
      
      // 添加到工作图层和选区
      this.addToWorkingLayer(polygon);
      this.selectedFeatures.push(polygon);
      
      this.updateSelectedArea();
      this.updateSelectedPlotsList();
      return;
    }
    
    // 2. 然后检查模拟数据中的业务边界
    console.log('当前业务图层数量:', this.smartSelection.businessBoundaries.length);
    console.log('当前地形图层数量:', this.smartSelection.terrainFeatures.length);
    
    // 执行智能选区
    const feature = this.smartSelection.selectAt(latlng);
    
    console.log('命中结果:', feature);
    
    if (feature && feature.coordinates) {
      console.log('=== 命中地块 ===');
      console.log('地块名称:', feature.name);
      console.log('地块类型:', feature.type);
      console.log('坐标数量:', feature.coordinates.length);
      
      // 创建多边形
      const polygon = L.polygon(feature.coordinates, this.styles.selected);
      
      // 添加到工作图层和选区
      this.addToWorkingLayer(polygon);
      this.selectedFeatures.push(polygon);
      
      this.updateSelectedArea();
      this.updateSelectedPlotsList();
    } else {
      console.log('=== 未命中任何地块 ===');
      // 没有命中地块，提示用户
      alert('未识别到地块，请点击已有业务区域');
    }
  }
  
  // 在 GeoJSON 图层中查找特征
  findFeatureInGeoJSONLayers(latlng) {
    console.log('=== 在 GeoJSON 图层中查找特征 ===');
    
    // 遍历所有业务图层
    for (const layerName in this.layers.business) {
      const layer = this.layers.business[layerName];
      if (layer) {
        console.log(`检查图层: ${layerName}`);
        
        // 检查图层中的每个特征
        let foundFeature = null;
        layer.eachLayer((featureLayer) => {
          if (featureLayer.contains && featureLayer.contains(latlng)) {
            console.log(`在 ${layerName} 图层中找到特征`);
            foundFeature = {
              layerName: layerName,
              coordinates: featureLayer.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]),
              properties: featureLayer.feature ? featureLayer.feature.properties : {}
            };
          }
        });
        
        if (foundFeature) {
          return foundFeature;
        }
      }
    }
    
    return null;
  }
  
  // 更新已选地块列表
  updateSelectedPlotsList() {
    const selectedAreasContainer = document.getElementById('selectedAreas');
    if (!selectedAreasContainer) return;
    selectedAreasContainer.innerHTML = '';
    
    this.userPlots.forEach((plot, index) => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      if (plot.id === this.activePlotId) {
        item.classList.add('active');
      }
      
      const name = plot.properties?.name || `地块 ${index + 1}`;
      const isLocked = !!plot.locked;
      const isVisible = plot.visible !== false;
      item.innerHTML = `
        <input type="checkbox" class="layer-checkbox" ${isVisible ? 'checked' : ''}>
        <span class="layer-color" style="background-color: ${this.getPlotColor(plot.properties?.type)}; width: 12px; height: 12px; display: inline-block; margin: 0 8px; border-radius: 2px;"></span>
        <span style="flex: 1;">${name}</span>
        <div style="margin-left: auto; display: flex; align-items: center; gap: 10px;">
          <i class="bi ${isLocked ? 'bi-lock' : 'bi-unlock'} layer-lock" style="cursor: pointer; font-size: 12px; ${isLocked ? 'color: #dc3545;' : ''}"></i>
          <i class="bi bi-chevron-up layer-up" style="cursor: pointer; font-size: 12px;"></i>
          <i class="bi bi-chevron-down layer-down" style="cursor: pointer; font-size: 12px;"></i>
          <i class="bi bi-trash layer-delete" style="cursor: pointer; font-size: 12px; color: #dc3545;"></i>
        </div>
      `;
      
      item.addEventListener('click', () => this.selectPlot(plot.id));

      const checkbox = item.querySelector('.layer-checkbox');
      if (checkbox) {
        checkbox.addEventListener('click', (e) => e.stopPropagation());
        checkbox.addEventListener('change', () => this.togglePlotVisibility(plot.id, checkbox.checked));
      }

      const lockIcon = item.querySelector('.layer-lock');
      if (lockIcon) {
        lockIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePlotLock(plot.id);
        });
      }

      const upIcon = item.querySelector('.layer-up');
      if (upIcon) {
        upIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          this.movePlot(plot.id, -1);
        });
      }

      const downIcon = item.querySelector('.layer-down');
      if (downIcon) {
        downIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          this.movePlot(plot.id, +1);
        });
      }

      const deleteIcon = item.querySelector('.layer-delete');
      if (deleteIcon) {
        deleteIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          this.removePlot(plot.id);
        });
      }
      
      selectedAreasContainer.appendChild(item);
    });
  }
  
  // 选择地块
  selectPlot(plotId) {
    this.activePlotId = plotId;

    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot) return;

    this.userPlots.forEach(p => {
      if (p.layer && p.layer.setStyle) {
        p.layer.setStyle(this.getPlotStyle(p.properties?.type, false));
      }
    });
    if (plot.layer && plot.layer.setStyle) {
      plot.layer.setStyle(this.getPlotStyle(plot.properties?.type, true));
      if (plot.layer.bringToFront) plot.layer.bringToFront();
      if (plot.layer.eachLayer) {
        plot.layer.eachLayer(l => l.bringToFront && l.bringToFront());
      }
    }

    // 移除所有项的激活状态
    document.querySelectorAll('#selectedAreas .layer-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // 激活当前项
    const idx = this.userPlots.findIndex(p => p.id === plotId);
    if (idx >= 0) {
      const item = document.querySelectorAll('#selectedAreas .layer-item')[idx];
      if (item) item.classList.add('active');
    }
    
    // 更新右侧属性面板
    this.updateAttributePanel(plot);
  }
  
  // 移除地块
  async removePlot(plotId) {
    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot) return;

    if (plot.db_id) {
      if (!confirm(`确定要从数据库中永久删除地块 "${plot.properties.name || '未命名'}" 吗？`)) {
        return;
      }
      try {
        const response = await fetch(`/terrain/api/zones/${plot.db_id}/delete/`, {
          method: 'DELETE',
          headers: {
            'X-CSRFToken': this.getCookie('csrftoken')
          }
        });
        const result = await response.json();
        if (result.code === 0) {
          // 标记地块数据已变动，通知列表页刷新
          localStorage.setItem('terrain_plot_changed', '1');
        } else {
          alert('删除失败: ' + result.msg);
          return;
        }
      } catch (e) {
        console.error('删除请求异常:', e);
        alert('删除请求失败');
        return;
      }
    }

    if (plot.layer) {
      this.layerManager.layerGroups.working.removeLayer(plot.layer);
    }

    this.userPlots = this.userPlots.filter(p => p.id !== plotId);
    if (this.activePlotId === plotId) {
      this.activePlotId = this.userPlots.length ? this.userPlots[0].id : null;
    }

    this.captureHistorySnapshot();
    this.updateSelectedArea();
    this.updateSelectedPlotsList();
  }
  
  // 更新属性面板
  updateAttributePanel(plot) {
    if (!plot) return;

    // 基本属性同步到表单
    const nameInput = document.getElementById('plotName');
    if (nameInput) nameInput.value = plot.properties?.name || '';

    const typeSelect = document.getElementById('plotType');
    if (typeSelect) {
      typeSelect.value = plot.properties?.type || 'farmland';
      // 触发 change 事件以更新子类型显示
      typeSelect.dispatchEvent(new Event('change'));
    }

    const subTypeSelect = document.getElementById('plotSubType');
    if (subTypeSelect) subTypeSelect.value = plot.properties?.subType || '';

    const remarkInput = document.getElementById('plotRemark');
    if (remarkInput) remarkInput.value = plot.properties?.remark || '';

    const riskSelect = document.getElementById('riskLevel');
    if (riskSelect) riskSelect.value = plot.properties?.riskLevel || 'low';

    const descText = document.getElementById('description');
    if (descText) descText.value = plot.properties?.description || '';

    const plotAreaInput = document.getElementById('plotArea');
    if (plotAreaInput) plotAreaInput.value = Number(plot.properties?.areaHa || 0).toFixed(2);

    // 显示要素统计和列表
    const elementCountEl = document.getElementById('elementCount');
    const elementListEl = document.getElementById('elementList');
    const addElementBtn = document.getElementById('addElementBtn');
    
    if (elementCountEl) {
      elementCountEl.textContent = (plot.elements || []).length;
    }
    
    if (elementListEl) {
      if (plot.elements && plot.elements.length > 0) {
        elementListEl.innerHTML = plot.elements.map(el => `
          <div class="d-flex justify-content-between align-items-center mb-1 p-1 border-bottom">
            <span>${el.name} (${el.type})</span>
            <button class="btn btn-sm text-danger" onclick="terrainEditor.deleteElement(${el.id}, ${plot.id})">
              <i class="bi bi-x"></i>
            </button>
          </div>
        `).join('');
      } else {
        elementListEl.innerHTML = '<p class="text-muted italic">无要素记录</p>';
      }
    }
    
    if (addElementBtn) {
      addElementBtn.disabled = false;
      // 移除旧事件
      const newBtn = addElementBtn.cloneNode(true);
      addElementBtn.parentNode.replaceChild(newBtn, addElementBtn);
      newBtn.addEventListener('click', () => this.promptAddElement(plot.id));
    }

    const centerPointEl = document.getElementById('centerPoint');
    const boundaryCountEl = document.getElementById('boundaryCount');

    if (plot.layer && plot.layer.getBounds) {
      const bounds = plot.layer.getBounds();
      const center = bounds.getCenter();
      if (centerPointEl) centerPointEl.textContent = `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`;
    }

    if (boundaryCountEl) {
      const rings = this.getLatLngRingsFromLayer(plot.layer);
      boundaryCountEl.textContent = rings.length ? (rings[0].length || '-') : '-';
    }
  }
  
  // 多选工具
  multiSelect(latlng) {
    const layers = this.map.layers;
    let selectedLayer = null;
    
    // 检查所有图层
    for (const layerGroup in this.layers) {
      if (this.layers[layerGroup]) {
        for (const layerKey in this.layers[layerGroup]) {
          const layer = this.layers[layerGroup][layerKey];
          if (layer && layer.contains && layer.contains(latlng)) {
            selectedLayer = layer;
            break;
          }
        }
      }
    }
    
    if (selectedLayer) {
      // 检查是否已经选中
      const isAlreadySelected = this.selectedFeatures.some(feature => feature === selectedLayer);
      
      if (!isAlreadySelected) {
        // 高亮选中的图层
        selectedLayer.setStyle(this.styles.selected);
        
        // 添加到选区
        this.selectedFeatures.push(selectedLayer);
        this.updateSelectedArea();
        this.updateSelectedPlotsList();
      }
    }
  }
  
  // 合并工具
  mergeFeatures() {
    if (this.selectedFeatures.length < 2) {
      alert('至少需要选择两个地块才能合并');
      return;
    }
    
    // 合并选中的多边形
    const mergedPolygon = this.mergePolygons(this.selectedFeatures);
    
    // 清除原有选区
    this.clearSelectedFeatures();
    
    // 添加合并后的多边形
    this.addToWorkingLayer(mergedPolygon);
    this.selectedFeatures.push(mergedPolygon);
    this.updateSelectedArea();
    this.updateSelectedPlotsList();
  }
  
  // 拆分工具
  splitFeature() {
    if (this.selectedFeatures.length !== 1) {
      alert('请选择一个地块进行拆分');
      return;
    }
    
    const feature = this.selectedFeatures[0];
    const latLngs = feature.getLatLngs()[0];
    
    if (latLngs.length < 4) {
      alert('地块顶点数量不足，无法拆分');
      return;
    }
    
    // 简单拆分：从中心点分成两部分
    const center = feature.getBounds().getCenter();
    const splitPoint = latLngs[Math.floor(latLngs.length / 2)];
    
    // 创建两个新多边形
    const part1 = latLngs.slice(0, Math.floor(latLngs.length / 2)).concat([center, latLngs[0]]);
    const part2 = latLngs.slice(Math.floor(latLngs.length / 2)).concat([center, latLngs[Math.floor(latLngs.length / 2)]]);
    
    const polygon1 = L.polygon(part1, this.styles.selected);
    const polygon2 = L.polygon(part2, this.styles.selected);
    
    // 清除原有选区
    this.clearSelectedFeatures();
    
    // 添加新多边形
    this.addToWorkingLayer(polygon1);
    this.addToWorkingLayer(polygon2);
    this.selectedFeatures.push(polygon1, polygon2);
    this.updateSelectedArea();
    this.updateSelectedPlotsList();
  }
  
  // 橡皮擦模式设置
  setEraserMode(mode) {
    this.eraserMode = mode;
  }

  // 平移地图工具
  enablePan() {
    this.clearToolEvents();
    this.currentTool = 'pan';
    this.updateEditMode('平移/拖动');
    
    // 平移模式下启用地图拖拽
    this.map.dragging.enable();
    this.map.scrollWheelZoom.enable();
    this.map.doubleClickZoom.enable();
    
    // 改变鼠标样式
    this.map.getContainer().style.cursor = 'grab';
  }

  // 橡皮擦工具
  enableEraser() {
    this.clearToolEvents();
    this.currentTool = 'eraser';
    this.updateEditMode(`橡皮擦 (${this.eraserMode === 'block' ? '整块' : '画笔'})`);
    
    // 设置鼠标样式
    this.map.getContainer().style.cursor = 'url("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/icons/eraser.svg"), auto';
    
    if (this.eraserMode === 'block') {
      this.map.on('click', this._handlers.eraserClick);
    } else {
      // 画笔橡皮擦逻辑
      this.paintedGrids = new Set();
      if (this.paintedLayer) this.map.removeLayer(this.paintedLayer);
      this.paintedLayer = L.layerGroup().addTo(this.map);
      this.isPainting = false;
      this.map.dragging.disable();
      
      this.map.on('mousedown', this._handlers.eraserStart);
      this.map.on('mousemove', this._handlers.eraserMove);
      this.map.on('mouseup', this._handlers.eraserEnd);
      this.map.on('mouseout', this._handlers.eraserEnd);
    }
  }
  
  // 整块擦除点击处理
  handleEraserClick(e) {
    if (this.currentTool === 'eraser' && this.eraserMode === 'block') {
      if (typeof turf === 'undefined') return;
      const point = turf.point([e.latlng.lng, e.latlng.lat]);

      for (let i = this.userPlots.length - 1; i >= 0; i--) {
        const plot = this.userPlots[i];
        if (!plot || plot.visible === false) continue;
        if (plot.locked) continue;
        if (!plot.geojson) continue;

        try {
          if (turf.booleanPointInPolygon(point, plot.geojson)) {
            this.removePlot(plot.id);
            return;
          }
        } catch (_) {
          continue;
        }
      }
    }
  }

  // 画笔橡皮擦：开始
  startEraserBrush(e) {
    if (this.currentTool === 'eraser' && this.eraserMode === 'brush') {
      this.isPainting = true;
      this.paintedGrids.clear();
      this.paintedLayer.clearLayers();
      this.paintAtEraser(e.latlng);
    }
  }

  // 画笔橡皮擦：移动
  handleEraserBrush(e) {
    if (this.currentTool === 'eraser' && this.eraserMode === 'brush') {
      this.updateBrushPreview(e.latlng);
      if (this.isPainting) {
        this.paintAtEraser(e.latlng);
      }
    }
  }

  // 画笔橡皮擦：绘制预览（红色表示擦除）
  paintAtEraser(latlng) {
    const grids = this.getGridsForBrush(latlng);
    const newRectangles = [];
    const color = '#dc3545'; // 红色表示擦除
    
    grids.forEach(g => {
      const key = `${g.latIndex},${g.lngIndex}`;
      if (!this.paintedGrids.has(key)) {
        this.paintedGrids.add(key);
        const bounds = this.getGridBounds(g.latIndex, g.lngIndex);
        const rect = L.rectangle(bounds, {
          color: color,
          weight: 0,
          fillColor: color,
          fillOpacity: 0.6,
          interactive: false,
          renderer: this.canvasRenderer
        });
        newRectangles.push(rect);
      }
    });

    if (newRectangles.length > 0) {
      newRectangles.forEach(rect => rect.addTo(this.paintedLayer));
    }
  }

  // 画笔橡皮擦：结束并执行擦除
  endEraserBrush(e) {
    if (this.currentTool === 'eraser' && this.eraserMode === 'brush' && this.isPainting) {
      this.isPainting = false;
      if (this.brushPreviewLayer) {
        this.map.removeLayer(this.brushPreviewLayer);
        this.brushPreviewLayer = null;
      }
      
      if (this.paintedGrids.size > 0) {
        this.executeBrushEraser();
      }
    }
  }

  // 执行画笔擦除逻辑
  executeBrushEraser() {
    if (typeof turf === 'undefined') return;
    
    // 1. 构建擦除区域多边形
    let eraserPoly = null;
    this.paintedGrids.forEach(key => {
      const parts = key.split(',');
      const latIndex = parseInt(parts[0]);
      const lngIndex = parseInt(parts[1]);
      const bounds = this.getGridBounds(latIndex, lngIndex);
      const sLat = bounds[0][0], wLng = bounds[0][1];
      const nLat = bounds[1][0], eLng = bounds[1][1];
      
      const poly = turf.polygon([[
        [wLng, sLat], [eLng, sLat], [eLng, nLat], [wLng, nLat], [wLng, sLat]
      ]]);
      
      eraserPoly = eraserPoly ? turf.union(eraserPoly, poly) : poly;
    });

    if (!eraserPoly) return;

    // 2. 对每个地块执行差异计算
    let changed = false;
    this.userPlots.forEach(plot => {
      if (!plot.visible || plot.locked || !plot.geojson) return;

      try {
        const diff = turf.difference(plot.geojson, eraserPoly);
        if (diff) {
          // 如果还有剩余部分，更新 GeoJSON
          plot.geojson = diff;
          // 更新地图图层
          if (plot.layer) {
            plot.layer.clearLayers();
            L.geoJSON(diff, {
              style: this.getPlotStyle(plot.properties?.type, plot.id === this.activePlotId),
              renderer: this.canvasRenderer
            }).eachLayer(l => plot.layer.addLayer(l));
          }
          changed = true;
        } else {
          // 如果完全被擦除，后续可能需要处理删除逻辑
          // 这里简单做法是保留空地块，或者直接调用 removePlot
          this.removePlot(plot.id);
          changed = true;
        }
      } catch (err) {
        console.error('擦除计算失败:', err);
      }
    });

    if (changed) {
      this.captureHistorySnapshot();
      this.updateSelectedArea();
    }

    // 清理临时图层
    if (this.paintedLayer) this.paintedLayer.clearLayers();
    this.paintedGrids.clear();
  }
  
  // 设置画笔大小
  setBrushSize(size) {
    this.brushSize = size;
  }

  // 像素画笔工具
  enableBrush() {
    this.clearToolEvents();
    this.currentTool = 'brush';
    this.updateEditMode('像素画笔');
    
    // 画笔模式下设置鼠标样式
    this.map.getContainer().style.cursor = 'crosshair';
    
    this.paintedGrids = new Set();
    if (this.paintedLayer) this.map.removeLayer(this.paintedLayer);
    this.paintedLayer = L.layerGroup().addTo(this.map);
    
    this.isPainting = false;
    this.brushPreviewLayer = null;
    this.map.dragging.disable();
    
    this.map.on('mousedown', this._handlers.brushStart);
    this.map.on('mousemove', this._handlers.brushMove);
    this.map.on('mouseup', this._handlers.brushEnd);
    this.map.on('mouseout', this._handlers.brushEnd);
  }
  
  // 清除所有工具事件
  clearToolEvents() {
    this.map.off('mousedown', this._handlers.brushStart);
    this.map.off('mousemove', this._handlers.brushMove);
    this.map.off('mouseup', this._handlers.brushEnd);
    this.map.off('mouseout', this._handlers.brushEnd);
    
    this.map.off('mousedown', this._handlers.eraserStart);
    this.map.off('mousemove', this._handlers.eraserMove);
    this.map.off('mouseup', this._handlers.eraserEnd);
    this.map.off('mouseout', this._handlers.eraserEnd);
    
    this.map.off('click', this._handlers.eraserClick);
    
    if (this.brushPreviewLayer) {
      this.map.removeLayer(this.brushPreviewLayer);
      this.brushPreviewLayer = null;
    }
    this.map.dragging.enable();
  }

  // 开始画笔
  startBrush(e) {
    if (this.currentTool === 'brush') {
      this.isPainting = true;
      this.paintedGrids.clear(); // 清空上次绘制的集合
      this.paintedLayer.clearLayers(); // 清空画布上的旧矩形
      this.paintAt(e.latlng);
    }
  }
  
  // 处理画笔移动
  handleBrush(e) {
    if (this.currentTool === 'brush') {
      // 画笔预览框
      this.updateBrushPreview(e.latlng);
      
      if (this.isPainting) {
        this.paintAt(e.latlng);
      }
    }
  }
  
  // 预览画笔位置
  updateBrushPreview(latlng) {
    if (this.brushPreviewLayer) {
      this.map.removeLayer(this.brushPreviewLayer);
    }
    
    const grids = this.getGridsForBrush(latlng);
    const rects = grids.map(g => this.getGridBounds(g.latIndex, g.lngIndex));
    
    this.brushPreviewLayer = L.layerGroup(rects.map(b => L.rectangle(b, {
      color: '#ffc107',
      weight: 2,
      fillColor: '#ffc107',
      fillOpacity: 0.3,
      interactive: false
    }))).addTo(this.map);
  }

  // 更新当前激活地块的属性
  updateActivePlotProperties(newProps) {
    if (!this.activePlotId) return;
    const plot = this.userPlots.find(p => p.id === this.activePlotId);
    if (plot) {
      plot.properties = { ...plot.properties, ...newProps };
      // 如果类型改变，更新样式
      if (newProps.type && plot.layer) {
        plot.layer.setStyle(this.getPlotStyle(newProps.type, true));
      }
      this.updateSelectedPlotsList();
    }
  }

  // 计算刷子覆盖的网格 (支持自定义 N 网格)
  getGridsForBrush(latlng) {
    const latIndex = Math.floor(latlng.lat / this.gridLatStep);
    const lngIndex = Math.floor(latlng.lng / this.gridLngStep);
    const grids = [];
    
    // 如果是 1x1 就是 [0], 如果是 3x3 就是 [-1, 0, 1] 等等
    const offset = Math.floor(this.brushSize / 2);
    
    // 限制最大笔刷大小，防止性能崩溃
    const safeBrushSize = Math.min(this.brushSize, 50);

    for (let i = 0; i < safeBrushSize; i++) {
      for (let j = 0; j < safeBrushSize; j++) {
        const dLat = i - offset;
        const dLng = j - offset;
        grids.push({ latIndex: latIndex + dLat, lngIndex: lngIndex + dLng });
      }
    }
    return grids;
  }
  
  // 获取单个网格的边界
  getGridBounds(latIndex, lngIndex) {
    const sLat = latIndex * this.gridLatStep;
    const nLat = (latIndex + 1) * this.gridLatStep;
    const wLng = lngIndex * this.gridLngStep;
    const eLng = (lngIndex + 1) * this.gridLngStep;
    return [[sLat, wLng], [nLat, eLng]];
  }

  // 绘制网格
  paintAt(latlng) {
    const grids = this.getGridsForBrush(latlng);
    const newRectangles = [];
    const type = document.getElementById('plotType')?.value || 'farmland';
    const color = this.getPlotColor(type);
    
    grids.forEach(g => {
      const key = `${g.latIndex},${g.lngIndex}`;
      if (!this.paintedGrids.has(key)) {
        this.paintedGrids.add(key);
        // 性能优化：将渲染器指定为 canvas
        const bounds = this.getGridBounds(g.latIndex, g.lngIndex);
        const rect = L.rectangle(bounds, {
          color: color,
          weight: 0, // 移除边框，减少渲染负担
          fillColor: color,
          fillOpacity: 0.6,
          interactive: false,
          renderer: this.canvasRenderer // 使用 canvas 渲染
        });
        newRectangles.push(rect);
      }
    });

    // 批量添加到图层
    if (newRectangles.length > 0) {
      newRectangles.forEach(rect => rect.addTo(this.paintedLayer));
    }
  }
  
  // 结束画笔
  endBrush(e) {
    if (this.currentTool === 'brush' && this.isPainting) {
      this.isPainting = false;
      
      // 清除画笔预览框
      if (this.brushPreviewLayer) {
        this.map.removeLayer(this.brushPreviewLayer);
        this.brushPreviewLayer = null;
      }
      
      if (this.paintedGrids.size > 0) {
        // 将所有绘制的网格合并为一个多边形
        this.mergePaintedGrids();
      }
    }
  }
  
  // 使用 Turf.js 合并网格并生成多边形
  mergePaintedGrids() {
    if (typeof turf === 'undefined') {
      console.error('Turf.js 未加载，无法合并网格');
      return;
    }
    
    let combinedFeature = null;
    const cells = [];
    
    this.paintedGrids.forEach(key => {
      const parts = key.split(',');
      const latIndex = parseInt(parts[0]);
      const lngIndex = parseInt(parts[1]);
      
      cells.push({ x: lngIndex, y: latIndex });
      
      const bounds = this.getGridBounds(latIndex, lngIndex);
      const sLat = bounds[0][0], wLng = bounds[0][1];
      const nLat = bounds[1][0], eLng = bounds[1][1];
      
      // Turf Polygon 需要坐标为 [lng, lat]
      const poly = turf.polygon([[
        [wLng, sLat],
        [eLng, sLat],
        [eLng, nLat],
        [wLng, nLat],
        [wLng, sLat]
      ]]);
      
      if (!combinedFeature) {
        combinedFeature = poly;
      } else {
        combinedFeature = turf.union(combinedFeature, poly);
      }
    });
    
    if (combinedFeature) {
      if (this.paintedLayer) this.paintedLayer.clearLayers();

      const properties = this.getCurrentPlotPropertiesFromForm();

      let mergedFeature = combinedFeature;
      let mergedGridData = { grid_size: 10, cells: cells };
      let preservedDbId = null; // 记录被合并地块中的数据库 ID
      
      const toMerge = [];
      this.userPlots.forEach(plot => {
        if (!this.canAutoMergePlot(plot, properties)) return;
        if (!plot.geojson) return;
        try {
          if (turf.booleanIntersects(mergedFeature, plot.geojson)) {
            toMerge.push(plot);
          }
        } catch (_) {
          return;
        }
      });

      toMerge.forEach(plot => {
        try {
          // 如果被合并的地块有数据库 ID，则保留它（优先保留当前激活地块的 ID，或者第一个遇到的 ID）
          if (plot.db_id && (!preservedDbId || plot.id === this.activePlotId)) {
            preservedDbId = plot.db_id;
          }
          
          mergedFeature = turf.union(mergedFeature, plot.geojson);
          // 合并网格数据
          if (plot.gridData && plot.gridData.cells) {
            mergedGridData.cells = [...mergedGridData.cells, ...plot.gridData.cells];
            // 去重
            const seen = new Set();
            mergedGridData.cells = mergedGridData.cells.filter(c => {
              const k = `${c.x},${c.y}`;
              return seen.has(k) ? false : seen.add(k);
            });
          }
        } catch (_) {}
        this._removePlotInternal(plot.id);
      });

      const areaHa = turf.area(mergedFeature) / 10000;
      properties.areaHa = Number(areaHa.toFixed(2));

      const plot = this.createPlotFromGeoJSON(mergedFeature, properties, mergedGridData, preservedDbId);
      this.userPlots.push(plot);
      this.activePlotId = plot.id;

      this.applyPlotOrder();
      this.captureHistorySnapshot();
      this.updateSelectedArea();
      this.updateSelectedPlotsList();
      this.selectPlot(plot.id);
    }
    
    this.paintedGrids.clear();
  }
  
  captureHistorySnapshot() {
    const snapshot = {
      activePlotId: this.activePlotId,
      currentBasemap: this.currentBasemap,
      plots: this.userPlots.map(plot => ({
        id: plot.id,
        db_id: plot.db_id,
        geojson: plot.geojson,
        gridData: plot.gridData,
        properties: plot.properties,
        visible: plot.visible !== false,
        locked: !!plot.locked
      }))
    };

    if (this.historyIndex < this.history.length - 1) {
      this.history.splice(this.historyIndex + 1);
    }

    this.history.push(snapshot);
    this.historyIndex = this.history.length - 1;
  }

  restoreHistorySnapshot(index) {
    const snapshot = this.history[index];
    if (!snapshot) return;

    this.activePlotId = snapshot.activePlotId || null;

    if (snapshot.currentBasemap && snapshot.currentBasemap !== this.currentBasemap) {
      this.switchBasemap(snapshot.currentBasemap);
    }

    this.userPlots.forEach(p => {
      if (p.layer) this.layerManager.layerGroups.working.removeLayer(p.layer);
    });
    this.userPlots = [];

    snapshot.plots.forEach(p => {
      const layer = L.geoJSON(p.geojson, {
        style: this.getPlotStyle(p.properties?.type, p.id === this.activePlotId),
        interactive: !p.locked,
        renderer: this.canvasRenderer // 使用 Canvas 渲染以提升性能
      });
      if (p.visible) {
        this.layerManager.layerGroups.working.addLayer(layer);
      }
      this.userPlots.push({
        id: p.id,
        db_id: p.db_id,
        geojson: p.geojson,
        gridData: p.gridData,
        properties: p.properties,
        visible: p.visible,
        locked: p.locked,
        layer
      });
    });

    this.applyPlotOrder();
    this.updateSelectedArea();
    this.updateSelectedPlotsList();
    if (this.activePlotId) this.selectPlot(this.activePlotId);
  }

  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex -= 1;
    this.restoreHistorySnapshot(this.historyIndex);
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex += 1;
    this.restoreHistorySnapshot(this.historyIndex);
  }

  // 保存地块数据到后端
  async save() {
    if (!this.userPlots.length) {
      alert('没有需要保存的地块');
      return;
    }

    const errors = [];
    let savedCount = 0;

    for (const plot of this.userPlots) {
      if (!plot.geojson) continue;

      // 提取当前属性
      const properties = plot.properties || this.getCurrentPlotPropertiesFromForm();
      
      // 计算中心点 (使用 Turf)
      let center_lng = 0, center_lat = 0;
      try {
        if (typeof turf !== 'undefined' && plot.geojson.geometry) {
          const center = turf.center(plot.geojson);
          center_lng = center.geometry.coordinates[0];
          center_lat = center.geometry.coordinates[1];
        }
      } catch (e) {
        console.error('计算中心点失败', e);
      }

      // 构建请求负载
      let landType = properties.type || 'farmland';
      // 兼容处理：前端 plural 映射到后端 singular
      if (landType === 'buildings') landType = 'building';
      if (landType === 'roads') landType = 'road';

      const payload = {
        id: plot.db_id || null,
        area_obj: this.areaId, // 关键：关联到当前区域
        name: properties.name || '未命名地块',
        category: landType, // 字段名改为 category
        risk_level: properties.riskLevel || 'low',
        area: properties.areaHa || 0,
        description: properties.description || '',
        geom_json: plot.geojson,
        grid_json: plot.gridData || { grid_size: 10, cells: [] },
        style_json: {
          fill_color: this.getPlotColor(properties.type),
          stroke_color: this.colorScheme.selected,
          layer_name: properties.name,
          visible: plot.visible !== false,
          locked: !!plot.locked
        },
        meta_json: {
          source: 'manual_draw',
          editor_mode: 'pixel_brush',
          sub_type: properties.subType || '',
          remark: properties.remark || ''
        }
      };

      try {
        // 使用地块保存接口
        const url = '/terrain/api/zones/create/';

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCookie('csrftoken')
          },
          body: JSON.stringify(payload)
        });

        // 稳健解析 JSON
        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          console.error('解析响应失败:', text);
          throw new Error(`服务器返回了非 JSON 内容 (状态码: ${response.status})。请检查网络面板查看具体报错。`);
        }

        if (result.code === 0) {
          plot.db_id = result.data.id; // 回填 ID
          savedCount++;
          // 标记地块数据已变动，通知列表页刷新
          localStorage.setItem('terrain_plot_changed', '1');
        } else {
          const errorMsg = result.msg || result.message || result.detail || JSON.stringify(result) || '未知错误';
          errors.push(`地块[${payload.name}]保存失败: ${errorMsg}`);
        }
      } catch (e) {
        console.error(`保存地块 ${plot.id} 失败:`, e);
        errors.push(`地块[${payload.name}]保存异常: ${e.message}`);
      }
    }

    if (errors.length > 0) {
      alert('保存完成，但部分地块失败:\n' + errors.join('\n'));
    } else {
      alert(`成功保存 ${savedCount} 个地块！`);
    }
    
    this.updateSelectedPlotsList();
  }

  // 加载区域编辑详情 (包括区域边界、地块及其要素)
  async loadAreaEditDetail(areaId) {
    if (!areaId) return;
    this.areaId = areaId;
    
    try {
      const response = await fetch(`/terrain/api/areas/${areaId}/edit/`);
      const result = await response.json();
      
      if (result.code === 0 && result.data) {
        const { area, zones } = result.data;
        this.areaData = area;
        
        // 1. 渲染区域边界并更新视口
        if (area.boundary_json) {
          this.renderAreaBoundary(area.boundary_json);
          this.updateMapViewport(area.boundary_json);
        } else {
          this.updateMapViewport();
        }

        // 3. 清理当前地块并重新渲染
        this.userPlots.forEach(p => {
          if (p.layer) this.layerManager.layerGroups.working.removeLayer(p.layer);
        });
        this.userPlots = [];

        // 4. 渲染所有地块 (Zones)
        if (zones && zones.length > 0) {
          zones.forEach(zoneData => {
            this.renderPlotFromData(zoneData);
          });
        }
        
        this.updateSelectedPlotsList();
        console.log(`成功加载区域 "${area.name}", 包含 ${zones.length} 个地块`);
      } else {
        console.warn('加载区域编辑详情失败:', result.msg);
      }
    } catch (e) {
      console.error('加载区域编辑详情异常:', e);
    }
  }

  // 渲染区域边界 (作为背景参考)
  renderAreaBoundary(geojson) {
    if (!geojson) return;
    
    // 如果已有边界层，先移除
    if (this.areaBoundaryLayer) {
      this.map.removeLayer(this.areaBoundaryLayer);
    }
    
    this.areaBoundaryLayer = L.geoJSON(geojson, {
      style: {
        color: '#666',
        weight: 2,
        dashArray: '5, 10',
        fillOpacity: 0.05,
        interactive: false
      }
    }).addTo(this.map);
    
    // 自动缩放到边界
    const bounds = this.areaBoundaryLayer.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds);
    }
  }

  // 从数据库数据渲染地块 (Zone) 到地图
  renderPlotFromData(data) {
    const properties = {
      name: data.name,
      type: data.category, // 注意字段对应关系: data.category -> properties.type
      riskLevel: data.risk_level,
      description: data.description,
      areaHa: data.area,
      subType: data.meta_json?.sub_type || '',
      remark: data.meta_json?.remark || ''
    };

    const id = `plot_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    
    // 创建 Leaflet 图层
    const layer = L.geoJSON(data.geom_json, {
      style: this.getPlotStyle(properties.type, false),
      interactive: !(data.style_json?.locked),
      renderer: this.canvasRenderer
    });

    const plot = {
      id: id,
      db_id: data.id,
      geojson: data.geom_json,
      gridData: data.grid_json,
      properties: properties,
      elements: data.elements || [], // 保存该地块下的要素
      visible: data.style_json?.visible !== false,
      locked: !!data.style_json?.locked,
      layer: layer
    };

    // 添加到地图和管理器
    if (plot.visible) {
      this.layerManager.layerGroups.working.addLayer(layer);
    }

    this.userPlots.push(plot);
    
    // 为地块绑定点击事件以支持再次选择
    layer.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      this.selectPlot(plot.id);
    });
  }

  // 获取 CSRF Token
  getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
   }

  exportGeoJSON() {
    const features = this.userPlots.map((plot) => ({
      type: 'Feature',
      geometry: plot.geojson?.geometry,
      properties: {
        ...plot.properties,
        id: plot.id
      }
    })).filter(f => !!f.geometry);

    const geojson = {
      type: 'FeatureCollection',
      features
    };

    const geojsonString = JSON.stringify(geojson, null, 2);
    const blob = new Blob([geojsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uav_plots_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('GeoJSON 导出成功（仅包含用户绘制地块）');
  }

  getPlotColor(type) {
    if (type && this.colorScheme[type]) return this.colorScheme[type];
    return this.colorScheme.selected;
  }

  getPlotStyle(type, isActive) {
    const fill = this.getPlotColor(type);
    if (isActive) {
      return {
        color: this.colorScheme.selected,
        weight: 3,
        fillColor: fill,
        fillOpacity: 0.45
      };
    }
    return {
      color: fill,
      weight: 1,
      fillColor: fill,
      fillOpacity: 0.35
    };
  }

  getCurrentPlotPropertiesFromForm() {
    const name = document.getElementById('plotName')?.value || '未命名地块';
    const type = document.getElementById('plotType')?.value || 'farmland';
    const subType = document.getElementById('plotSubType')?.value || '';
    const riskLevel = document.getElementById('riskLevel')?.value || 'low';
    const description = document.getElementById('description')?.value || '';

    return {
      name,
      type,
      subType,
      riskLevel,
      description,
      areaHa: 0
    };
  }

  canAutoMergePlot(plot, properties) {
    if (!plot || !plot.properties) return false;
    if (plot.locked) return false;
    if (plot.properties.type !== properties.type) return false;
    if ((plot.properties.riskLevel || 'low') !== (properties.riskLevel || 'low')) return false;
    if ((plot.properties.subType || '') !== (properties.subType || '')) return false;
    return true;
  }

  // 创建地块对象
  createPlotFromGeoJSON(geojson, properties, gridData = null, db_id = null) {
    const id = `plot_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const layer = L.geoJSON(geojson, {
      style: this.getPlotStyle(properties.type, true),
      interactive: true,
      renderer: this.canvasRenderer
    });
    this.layerManager.layerGroups.working.addLayer(layer);

    return {
      id,
      db_id, // 允许传入数据库 ID
      geojson,
      gridData: gridData || { grid_size: 10, cells: [] },
      properties,
      visible: true,
      locked: false,
      layer
    };
  }

  // 提示添加要素
  async promptAddElement(plotId) {
    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot || !plot.db_id) {
      alert('请先保存地块再添加要素');
      return;
    }
    
    const name = prompt('请输入要素名称:', '新要素');
    if (!name) return;
    const type = prompt('请输入要素类型:', '观测点');
    if (!type) return;
    
    const payload = {
      zone: plot.db_id,
      name: name,
      type: type,
      area: 0,
      geom_json: { type: 'Point', coordinates: [0, 0] } // 简化版，实际应在地图上点选
    };
    
    try {
      const response = await fetch('/terrain/api/elements/create/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.getCookie('csrftoken')
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.code === 0) {
        plot.elements.push(result.data);
        this.updateAttributePanel(plot);
      } else {
        alert('添加失败: ' + result.msg);
      }
    } catch (e) {
      console.error('添加要素异常:', e);
    }
  }

  // 删除要素
  async deleteElement(elementId, plotId) {
    if (!confirm('确定要删除该要素吗？')) return;
    
    try {
      const response = await fetch(`/terrain/api/elements/${elementId}/delete/`, {
        method: 'DELETE',
        headers: {
          'X-CSRFToken': this.getCookie('csrftoken')
        }
      });
      const result = await response.json();
      if (result.code === 0) {
        const plot = this.userPlots.find(p => p.id === plotId);
        if (plot) {
          plot.elements = plot.elements.filter(el => el.id !== elementId);
          this.updateAttributePanel(plot);
        }
      } else {
        alert('删除失败: ' + result.msg);
      }
    } catch (e) {
      console.error('删除要素异常:', e);
    }
  }

  // 彻底删除地块 (包括后端)
  async deletePlot(plotId) {
    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot) return;

    if (plot.db_id) {
      if (!confirm(`确定要永久删除地块 "${plot.properties.name || '未命名'}" 吗？`)) return;
      
      try {
        const response = await fetch(`/terrain/api/zones/${plot.db_id}/delete/`, {
          method: 'DELETE',
          headers: {
            'X-CSRFToken': this.getCookie('csrftoken')
          }
        });
        const result = await response.json();
        if (result.code !== 0) {
          alert('删除失败: ' + result.msg);
          return;
        }
        localStorage.setItem('terrain_plot_changed', '1');
      } catch (e) {
        console.error('删除请求异常:', e);
        alert('删除异常: ' + e.message);
        return;
      }
    }

    this._removePlotInternal(plotId);
    this.updateSelectedPlotsList();
    this.captureHistorySnapshot();
  }

  _removePlotInternal(plotId) {
    const idx = this.userPlots.findIndex(p => p.id === plotId);
    if (idx === -1) return;
    const plot = this.userPlots[idx];
    if (plot.layer) this.layerManager.layerGroups.working.removeLayer(plot.layer);
    this.userPlots.splice(idx, 1);
    if (this.activePlotId === plotId) {
      this.activePlotId = this.userPlots.length ? this.userPlots[this.userPlots.length - 1].id : null;
    }
  }

  togglePlotVisibility(plotId, visible) {
    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot) return;
    plot.visible = !!visible;
    if (plot.layer) {
      if (plot.visible) this.layerManager.layerGroups.working.addLayer(plot.layer);
      else this.layerManager.layerGroups.working.removeLayer(plot.layer);
    }
    this.captureHistorySnapshot();
    this.updateSelectedPlotsList();
  }

  togglePlotLock(plotId) {
    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot) return;
    plot.locked = !plot.locked;
    if (plot.layer && plot.layer.eachLayer) {
      plot.layer.eachLayer(l => {
        l.options.interactive = !plot.locked;
      });
    }
    this.captureHistorySnapshot();
    this.updateSelectedPlotsList();
  }

  movePlot(plotId, direction) {
    const idx = this.userPlots.findIndex(p => p.id === plotId);
    if (idx === -1) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= this.userPlots.length) return;
    const [plot] = this.userPlots.splice(idx, 1);
    this.userPlots.splice(nextIdx, 0, plot);
    this.applyPlotOrder();
    this.captureHistorySnapshot();
    this.updateSelectedPlotsList();
  }

  applyPlotOrder() {
    this.userPlots.forEach(p => {
      if (!p.layer) return;
      if (p.layer.bringToFront) p.layer.bringToFront();
      if (p.layer.eachLayer) {
        p.layer.eachLayer(l => l.bringToFront && l.bringToFront());
      }
    });
  }

  getLatLngRingsFromLayer(layer) {
    if (!layer) return [];
    if (layer.getLatLngs) {
      const ll = layer.getLatLngs();
      if (Array.isArray(ll) && ll.length) {
        const ring = Array.isArray(ll[0]) ? ll[0] : ll;
        return Array.isArray(ring) ? [ring] : [];
      }
    }
    if (layer.eachLayer) {
      let rings = [];
      layer.eachLayer(l => {
        if (rings.length) return;
        rings = this.getLatLngRingsFromLayer(l);
      });
      return rings;
    }
    return [];
  }
  
  // 多边形简化算法（Douglas-Peucker 算法）
  simplifyPolygon(polygon, tolerance = 0.0001) {
    const latLngs = polygon.getLatLngs()[0];
    const simplified = this.douglasPeucker(latLngs, tolerance);
    polygon.setLatLngs([simplified]);
    return polygon;
  }
  
  // Douglas-Peucker 算法实现
  douglasPeucker(points, tolerance) {
    if (points.length <= 2) {
      return points;
    }
    
    let maxDistance = 0;
    let maxIndex = 0;
    
    // 找到距离最远的点
    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.distanceToLine(points[i], points[0], points[points.length - 1]);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    
    // 如果最远点距离大于容差，递归简化
    if (maxDistance > tolerance) {
      const left = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const right = this.douglasPeucker(points.slice(maxIndex), tolerance);
      return left.slice(0, left.length - 1).concat(right);
    } else {
      // 否则，只保留首尾点
      return [points[0], points[points.length - 1]];
    }
  }
  
  // 更新颜色方案
  updateColorScheme(newColors) {
    // 合并新颜色到现有方案
    this.colorScheme = { ...this.colorScheme, ...newColors };
    
    // 更新样式对象
    this.styles = {
      selected: {
        color: this.colorScheme.selected,
        weight: 3,
        fillColor: this.colorScheme.selected,
        fillOpacity: 0.2
      },
      editing: {
        color: this.colorScheme.editing,
        weight: 2,
        fillColor: this.colorScheme.editing,
        fillOpacity: 0.1
      },
      highlight: {
        color: this.colorScheme.highlight,
        weight: 4,
        fillColor: this.colorScheme.highlight,
        fillOpacity: 0.3
      }
    };
    
    // 更新所有图层的颜色
    this.updateLayerColors();
  }
  
  // 更新图层颜色
  updateLayerColors() {
    this.userPlots.forEach(plot => {
      if (plot.layer && plot.layer.setStyle) {
        plot.layer.setStyle(this.getPlotStyle(plot.properties?.type, plot.id === this.activePlotId));
      }
    });
  }
  
  // 选择图层
  selectLayer(layer) {
    // 清除之前的选择
    this.clearSelectedFeatures();
    
    // 高亮选中的图层
    layer.setStyle(this.styles.selected);
    
    // 添加到选区
    this.selectedFeatures.push(layer);
    this.updateSelectedArea();
  }
  
  // 添加到工作图层
  addToWorkingLayer(layer) {
    this.layerManager.addLayer(`working-${Date.now()}`, layer, 'working');
  }
  
  // 清除选中的特征
  clearSelectedFeatures() {
    this.selectedFeatures.forEach(feature => {
      if (feature.setStyle) {
        feature.setStyle({});
      }
    });
    this.selectedFeatures = [];
    this.updateSelectedArea();
  }
  
  // 合并多边形
  mergePolygons(polygons) {
    // 更精确的合并逻辑，使用凸包算法确保生成正确的多边形
    let allPoints = [];
    
    polygons.forEach(polygon => {
      const latLngs = polygon.getLatLngs()[0];
      allPoints = allPoints.concat(latLngs);
    });
    
    // 去重
    const uniquePoints = this.removeDuplicates(allPoints);
    
    // 使用凸包算法生成合并后的边界
    const convexHullPoints = this.convexHull(uniquePoints);
    
    return L.polygon(convexHullPoints, this.styles.selected);
  }
  
  // 凸包算法
  convexHull(points) {
    // 找到最左下角的点
    let startPoint = points[0];
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      if (point.lat < startPoint.lat || (point.lat === startPoint.lat && point.lng < startPoint.lng)) {
        startPoint = point;
      }
    }
    
    // 按极角排序
    points.sort((a, b) => {
      const angleA = Math.atan2(a.lng - startPoint.lng, a.lat - startPoint.lat);
      const angleB = Math.atan2(b.lng - startPoint.lng, b.lat - startPoint.lat);
      return angleA - angleB;
    });
    
    // 构建凸包
    const hull = [];
    for (let i = 0; i < points.length; i++) {
      while (hull.length >= 2 && this.cross(hull[hull.length - 2], hull[hull.length - 1], points[i]) <= 0) {
        hull.pop();
      }
      hull.push(points[i]);
    }
    
    return hull;
  }
  
  // 计算叉积
  cross(o, a, b) {
    return (a.lat - o.lat) * (b.lng - o.lng) - (a.lng - o.lng) * (b.lat - o.lat);
  }
  
  // 移除重复点
  removeDuplicates(points) {
    const unique = [];
    const seen = new Set();
    
    points.forEach(point => {
      const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(point);
      }
    });
    
    return unique;
  }
  
  // 排序点（简单的凸包算法）
  sortPoints(points) {
    // 找到最左下角的点
    let startPoint = points[0];
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      if (point.lat < startPoint.lat || (point.lat === startPoint.lat && point.lng < startPoint.lng)) {
        startPoint = point;
      }
    }
    
    // 按极角排序
    points.sort((a, b) => {
      const angleA = Math.atan2(a.lng - startPoint.lng, a.lat - startPoint.lat);
      const angleB = Math.atan2(b.lng - startPoint.lng, b.lat - startPoint.lat);
      return angleA - angleB;
    });
    
    return points;
  }
  
  // 获取智能选择边界
  getSmartSelectionBounds(latlng) {
    // 模拟智能选择边界
    const buffer = 0.001; // 约100米
    return [
      [latlng.lat - buffer, latlng.lng - buffer],
      [latlng.lat + buffer, latlng.lng + buffer]
    ];
  }
  
  // 更新选中区域信息
  updateSelectedArea() {
    const selectedAreaEl = document.getElementById('selectedArea');
    const vertexCountEl = document.getElementById('vertexCount');

    if (!this.userPlots.length) {
      if (selectedAreaEl) selectedAreaEl.textContent = '面积: -';
      if (vertexCountEl) vertexCountEl.textContent = '顶点: -';
      return;
    }

    const totalAreaHa = this.userPlots.reduce((sum, p) => sum + (Number(p.properties?.areaHa) || 0), 0);
    if (selectedAreaEl) selectedAreaEl.textContent = `面积: ${totalAreaHa.toFixed(2)} 公顷`;

    const active = this.userPlots.find(p => p.id === this.activePlotId) || this.userPlots[0];
    const rings = this.getLatLngRingsFromLayer(active?.layer);
    const vertices = rings.length ? rings[0].length : 0;
    if (vertexCountEl) vertexCountEl.textContent = `顶点: ${vertices || '-'}`;
  }
  
  // 更新光标位置
  updateCursorPosition(latlng) {
    document.getElementById('cursorPosition').textContent = `坐标: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
  }
  
  // 更新编辑模式
  updateEditMode(mode) {
    if (this.currentTool === 'brush' && mode !== '像素画笔') {
      if (typeof this.clearToolEvents === 'function') {
        this.clearToolEvents();
      }
    }
    document.getElementById('editMode').textContent = `编辑模式: ${mode}`;
  }
  
  // 初始化数据管理器
  initDataManager() {
    this.dataManager = new window.MapDataManager();
    
    // 注册数据加载完成回调
    this.dataManager.onDataLoaded((data) => {
      this.loadTerrainData(data);
    });
    
    // 加载所有数据
    this.dataManager.loadAllData();
  }
  
  // 加载地形数据
  loadTerrainData(data) {
    console.log('=== 开始加载地形数据 ===');
    console.log('数据内容:', data);
    
    // 收集业务图层数据
    const terrainFeatures = [];
    const businessBoundaries = [];
    const allLayers = [];
    
    // 加载地形边界
    if (data.terrainBoundaries) {
      console.log('=== 加载地形边界 ===');
      console.log('地形边界数量:', data.terrainBoundaries.length);
      
      data.terrainBoundaries.forEach(boundary => {
        console.log('地形边界:', boundary.name, boundary.coordinates);
        
        const polygon = L.polygon(boundary.coordinates, {
          color: '#6c757d',
          weight: 2,
          fillColor: '#6c757d',
          fillOpacity: 0.3
        });
        polygon.bindPopup(`<strong>${boundary.name}</strong><br>类型: ${boundary.type}`);
        this.layerManager.addLayer(`terrain-${boundary.id}`, polygon, 'base');
        this.layers.base.terrain = polygon;
        terrainFeatures.push(boundary);
        allLayers.push(polygon);
        
        console.log('地形边界已添加到地图:', boundary.name);
      });
    }
    
    // 加载风险区域
    if (data.riskAreas) {
      console.log('=== 加载风险区域 ===');
      console.log('风险区域数量:', data.riskAreas.length);
      
      data.riskAreas.forEach(zone => {
        console.log('风险区域:', zone.name, zone.coordinates);
        
        const polygon = L.polygon(zone.coordinates, {
          color: '#dc3545',
          weight: 2,
          fillColor: '#dc3545',
          fillOpacity: 0.3
        });
        polygon.bindPopup(`<strong>${zone.name}</strong><br>风险等级: ${zone.level}`);
        this.layerManager.addLayer(`risk-${zone.id}`, polygon, 'base');
        this.layers.base.risk = polygon;
        allLayers.push(polygon);
        
        console.log('风险区域已添加到地图:', zone.name);
      });
    }
    
    // 加载禁飞区
    if (data.noFlyZones) {
      console.log('=== 加载禁飞区 ===');
      console.log('禁飞区数量:', data.noFlyZones.length);
      
      data.noFlyZones.forEach(zone => {
        console.log('禁飞区:', zone.name, zone.coordinates);
        
        const polygon = L.polygon(zone.coordinates, {
          color: '#6f42c1',
          weight: 2,
          fillColor: '#6f42c1',
          fillOpacity: 0.3
        });
        polygon.bindPopup(`<strong>${zone.name}</strong><br>原因: ${zone.reason}`);
        this.layerManager.addLayer(`noFly-${zone.id}`, polygon, 'base');
        this.layers.base.noFly = polygon;
        allLayers.push(polygon);
        
        console.log('禁飞区已添加到地图:', zone.name);
      });
    }
    
    // 加载林区
    if (data.forestAreas) {
      console.log('=== 加载林区 ===');
      console.log('林区数量:', data.forestAreas.length);
      
      data.forestAreas.forEach(area => {
        console.log('林区:', area.name, area.coordinates);
        
        const polygon = L.polygon(area.coordinates, {
          color: '#198754',
          weight: 2,
          fillColor: '#198754',
          fillOpacity: 0.3
        });
        polygon.bindPopup(`<strong>${area.name}</strong><br>类型: ${area.type}`);
        this.layerManager.addLayer(`forest-${area.id}`, polygon, 'business');
        this.layers.business.forest = polygon;
        businessBoundaries.push(area);
        allLayers.push(polygon);
        
        console.log('林区已添加到地图:', area.name);
      });
    }
    
    // 加载农田
    if (data.farmAreas) {
      console.log('=== 加载农田 ===');
      console.log('农田数量:', data.farmAreas.length);
      
      data.farmAreas.forEach(area => {
        console.log('农田:', area.name, area.coordinates);
        
        const polygon = L.polygon(area.coordinates, {
          color: '#fd7e14',
          weight: 2,
          fillColor: '#fd7e14',
          fillOpacity: 0.3
        });
        polygon.bindPopup(`<strong>${area.name}</strong><br>作物: ${area.crop}`);
        this.layerManager.addLayer(`farm-${area.id}`, polygon, 'business');
        this.layers.business.farm = polygon;
        businessBoundaries.push(area);
        allLayers.push(polygon);
        
        console.log('农田已添加到地图:', area.name);
      });
    }
    
    // 加载现有地块
    if (data.existingPlots) {
      console.log('=== 加载现有地块 ===');
      console.log('现有地块数量:', data.existingPlots.length);
      
      data.existingPlots.forEach(plot => {
        console.log('现有地块:', plot.name, plot.coordinates);
        
        const polygon = L.polygon(plot.coordinates, {
          color: '#0d6efd',
          weight: 2,
          fillColor: '#0d6efd',
          fillOpacity: 0.3
        });
        polygon.bindPopup(`<strong>${plot.name}</strong><br>类型: ${plot.type}<br>面积: ${plot.area} 公顷<br>风险等级: ${plot.riskLevel}`);
        this.layerManager.addLayer(`plot-${plot.id}`, polygon, 'business');
        businessBoundaries.push(plot);
        allLayers.push(polygon);
        
        console.log('现有地块已添加到地图:', plot.name);
      });
    }
    
    // 传递业务图层数据给 smartSelection
    if (this.smartSelection) {
      console.log('=== 传递数据给智能选区 ===');
      console.log('地形特征数量:', terrainFeatures.length);
      console.log('业务边界数量:', businessBoundaries.length);
      
      this.smartSelection.loadTerrainFeatures(terrainFeatures);
      this.smartSelection.loadBusinessBoundaries(businessBoundaries);
    }
    
    // 调整地图视野到所有图层
    if (allLayers.length > 0) {
      console.log('=== 调整地图视野 ===');
      console.log('图层数量:', allLayers.length);
      
      const bounds = L.latLngBounds();
      allLayers.forEach(layer => {
        if (layer.getBounds) {
          bounds.extend(layer.getBounds());
          console.log('图层边界:', layer.getBounds());
        }
      });
      
      if (bounds.isValid()) {
        console.log('调整地图视野到:', bounds);
        this.map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }
  
  // 切换底图
  switchBasemap(basemap) {
    if (basemap === this.currentBasemap && this.activeBaseLayer) return;
    
    // 移除当前底图实例
    if (this.activeBaseLayer) {
      this.map.removeLayer(this.activeBaseLayer);
    } else {
      // 兜底：如果 activeBaseLayer 为空，尝试移除所有可能的底图
      // 这在初次初始化时很有用，因为 initMap 已经添加了一个卫星底图实例
      this.map.eachLayer(layer => {
        if (layer instanceof L.TileLayer && !layer.options.opacity) { // 简单判断是否为底图
           this.map.removeLayer(layer);
        }
      });
    }
    
    // 获取新底图实例
    const newLayer = this.baseLayers[basemap];
    if (newLayer) {
      newLayer.addTo(this.map);
      this.activeBaseLayer = newLayer;
      this.currentBasemap = basemap;
      
      // 更新按钮显示名称
      this.updateBasemapUI(basemap);
    }
  }
  
  // 更新底图UI
  updateBasemapUI(basemap) {
    // 更新按钮文字
    const basemapNames = {
      grayscale: '标准底图',
      satellite: '卫星底图'
    };
    
    const basemapName = basemapNames[basemap] || '底图';
    const currentBasemapElement = document.getElementById('currentBasemapName');
    if (currentBasemapElement) {
      currentBasemapElement.textContent = basemapName;
    }
    const currentBasemapSidebarElement = document.getElementById('currentBasemapNameSidebar');
    if (currentBasemapSidebarElement) {
      currentBasemapSidebarElement.textContent = basemapName;
    }
    
    // 更新下拉菜单active状态
    document.querySelectorAll('.dropdown-item[data-basemap]').forEach(item => {
      if (item.getAttribute('data-basemap') === basemap) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
  
  // 计算面积（公顷）
  calculateArea(coordinates) {
    // 简单的面积计算
    let area = 0;
    const n = coordinates.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coordinates[i][0] * coordinates[j][1];
      area -= coordinates[j][0] * coordinates[i][1];
    }
    
    area = Math.abs(area) / 2;
    // 转换为公顷（1度约等于111公里）
    return (area * Math.pow(111, 2) * 100).toFixed(2);
  }
}

// 全局变量
try {
  window.TerrainEditor = TerrainEditor;
} catch (e) {
  console.error('无法设置全局变量:', e);
}
