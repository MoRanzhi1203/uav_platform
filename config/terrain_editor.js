// 地形编辑器类
class TerrainEditor {
  constructor(mapId) {
    // 初始化地图
    this.map = window.initMap(mapId, {
      center: [30.05, 107.60],
      zoom: 7,
      minZoom: 5,
      maxZoom: 18, // 限制最大缩放级别，避免瓦片丢失
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
      building: '#475569',    // 建筑 - 深灰蓝
      buildings: '#475569',   // 建筑 - 兼容旧键名
      water: '#3498db',       // 水域 - 蓝色
      road: '#9CA3AF',        // 道路 - 灰色
      roads: '#9CA3AF',       // 道路 - 兼容旧键名
      bare: '#D97706',        // 裸地 - 橙褐
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
          console.error('GeoJSON 数据解析失败或数据为空');
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
    // 调低缩放限制，使其在缩放级别 16 也能显示（由于优化了绘制逻辑，性能影响较小）
    if (this.map.getZoom() < 16) return;
    
    this._drawGridGeneric(this.refGridLayer10m, this.gridLatStep, this.gridLngStep, {
      color: '#888888', // 稍微加深颜色
      weight: 0.5, 
      opacity: 0.3
    });
  }

  // 绘制 1km x 1km 参考网格
  drawReferenceGrid1km() {
    this.refGridLayer1km.clearLayers();
    // 调低缩放限制，使其在缩放级别 10 也能显示
    if (this.map.getZoom() < 10) return;

    this._drawGridGeneric(this.refGridLayer1km, this.gridLatStep1km, this.gridLngStep1km, {
      color: '#4a90e2', // 改为较深的蓝色，更容易辨认
      weight: 1.2,      // 稍微加宽
      opacity: 0.5,     // 增加不透明度
      dashArray: '10, 10' // 调整虚线比例
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
    this.map.setView([29.5630, 106.5516], 10);
  }
  
  // 显示图形信息
  showFeatureInfo(feature) {
    console.log('图形信息:', feature.properties);
    // 这里可以实现显示图形属性的逻辑
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
      typeSelect.value = plot.properties?.type || 'forest';
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
    this.map.off('click', this._handlers.eraserClick);
    this.map.off('mousedown', this._handlers.eraserStart);
    this.map.off('mousemove', this._handlers.eraserMove);
    this.map.off('mouseup', this._handlers.eraserEnd);
    this.map.off('mouseout', this._handlers.eraserEnd);
    this.map.off('mousedown', this._handlers.brushStart);
    this.map.off('mousemove', this._handlers.brushMove);
    this.map.off('mouseup', this._handlers.brushEnd);
    this.map.off('mouseout', this._handlers.brushEnd);
    
    // 恢复地图交互
    this.map.dragging.enable();
    this.map.getContainer().style.cursor = '';
    
    // 清理临时图层
    if (this.paintedLayer) {
      this.map.removeLayer(this.paintedLayer);
      this.paintedLayer = null;
    }
    if (this.brushPreviewLayer) {
      this.map.removeLayer(this.brushPreviewLayer);
      this.brushPreviewLayer = null;
    }
  }

  // 画笔开始
  startBrush(e) {
    if (this.currentTool === 'brush') {
      this.isPainting = true;
      this.paintedGrids.clear();
      this.paintedLayer.clearLayers();
      this.paintAt(e.latlng);
    }
  }

  // 画笔移动
  handleBrush(e) {
    if (this.currentTool === 'brush') {
      this.updateBrushPreview(e.latlng);
      if (this.isPainting) {
        this.paintAt(e.latlng);
      }
    }
  }

  // 更新画笔预览
  updateBrushPreview(latlng) {
    if (this.brushPreviewLayer) {
      this.map.removeLayer(this.brushPreviewLayer);
    }
    
    this.brushPreviewLayer = L.layerGroup().addTo(this.map);
    const grids = this.getGridsForBrush(latlng);
    const color = this.currentTool === 'eraser' ? '#dc3545' : this.colorScheme.editing;
    
    grids.forEach(g => {
      const bounds = this.getGridBounds(g.latIndex, g.lngIndex);
      L.rectangle(bounds, {
        color: color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.3,
        interactive: false
      }).addTo(this.brushPreviewLayer);
    });
  }

  // 绘制点
  paintAt(latlng) {
    const grids = this.getGridsForBrush(latlng);
    const newRectangles = [];
    
    grids.forEach(g => {
      const key = `${g.latIndex},${g.lngIndex}`;
      if (!this.paintedGrids.has(key)) {
        this.paintedGrids.add(key);
        const bounds = this.getGridBounds(g.latIndex, g.lngIndex);
        const rect = L.rectangle(bounds, {
          color: this.colorScheme.editing,
          weight: 0,
          fillColor: this.colorScheme.editing,
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

  // 画笔结束
  endBrush(e) {
    if (this.currentTool === 'brush' && this.isPainting) {
      this.isPainting = false;
      if (this.brushPreviewLayer) {
        this.map.removeLayer(this.brushPreviewLayer);
        this.brushPreviewLayer = null;
      }
      
      if (this.paintedGrids.size > 0) {
        this.convertPaintedToPolygon();
      }
    }
  }

  // 获取画笔覆盖的所有网格
  getGridsForBrush(latlng) {
    const centerLatIdx = Math.floor(latlng.lat / this.gridLatStep);
    const centerLngIdx = Math.floor(latlng.lng / this.gridLngStep);
    const size = this.brushSize;
    const grids = [];
    
    // 以点击点为中心扩展
    const offset = Math.floor(size / 2);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        grids.push({
          latIndex: centerLatIdx - offset + i,
          lngIndex: centerLngIdx - offset + j
        });
      }
    }
    return grids;
  }

  // 获取网格边界坐标
  getGridBounds(latIndex, lngIndex) {
    const sLat = latIndex * this.gridLatStep;
    const wLng = lngIndex * this.gridLngStep;
    const nLat = (latIndex + 1) * this.gridLatStep;
    const eLng = (lngIndex + 1) * this.gridLngStep;
    return [[sLat, wLng], [nLat, eLng]];
  }

  // 将绘制的网格转换为多边形并合并到地块
  convertPaintedToPolygon() {
    if (typeof turf === 'undefined') return;

    // 1. 构建所有网格的合并多边形
    let combinedPoly = null;
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
      
      combinedPoly = combinedPoly ? turf.union(combinedPoly, poly) : poly;
    });

    if (!combinedPoly) return;

    // 2. 如果当前有激活地块，合并到激活地块；否则创建新地块
    if (this.activePlotId) {
      const plot = this.userPlots.find(p => p.id === this.activePlotId);
      if (plot && !plot.locked && plot.visible !== false) {
        try {
          const merged = turf.union(plot.geojson, combinedPoly);
          plot.geojson = merged;
          
          // 更新地图图层
          if (plot.layer) {
            plot.layer.clearLayers();
            L.geoJSON(merged, {
              style: this.getPlotStyle(plot.properties?.type, true),
              renderer: this.canvasRenderer
            }).eachLayer(l => plot.layer.addLayer(l));
          }
          
          this.captureHistorySnapshot();
          this.updateSelectedArea();
          this.updateAttributePanel(plot);
        } catch (err) {
          console.error('合并地块失败:', err);
        }
      } else {
        this.createNewPlotFromGeoJSON(combinedPoly);
      }
    } else {
      this.createNewPlotFromGeoJSON(combinedPoly);
    }

    // 清理临时图层
    if (this.paintedLayer) this.paintedLayer.clearLayers();
    this.paintedGrids.clear();
  }

  // 创建新地块
  createNewPlotFromGeoJSON(geojson) {
    const plotId = 'plot_' + Date.now();
    const type = document.getElementById('plotType')?.value || 'forest';
    
    // 计算面积
    const area = turf.area(geojson);
    const areaHa = area / 10000;

    const plot = {
      id: plotId,
      geojson: geojson,
      properties: {
        name: `新地块 ${this.userPlots.length + 1}`,
        type: type,
        areaHa: areaHa,
        riskLevel: 'low'
      },
      visible: true,
      locked: false
    };

    // 创建地图图层 (FeatureGroup 方便后续更新内容)
    const layer = L.featureGroup().addTo(this.layerManager.layerGroups.working);
    L.geoJSON(geojson, {
      style: this.getPlotStyle(type, true),
      renderer: this.canvasRenderer
    }).eachLayer(l => layer.addLayer(l));
    
    plot.layer = layer;
    this.userPlots.push(plot);
    this.selectPlot(plotId);
    this.updateSelectedPlotsList();
    this.captureHistorySnapshot();
    this.updateSelectedArea();
  }
  
  // 获取地块样式
  getPlotStyle(type, isActive) {
    const color = this.colorScheme[type] || this.colorScheme.forest;
    return {
      color: isActive ? this.colorScheme.selected : color,
      weight: isActive ? 3 : 2,
      opacity: 1,
      fillColor: color,
      fillOpacity: isActive ? 0.5 : 0.3
    };
  }

  // 获取地块颜色
  getPlotColor(type) {
    return this.colorScheme[type] || this.colorScheme.forest;
  }
  
  // 更新激活地块的属性
  updateActivePlotProperties(props) {
    const plot = this.userPlots.find(p => p.id === this.activePlotId);
    if (!plot) return;

    plot.properties = { ...plot.properties, ...props };
    
    // 如果修改了类型，更新颜色
    if (props.type && plot.layer) {
      plot.layer.setStyle(this.getPlotStyle(props.type, true));
    }

    this.updateSelectedPlotsList();
    this.captureHistorySnapshot();
  }

  // 切换可见性
  togglePlotVisibility(plotId, visible) {
    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot) return;

    plot.visible = visible;
    if (plot.layer) {
      if (visible) {
        this.layerManager.layerGroups.working.addLayer(plot.layer);
      } else {
        this.layerManager.layerGroups.working.removeLayer(plot.layer);
      }
    }
  }

  // 切换锁定
  togglePlotLock(plotId) {
    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot) return;

    plot.locked = !plot.locked;
    this.updateSelectedPlotsList();
  }

  // 移动图层顺序
  movePlot(plotId, direction) {
    const idx = this.userPlots.findIndex(p => p.id === plotId);
    if (idx < 0) return;

    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= this.userPlots.length) return;

    // 交换数组位置
    const temp = this.userPlots[idx];
    this.userPlots[idx] = this.userPlots[newIdx];
    this.userPlots[newIdx] = temp;

    // 更新地图层级 (Z-index 模拟)
    this.userPlots.forEach((p, i) => {
      if (p.layer && p.layer.bringToFront) {
        // 按数组顺序重新排列，后面的在地块上方
        // Leaflet 默认按添加顺序，这里需要手动调整
      }
    });
    
    // 简单做法：清空并按新顺序重新添加
    this.userPlots.forEach(p => {
      if (p.layer) {
        this.layerManager.layerGroups.working.removeLayer(p.layer);
      }
    });
    this.userPlots.forEach(p => {
      if (p.layer && p.visible !== false) {
        this.layerManager.layerGroups.working.addLayer(p.layer);
      }
    });

    this.updateSelectedPlotsList();
  }

  // 捕获历史记录快照 (深拷贝状态)
  captureHistorySnapshot() {
    // 限制历史记录数量
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    const snapshot = {
      userPlots: this.userPlots.map(plot => ({
        id: plot.id,
        geojson: JSON.parse(JSON.stringify(plot.geojson)),
        properties: { ...plot.properties },
        visible: plot.visible,
        locked: plot.locked
      })),
      activePlotId: this.activePlotId
    };

    this.history.push(snapshot);
    if (this.history.length > 50) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  // 撤销
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreFromSnapshot(this.history[this.historyIndex]);
    }
  }

  // 重做
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreFromSnapshot(this.history[this.historyIndex]);
    }
  }

