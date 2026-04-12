// 地形编辑器类
class TerrainEditor {
  constructor(mapId) {
    // 初始化地图
    this.map = window.initMap(mapId);
    this.layerManager = new window.LayerManager(this.map);
    
    // 智能选区
    this.smartSelection = new window.SmartSelection(this.map);
    
    // 底图管理
    this.currentBasemap = 'grayscale';
    this.baseLayers = window.baseLayers;
    
    // 等高线叠加管理
    this.isContourOverlayEnabled = false;
    this.contourLayer = null;
    
    // 状态管理
    this.currentTool = 'select';
    this.selectedFeatures = [];
    this.history = [];
    this.historyIndex = -1;
    
    // 图层管理
    this.layers = {
      base: {
        terrain: null,
        risk: null,
        noFly: null
      },
      business: {
        forest: null,
        farm: null
      },
      working: {
        selected: null,
        editing: null
      }
    };
    
    // 样式
    this.styles = {
      selected: {
        color: '#0d6efd',
        weight: 3,
        fillColor: '#0d6efd',
        fillOpacity: 0.2
      },
      editing: {
        color: '#ffc107',
        weight: 2,
        fillColor: '#ffc107',
        fillOpacity: 0.1
      },
      highlight: {
        color: '#198754',
        weight: 4,
        fillColor: '#198754',
        fillOpacity: 0.3
      }
    };
    
    // 初始化
    this.init();
  }
  
  // 初始化
  init() {
    this.addLayerGroups();
    this.bindEvents();
    this.initDrawControls();
    this.initDataManager();
  }
  
  // 添加图层组
  addLayerGroups() {
    this.layerManager.addLayerGroup('base');
    this.layerManager.addLayerGroup('business');
    this.layerManager.addLayerGroup('working');
  }
  
