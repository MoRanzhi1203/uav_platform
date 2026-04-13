// 地形编辑器类
class TerrainEditor {
  constructor(mapId) {
    // 初始化地图
    this.map = window.initMap(mapId, {
      center: [29.5630, 106.5516],
      zoom: 12,
      minZoom: 9,
      maxZoom: 18, // 限制最大缩放级别，避免瓦片丢失
      maxBounds: [
        [28.16, 105.11], // 重庆西南角
        [32.20, 110.19]  // 重庆东北角
      ],
      maxBoundsViscosity: 1.0
    });
    this.layerManager = new window.LayerManager(this.map);
    
    // 底图管理
    this.currentBasemap = 'grayscale';
    this.baseLayers = window.baseLayers;
    
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
    this.captureHistorySnapshot();
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
      // 指向 static 下的 shp 文件目录 (shpjs 支持直接读取同名 shp/dbf 等)
      const shpUrl = '/static/shp/chongqing-260411-free.shp/gis_osm_adminareas_a_free_1';
      
      // 使用 shpjs 的通用方法加载并转换 GeoJSON
      // 注意：此方法会尝试 fetch .shp, .dbf 等后缀文件
      const geojson = await shp(shpUrl);
      
      if (geojson) {
        L.geoJSON(geojson, {
          style: {
            color: '#34495e', // 深灰色边框
            weight: 1.5,
            opacity: 0.8,
            fillOpacity: 0,
            dashArray: '2, 4',
            interactive: false
          }
        }).addTo(this.adminBoundaryLayer);
        console.log('行政区划边界加载成功');
      }
    } catch (error) {
      console.warn('行政区划边界加载失败，请检查 static/shp 路径或 shpjs 库是否引入:', error);
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
    if (this.map.getZoom() < 17) return;
    
    this._drawGridGeneric(this.refGridLayer10m, this.gridLatStep, this.gridLngStep, {
      color: '#aaaaaa', weight: 0.5, opacity: 0.4
    });
  }

  // 绘制 1km x 1km 参考网格
  drawReferenceGrid1km() {
    this.refGridLayer1km.clearLayers();
    if (this.map.getZoom() < 11) return;

    this._drawGridGeneric(this.refGridLayer1km, this.gridLatStep1km, this.gridLngStep1km, {
      color: '#aaaaaa', weight: 0.6, opacity: 0.25, dashArray: '5, 10'
    });
  }

  // 通用网格绘制逻辑
  _drawGridGeneric(layerGroup, latStep, lngStep, style) {
    const bounds = this.map.getBounds();
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();
    
    const startLat = Math.floor(south / latStep) * latStep;
    const endLat = Math.ceil(north / latStep) * latStep;
    const startLng = Math.floor(west / lngStep) * lngStep;
    const endLng = Math.ceil(east / lngStep) * lngStep;
    
    const gridStyle = { ...style, interactive: false };
    
    let count = 0;
    const maxLines = 300;

    for (let lat = startLat; lat <= endLat && count < maxLines; lat += latStep) {
      L.polyline([[lat, startLng], [lat, endLng]], gridStyle).addTo(layerGroup);
      count++;
    }
    
    count = 0;
    for (let lng = startLng; lng <= endLng && count < maxLines; lng += lngStep) {
      L.polyline([[startLat, lng], [endLat, lng]], gridStyle).addTo(layerGroup);
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
    this.map.setView([29.5630, 106.5516], 10);
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
  removePlot(plotId) {
    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot) return;

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
    
    this.paintedGrids.forEach(key => {
      const parts = key.split(',');
      const latIndex = parseInt(parts[0]);
      const lngIndex = parseInt(parts[1]);
      
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
          mergedFeature = turf.union(mergedFeature, plot.geojson);
        } catch (_) {}
        this._removePlotInternal(plot.id);
      });

      const areaHa = turf.area(mergedFeature) / 10000;
      properties.areaHa = Number(areaHa.toFixed(2));

      const plot = this.createPlotFromGeoJSON(mergedFeature, properties);
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
        geojson: plot.geojson,
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
        geojson: p.geojson,
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

  save() {
    this.exportGeoJSON();
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

  createPlotFromGeoJSON(geojson, properties) {
    const id = `plot_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const layer = L.geoJSON(geojson, {
      style: this.getPlotStyle(properties.type, true),
      interactive: true,
      renderer: this.canvasRenderer
    });
    this.layerManager.layerGroups.working.addLayer(layer);

    return {
      id,
      geojson,
      properties,
      visible: true,
      locked: false,
      layer
    };
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
    if (basemap === this.currentBasemap) return;
    
    // 移除当前底图
    if (this.baseLayers[this.currentBasemap]) {
      this.map.removeLayer(this.baseLayers[this.currentBasemap]);
    }
    
    // 添加新底图
    if (this.baseLayers[basemap]) {
      this.baseLayers[basemap].addTo(this.map);
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