  // 从快照恢复
  restoreFromSnapshot(snapshot) {
    // 1. 清理当前图层
    this.userPlots.forEach(p => {
      if (p.layer) this.layerManager.layerGroups.working.removeLayer(p.layer);
    });

    // 2. 恢复数据
    this.userPlots = snapshot.userPlots.map(s => {
      const layer = L.featureGroup();
      if (s.visible !== false) {
        layer.addTo(this.layerManager.layerGroups.working);
      }
      
      L.geoJSON(s.geojson, {
        style: this.getPlotStyle(s.properties?.type, s.id === snapshot.activePlotId),
        renderer: this.canvasRenderer
      }).eachLayer(l => layer.addLayer(l));

      return { ...s, layer: layer };
    });

    this.activePlotId = snapshot.activePlotId;

    // 3. 更新 UI
    this.updateSelectedPlotsList();
    this.updateSelectedArea();
    if (this.activePlotId) {
      const activePlot = this.userPlots.find(p => p.id === this.activePlotId);
      this.updateAttributePanel(activePlot);
    }
  }

  // 保存数据
  save() {
    if (this.userPlots.length === 0) {
      alert('没有需要保存的地块');
      return;
    }

    const data = this.userPlots.map(p => ({
      id: p.id,
      geojson: p.geojson,
      properties: p.properties
    }));

    console.log('保存地块数据:', data);
    
    // 模拟异步保存
    const btn = document.querySelector('[data-action="save"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 保存中...';
    btn.disabled = true;

    setTimeout(() => {
      alert('地块数据已成功保存到服务器');
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 1000);
  }

  // 底图切换
  switchBasemap(name) {
    if (this.baseLayers[name]) {
      this.map.removeLayer(this.baseLayers[this.currentBasemap]);
      this.baseLayers[name].addTo(this.map);
      this.currentBasemap = name;
      
      // 更新 UI
      const nameMap = { 'grayscale': '标准底图', 'satellite': '卫星底图' };
      document.getElementById('currentBasemapName').textContent = nameMap[name];
      document.getElementById('currentBasemapNameSidebar').textContent = nameMap[name];
      
      // 更新激活状态
      document.querySelectorAll('[data-basemap]').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-basemap') === name);
      });
    }
  }