  // 绑定事件
  bindEvents() {
    // 地图点击事件
    this.map.on('click', (e) => {
      this.handleMapClick(e);
    });
    
    // 鼠标移动事件
    this.map.on('mousemove', (e) => {
      this.updateCursorPosition(e.latlng);
    });
    
    // 等高线叠加开关事件
    const contourCheckbox = document.getElementById('contourOverlay');
    if (contourCheckbox) {
      contourCheckbox.addEventListener('change', (e) => {
        this.toggleContourOverlay(e.target.checked);
      });
    }
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
      
      console.log('=== 写入 selectedFeatures ===');
      console.log('写入前长度:', this.selectedFeatures.length);
      this.addToWorkingLayer(polygon);
      this.selectedFeatures.push(polygon);
      console.log('写入后长度:', this.selectedFeatures.length);
      
      this.updateSelectedArea();
      console.log('=== 更新已选地块列表 ===');
      this.updateSelectedPlotsList();
    } else {
      console.log('=== 未命中任何地块 ===');
      // 没有命中地块，提示用户
      alert('未识别到地块，请点击已有业务区域');
    }
  }
  
  // 更新已选地块列表
  updateSelectedPlotsList() {
    const selectedAreasContainer = document.getElementById('selectedAreas');
    selectedAreasContainer.innerHTML = '';
    
    this.selectedFeatures.forEach((feature, index) => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      if (index === 0) {
        item.classList.add('active');
      }
      
      const name = feature.name || `地块 ${index + 1}`;
      item.innerHTML = `
        <span>${name}</span>
        <button class="btn btn-sm btn-danger ml-auto" data-index="${index}">
          <i class="bi bi-x"></i>
        </button>
      `;
      
      // 绑定点击事件
      item.addEventListener('click', () => {
        this.selectPlot(index);
      });
      
      // 绑定删除事件
      const deleteBtn = item.querySelector('.btn-danger');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removePlot(index);
      });
      
      selectedAreasContainer.appendChild(item);
    });
  }
  
  // 选择地块
  selectPlot(index) {
    // 移除所有项的激活状态
    document.querySelectorAll('#selectedAreas .layer-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // 激活当前项
    document.querySelectorAll('#selectedAreas .layer-item')[index].classList.add('active');
    
    // 更新右侧属性面板
    this.updateAttributePanel(this.selectedFeatures[index]);
  }
  
  // 移除地块
  removePlot(index) {
    // 从地图中移除
    const feature = this.selectedFeatures[index];
    if (feature && feature.remove) {
      feature.remove();
    }
    
    // 从选中列表中移除
    this.selectedFeatures.splice(index, 1);
    
    // 更新界面
    this.updateSelectedArea();
    this.updateSelectedPlotsList();
  }
  
  // 更新属性面板
  updateAttributePanel(feature) {
    if (!feature) return;
    
    // 更新面积
    const area = this.calculateArea(feature.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]));
    document.getElementById('plotArea').value = area;
    
    // 更新地理信息
    const bounds = feature.getBounds();
    const center = bounds.getCenter();
    document.getElementById('centerPoint').textContent = `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`;
    document.getElementById('boundaryCount').textContent = feature.getLatLngs()[0].length;
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
  
  // 顶点编辑工具
  enableVertexEdit() {
    // 启用顶点编辑模式
    this.currentTool = 'vertex-edit';
    this.updateEditMode('顶点编辑');
    
    if (this.selectedFeatures.length > 0) {
      if (!this.boundaryEditor) {
        this.boundaryEditor = new window.BoundaryEditor(this.map);
      }
      this.boundaryEditor.startEditing(this.selectedFeatures[0]);
    }
  }
  
  // 边编辑工具
  enableEdgeEdit() {
    // 启用边编辑模式
    this.currentTool = 'edge-edit';
    this.updateEditMode('边编辑');
    
    if (this.selectedFeatures.length > 0) {
      if (!this.boundaryEditor) {
        this.boundaryEditor = new window.BoundaryEditor(this.map);
      }
      this.boundaryEditor.startEditing(this.selectedFeatures[0]);
    }
  }
  
  // 裁剪工具
  enableCut() {
    // 启用裁剪模式
    this.currentTool = 'cut';
    this.updateEditMode('裁剪');
  }
  
  // 橡皮擦工具
  enableEraser() {
    // 启用橡皮擦模式
    this.currentTool = 'eraser';
    this.updateEditMode('橡皮擦');
  }
  
  // 画笔工具
  enableBrush() {
    // 启用画笔模式
    this.currentTool = 'brush';
    this.updateEditMode('画笔');
  }
  
  // 撤销操作
  undo() {
    if (this.historyIndex >= 0) {
      const action = this.history[this.historyIndex];
      action.undo();
      this.historyIndex--;
    }
  }
  
  // 重做操作
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const action = this.history[this.historyIndex];
      action.redo();
    }
  }
  
  // 保存操作
  save() {
    // 收集所有编辑后的地块数据
    const features = this.selectedFeatures.map(feature => {
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [feature.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat])]
        },
        properties: {
          name: document.getElementById('plotName').value,
          type: document.getElementById('plotType').value,
          riskLevel: document.getElementById('riskLevel').value,
          description: document.getElementById('description').value
        }
      };
    });
    
    // 发送数据到服务器
    console.log('保存地块数据:', features);
    
    // 返回成功消息
    alert('地块保存成功！');
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
    if (this.selectedFeatures.length === 0) {
      document.getElementById('selectedArea').textContent = '面积: -';
      document.getElementById('vertexCount').textContent = '顶点: -';
      return;
    }
    
    let totalArea = 0;
    let totalVertices = 0;
    
    this.selectedFeatures.forEach(feature => {
      if (feature.getBounds) {
        // 简单计算面积（实际项目中可能需要更精确的算法）
        const bounds = feature.getBounds();
        const width = bounds.getEast() - bounds.getWest();
        const height = bounds.getNorth() - bounds.getSouth();
        totalArea += width * height * 111 * 111; // 粗略计算面积（平方公里）
      }
      
      if (feature.getLatLngs) {
        totalVertices += feature.getLatLngs()[0].length;
      }
    });
    
    document.getElementById('selectedArea').textContent = `面积: ${(totalArea * 100).toFixed(2)} 公顷`;
    document.getElementById('vertexCount').textContent = `顶点: ${totalVertices}`;
  }
  
  // 更新光标位置
  updateCursorPosition(latlng) {
    document.getElementById('cursorPosition').textContent = `坐标: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
  }
  
  // 更新编辑模式
  updateEditMode(mode) {
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
  
  // 保存地块
  save() {
    if (this.selectedFeatures.length === 0) {
      alert('请先选择或创建地块');
      return;
    }
    
    // 收集所有编辑后的地块数据
    const features = this.selectedFeatures.map(feature => {
      const latLngs = feature.getLatLngs()[0];
      const coordinates = latLngs.map(latlng => [latlng.lat, latlng.lng]);
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates.map(point => [point[1], point[0]])] // 转换为lng, lat格式
        },
        properties: {
          name: document.getElementById('plotName').value || '新地块',
          type: document.getElementById('plotType').value,
          riskLevel: document.getElementById('riskLevel').value,
          description: document.getElementById('description').value,
          area: this.calculateArea(coordinates)
        }
      };
    });
    
    // 保存到数据管理器
    this.dataManager.savePlot(features[0].properties).then(() => {
      alert('地块保存成功！');
      window.location.href = '/terrain/';
    }).catch((error) => {
      alert('保存失败: ' + error);
    });
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
    
    // 更新下拉菜单active状态
    document.querySelectorAll('.dropdown-item[data-basemap]').forEach(item => {
      if (item.getAttribute('data-basemap') === basemap) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
  
  // 切换等高线叠加
  toggleContourOverlay(enabled) {
    console.log('=== 切换等高线叠加 ===');
    console.log('状态:', enabled);
    
    // 确保等高线图层只创建一次
    if (!this.contourLayer) {
      // 创建等高线图层
      this.contourLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
        opacity: 0.6
      });
    }
    
    if (enabled) {
      // 添加到地图
      if (!this.map.hasLayer(this.contourLayer)) {
        this.contourLayer.addTo(this.map);
        
        // 调整图层顺序，确保等高线在底图之上，业务图层之下
        this.map.eachLayer((layer) => {
          if (layer instanceof L.TileLayer && layer !== this.contourLayer && 
              (layer === this.baseLayers.grayscale || layer === this.baseLayers.satellite)) {
            this.map.removeLayer(layer);
            this.map.addLayer(layer);
          }
        });
        
        console.log('等高线叠加已开启');
      }
    } else {
      // 从地图中移除
      if (this.map.hasLayer(this.contourLayer)) {
        this.map.removeLayer(this.contourLayer);
        console.log('等高线叠加已关闭');
      }
    }
    
    this.isContourOverlayEnabled = enabled;
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