  // 更新坐标显示
  updateCursorPosition(latlng) {
    const el = document.getElementById('cursorPosition');
    if (el) {
      el.textContent = `坐标: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
    }
  }
  
  // 更新已选面积显示
  updateSelectedArea() {
    if (typeof turf === 'undefined') return;

    let totalArea = 0;
    let totalHa = 0;
    let totalPoints = 0;

    this.userPlots.forEach(plot => {
      if (plot.visible !== false && plot.geojson) {
        totalArea += turf.area(plot.geojson);
        totalPoints += this.getLatLngRingsFromLayer(plot.layer)[0]?.length || 0;
      }
    });

    totalHa = totalArea / 10000;

    const areaEl = document.getElementById('selectedArea');
    const vertexEl = document.getElementById('vertexCount');
    if (areaEl) areaEl.textContent = `面积: ${totalHa.toFixed(2)} 公顷`;
    if (vertexEl) vertexEl.textContent = `顶点: ${totalPoints}`;
  }

  // 更新编辑模式文本
  updateEditMode(text) {
    const el = document.getElementById('editMode');
    if (el) el.textContent = `编辑模式: ${text}`;
  }

  // 辅助函数：从图层中提取 LatLng 环
  getLatLngRingsFromLayer(layer) {
    const rings = [];
    if (!layer) return rings;

    layer.eachLayer(l => {
      if (l.getLatLngs) {
        const latlngs = l.getLatLngs();
        // 处理嵌套数组 (多边形可能有多环)
        if (Array.isArray(latlngs[0])) {
          latlngs.forEach(ring => rings.push(ring));
        } else {
          rings.push(latlngs);
        }
      }
    });
    return rings;
  }
}

// 挂载到全局
window.TerrainEditor = TerrainEditor;
