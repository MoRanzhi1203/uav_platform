// 地形编辑器类
class TerrainEditor {
  constructor(mapId, options = {}) {
    this.areaId = options.areaId || null; // 预先获取 areaId，防止异步加载过程中的判断失误
    
    // 初始化地图
    this.map = window.initMap(mapId, {
      center: [30.05, 107.60],
      zoom: 7,
      minZoom: 5,
      maxZoom: 18,
      zoomSnap: 0.1, // 允许更精细的缩放级别以精确匹配重庆占比
      skipDefaultLayer: true, // 跳过默认底图加载，由编辑器统一管理
    });
    
    // 默认缩放占比配置 (根据用户要求：地块/重庆市占 3/4 边宽)
    this.viewportConfig = {
      targetHeightRatio: 0.75,
      targetWidthRatio: 0.75,
      chongqingBounds: [[28.16, 105.18], [32.20, 110.19]] // 初始估算，稍后由行政区划数据修正
    };

    this.layerManager = new window.LayerManager(this.map);
    
    // 底图管理 (使用实例存储)
    this.baseLayers = window.baseLayers;
    this.currentBasemap = 'satellite';
    this.activeBaseLayer = null; // 存储当前正在使用的底图实例
    this.topographicAssistLayer = null; // 卫星底图上的等高线参考叠加层
    this.topographicAssistOpacity = 0.5;
    this.adminBoundaryStyles = {
      city: {
        outer: {
          color: 'rgba(15,23,42,0.24)',
          weight: 3.6,
          opacity: 1,
          fillColor: '#f1f5f9',
          fillOpacity: 0,
          dashArray: '',
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        },
        inner: {
          color: '#f1f5f9',
          weight: 2.2,
          opacity: 0.95,
          fillColor: '#f1f5f9',
          fillOpacity: 0.008,
          dashArray: '',
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }
      },
      district: {
        outer: {
          color: 'rgba(15,23,42,0.18)',
          weight: 2.2,
          opacity: 1,
          fillColor: '#f1f5f9',
          fillOpacity: 0,
          dashArray: '',
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        },
        inner: {
          color: '#f1f5f9',
          weight: 1.35,
          opacity: 0.9,
          fillColor: '#f1f5f9',
          fillOpacity: 0.006,
          dashArray: '',
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }
      },
      township: {
        single: {
          color: '#f1f5f9',
          weight: 0.9,
          opacity: 0.76,
          fillColor: '#f1f5f9',
          fillOpacity: 0.002,
          dashArray: '4,6',
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }
      }
    };
    this.adminBoundaryDisplayLevel = 1;
    this.adminBoundaryEnabled = true;
    this.adminBoundaryLevelConfig = {
      0: 'city',
      1: 'district',
      2: 'township'
    };
    this.adminBoundaryChunkSize = 50;
    this.adminBoundaryLoaded = {
      city: false,
      district: false,
      township: false
    };
    this.adminBoundaryLoadPromises = {};
    this.adminBoundaryFeatureCache = {
      city: [],
      district: [],
      township: []
    };
    this.adminBoundaryLoadedSourceUrls = {
      city: '',
      district: '',
      township: ''
    };
    this.adminBoundaryViewportInitialized = false;
    // 版本号优先由模板注入；缺失时仅在当前页面生命周期内生成一次，避免重复刷新。
    this.adminBoundaryDataVersion = String(window.ADMIN_BOUNDARY_DATA_VERSION || Date.now());
    this.adminBoundarySourceUrls = this.getAdminBoundarySourceUrls();
    
    // 状态管理
    this.currentTool = 'browse';
    this.eraserMode = 'block'; // 'block' 或 'brush'
    this.selectedFeatures = [];
    this.userPlots = [];
    this.activePlotId = null;
    this.multiSelectedPlotIds = new Set(); // 多选地块 ID
    this.isMultiSelectMode = false;
    this.history = [];
    this.historyIndex = -1;
    // this.areaId 已在 constructor 顶部初始化
    this.areaData = null; // 区域基础信息
    this.originalBoundaryLayer = null; // 原始边界参考图层
    this.originalBoundaryGeoJSON = null; // 原始边界参考数据，默认仅作隐藏兜底
    this.showOriginalBoundary = false;
    this.backgroundLayerKeys = []; // 管理 dataManager 注入的业务/历史背景图层
    this.subcategoryOptionsByCategory = {};
    this._disjointSplitModalBound = false;
    this._pendingDisjointSplitResolver = null;
    this._disjointSplitModalConfirmed = false;
    this._movingPlotsState = null;
    this._marqueeSelectionState = null;
    this._marqueeSelectionLayer = null;
    
    // 网格配置 (10m x 10m)
    this.gridLatStep = 0.0000898;
    this.gridLngStep = 0.0001037;
    
    // 中尺度网格步长 (1000m)
    this.gridLatStep1km = 0.00898;
    this.gridLngStep1km = 0.01037;

    this.brushSize = 1;
    this.brushShape = 'square'; // 'square' 或 'circle'
    
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
      water: '#3498db',       // 水域 - 蓝色
      road: '#9CA3AF',        // 道路 - 灰色
      bare_land: '#D97706',   // 裸地 - 橙褐
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
      mapClick: this.handleMapClick.bind(this),
      plotMove: this.handlePlotMove.bind(this),
      plotMoveEnd: this.endPlotMove.bind(this),
      marqueeStart: this.startMarqueeSelection.bind(this),
      marqueeMove: this.handleMarqueeSelection.bind(this),
      marqueeEnd: this.endMarqueeSelection.bind(this),
      
      // 统一 Pointer 事件处理
      pointerDown: this.handlePointerDown.bind(this),
      pointerMove: this.handlePointerMove.bind(this),
      pointerUp: this.handlePointerUp.bind(this),
      
      // 保持原有兼容（如果需要）
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

  normalizePlotTypeKey(type) {
    const rawType = String(type || '').trim();
    const aliasMap = {
      forest: 'forest',
      '林区': 'forest',
      farmland: 'farmland',
      '农田': 'farmland',
      building: 'building',
      '建筑': 'building',
      water: 'water',
      '水域': 'water',
      road: 'road',
      '道路': 'road',
      bare: 'bare_land',
      bare_land: 'bare_land',
      '裸地': 'bare_land',
      open: 'bare_land',
      open_land: 'bare_land',
      empty_land: 'bare_land',
      unused_land: 'bare_land',
      '空地': 'bare_land',
      '开敞地': 'bare_land'
    };
    return aliasMap[rawType] || aliasMap[rawType.toLowerCase?.()] || 'bare_land';
  }
  
  // 初始化
  init() {
    // 设置地图容器的 Pointer 事件支持
    const container = this.map.getContainer();
    container.style.touchAction = 'none';
    container.style.userSelect = 'none';
    container.style.webkitUserSelect = 'none';
    
    this.addLayerGroups();
    this.layerManager.addLayerGroup('auxiliary'); // 辅助图层，如原始边界
    
    this.initReferenceGrid();
    this.bindEvents();
    
    // 强制切换一次卫星底图，确保实例被正确管理和显示
    this.currentBasemap = null; 
    this.switchBasemap('satellite');
    
    // 监听缩放事件以更新字体大小 (行政区划边界)
    this.map.on('zoomend', () => {
      this.updateLabelScaling();
    });
    this.updateLabelScaling(); // 初始执行一次

    // 监听侧边栏切换事件，在动画完成后刷新地图尺寸，补全右侧空白，并保持中心对齐
    const sidebarBtn = document.querySelector('.toggle-sidebar-btn');
    if (sidebarBtn) {
      sidebarBtn.addEventListener('click', () => {
        // 侧边栏切换动画通常需要 300ms，延时刷新以确保获取到正确的容器尺寸
        setTimeout(() => {
          if (this.map) {
            // invalidateSize 重新计算地图容器大小
            // pan: true 选项会尝试在容器大小变化后保持地图中心点不变
            this.map.invalidateSize({ pan: true });
            
            // 如果当前没有正在编辑的具体地块，或者需要重新对齐重庆市，则调用视口更新逻辑
            // 这确保了在侧边栏切换后，底图（重庆市）依然保持在新的可视区域中心
            if (!this.activePlotId) {
              this.updateMapViewport(this.areaData ? this.areaData.boundary_json : null);
            }
            console.log('地图尺寸已刷新并重新对齐中心');
          }
        }, 350);
      });
    }

    // 如果是新建地块（没有加载 areaId），自动调整一次视口到重庆
    if (!this.areaId) {
      setTimeout(() => {
        this.updateMapViewport();
      }, 100);
    }

    this.captureHistorySnapshot();
    
    // 初始化时，根据默认底图（satellite）同步辅助图层的可用性
    this.updateAdminBoundaryAvailability(this.currentBasemap);
    this.updateTopographicAssistAvailability(this.currentBasemap);

    // 首屏渲染一次左侧图层面板：无论是否携带 area_id，至少要显示空状态/按钮状态
    this.updateSelectedPlotsList();
  }
  
  /**
   * 更新行政区划边界字体大小，随缩放级别动态调整
   */
  updateLabelScaling() {
    const zoom = this.map.getZoom();
    const largeFontSize = Math.max(11, Math.min(22, (zoom - 10) * 1.2 + 14));
    const smallFontSize = Math.max(9, Math.min(18, (zoom - 10) * 0.9 + 11));
    document.documentElement.style.setProperty('--admin-label-font-size', largeFontSize + 'px');
    document.documentElement.style.setProperty('--admin-label-font-size-small', smallFontSize + 'px');
    this.refreshAdminBoundaryLabels();
  }

  /**
   * 计算并设置地图视口，使当前区域或重庆市在画面中居中并按指定比例显示
   * @param {Object} boundaryGeoJSON 区域边界 GeoJSON
   */
  updateMapViewport(boundaryGeoJSON) {
    // 1. 获取基础参考边界
    const cqBounds = L.latLngBounds(this.viewportConfig.chongqingBounds);
    const container = this.map.getContainer();
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    if (containerWidth === 0 || containerHeight === 0) {
      setTimeout(() => this.updateMapViewport(boundaryGeoJSON), 100);
      return;
    }

    // 2. 静态计算重庆市全境的最小缩放级别 (占据 3/4 边宽)
    const cqPaddingY = (1 - this.viewportConfig.targetHeightRatio) / 2 * containerHeight;
    const cqPaddingX = (1 - this.viewportConfig.targetWidthRatio) / 2 * containerWidth;
    const cqMinZoom = this.map.getBoundsZoom(cqBounds, false, [cqPaddingX, cqPaddingY]);
    
    // 3. 应用地图限制 (立即生效，不再跳转)
    this.map.setMinZoom(cqMinZoom);
    this.map.setMaxZoom(18);
    // 锁定最大移动范围为重庆市全境 (稍微外扩一点保证边缘可见性)
    this.map.setMaxBounds(cqBounds.pad(0.2));

    // 4. 直接定位到目标视口，消除中间切换过程
    if (boundaryGeoJSON) {
      try {
        const bbox = turf.bbox(boundaryGeoJSON);
        const terrainBounds = L.latLngBounds([bbox[1], bbox[0]], [bbox[3], bbox[2]]);
        const terrainCenter = terrainBounds.getCenter();
        
        const terrainPaddingY = (1 - this.viewportConfig.targetHeightRatio) / 2 * containerHeight;
        const terrainPaddingX = (1 - this.viewportConfig.targetWidthRatio) / 2 * containerWidth;
        const terrainZoom = this.map.getBoundsZoom(terrainBounds, false, [terrainPaddingX, terrainPaddingY]);
        
        // 直接设置视口，无动画
        this.map.setView(terrainCenter, terrainZoom, { animate: false });
        console.log(`地图已直接定位至地形 "${this.areaData?.name}", 缩放级别: ${terrainZoom}`);
      } catch (e) {
        console.error('计算地形视口失败，回退到重庆全境:', e);
        this.map.setView(cqBounds.getCenter(), cqMinZoom, { animate: false });
      }
    } else {
      // 如果没有地形数据（新建模式），则显示重庆全境
      this.map.setView(cqBounds.getCenter(), cqMinZoom, { animate: false });
      console.log('地图已直接定位至重庆市全境');
    }
  }
  
  // 初始化参考网格 (10m, 1km)
  initReferenceGrid() {
    this.refGridLayer10m = L.layerGroup();
    this.refGridLayer1km = L.layerGroup();
    this.cityLayer = L.layerGroup();
    this.districtLayer = L.layerGroup();
    this.townshipLayer = L.layerGroup();
    this.adminBoundaryLayers = {
      city: this.cityLayer,
      district: this.districtLayer,
      township: this.townshipLayer
    };
    
    // 监听缩放和移动事件来重绘网格
    const redrawGrids = () => {
      if (this.map.hasLayer(this.refGridLayer10m)) this.drawReferenceGrid10m();
      if (this.map.hasLayer(this.refGridLayer1km)) this.drawReferenceGrid1km();
    };
    const refreshAdminLabels = () => {
      this.refreshAdminBoundaryLabels();
    };

    this.map.on('moveend', redrawGrids);
    this.map.on('zoomend', redrawGrids);
    this.map.on('moveend', refreshAdminLabels);
    this.map.on('zoomend', refreshAdminLabels);
    
    // 初始化行政区划边界层 (独立于参考网格管理)
    this.loadAdminBoundaries();
    this.syncAdminBoundarySliderUI();
    this.bindAdminBoundaryControlEvents();
  }
  
  getAdminBoundaryDerivedFileNames() {
    return {
      city: 'chongqing_city_from_township.geojson',
      district: 'chongqing_district_from_township.geojson',
      township: 'chongqing_township_from_source.geojson'
    };
  }

  getAdminBoundaryDerivedPath(level) {
    const fileName = this.getAdminBoundaryDerivedFileNames()[level];
    return fileName ? `/static/shp/chongqing/derived/${fileName}` : '';
  }

  isExpectedAdminBoundaryUrl(level, sourceUrl) {
    if (!sourceUrl) {
      return false;
    }

    try {
      const resolvedUrl = new URL(sourceUrl, window.location.origin);
      return resolvedUrl.pathname === this.getAdminBoundaryDerivedPath(level);
    } catch (error) {
      console.warn(`行政区划数据源 URL 解析失败，已回退为 derived 默认路径: ${sourceUrl}`, error);
      return false;
    }
  }

  appendAdminBoundaryVersion(sourceUrl, version) {
    const resolvedUrl = new URL(sourceUrl, window.location.origin);
    resolvedUrl.searchParams.set('v', version);
    return resolvedUrl.toString();
  }

  getAdminBoundarySourceUrls() {
    const apiSources = window.ADMIN_BOUNDARY_API_URLS || {};
    const origin = window.location.origin;
    const version = this.adminBoundaryDataVersion;
    const defaults = {
      city: `${origin}${this.getAdminBoundaryDerivedPath('city')}`,
      district: `${origin}${this.getAdminBoundaryDerivedPath('district')}`,
      township: `${origin}${this.getAdminBoundaryDerivedPath('township')}`
    };

    const sourceUrls = {};

    Object.entries(defaults).forEach(([level, fallbackUrl]) => {
      const candidateUrl = apiSources[level];
      const normalizedSourceUrl = this.isExpectedAdminBoundaryUrl(level, candidateUrl)
        ? candidateUrl
        : fallbackUrl;

      if (candidateUrl && normalizedSourceUrl !== candidateUrl) {
        console.warn(`[行政区划数据源] 已忽略旧路径 ${candidateUrl}，统一回退到 derived: ${fallbackUrl}`);
      }

      sourceUrls[level] = this.appendAdminBoundaryVersion(normalizedSourceUrl, version);
    });

    console.log('[行政区划数据源]', sourceUrls);
    return sourceUrls;
  }

  resetAdminBoundaryCacheForUrlChanges(nextSourceUrls) {
    Object.keys(this.adminBoundaryFeatureCache || {}).forEach(level => {
      const previousUrl = this.adminBoundaryLoadedSourceUrls[level];
      const nextUrl = nextSourceUrls[level];
      if (!previousUrl || previousUrl === nextUrl) {
        return;
      }

      this.adminBoundaryFeatureCache[level] = [];
      this.adminBoundaryLoaded[level] = false;
      this.adminBoundaryLayers?.[level]?.clearLayers();
      this.adminBoundaryLoadedSourceUrls[level] = '';
    });
  }

  // 初始化行政区划边界的异步加载
  loadAdminBoundaries() {
    const nextSourceUrls = this.getAdminBoundarySourceUrls();
    this.resetAdminBoundaryCacheForUrlChanges(nextSourceUrls);
    this.adminBoundarySourceUrls = nextSourceUrls;
    console.log('[行政区划数据源]', this.adminBoundarySourceUrls);
    const currentLevel = this.getAdminBoundaryLevelKey();
    setTimeout(() => {
      this.ensureAdminBoundaryLayerLoaded(currentLevel);
    }, 0);
  }

  async ensureAdminBoundaryLayerLoaded(level) {
    if (this.adminBoundaryLoaded[level]) {
      return this.adminBoundaryLayers?.[level];
    }

    if (this.adminBoundaryLoadPromises[level]) {
      return this.adminBoundaryLoadPromises[level];
    }

    const loadPromise = (async () => {
      try {
        const features = await this.loadAdminBoundaryLevelData(level);

        if (!features.length) {
          console.warn(`行政区划图层 ${level} 未解析到有效要素`);
          return null;
        }

        if (!this.adminBoundaryViewportInitialized) {
          this.updateViewportBoundsFromAdminFeatures(features);
          this.adminBoundaryViewportInitialized = true;
        }

        await this.renderAdminBoundaryChunks(level, features);
        this.adminBoundaryLoaded[level] = true;
        this.applyAdminBoundaryVisibility();
        this.refreshAdminBoundaryLabels(level);
        return this.adminBoundaryLayers[level];
      } catch (error) {
        console.error(`行政区划图层 ${level} 加载失败:`, error);
        return null;
      } finally {
        delete this.adminBoundaryLoadPromises[level];
      }
    })();

    this.adminBoundaryLoadPromises[level] = loadPromise;
    return loadPromise;
  }

  async fetchAdminBoundarySource(sourceUrl) {
    if (!sourceUrl) {
      throw new Error('行政区划数据源地址为空');
    }

    const response = await fetch(sourceUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`GeoJSON 请求失败: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  normalizeAdminBoundaryFeatures(sourceData, level = '') {
    const collections = Array.isArray(sourceData) ? sourceData : [sourceData];
    const features = [];

    collections.forEach(item => {
      if (!item) return;
      if (item.type === 'FeatureCollection' && Array.isArray(item.features)) {
        features.push(...item.features);
        return;
      }
      if (item.type === 'Feature') {
        features.push(item);
        return;
      }
      if (Array.isArray(item.features)) {
        features.push(...item.features);
      }
    });

    return features
      .filter(feature => feature?.geometry)
      .map(feature => {
        const properties = { ...(feature.properties || {}) };
        const normalizedLevel = String(properties.level || level || '').trim() || level;
        const normalizedCity = String(properties.city || '').trim() || '重庆市';
        const normalizedDistrict = String(properties.district || properties.county || '').trim();
        const normalizedName = this.getAdminBoundaryLabel({
          properties: {
            ...properties,
            level: normalizedLevel
          }
        }) || (
          normalizedLevel === 'city'
            ? '重庆市'
            : normalizedLevel === 'district'
              ? normalizedDistrict
              : String(properties.name || '').trim()
        );

        return {
          type: 'Feature',
          geometry: feature.geometry,
          properties: {
            ...properties,
            name: normalizedName,
            level: normalizedLevel,
            city: normalizedCity,
            district: normalizedDistrict
          }
        };
      });
  }

  async loadAdminBoundaryLevelData(level) {
    const sourceUrl = this.adminBoundarySourceUrls[level];
    const cachedSourceUrl = this.adminBoundaryLoadedSourceUrls[level];

    if (cachedSourceUrl && cachedSourceUrl !== sourceUrl) {
      this.adminBoundaryFeatureCache[level] = [];
      this.adminBoundaryLoaded[level] = false;
      this.adminBoundaryLayers?.[level]?.clearLayers();
    }

    if (this.adminBoundaryFeatureCache[level]?.length && cachedSourceUrl === sourceUrl) {
      return this.adminBoundaryFeatureCache[level];
    }

    console.log('[行政区划加载]', level, sourceUrl);
    const rawData = await this.fetchAdminBoundarySource(sourceUrl);
    const features = this.normalizeAdminBoundaryFeatures(rawData, level);
    this.adminBoundaryFeatureCache[level] = features;
    this.adminBoundaryLoadedSourceUrls[level] = sourceUrl;
    return features;
  }

  updateViewportBoundsFromAdminFeatures(features) {
    if (typeof turf === 'undefined' || !Array.isArray(features) || features.length === 0) {
      return;
    }

    try {
      const featureCollection = {
        type: 'FeatureCollection',
        features
      };
      const fullBbox = turf.bbox(featureCollection);
      this.viewportConfig.chongqingBounds = [[fullBbox[1], fullBbox[0]], [fullBbox[3], fullBbox[2]]];

      const container = this.map.getContainer();
      const cqPaddingY = (1 - this.viewportConfig.targetHeightRatio) / 2 * container.offsetHeight;
      const cqPaddingX = (1 - this.viewportConfig.targetWidthRatio) / 2 * container.offsetWidth;
      const cqBounds = L.latLngBounds(this.viewportConfig.chongqingBounds);
      const cqMinZoom = this.map.getBoundsZoom(cqBounds, false, [cqPaddingX, cqPaddingY]);

      this.map.setMinZoom(cqMinZoom);
      this.map.setMaxBounds(cqBounds.pad(0.2));

      if (!this.areaId) {
        this.updateMapViewport();
      }
    } catch (error) {
      console.warn('根据行政区划边界更新视口限制失败，继续使用默认重庆范围:', error);
    }
  }

  isDualStrokeLevel(level) {
    return level === 'city' || level === 'district';
  }

  getAdminBoundaryStyle(level, strokeRole = 'inner') {
    const levelStyles = this.adminBoundaryStyles[level] || this.adminBoundaryStyles.city;
    if (!levelStyles) {
      return {};
    }

    if (levelStyles.single) {
      return { ...levelStyles.single };
    }

    return {
      ...(levelStyles[strokeRole] || levelStyles.inner || levelStyles.outer || {})
    };
  }

  getAdminBoundaryRenderStyles(level) {
    if (this.isDualStrokeLevel(level)) {
      return [
        {
          role: 'outer',
          style: this.getAdminBoundaryStyle(level, 'outer'),
          bindTooltip: false
        },
        {
          role: 'inner',
          style: this.getAdminBoundaryStyle(level, 'inner'),
          bindTooltip: true
        }
      ];
    }

    return [
      {
        role: 'single',
        style: this.getAdminBoundaryStyle(level, 'single'),
        bindTooltip: true
      }
    ];
  }

  getAdminBoundaryLabel(feature) {
    const properties = feature?.properties || {};
    if (properties.level === 'city') {
      return '重庆市';
    }

    if (properties.level === 'district') {
      return String(properties.name || properties.district || properties.county || '').trim();
    }

    if (properties.level === 'township') {
      return String(properties.name || '').trim();
    }

    const candidateKeys = ['name', 'NAME', 'Name', 'district', 'DISTRICT', 'county', 'COUNTY', 'city', 'CITY'];
    for (const key of candidateKeys) {
      const value = properties[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  shouldShowCityAdminLabel(feature, level = feature?.properties?.level) {
    if (level !== 'city') {
      return true;
    }

    return this.getAdminBoundaryLabel(feature) !== '重庆市' || this.adminBoundaryDisplayLevel === 0;
  }

  bindAdminBoundaryTooltip(level, feature, layer) {
    if (!layer) return;

    const label = this.getAdminBoundaryLabel(feature);
    if (!label || !this.shouldRenderAdminLabel(level, layer)) {
      this.clearAdminBoundaryTooltip(layer);
      return;
    }

    const tooltipOptions = level === 'township'
      ? {
        permanent: true,
        direction: 'center',
        className: 'admin-label',
        opacity: 0.92,
        interactive: false
      }
      : {
        permanent: true,
        direction: 'center',
        className: 'admin-label-large',
        opacity: 1,
        interactive: false
      };

    const currentTooltip = typeof layer.getTooltip === 'function' ? layer.getTooltip() : null;
    const hasSameTooltip = Boolean(currentTooltip)
      && layer.adminBoundaryTooltipLabel === label
      && layer.adminBoundaryTooltipClassName === tooltipOptions.className;

    if (hasSameTooltip) {
      currentTooltip.setContent(label);
      return;
    }

    this.clearAdminBoundaryTooltip(layer);
    layer.bindTooltip(label, tooltipOptions);
    layer.adminBoundaryTooltipLabel = label;
    layer.adminBoundaryTooltipClassName = tooltipOptions.className;
  }

  clearAdminBoundaryTooltip(layer) {
    if (!layer) return;

    layer.unbindPopup();
    layer.unbindTooltip();
    layer.off('mouseover mousemove mouseout click');
    layer.adminBoundaryTooltipLabel = '';
    layer.adminBoundaryTooltipClassName = '';
  }

  markAdminBoundaryFeatureLayer(featureLayer, level, renderRole, bindTooltip) {
    if (!featureLayer) return;

    featureLayer.adminBoundaryLevel = level;
    featureLayer.adminBoundaryRenderRole = renderRole;
    featureLayer.adminBoundaryTooltipLayer = Boolean(bindTooltip);
  }

  shouldBindAdminBoundaryTooltip(layer) {
    if (!layer?.feature) {
      return false;
    }

    return layer.adminBoundaryTooltipLayer !== false;
  }

  createAdminBoundaryChunkLayer(level, features, renderRole, style, bindTooltip = false) {
    return L.geoJSON(
      { type: 'FeatureCollection', features },
      {
        renderer: this.canvasRenderer,
        style: () => ({ ...style }),
        onEachFeature: (feature, featureLayer) => {
          this.markAdminBoundaryFeatureLayer(featureLayer, level, renderRole, bindTooltip);

          if (bindTooltip) {
            this.bindAdminBoundaryTooltip(level, feature, featureLayer);
            return;
          }

          this.clearAdminBoundaryTooltip(featureLayer);
        }
      }
    );
  }

  renderAdminBoundaryChunks(level, features) {
    const targetLayerGroup = this.adminBoundaryLayers?.[level];
    if (!targetLayerGroup) {
      return Promise.resolve();
    }

    targetLayerGroup.clearLayers();

    return new Promise(resolve => {
      let index = 0;
      const chunkSize = level === 'township' ? 25 : this.adminBoundaryChunkSize;
      const renderStyles = this.getAdminBoundaryRenderStyles(level);

      const loadChunk = () => {
        const chunk = features.slice(index, index + chunkSize);
        if (chunk.length === 0) {
          this.refreshAdminBoundaryLabels(level);
          resolve();
          return;
        }

        renderStyles.forEach(({ role, style, bindTooltip }) => {
          const layer = this.createAdminBoundaryChunkLayer(level, chunk, role, style, bindTooltip);
          layer.addTo(targetLayerGroup);
        });

        index += chunkSize;
        setTimeout(loadChunk, 10);
      };

      loadChunk();
    });
  }

  shouldShowTownshipLabels() {
    if (!this.map) {
      return false;
    }

    return this.map.getZoom() >= this.getTownshipLabelMinZoom();
  }

  getTownshipLabelMinZoom() {
    if (!this.map) {
      return 0;
    }

    const minZoom = Number.isFinite(this.map.getMinZoom()) ? this.map.getMinZoom() : 0;
    const maxZoom = Number.isFinite(this.map.getMaxZoom()) ? this.map.getMaxZoom() : minZoom;
    return Math.ceil(minZoom + (maxZoom - minZoom) * 0.5);
  }

  isFeatureInViewport(layer) {
    if (!this.map || !layer) {
      return false;
    }

    const viewportBounds = this.map.getBounds();
    if (!viewportBounds) {
      return false;
    }

    try {
      if (typeof layer.getBounds === 'function') {
        const layerBounds = layer.getBounds();
        return Boolean(layerBounds?.isValid?.() && viewportBounds.intersects(layerBounds));
      }

      if (typeof layer.getLatLng === 'function') {
        const latLng = layer.getLatLng();
        return Boolean(latLng && viewportBounds.contains(latLng));
      }
    } catch (error) {
      console.warn('行政区划标签视窗判断失败，已跳过当前要素:', error);
    }

    return false;
  }

  shouldRenderAdminLabel(level, layer) {
    if (!this.shouldBindAdminBoundaryTooltip(layer)) {
      return false;
    }

    if (!this.isFeatureInViewport(layer)) {
      return false;
    }

    if (!this.shouldShowCityAdminLabel(layer?.feature, level)) {
      return false;
    }

    if (level === 'township') {
      return this.shouldShowTownshipLabels();
    }

    return true;
  }

  refreshAdminBoundaryLabels(targetLevel = null) {
    const levels = targetLevel ? [targetLevel] : Object.keys(this.adminBoundaryLayers || {});

    levels.forEach(level => {
      const layerGroup = this.adminBoundaryLayers?.[level];
      if (!layerGroup) return;

      layerGroup.eachLayer(item => {
        if (typeof item.eachLayer === 'function') {
          item.eachLayer(featureLayer => {
            if (this.shouldBindAdminBoundaryTooltip(featureLayer)) {
              this.bindAdminBoundaryTooltip(level, featureLayer.feature, featureLayer);
            } else {
              this.clearAdminBoundaryTooltip(featureLayer);
            }
          });
          return;
        }

        if (this.shouldBindAdminBoundaryTooltip(item)) {
          this.bindAdminBoundaryTooltip(level, item.feature, item);
        } else {
          this.clearAdminBoundaryTooltip(item);
        }
      });
    });
  }

  // 已废弃：行政区划融合改由 Python 后端预处理，不再在前端运行时执行。
  async prepareAdminBoundaryDerivedData() {
    console.warn('prepareAdminBoundaryDerivedData 已废弃：行政区划派生改由后端预处理完成。');
    return [];
  }

  // 已废弃：市级边界改由 Python 后端预处理生成 GeoJSON。
  async buildCityBoundaryFromTownship() {
    console.warn('buildCityBoundaryFromTownship 已废弃：请使用后端预生成的 city GeoJSON。');
    return [];
  }

  // 已废弃：区/县边界改由 Python 后端预处理生成 GeoJSON。
  async buildDistrictBoundariesFromTownship() {
    console.warn('buildDistrictBoundariesFromTownship 已废弃：请使用后端预生成的 district GeoJSON。');
    return [];
  }

  // 已废弃：行政区划融合改由 Python 后端预处理，不再在浏览器内执行。
  mergeAdminBoundaryFeatures() {
    console.warn('mergeAdminBoundaryFeatures 已废弃：前端不再执行行政区划 turf.union()。');
    return null;
  }

  // 兼容旧调用：当前边界颜色已固定，不再提供前端调色入口
  updateAdminBoundaryColor(color) {
    return color;
  }

  setAdminBoundaryStyle(level, stylePatch = {}) {
    if (!this.adminBoundaryStyles[level]) return;

    const currentStyles = this.adminBoundaryStyles[level];
    if (this.isDualStrokeLevel(level)) {
      this.adminBoundaryStyles[level] = {
        ...currentStyles,
        outer: {
          ...currentStyles.outer,
          ...(stylePatch.outer || {})
        },
        inner: {
          ...currentStyles.inner,
          ...(stylePatch.inner || (!stylePatch.outer ? stylePatch : {}))
        }
      };
    } else {
      this.adminBoundaryStyles[level] = {
        ...currentStyles,
        single: {
          ...currentStyles.single,
          ...(stylePatch.single || stylePatch)
        }
      };
    }

    const targetLayerGroup = this.adminBoundaryLayers?.[level];
    if (!targetLayerGroup) return;

    targetLayerGroup.eachLayer(layer => {
      if (typeof layer.eachLayer === 'function') {
        layer.eachLayer(featureLayer => {
          if (typeof featureLayer.setStyle === 'function') {
            const renderRole = featureLayer.adminBoundaryRenderRole || (this.isDualStrokeLevel(level) ? 'inner' : 'single');
            featureLayer.setStyle(this.getAdminBoundaryStyle(level, renderRole));
          }
        });
        return;
      }

      if (typeof layer.setStyle === 'function') {
        const renderRole = layer.adminBoundaryRenderRole || (this.isDualStrokeLevel(level) ? 'inner' : 'single');
        layer.setStyle(this.getAdminBoundaryStyle(level, renderRole));
      }
    });
  }

  getAdminBoundaryLevelKey(level = this.adminBoundaryDisplayLevel) {
    return this.adminBoundaryLevelConfig[level] || this.adminBoundaryLevelConfig[1];
  }

  // 根据滑块值返回当前应逐级叠加显示的行政区划层级
  getVisibleAdminBoundaryLevels(level = this.adminBoundaryDisplayLevel) {
    const numericLevel = Number(level);
    const normalizedLevel = Object.prototype.hasOwnProperty.call(this.adminBoundaryLevelConfig, numericLevel)
      ? numericLevel
      : 1;

    return Object.keys(this.adminBoundaryLevelConfig)
      .map(Number)
      .sort((a, b) => a - b)
      .filter(configLevel => configLevel <= normalizedLevel)
      .map(configLevel => this.adminBoundaryLevelConfig[configLevel]);
  }

  isAdminBoundaryAvailable(basemap = this.currentBasemap) {
    return basemap === 'satellite';
  }

  removeAdminBoundaryLayers() {
    Object.values(this.adminBoundaryLayers || {}).forEach(layerGroup => {
      if (layerGroup && this.map?.hasLayer(layerGroup)) {
        this.map.removeLayer(layerGroup);
      }
    });
  }

  syncAdminBoundaryTickState(level = this.adminBoundaryDisplayLevel) {
    const ticks = document.querySelectorAll('#adminBoundaryTicks .admin-boundary-tick');
    const numericLevel = Object.prototype.hasOwnProperty.call(this.adminBoundaryLevelConfig, Number(level))
      ? Number(level)
      : this.adminBoundaryDisplayLevel;

    ticks.forEach(tick => {
      const tickLevel = Number(tick.dataset.level);
      const isActive = tickLevel === numericLevel;
      tick.classList.toggle('active', isActive);
      tick.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  }

  syncAdminBoundarySliderUI() {
    const toggle = document.getElementById('adminBoundaryToggle');
    const slider = document.getElementById('adminBoundarySlider');
    const label = document.getElementById('adminBoundaryLevelLabel');
    const labelMap = {
      0: '市级边界',
      1: '区/县边界',
      2: '乡镇/街道边界'
    };
    const isSatellite = this.isAdminBoundaryAvailable();
    const isEnabled = this.adminBoundaryEnabled === true;

    if (toggle) {
      toggle.checked = isEnabled;
    }

    if (slider) {
      slider.value = String(this.adminBoundaryDisplayLevel);
      slider.disabled = !isSatellite || !isEnabled;
      slider.style.cursor = slider.disabled ? 'not-allowed' : 'pointer';
      slider.setAttribute('aria-valuetext', labelMap[this.adminBoundaryDisplayLevel] || labelMap[1]);
    }

    if (label) {
      label.textContent = labelMap[this.adminBoundaryDisplayLevel] || labelMap[1];
    }

    this.syncAdminBoundaryTickState();
  }

  bindAdminBoundaryControlEvents() {
    const toggle = document.getElementById('adminBoundaryToggle');
    const slider = document.getElementById('adminBoundarySlider');

    if (toggle && !toggle.dataset.bound) {
      toggle.addEventListener('change', () => {
        this.toggleAdminBoundaries(toggle.checked);
      });
      toggle.dataset.bound = 'true';
    }

    if (slider && !slider.dataset.bound) {
      const handleLevelChange = () => {
        this.setAdminBoundaryDisplayLevel(Number(slider.value));
      };

      slider.addEventListener('input', handleLevelChange);
      slider.addEventListener('change', handleLevelChange);
      slider.dataset.bound = 'true';
    }

    this.bindAdminBoundaryTickEvents();
  }

  handleAdminBoundaryTickSelect(level) {
    const slider = document.getElementById('adminBoundarySlider');
    const numericLevel = Number(level);

    if (!slider || slider.disabled) {
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(this.adminBoundaryLevelConfig, numericLevel)) {
      return;
    }

    slider.value = String(numericLevel);
    this.setAdminBoundaryDisplayLevel(numericLevel);
  }

  bindAdminBoundaryTickEvents() {
    const ticks = document.querySelectorAll('#adminBoundaryTicks .admin-boundary-tick');

    ticks.forEach(tick => {
      if (tick.dataset.bound === 'true') {
        return;
      }

      const handleSelect = () => {
        this.handleAdminBoundaryTickSelect(tick.dataset.level);
      };

      tick.addEventListener('click', () => {
        handleSelect();
      });

      tick.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }

        event.preventDefault();
        handleSelect();
      });

      tick.dataset.bound = 'true';
    });
  }

  setAdminBoundaryDisplayLevel(level) {
    const numericLevel = Number(level);
    if (!Object.prototype.hasOwnProperty.call(this.adminBoundaryLevelConfig, numericLevel)) {
      return;
    }

    this.adminBoundaryDisplayLevel = numericLevel;
    this.syncAdminBoundarySliderUI();
    if (this.adminBoundaryEnabled && this.isAdminBoundaryAvailable()) {
      this.getVisibleAdminBoundaryLevels(numericLevel).forEach(visibleLevel => {
        this.ensureAdminBoundaryLayerLoaded(visibleLevel);
      });
    }
    this.applyAdminBoundaryVisibility();
  }

  applyAdminBoundaryVisibility() {
    const canDisplay = this.currentBasemap === 'satellite' && this.adminBoundaryEnabled === true;
    if (!canDisplay) {
      this.removeAdminBoundaryLayers();
      return;
    }

    const visibleLevels = this.adminBoundaryEnabled
      ? this.getVisibleAdminBoundaryLevels()
      : [];
    const visibleLevelSet = new Set(visibleLevels);

    Object.entries(this.adminBoundaryLayers || {}).forEach(([level, layerGroup]) => {
      const shouldShow = visibleLevelSet.has(level);

      if (shouldShow && !this.adminBoundaryLoaded[level]) {
        this.ensureAdminBoundaryLayerLoaded(level);
      }

      if (shouldShow && this.adminBoundaryLoaded[level]) {
        if (!this.map.hasLayer(layerGroup)) {
          layerGroup.addTo(this.map);
        }
        this.refreshAdminBoundaryLabels(level);
        return;
      }

      if (this.map.hasLayer(layerGroup)) {
        this.map.removeLayer(layerGroup);
      }
    });
  }

  toggleAdminBoundaryLevel(level, visible) {
    const targetLayer = this.adminBoundaryLayers?.[level];
    if (!targetLayer) {
      return;
    }

    if (!visible) {
      if (this.map.hasLayer(targetLayer)) {
        this.map.removeLayer(targetLayer);
      }
      return;
    }

    this.ensureAdminBoundaryLayerLoaded(level).then(() => {
      if (this.adminBoundaryEnabled) {
        targetLayer.addTo(this.map);
      }
    });
  }

  // 兼容旧调用：统一切换三级行政区划图层
  toggleAdminBoundaries(visible) {
    this.adminBoundaryEnabled = Boolean(visible);
    this.syncAdminBoundarySliderUI();
    this.applyAdminBoundaryVisibility();
  }

  // 切换卫星底图上的等高线参考叠加层
  toggleTopographicAssist(visible) {
    if (!this.topographicAssistLayer && typeof window.getOverlayLayer === 'function') {
      this.topographicAssistLayer = window.getOverlayLayer('contours');
    }

    if (!this.topographicAssistLayer) return;

    if (this.topographicAssistLayer.setOpacity) {
      this.topographicAssistLayer.setOpacity(this.topographicAssistOpacity);
    }

    const shouldDisplay = visible && this.currentBasemap === 'satellite';
    if (shouldDisplay) {
      if (!this.map.hasLayer(this.topographicAssistLayer)) {
        this.topographicAssistLayer.addTo(this.map);
      }
    } else if (this.map.hasLayer(this.topographicAssistLayer)) {
      this.map.removeLayer(this.topographicAssistLayer);
    }
  }

  // 更新等高线参考叠加层透明度
  setTopographicAssistOpacity(opacity) {
    const parsedOpacity = Number(opacity);
    const normalizedOpacity = Number.isFinite(parsedOpacity)
      ? Math.max(0, Math.min(1, parsedOpacity))
      : 0;

    this.topographicAssistOpacity = normalizedOpacity;
    if (this.topographicAssistLayer?.setOpacity) {
      this.topographicAssistLayer.setOpacity(normalizedOpacity);
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
  
  // 显示图形信息
  showFeatureInfo(feature) {
    console.log('图形信息:', feature.properties);
    // 这里可以实现显示图形属性的逻辑
    // 例如更新右侧属性面板
  }
  
  // 添加图层组
  addLayerGroups() {
    // 优化目的: 统一补齐业务/工作/辅助图层，避免编辑态访问 this.layers.business 或 layerGroups.business 报错。
    const requiredGroups = ['base', 'business', 'working', 'auxiliary'];
    this.layers = this.layers || {};

    requiredGroups.forEach((groupName) => {
      if (!this.layers[groupName] || typeof this.layers[groupName] !== 'object') {
        this.layers[groupName] = {};
      }

      if (!this.layerManager.layerGroups || !this.layerManager.layerGroups[groupName]) {
        this.layerManager.addLayerGroup(groupName);
      }
    });

    if (!this.layers.temp || typeof this.layers.temp !== 'object') {
      this.layers.temp = {};
    }
  }

  clearOriginalBoundaryLayer() {
    const auxiliaryGroup = this.layerManager?.layerGroups?.auxiliary;
    if (this.originalBoundaryLayer && auxiliaryGroup?.hasLayer?.(this.originalBoundaryLayer)) {
      auxiliaryGroup.removeLayer(this.originalBoundaryLayer);
    } else if (this.originalBoundaryLayer && this.map?.hasLayer?.(this.originalBoundaryLayer)) {
      this.map.removeLayer(this.originalBoundaryLayer);
    }

    this.originalBoundaryLayer = null;
  }

  setOriginalBoundaryReference(geojson) {
    this.originalBoundaryGeoJSON = geojson || null;
    this.clearOriginalBoundaryLayer();
  }

  clearManagedBackgroundLayers() {
    const managedGroups = ['base', 'business'];
    managedGroups.forEach((groupName) => {
      const group = this.layerManager?.layerGroups?.[groupName];
      if (group?.clearLayers) {
        group.clearLayers();
      }

      if (this.layers?.[groupName] && typeof this.layers[groupName] === 'object') {
        Object.keys(this.layers[groupName]).forEach((key) => {
          delete this.layers[groupName][key];
        });
      }
    });

    this.backgroundLayerKeys.forEach((key) => {
      if (this.layerManager?.layers?.[key]) {
        delete this.layerManager.layers[key];
      }
    });
    this.backgroundLayerKeys = [];
  }

  getCurrentEditAreaId() {
    return this.areaId || this.areaData?.id || document.getElementById('terrainId')?.value || null;
  }

  matchesCurrentArea(item, currentAreaId) {
    if (!currentAreaId || !item || typeof item !== 'object') {
      return false;
    }

    const candidateIds = this.getZoneCandidateAreaIds(item);

    if (!candidateIds.length) {
      return false;
    }

    return candidateIds.some((value) => String(value) === String(currentAreaId));
  }

  getZoneCandidateAreaIds(item) {
    if (!item || typeof item !== 'object') {
      return [];
    }

    return [
      item.area_id,
      item.areaId,
      item.area_obj_id,
      item.areaObjId,
      item.terrain_id,
      item.terrainId,
      item.area?.id,
      item.area?.area_id,
      item.area_obj?.id
    ].filter((value) => value !== undefined && value !== null && value !== '');
  }

  parseZonePayloadObject(value) {
    let current = value;
    for (let i = 0; i < 2 && typeof current === 'string'; i += 1) {
      try {
        current = JSON.parse(current);
      } catch (_) {
        return {};
      }
    }
    return current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  }

  zoneHasRenderableGeometry(zoneData) {
    const geomSource = zoneData?.geom_json || zoneData?.geometry || zoneData?.geojson || null;
    const parsed = this.parseZonePayloadObject(geomSource);

    const hasCoordinatePairs = (value) => {
      if (Array.isArray(value)) {
        if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
          return true;
        }
        return value.some((item) => hasCoordinatePairs(item));
      }
      return false;
    };

    const geometry = parsed?.type === 'Feature' ? (parsed.geometry || {}) : parsed;
    if (!geometry || typeof geometry !== 'object') {
      return false;
    }

    if (parsed?.type === 'FeatureCollection') {
      return Array.isArray(parsed.features) && parsed.features.some((feature) => {
        const featureGeometry = this.parseZonePayloadObject(feature)?.geometry || {};
        return hasCoordinatePairs(featureGeometry.coordinates);
      });
    }

    if (geometry.type === 'GeometryCollection') {
      return Array.isArray(geometry.geometries) && geometry.geometries.some((item) => hasCoordinatePairs(item?.coordinates));
    }

    return hasCoordinatePairs(geometry.coordinates);
  }

  buildZoneRenderDedupeKey(zoneData) {
    const geomSource = zoneData?.geom_json || zoneData?.geometry || zoneData?.geojson || null;
    const parsedGeometry = this.parseZonePayloadObject(geomSource);
    const geometry = parsedGeometry?.type === 'Feature' ? (parsedGeometry.geometry || {}) : parsedGeometry;
    const areaIds = this.getZoneCandidateAreaIds(zoneData);

    return JSON.stringify({
      areaId: areaIds[0] ?? null,
      category: this.normalizePlotTypeKey(zoneData?.category || zoneData?.type || ''),
      subType: zoneData?.subcategory || zoneData?.sub_type || zoneData?.type || '',
      geometry: geometry || {}
    });
  }

  getZoneRenderValidation(zoneData, options = {}) {
    const areaId = options.areaId ?? this.getCurrentEditAreaId();
    const meta = this.parseZonePayloadObject(zoneData?.meta_json || zoneData?.meta || {});
    const style = this.parseZonePayloadObject(zoneData?.style_json || zoneData?.style || {});
    const candidateAreaIds = this.getZoneCandidateAreaIds(zoneData);
    const inactiveStatuses = new Set(['deleted', 'inactive', 'archived', 'history', 'historical', 'invalid', 'discarded', 'disabled', 'hidden', 'draft']);

    if (!zoneData || typeof zoneData !== 'object') {
      return { ok: false, reason: 'invalid_payload' };
    }

    if (zoneData.is_deleted === true) {
      return { ok: false, reason: 'is_deleted' };
    }

    if (areaId && candidateAreaIds.length > 0 && !this.matchesCurrentArea(zoneData, areaId)) {
      return { ok: false, reason: 'area_mismatch' };
    }

    if (!this.zoneHasRenderableGeometry(zoneData)) {
      return { ok: false, reason: 'missing_geometry' };
    }

    for (const key of ['hidden', 'is_hidden', 'archived', 'is_archived', 'history', 'is_history', 'historical', 'is_historical', 'invalid', 'is_invalid', 'disabled', 'is_disabled', 'draft', 'is_draft']) {
      if (meta[key] === true || style[key] === true) {
        return { ok: false, reason: `flag:${key}` };
      }
    }

    if (style.visible === false) {
      return { ok: false, reason: 'style_hidden' };
    }

    for (const key of ['active', 'is_active', 'current', 'is_current', 'latest', 'is_latest', 'enabled', 'is_enabled']) {
      if ((key in meta && meta[key] === false) || (key in style && style[key] === false)) {
        return { ok: false, reason: `flag:${key}=false` };
      }
    }

    for (const key of ['status', 'zone_status', 'record_status', 'state']) {
      const metaStatus = meta[key];
      const styleStatus = style[key];
      if (metaStatus !== undefined && inactiveStatuses.has(String(metaStatus).trim().toLowerCase())) {
        return { ok: false, reason: `status:${String(metaStatus).trim().toLowerCase()}` };
      }
      if (styleStatus !== undefined && inactiveStatuses.has(String(styleStatus).trim().toLowerCase())) {
        return { ok: false, reason: `status:${String(styleStatus).trim().toLowerCase()}` };
      }
    }

    return {
      ok: true,
      reason: null,
      dedupeKey: this.buildZoneRenderDedupeKey(zoneData)
    };
  }

  filterRenderableZones(zones, options = {}) {
    if (!Array.isArray(zones)) {
      return [];
    }

    const filteredZones = [];
    const skippedZones = [];
    const seenKeys = new Set();
    const areaId = options.areaId ?? this.getCurrentEditAreaId();

    zones.forEach((zoneData) => {
      const validation = this.getZoneRenderValidation(zoneData, { areaId });
      if (!validation.ok) {
        skippedZones.push({
          id: zoneData?.id ?? null,
          name: zoneData?.name || '',
          reason: validation.reason
        });
        return;
      }

      if (validation.dedupeKey && seenKeys.has(validation.dedupeKey)) {
        skippedZones.push({
          id: zoneData?.id ?? null,
          name: zoneData?.name || '',
          reason: 'duplicate_geometry'
        });
        return;
      }

      if (validation.dedupeKey) {
        seenKeys.add(validation.dedupeKey);
      }
      filteredZones.push(zoneData);
    });

    if (skippedZones.length > 0) {
      console.warn('编辑页 zones 前端兜底过滤已剔除无效地块:', skippedZones);
    }

    return filteredZones;
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
        this.handleSelectToolClick(e);
        break;
      case 'smart-select':
        this.smartSelect(e.latlng);
        break;
      case 'multiselect':
        this.multiSelect(e.latlng);
        break;
    }
  }

  // 选择工具点击处理
  handleSelectToolClick(e) {
    if (typeof turf === 'undefined') return;
    const point = turf.point([e.latlng.lng, e.latlng.lat]);

    // 优先从用户绘制的地块中查找
    for (let i = this.userPlots.length - 1; i >= 0; i--) {
      const plot = this.userPlots[i];
      if (!plot || plot.visible === false || !plot.geojson) continue;

      try {
        if (turf.booleanPointInPolygon(point, plot.geojson)) {
          this.selectPlot(plot.id);
          return;
        }
      } catch (_) {
        continue;
      }
    }

    // 如果没点中地块，可以考虑清除选中（可选）
    // this.selectPlot(null);
  }

  // 兼容旧入口：选择工具改为移动工具
  enableSelect() {
    this.enableMoveLayer();
  }

  enableBrowseMode() {
    this.clearToolEvents();
    this.currentTool = 'browse';
    this.updateEditMode('鼠标');
    this.map.getContainer().style.cursor = 'grab';
    this.map.dragging.enable();
    this.map.scrollWheelZoom.enable();
    this.map.doubleClickZoom.enable();
    this.refreshPlotInteractivity();
  }

  enableMoveLayer() {
    this.clearToolEvents();
    this.currentTool = 'move-layer';
    this.updateEditMode('移动');
    this.map.getContainer().style.cursor = 'grab';
    this.map.dragging.enable();
    this.refreshPlotInteractivity();
    
    // 使用 Pointer Events
    const container = this.map.getContainer();
    container.addEventListener('pointermove', this._handlers.pointerMove);
    container.addEventListener('pointerup', this._handlers.pointerUp);
    container.addEventListener('pointercancel', this._handlers.pointerUp);
    
    // 兼容旧逻辑
    this.map.on('mousemove', this._handlers.plotMove);
    this.map.on('mouseup', this._handlers.plotMoveEnd);
  }

  bindPlotSelectionEvents(plot) {
    if (!plot?.layer) return;

    plot.layer.off('click');
    plot.layer.off('mousedown');
    plot.layer.on('click', (e) => {
      if (this.currentTool !== 'move-layer') return;
      if (e) {
        L.DomEvent.stopPropagation(e);
      }
      this.selectPlot(plot.id);
    });
    plot.layer.on('mousedown', (e) => {
      if (this.currentTool !== 'move-layer') return;
      if (e) {
        L.DomEvent.stopPropagation(e);
      }
      this.startPlotMove(plot.id, e?.latlng);
    });
  }

  refreshPlotInteractivity() {
    const interactive = this.currentTool === 'move-layer';

    this.userPlots.forEach(plot => {
      if (!plot?.layer?.eachLayer) return;

      plot.layer.eachLayer(layer => {
        layer.options.interactive = interactive && !plot.locked;
      });
    });
  }

  getMoveTargetPlotIds(plotId) {
    if (this.multiSelectedPlotIds.has(plotId) && this.multiSelectedPlotIds.size > 1) {
      return Array.from(this.multiSelectedPlotIds);
    }

    return [plotId];
  }

  startPlotMove(plotId, latlng) {
    if (this.currentTool !== 'move-layer' || !latlng) return;

    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot || plot.locked) return;

    const targetPlotIds = this.getMoveTargetPlotIds(plotId)
      .filter(id => {
        const item = this.userPlots.find(p => p.id === id);
        return item && !item.locked;
      });

    if (targetPlotIds.length === 0) return;

    if (!this.multiSelectedPlotIds.has(plotId)) {
      this.multiSelectedPlotIds.clear();
      this.multiSelectedPlotIds.add(plotId);
    }

    this.selectPlot(plotId);
    this.updateSelectedPlotsList();

    this._movingPlotsState = {
      plotIds: targetPlotIds,
      startLatLng: latlng,
      basePlots: new Map(targetPlotIds.map(id => {
        const item = this.userPlots.find(p => p.id === id);
        return [id, {
          geojson: item?.geojson ? JSON.parse(JSON.stringify(item.geojson)) : null,
          gridData: item?.gridData ? JSON.parse(JSON.stringify(item.gridData)) : null
        }];
      })),
      appliedLatSteps: 0,
      appliedLngSteps: 0,
      hasMoved: false
    };

    this.map.dragging.disable();
    this.map.getContainer().style.cursor = 'grabbing';
  }

  handlePlotMove(e) {
    if (this.currentTool !== 'move-layer' || !this._movingPlotsState?.startLatLng || !e?.latlng) {
      return;
    }

    const rawDeltaLat = e.latlng.lat - this._movingPlotsState.startLatLng.lat;
    const rawDeltaLng = e.latlng.lng - this._movingPlotsState.startLatLng.lng;
    const latSteps = Math.trunc(rawDeltaLat / this.gridLatStep);
    const lngSteps = Math.trunc(rawDeltaLng / this.gridLngStep);

    if (
      latSteps === this._movingPlotsState.appliedLatSteps &&
      lngSteps === this._movingPlotsState.appliedLngSteps
    ) {
      return;
    }

    const snappedDeltaLat = latSteps * this.gridLatStep;
    const snappedDeltaLng = lngSteps * this.gridLngStep;

    this._movingPlotsState.plotIds.forEach(plotId => {
      const plot = this.userPlots.find(p => p.id === plotId);
      if (!plot?.geojson) return;
      const basePlot = this._movingPlotsState.basePlots.get(plotId);
      if (!basePlot?.geojson) return;
      plot.geojson = this.translatePlotGeoJSON(basePlot.geojson, snappedDeltaLat, snappedDeltaLng);
      plot.gridData = this.translateGridData(basePlot.gridData, lngSteps, latSteps);
      this.rebuildPlotLayer(plot);
    });

    this._movingPlotsState.appliedLatSteps = latSteps;
    this._movingPlotsState.appliedLngSteps = lngSteps;
    this._movingPlotsState.hasMoved = true;
    this.applyPlotOrder();

    const activePlot = this.userPlots.find(p => p.id === this.activePlotId);
    if (activePlot) {
      this.updateAttributePanel(activePlot);
    }
  }

  endPlotMove() {
    if (!this._movingPlotsState) return;

    const hasMoved = this._movingPlotsState.hasMoved;
    this._movingPlotsState = null;

    this.map.dragging.enable();
    this.map.getContainer().style.cursor = 'grab';

    if (hasMoved) {
      this.captureHistorySnapshot();
      this.updateSelectedArea();
      this.updateSelectedPlotsList();
    }
  }

  translatePlotGeoJSON(geojson, deltaLat, deltaLng) {
    if (!geojson) return geojson;

    const translated = JSON.parse(JSON.stringify(geojson));
    const geometry = translated.geometry || translated;

    const shiftCoordinates = (coords) => {
      if (!Array.isArray(coords)) return coords;
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        return [coords[0] + deltaLng, coords[1] + deltaLat];
      }
      return coords.map(shiftCoordinates);
    };

    geometry.coordinates = shiftCoordinates(geometry.coordinates);
    return translated;
  }

  translateGridData(gridData, deltaX, deltaY) {
    if (!gridData) return gridData;

    const translated = JSON.parse(JSON.stringify(gridData));
    if (Array.isArray(translated.cells)) {
      translated.cells = translated.cells.map(cell => ({
        ...cell,
        x: Number(cell.x) + deltaX,
        y: Number(cell.y) + deltaY
      }));
    }

    return translated;
  }

  rebuildPlotLayer(plot) {
    if (!plot) return;

    this.syncPlotArea(plot);

    if (plot.layer) {
      this.layerManager.layerGroups.working.removeLayer(plot.layer);
    }

    const layerOptions = {
      style: this.getPlotStyle(plot.properties, plot.id === this.activePlotId, this.multiSelectedPlotIds.has(plot.id)),
      interactive: this.currentTool === 'move-layer' && !plot.locked
    };
    if (!plot.db_id) {
      layerOptions.renderer = this.canvasRenderer;
    }

    plot.layer = L.geoJSON(plot.geojson, layerOptions);
    if (plot.visible) {
      this.layerManager.layerGroups.working.addLayer(plot.layer);
    }
    this.bindPlotSelectionEvents(plot);
  }

  enableMarqueeSelect() {
    this.clearToolEvents();
    this.currentTool = 'marquee-select';
    this.isMultiSelectMode = true;
    this.updateEditMode('框选');
    this.map.getContainer().style.cursor = 'crosshair';
    this.map.dragging.disable();
    this.refreshPlotInteractivity();
    
    // 使用 Pointer Events
    const container = this.map.getContainer();
    container.addEventListener('pointerdown', this._handlers.pointerDown);
    container.addEventListener('pointermove', this._handlers.pointerMove);
    container.addEventListener('pointerup', this._handlers.pointerUp);
    container.addEventListener('pointercancel', this._handlers.pointerUp);
  }

  startMarqueeSelection(e) {
    if (this.currentTool !== 'marquee-select' || !e?.latlng) return;

    this._marqueeSelectionState = {
      startLatLng: e.latlng,
      lastLatLng: e.latlng
    };

    if (this._marqueeSelectionLayer) {
      this.map.removeLayer(this._marqueeSelectionLayer);
    }

    this._marqueeSelectionLayer = L.rectangle([e.latlng, e.latlng], {
      color: '#0d6efd',
      weight: 1,
      dashArray: '6, 4',
      fillColor: '#0d6efd',
      fillOpacity: 0.12,
      interactive: false
    }).addTo(this.map);
  }

  handleMarqueeSelection(e) {
    if (this.currentTool !== 'marquee-select' || !this._marqueeSelectionState || !e?.latlng) return;

    this._marqueeSelectionState.lastLatLng = e.latlng;
    if (this._marqueeSelectionLayer) {
      this._marqueeSelectionLayer.setBounds(L.latLngBounds(
        this._marqueeSelectionState.startLatLng,
        this._marqueeSelectionState.lastLatLng
      ));
    }
  }

  endMarqueeSelection() {
    if (this.currentTool !== 'marquee-select' || !this._marqueeSelectionState) return;

    const selectionBounds = this._marqueeSelectionLayer?.getBounds();
    this.isMultiSelectMode = true;
    this.multiSelectedPlotIds.clear();

    const matchedPlots = this.userPlots.filter(plot => {
      if (!plot || plot.visible === false) return false;
      const plotBounds = this.getPlotBounds(plot);
      return plotBounds && selectionBounds && plotBounds.intersects(selectionBounds);
    });

    matchedPlots.forEach(plot => this.multiSelectedPlotIds.add(plot.id));

    if (this._marqueeSelectionLayer) {
      this.map.removeLayer(this._marqueeSelectionLayer);
      this._marqueeSelectionLayer = null;
    }

    this._marqueeSelectionState = null;
    this.updateSelectedPlotsList();

    if (matchedPlots[0]) {
      this.selectPlot(matchedPlots[0].id);
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
      this.alertAction('未识别到地块，请点击已有业务区域');
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
  
  // 切换批量选择模式
  toggleMultiSelectMode() {
    this.isMultiSelectMode = !this.isMultiSelectMode;
    
    // 如果进入批量模式且当前没有选中的地块，可以考虑默认不选，或者维持现状
    // 如果退出批量模式，则清空所有勾选
    if (!this.isMultiSelectMode) {
      this.multiSelectedPlotIds.clear();
    } else {
      // 构思优化：如果当前是全选状态，则点击变为全不选；如果不是全选，则变为全选
      const allPlotIds = this.userPlots.map(p => p.id);
      const isAllSelected = allPlotIds.length > 0 && allPlotIds.every(id => this.multiSelectedPlotIds.has(id));
      
      if (isAllSelected) {
        this.multiSelectedPlotIds.clear();
        // 此时如果不想要批量模式了，可以顺便退出
        this.isMultiSelectMode = false;
      } else {
        allPlotIds.forEach(id => this.multiSelectedPlotIds.add(id));
      }
    }
    
    this.updateLayerPanelButtons();
    this.updateSelectedPlotsList();
  }

  // 更新已选地块列表
  updateSelectedPlotsList() {
    const selectedAreasContainer = document.getElementById('selectedAreas');
    if (!selectedAreasContainer) return;
    selectedAreasContainer.innerHTML = '';
    selectedAreasContainer.classList.toggle('is-empty', this.userPlots.length === 0);
    this.updateCurrentPlotTitle();
    this.refreshPlotStyles();
    
    // 如果存在多选按钮，动态控制其高亮状态
    const toggleMultiSelectBtn = document.getElementById('toggleMultiSelectBtn');
    if (toggleMultiSelectBtn) {
      if (this.isMultiSelectMode) {
        toggleMultiSelectBtn.classList.add('btn-primary');
        toggleMultiSelectBtn.classList.remove('btn-outline-secondary');
      } else {
        toggleMultiSelectBtn.classList.remove('btn-primary');
        toggleMultiSelectBtn.classList.add('btn-outline-secondary');
      }
    }

    if (this.userPlots.length === 0) {
      selectedAreasContainer.innerHTML = `
        <div class="layer-empty-state">
          <div class="layer-empty-icon">
            <i class="bi bi-layers"></i>
          </div>
          <div class="layer-empty-title">当前还没有地块图层</div>
          <div class="layer-empty-text">点击下方“新建地块图层”后，即可开始绘制和管理地块。</div>
        </div>
      `;
      this.updateLayerPanelButtons();
      return;
    }
    
    this.userPlots.forEach((plot, index) => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      if (plot.id === this.activePlotId) {
        item.classList.add('active');
      }
      if (this.multiSelectedPlotIds.has(plot.id)) {
        item.classList.add('multi-selected');
      }
      
      const name = this.getPlotDisplayName(plot, `地块 ${index + 1}`);
      const typeLabel = this.getPlotTypeLabel(plot.properties?.type);
      const subtypeLabel = this.getPlotSubtypeLabel(plot);
      const metaLabel = subtypeLabel ? `${typeLabel} / ${subtypeLabel}` : typeLabel;
      item.title = name;
      const isLocked = !!plot.locked;
      const isVisible = plot.visible !== false;
      const isMultiSelected = this.multiSelectedPlotIds.has(plot.id);

      item.innerHTML = `
        <div class="layer-item-content">
          <div class="layer-check-area" title="批量选择">
            <input type="checkbox" class="layer-multi-check" ${isMultiSelected ? 'checked' : ''}>
          </div>
          <div class="layer-visibility-area" title="显示/隐藏">
            <i class="bi ${isVisible ? 'bi-eye' : 'bi-eye-slash'} layer-visibility"></i>
          </div>
          <div class="layer-color-area" title="${name}">
            <span class="layer-color" style="background-color: ${this.getPlotColor(plot.properties?.type)};" title="${name}"></span>
          </div>
          <div class="layer-name-area" title="${name}">
            <span class="layer-name text-truncate" title="${name}">${name}</span>
            <span class="layer-meta text-truncate" title="${metaLabel}">${metaLabel}</span>
          </div>
          <div class="layer-actions">
            <i class="bi ${isLocked ? 'bi-lock-fill text-danger' : 'bi-unlock'} layer-lock" title="${isLocked ? '解锁图层' : '锁定图层'}"></i>
            <i class="bi bi-trash layer-delete text-danger" title="删除图层"></i>
          </div>
        </div>
      `;

      if (!isVisible) {
        item.classList.add('layer-hidden');
      }

      if (isLocked) {
        item.classList.add('layer-locked');
      }
      
      // 点击选择（单选/激活） - 点击整个 item content
      item.querySelector('.layer-item-content').addEventListener('click', (e) => {
        // 如果点击的是复选框、眼睛、锁定、删除图标，不触发图层切换
        if (e.target.closest('.layer-check-area, .layer-visibility-area, .layer-actions')) {
          return;
        }
        e.stopPropagation();
        this.selectPlot(plot.id);
      });

      item.querySelector('.layer-item-content').addEventListener('dblclick', (e) => {
        if (e.target.closest('.layer-check-area, .layer-visibility-area, .layer-actions')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.selectPlot(plot.id);
        this.focusPlotOnMap(plot.id);
      });

      // 多选框 (selected)
      const multiCheck = item.querySelector('.layer-multi-check');
      if (multiCheck) {
        multiCheck.addEventListener('change', (e) => {
          e.stopPropagation();
          if (multiCheck.checked) this.multiSelectedPlotIds.add(plot.id);
          else this.multiSelectedPlotIds.delete(plot.id);
          this.updateLayerPanelButtons();
          this.updateSelectedPlotsList(); // 刷新样式
        });
      }

      // 可见性 (visible - 眼睛图标)
      const visibilityIcon = item.querySelector('.layer-visibility');
      if (visibilityIcon) {
        visibilityIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          const isCurrentlyVisible = visibilityIcon.classList.contains('bi-eye');
          this.togglePlotVisibility(plot.id, !isCurrentlyVisible);
        });
      }

      // 锁定
      const lockIcon = item.querySelector('.layer-lock');
      lockIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlotLock(plot.id);
      });

      // 删除
      const deleteIcon = item.querySelector('.layer-delete');
      deleteIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removePlot(plot.id);
      });
      
      selectedAreasContainer.appendChild(item);
    });

    this.updateLayerPanelButtons();
  }

  // 更新图层面板按钮状态
  updateLayerPanelButtons() {
    const mergeBtn = document.getElementById('mergeZonesBtn');
    const booleanBtn = document.getElementById('booleanSubtractBtn');
    const splitBtn = document.getElementById('splitZoneBtn');
    
    const selectedCount = this.multiSelectedPlotIds.size;
    
    if (mergeBtn) mergeBtn.disabled = selectedCount < 2;
    if (booleanBtn) booleanBtn.disabled = selectedCount !== 2;
    if (splitBtn) splitBtn.disabled = !this.activePlotId;
  }

  getPlotDisplayName(plot, fallback = '未命名地块') {
    const name = plot?.properties?.name;
    if (typeof name === 'string' && name.trim()) {
      return name.trim();
    }
    return fallback;
  }

  getPlotTypeLabel(type) {
    const normalizedType = this.normalizePlotTypeKey(type);
    const labels = {
      forest: '林区',
      farmland: '农田',
      building: '建筑',
      water: '水域',
      road: '道路',
      bare_land: '裸地'
    };
    return labels[normalizedType] || '未分类';
  }

  getPlotSubtypeLabel(plot) {
    return String(
      plot?.properties?.subcategoryName
      || plot?.properties?.subtype_label
      || plot?.properties?.subType
      || ''
    ).trim();
  }

  updateCurrentPlotTitle() {
    const titleEl = document.getElementById('currentPlotTitleName');
    if (!titleEl) return;

    const activePlot = this.userPlots.find(p => p.id === this.activePlotId);
    if (activePlot) {
      const plotName = this.getPlotDisplayName(activePlot);
      titleEl.textContent = plotName;
      titleEl.title = plotName;
      return;
    }

    titleEl.textContent = '-';
    titleEl.title = '当前未选择地块';
  }

  refreshPlotStyles() {
    this.userPlots.forEach(plot => {
      if (!plot?.layer?.setStyle) return;
      plot.layer.setStyle(this.getPlotStyle(
        plot.properties,
        plot.id === this.activePlotId,
        this.multiSelectedPlotIds.has(plot.id)
      ));
    });
  }

  getPlotBounds(plot) {
    if (!plot) return null;

    if (plot.layer && typeof plot.layer.getBounds === 'function') {
      const layerBounds = plot.layer.getBounds();
      if (layerBounds && typeof layerBounds.isValid === 'function' && layerBounds.isValid()) {
        return layerBounds;
      }
    }

    const geojson = plot.geojson?.geometry ? plot.geojson : (plot.geojson ? { type: 'Feature', geometry: plot.geojson, properties: {} } : null);
    if (!geojson || typeof turf === 'undefined') {
      return null;
    }

    try {
      const bbox = turf.bbox(geojson);
      const bounds = L.latLngBounds([bbox[1], bbox[0]], [bbox[3], bbox[2]]);
      if (bounds.isValid()) {
        return bounds;
      }
    } catch (error) {
      console.warn('计算地块视野范围失败:', error);
    }

    return null;
  }

  focusPlotOnMap(plotId) {
    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot || !this.map) return false;

    const bounds = this.getPlotBounds(plot);
    if (!bounds) return false;

    const maxZoom = Number.isFinite(this.map.options?.maxZoom) ? this.map.options.maxZoom : 18;
    this.map.fitBounds(bounds, {
      padding: [48, 48],
      maxZoom,
      animate: true
    });

    return true;
  }

  // 选择地块
  async selectPlot(plotId) {
    // 切换地块前，检查旧地块是否有不相连部分
    if (this.activePlotId && this.activePlotId !== plotId) {
      await this.checkAndSplitDisjointPartsLocally(this.activePlotId);
    }

    // --- 日志3：图层切换日志 ---
    console.log('[日志3：图层切换]');
    console.log('- 切换前 activeLayerId:', this.activePlotId);
    const oldSubtype = document.getElementById('plotSubType')?.value;
    console.log('- 切换前表单 subtype:', oldSubtype);

    // 更新当前选中 ID
    this.activePlotId = plotId;
    const plot = this.userPlots.find(p => p.id === plotId);
    
    // 如果找不到地块（理论上不应该发生），也需要更新列表 UI 取消所有高亮
    if (!plot) {
      this.updateSelectedPlotsList();
      return;
    }

    console.log('- 切换后 activeLayerId:', plot.id);
    console.log('- 切换后准备从 layer 回填的 subtype:', plot.properties?.subType || '');

    // 更新地图上所有图层的样式
    this.refreshPlotStyles();

    // 设置当前图层前置显示
    if (plot.layer && plot.layer.setStyle) {
      if (plot.layer.bringToFront) plot.layer.bringToFront();
      if (plot.layer.eachLayer) {
        plot.layer.eachLayer(l => l.bringToFront && l.bringToFront());
      }
    }

    // 更新右侧属性面板
    this.updateAttributePanel(plot);
    
    // 更新面积显示
    this.updateSelectedArea();
    
    // 无论是否存在 layer (比如新建的空图层)，都必须更新左侧图层列表的 DOM 激活状态
    this.updateSelectedPlotsList();
  }
  
  // 移除地块
  async removePlot(plotId) {
    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot) return;

    if (plot.db_id) {
      this.confirmAction(`确定要从数据库中永久删除地块 "${plot.properties.name || '未命名'}" 吗？`, async () => {
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
            
            // 成功后继续执行本地移除逻辑
            this.executeRemovePlotLocal(plotId, plot);
          } else {
            this.alertAction('删除失败: ' + result.msg);
          }
        } catch (e) {
          console.error('删除请求异常:', e);
          this.alertAction('删除请求失败');
        }
      }, null, 'danger');
      return;
    }

    // 本地未保存的地块直接移除
    this.executeRemovePlotLocal(plotId, plot);
  }
  
  executeRemovePlotLocal(plotId, plot) {
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

    // 使用统一方法设置地块类型、触发子类型加载并回填
    const currentCategory = plot.properties?.type || 'forest';
    const currentSubtype = plot.properties?.subType || '';
    this.setPlotCategoryAndLoadSubcategories(currentCategory, currentSubtype);

    const riskSelect = document.getElementById('riskLevel');
    if (riskSelect) riskSelect.value = plot.properties?.riskLevel || 'low';

    const descText = document.getElementById('description');
    if (descText) descText.value = plot.properties?.description || '';

    const plotAreaInput = document.getElementById('plotArea');
    if (plotAreaInput) plotAreaInput.value = Number(plot.properties?.areaHa || 0).toFixed(2);

    // 显示附加记录列表
    const elementListEl = document.getElementById('elementList');
    const addElementBtn = document.getElementById('addElementBtn');

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
        elementListEl.innerHTML = '<p class="text-muted italic">暂无记录</p>';
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

    if (plot.layer && plot.layer.getBounds) {
      const bounds = plot.layer.getBounds();
      const center = bounds.getCenter();
      if (centerPointEl) centerPointEl.textContent = `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`;
    }

    // 更新选中区域信息 (面积显示等)
    this.updateSelectedArea();
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

  // 兼容旧入口：平移功能并入移动工具
  enablePan() {
    this.enableMoveLayer();
  }

  // 橡皮擦工具
  enableEraser() {
    this.clearToolEvents();
    this.currentTool = 'eraser';
    this.updateEditMode(`橡皮擦 (${this.eraserMode === 'block' ? '整块' : '画笔'})`);
    this.refreshPlotInteractivity();
    
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
      
      // 使用 Pointer Events 适配数位笔和鼠标
      const container = this.map.getContainer();
      container.addEventListener('pointerdown', this._handlers.pointerDown);
      container.addEventListener('pointermove', this._handlers.pointerMove);
      container.addEventListener('pointerup', this._handlers.pointerUp);
      container.addEventListener('pointercancel', this._handlers.pointerUp);
    }
  }
  
  // 整块擦除点击处理
  handleEraserClick(e) {
    if (!this.activePlotId) {
      alert('请先选择一个地块进行擦除。');
      return;
    }
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
    if (!this.activePlotId) {
      alert('请先选择一个地块进行擦除。');
      return;
    }
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
              style: this.getPlotStyle(plot.properties, plot.id === this.activePlotId, this.multiSelectedPlotIds.has(plot.id)),
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

  // 设置画笔形状 (square/circle)
  setBrushShape(shape) {
    this.brushShape = shape;
  }

  // === Pointer 事件统一处理逻辑 ===
  
  handlePointerDown(e) {
    // 适配 Leaflet 事件和原生事件
    const originalEvent = e.originalEvent || e;
    const pointerType = originalEvent.pointerType || 'mouse';
    
    // 仅在特定模式下处理
    const drawableTools = ['brush', 'eraser', 'marquee-select'];
    if (!drawableTools.includes(this.currentTool)) return;
    
    // 压力保护：如果是笔且支持压力，压力必须大于 0
    if (pointerType === 'pen' && originalEvent.pressure !== undefined && originalEvent.pressure === 0) {
      return;
    }

    // 鼠标必须是左键按下 (buttons & 1)
    if (pointerType === 'mouse' && !(originalEvent.buttons & 1)) {
      return;
    }

    // 获取坐标
    const latlng = e.latlng || this.map.mouseEventToLatLng(originalEvent);
    
    // 捕获指针，确保移动到画布外也能接收事件
    try {
      this.map.getContainer().setPointerCapture(originalEvent.pointerId);
    } catch (err) {}

    if (this.currentTool === 'brush') {
      this.startBrush({ latlng });
    } else if (this.currentTool === 'eraser' && this.eraserMode === 'brush') {
      this.startEraserBrush({ latlng });
    } else if (this.currentTool === 'marquee-select') {
      this.startMarqueeSelection({ latlng });
    }
    
    // 阻止默认行为（如滚动、缩放）
    if (originalEvent.cancelable) {
      originalEvent.preventDefault();
    }
  }

  handlePointerMove(e) {
    const originalEvent = e.originalEvent || e;
    const pointerType = originalEvent.pointerType || 'mouse';
    const latlng = e.latlng || this.map.mouseEventToLatLng(originalEvent);

    // 更新预览（无论是否在绘制）
    if (this.currentTool === 'brush' || (this.currentTool === 'eraser' && this.eraserMode === 'brush')) {
      this.updateBrushPreview(latlng);
    }

    // 处理框选预览
    if (this.currentTool === 'marquee-select') {
      this.handleMarqueeSelection({ latlng });
    }

    if (!this.isPainting && this.currentTool !== 'marquee-select') return;
    if (this.currentTool === 'marquee-select' && !this._marqueeSelectionState) return;

    // 绘制过程中的持续判断
    if (pointerType === 'mouse' && !(originalEvent.buttons & 1)) {
      // 鼠标左键松开，结束绘制
      this.handlePointerUp(e);
      return;
    }

    if (this.currentTool === 'brush') {
      this.handleBrush({ latlng });
    } else if (this.currentTool === 'eraser' && this.eraserMode === 'brush') {
      this.handleEraserBrush({ latlng });
    }

    if (originalEvent.cancelable) {
      originalEvent.preventDefault();
    }
  }

  handlePointerUp(e) {
    const originalEvent = e.originalEvent || e;
    const latlng = e.latlng || this.map.mouseEventToLatLng(originalEvent);

    const wasPainting = this.isPainting;
    const wasMarquee = this._marqueeSelectionState;

    if (!wasPainting && !wasMarquee) return;

    // 释放指针捕获
    try {
      this.map.getContainer().releasePointerCapture(originalEvent.pointerId);
    } catch (err) {}

    if (this.currentTool === 'brush') {
      this.endBrush({ latlng });
    } else if (this.currentTool === 'eraser' && this.eraserMode === 'brush') {
      this.endEraserBrush({ latlng });
    } else if (this.currentTool === 'marquee-select') {
      this.endMarqueeSelection({ latlng });
    }
  }

  // 像素画笔工具
  enableBrush() {
    this.clearToolEvents();
    this.currentTool = 'brush';
    this.updateEditMode('像素画笔');
    this.refreshPlotInteractivity();
    
    // 画笔模式下设置鼠标样式
    this.map.getContainer().style.cursor = 'crosshair';
    
    this.paintedGrids = new Set();
    if (this.paintedLayer) this.map.removeLayer(this.paintedLayer);
    this.paintedLayer = L.layerGroup().addTo(this.map);
    
    this.isPainting = false;
    this.brushPreviewLayer = null;
    this.map.dragging.disable();
    
    // 使用 Pointer Events 适配数位笔和鼠标
    const container = this.map.getContainer();
    container.addEventListener('pointerdown', this._handlers.pointerDown);
    container.addEventListener('pointermove', this._handlers.pointerMove);
    container.addEventListener('pointerup', this._handlers.pointerUp);
    container.addEventListener('pointercancel', this._handlers.pointerUp);
  }
  
  // 清除所有工具事件
  clearToolEvents() {
    // 移除 Pointer Events
    const container = this.map.getContainer();
    container.removeEventListener('pointerdown', this._handlers.pointerDown);
    container.removeEventListener('pointermove', this._handlers.pointerMove);
    container.removeEventListener('pointerup', this._handlers.pointerUp);
    container.removeEventListener('pointercancel', this._handlers.pointerUp);

    this.map.off('mousedown', this._handlers.brushStart);
    this.map.off('mousemove', this._handlers.brushMove);
    this.map.off('mouseup', this._handlers.brushEnd);
    this.map.off('mouseout', this._handlers.brushEnd);
    
    this.map.off('mousedown', this._handlers.eraserStart);
    this.map.off('mousemove', this._handlers.eraserMove);
    this.map.off('mouseup', this._handlers.eraserEnd);
    this.map.off('mouseout', this._handlers.eraserEnd);
    
    this.map.off('click', this._handlers.eraserClick);
    this.map.off('mousemove', this._handlers.plotMove);
    this.map.off('mouseup', this._handlers.plotMoveEnd);
    this.map.off('mousedown', this._handlers.marqueeStart);
    this.map.off('mousemove', this._handlers.marqueeMove);
    this.map.off('mouseup', this._handlers.marqueeEnd);
    
    if (this.brushPreviewLayer) {
      this.map.removeLayer(this.brushPreviewLayer);
      this.brushPreviewLayer = null;
    }
    if (this._marqueeSelectionLayer) {
      this.map.removeLayer(this._marqueeSelectionLayer);
      this._marqueeSelectionLayer = null;
    }
    this._marqueeSelectionState = null;
    this._movingPlotsState = null;
    this.map.dragging.enable();
    this.map.getContainer().style.cursor = 'default';
  }

  // 开始画笔
  startBrush(e) {
    if (!this.activePlotId) {
      alert('请先从图层面板选择一个地块，或点击“新建地块图层”开始绘制。');
      return;
    }
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
      if (plot.layer) {
        plot.layer.setStyle(this.getPlotStyle(
          plot.properties,
          plot.id === this.activePlotId,
          this.multiSelectedPlotIds.has(plot.id)
        ));
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
        
        // 如果是圆形，检查距离
        if (this.brushShape === 'circle') {
          const centerX = (safeBrushSize - 1) / 2;
          const centerY = (safeBrushSize - 1) / 2;
          const dist = Math.sqrt(Math.pow(i - centerX, 2) + Math.pow(j - centerY, 2));
          // 使用半径判定，略加偏移以包含中心点周围的网格
          if (dist > (safeBrushSize / 2)) continue;
        }
        
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
    const type = document.getElementById('plotType')?.value || 'forest';
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

      let properties = this.getCurrentPlotPropertiesFromForm();
      const activePlot = this.userPlots.find(p => p.id === this.activePlotId);
      if (activePlot) {
        // 如果有当前激活图层，则继承其属性进行绘制与合并，而不是表单的临时状态
        properties = { ...activePlot.properties };
      }

      let mergedFeature = combinedFeature;
      let mergedGridData = { grid_size: 10, cells: cells };
      let preservedDbId = null; // 记录被合并地块中的数据库 ID
      
      const toMerge = [];
      this.userPlots.forEach(plot => {
        if (!this.canAutoMergePlot(plot, properties)) return;
        if (!plot.geojson) return;
        try {
          // 修复问题1：如果是当前激活地块，无条件纳入合并，确保同一图层内所有笔划归入同一对象
          if (plot.id === this.activePlotId) {
            toMerge.push(plot);
            return;
          }
          
          // 如果不是当前激活地块，只有当两者都有几何图形且相交时才自动合并
          if (plot.geojson.geometry && turf.booleanIntersects(mergedFeature, plot.geojson)) {
            toMerge.push(plot);
          }
        } catch (_) {
          return;
        }
      });

      // --- 日志2：画笔绘制日志 ---
      console.log('[日志2：画笔绘制]');
      console.log('- 当前 activeLayerId:', this.activePlotId);
      console.log('- 本次新增 cells:', cells.length);
      console.log('- 是否找到可合并的图层:', toMerge.length > 0);

      toMerge.forEach(plot => {
        try {
          console.log(`- 准备合并图层: ${plot.id} (首次落笔: ${!plot.geojson.geometry})`);
          // 如果被合并的地块有数据库 ID，则保留它（优先保留当前激活地块的 ID，或者第一个遇到的 ID）
          if (plot.db_id && (!preservedDbId || plot.id === this.activePlotId)) {
            preservedDbId = plot.db_id;
          }
          
          // 只有当原有地块有几何图形时才执行 union
          if (plot.geojson && plot.geojson.geometry) {
            mergedFeature = turf.union(mergedFeature, plot.geojson);
          }
          
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
        style: this.getPlotStyle(p.properties, p.id === this.activePlotId, this.multiSelectedPlotIds.has(p.id)),
        interactive: !p.locked,
        renderer: this.canvasRenderer // 使用 Canvas 渲染以提升性能
      });
      if (p.visible) {
        this.layerManager.layerGroups.working.addLayer(layer);
      }
      const plot = {
        id: p.id,
        db_id: p.db_id,
        geojson: p.geojson,
        gridData: p.gridData,
        properties: p.properties,
        visible: p.visible,
        locked: p.locked,
        layer
      };
      this.userPlots.push(plot);
      this.bindPlotSelectionEvents(plot);
    });

    this.refreshPlotInteractivity();
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

  // 保存地块数据到后端 (重构：统一保存 地形 + 所有地块)
  async save() {
    const terrainName = document.getElementById('terrainName')?.value?.trim();
    if (!terrainName) {
      this.showAlert('请填写地形名称', '保存校验', 'warning');
      return;
    }
    const terrainDesc = document.getElementById('terrainDesc')?.value?.trim() || '';
    const terrainId = document.getElementById('terrainId')?.value || this.areaId;

    // 1. 校验是否至少有一个地块 (仅针对新建地形或必须有内容的要求)
    const validPlots = this.userPlots.filter(plot => plot.geojson);
    if (validPlots.length === 0) {
      this.showAlert('当前地形中没有任何地块内容，请先在地图上绘制地块后再保存。', '保存校验', 'warning');
      return;
    }

    // 2. 校验地块重叠问题
    const overlapIssues = this.checkPlotOverlaps(validPlots);
    if (overlapIssues.length > 0) {
      let message = '检测到地块之间存在重叠，请修正后再保存：<br><br>';
      overlapIssues.forEach((issue, index) => {
        message += `${index + 1}. <b>${issue.plot1Name}</b> 与 <b>${issue.plot2Name}</b> 存在重叠区域。<br>`;
      });
      message += '<br><i>提示：您可以使用“移动”工具或重新绘制来避免重叠。</i>';
      this.showAlert(message, '地块重叠检测', 'danger');
      return;
    }

    // 3. 校验地块不得越出当前 TerrainArea 边界
    const boundaryIssues = this.checkPlotsOutsideBoundary(validPlots);
    if (boundaryIssues.length > 0) {
      let message = '检测到地块超出当前地形边界，请调整后再保存：<br><br>';
      boundaryIssues.forEach((issue, index) => {
        message += `${index + 1}. <b>${issue.plotName}</b> 超出边界约 ${issue.outsideRatio}% 。<br>`;
      });
      message += '<br><i>提示：请使用移动、裁剪或重绘工具，将所有地块控制在 TerrainArea 蓝色边界内。</i>';
      this.showAlert(message, '地块越界检测', 'danger');
      return;
    }

    // 构建地形数据
    const terrainPayload = {
      terrain: {
        id: terrainId || null,
        name: terrainName,
        description: terrainDesc,
        area: 0
      },
      plots: [] // 收集所有地块
    };
    let totalPlotArea = 0;

    // 收集所有有效图层地块
    for (const plot of validPlots) {
      const properties = plot.properties || this.getCurrentPlotPropertiesFromForm();
      let landType = this.normalizePlotTypeKey(properties.type || 'forest');
      const plotAreaHa = this.calculateGeoJSONAreaHa(plot.geojson, properties.areaHa || 0);
      properties.areaHa = plotAreaHa;
      totalPlotArea += plotAreaHa;

      terrainPayload.plots.push({
        id: plot.db_id || null,
        area_obj: terrainId || null,
        name: properties.name || '未命名地块',
        category: landType,
        type: properties.subType || '', // 子类别
        risk_level: properties.riskLevel || 'low',
        area: plotAreaHa,
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
          type_label: this.getPlotTypeLabel(landType),
          subtype_label: properties.subcategoryName || properties.subType || '',
          standard_type: landType,
          area: plotAreaHa
        }
      });
    }
    terrainPayload.terrain.area = Number(totalPlotArea.toFixed(2));

    console.log('--- 准备保存地形数据 ---', terrainPayload);

    try {
      const response = await fetch('/terrain/api/terrain/save/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.getCookie('csrftoken')
        },
        body: JSON.stringify(terrainPayload)
      });

      const result = await response.json();
      if (result.code === 0) {
        // 更新 Terrain ID
        this.areaId = result.data.terrain.id;
        const terrainIdInput = document.getElementById('terrainId');
        if (terrainIdInput) terrainIdInput.value = this.areaId;

        // 保存成功后启用删除按钮
        const deleteBtn = document.getElementById('deleteTerrainBtn');
        if (deleteBtn) deleteBtn.disabled = false;

        // 回填所有地块的 DB ID
        if (result.data.plots && result.data.plots.length > 0) {
          result.data.plots.forEach((dbPlot, idx) => {
            // 注意：这里需要根据某种标识匹配，由于是批量提交，顺序通常一致
            if (validPlots[idx]) {
              validPlots[idx].db_id = dbPlot.id;
            }
          });
        }

        this.alertAction(`成功保存地形 "${terrainName}" 及其 ${terrainPayload.plots.length} 个地块！`);
        sessionStorage.setItem('terrainRiskUpdated', String(this.areaId));
        localStorage.setItem('terrain_plot_changed', '1');
        localStorage.setItem('terrain_list_should_refresh', '1');
        // 保存成功后自动返回列表页
        window.location.href = '/terrain/';
      } else {
        this.alertAction('保存失败: ' + result.msg);
      }
    } catch (e) {
      console.error('保存异常:', e);
      this.alertAction('保存过程中发生异常，请检查网络或控制台。');
    }
    
    this.updateSelectedPlotsList();
  }

  /**
   * 检查地块之间是否存在重叠
   * @param {Array} plots 
   * @returns {Array} 重叠问题列表
   */
  checkPlotOverlaps(plots) {
    if (!plots || plots.length < 2 || typeof turf === 'undefined') return [];
    
    const issues = [];
    for (let i = 0; i < plots.length; i++) {
      for (let j = i + 1; j < plots.length; j++) {
        const plot1 = plots[i];
        const plot2 = plots[j];
        
        try {
          // 使用 turf.intersect 检测重叠
          const intersection = turf.intersect(plot1.geojson, plot2.geojson);
          
          if (intersection) {
            // 如果存在交集且面积大于一定阈值 (比如 0.1 平方米，防止浮点数计算误差)
            const area = turf.area(intersection);
            if (area > 0.01) {
              issues.push({
                plot1Id: plot1.id,
                plot1Name: plot1.properties?.name || `地块 ${i + 1}`,
                plot2Id: plot2.id,
                plot2Name: plot2.properties?.name || `地块 ${j + 1}`,
                overlapArea: area
              });
            }
          }
        } catch (e) {
          console.warn('地块重叠检测出错:', e);
        }
      }
    }
    return issues;
  }

  getAreaBoundaryConstraint() {
    const parseJson = (value) => {
      let current = value;
      for (let i = 0; i < 3 && typeof current === 'string'; i += 1) {
        try {
          current = JSON.parse(current);
        } catch (_) {
          return null;
        }
      }
      return current;
    };

    const rawBoundary = this.originalBoundaryGeoJSON || this.areaData?.boundary_json || this.areaData?.boundary || null;
    const boundary = parseJson(rawBoundary);
    if (!boundary || typeof boundary !== 'object') {
      return null;
    }

    if (boundary.type === 'Feature') {
      return boundary;
    }

    if (boundary.type === 'Polygon' || boundary.type === 'MultiPolygon') {
      return {
        type: 'Feature',
        geometry: boundary,
        properties: {}
      };
    }

    return null;
  }

  checkPlotsOutsideBoundary(plots) {
    if (!Array.isArray(plots) || !plots.length || typeof turf === 'undefined') {
      return [];
    }

    const boundaryFeature = this.getAreaBoundaryConstraint();
    if (!boundaryFeature) {
      return [];
    }

    const issues = [];
    plots.forEach((plot, index) => {
      const plotFeature = plot?.geojson?.geometry
        ? plot.geojson
        : (plot?.geojson ? { type: 'Feature', geometry: plot.geojson, properties: {} } : null);
      if (!plotFeature) {
        return;
      }

      try {
        const plotArea = turf.area(plotFeature);
        const intersection = turf.intersect(boundaryFeature, plotFeature);
        const coveredArea = intersection ? turf.area(intersection) : 0;
        const outsideRatio = plotArea > 0
          ? Math.max(0, ((plotArea - coveredArea) / plotArea) * 100)
          : 0;

        if (!intersection || outsideRatio > 0.1) {
          issues.push({
            plotId: plot.id,
            plotName: plot.properties?.name || `地块 ${index + 1}`,
            outsideRatio: outsideRatio.toFixed(2)
          });
        }
      } catch (error) {
        console.warn('地块边界校验出错:', error);
      }
    });

    return issues;
  }


  // 加载区域编辑详情 (包括区域边界、地块及其附加记录)
  async loadAreaEditDetail(areaId) {
    // 优化目的: 编辑态先用 boundary_json 做弱兜底，再在真实地块渲染完成后多次重聚焦，避免异步渲染导致视野偏移。
    if (!areaId) return;

    this.areaId = areaId;
    this.addLayerGroups();
    this.clearManagedBackgroundLayers();

    const runInNextFrame = (callback) => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(callback);
      } else {
        setTimeout(callback, 16);
      }
    };

    const requestUrl = `/terrain/api/areas/${areaId}/edit/?_ts=${Date.now()}`;
    const maxAttempts = 3;
    let result = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(requestUrl, {
          cache: 'no-store',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        result = await response.json();
        break;
      } catch (error) {
        if (attempt >= maxAttempts) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 180));
      }
    }

    if (!(result && result.code === 0 && result.data)) {
      console.warn('加载区域编辑详情失败:', result?.msg || '接口返回为空');
      return;
    }

    const payload = result.data.editor_payload || result.data;
    const area = payload.area || result.data.area || {};
    const rawZones = [
      ...(Array.isArray(payload.plots) ? payload.plots : []),
      ...(Array.isArray(payload.zones) ? payload.zones : []),
      ...(Array.isArray(result.data.plots) ? result.data.plots : []),
      ...(Array.isArray(result.data.zones) ? result.data.zones : [])
    ];
    const viewMeta = payload.view_meta || result.data.view_meta || {};
    const boundaryGeoJSON = area.boundary_json || area.boundary || payload.boundary_json || null;

    this.areaData = {
      ...area,
      boundary_json: boundaryGeoJSON || area.boundary_json || null
    };

    // 优化目的: 在重新渲染编辑区前，清理旧地块与旧选中状态，避免历史图层干扰真实 bounds 计算。
    this.userPlots.forEach((plot) => {
      if (plot?.layer && this.layerManager.layerGroups?.working) {
        this.layerManager.layerGroups.working.removeLayer(plot.layer);
      }
    });
    this.userPlots = [];
    this.activePlotId = null;
    if (this.multiSelectedPlotIds?.clear) {
      this.multiSelectedPlotIds.clear();
    }

    // 优化目的: 表单数据与弱兜底边界先同步，确保编辑页先可见、后精确聚焦。
    const terrainNameInput = document.getElementById('terrainName');
    const terrainDescInput = document.getElementById('terrainDesc');
    const terrainIdInput = document.getElementById('terrainId');
    if (terrainNameInput) terrainNameInput.value = area.name || '';
    if (terrainDescInput) terrainDescInput.value = area.description || '';
    if (terrainIdInput) terrainIdInput.value = area.id || '';

    // 原始 boundary_json 仅保留为内部参考数据，用于越界校验与导出，不直接渲染到地图。
    this.setOriginalBoundaryReference(boundaryGeoJSON);

    const zones = this.filterRenderableZones(rawZones, { areaId });

    const viewportPayload = {
      area: this.areaData,
      zones,
      view_meta: viewMeta
    };

    // 优化目的: 第一时间只用 boundary_json 做弱兜底，不再调用 updateMapViewport 抢占编辑态视野。
    this.applyInitialViewportByMode('edit', viewportPayload, {
      force: true,
      retry: true,
      source: 'boundary-fallback'
    });

    if (zones.length > 0) {
      zones.forEach((zoneData) => {
        this.renderPlotFromData(zoneData);
      });

      const firstPlot = this.userPlots[0];
      if (firstPlot) {
        console.log('自动选择第一个地块:', firstPlot.id);
        this.selectPlot(firstPlot.id);
      }
    }

    // 优化目的: 地块、网格、样式异步挂载后再次聚焦真实地块 bounds，兼容 requestAnimationFrame 与慢速渲染。
    [0, 80, 220, 480].forEach((delay) => {
      setTimeout(() => {
        runInNextFrame(() => {
          this.applyInitialViewportByMode('edit', viewportPayload, {
            force: delay === 0,
            retry: true,
            source: 'post-render'
          });
        });
      }, delay);
    });

    this.updateSelectedPlotsList();
    console.log(`成功加载地形 "${area.name || areaId}", 原始地块 ${rawZones.length} 个，实际渲染 ${zones.length} 个`);
  }

  // 仅缓存区域边界，用于校验和导出，不在编辑器默认绘制。
  renderAreaBoundary(geojson) {
    const parseJson = (value) => {
      let current = value;
      for (let i = 0; i < 3 && typeof current === 'string'; i += 1) {
        try {
          current = JSON.parse(current);
        } catch (_) {
          break;
        }
      }
      return current;
    };

    const mercatorToLngLat = (x, y) => {
      const lng = (x / 20037508.34) * 180;
      let lat = (y / 20037508.34) * 180;
      lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
      return [lng, lat];
    };

    const convertCoordinates = (coordinates) => {
      if (!Array.isArray(coordinates)) return coordinates;
      if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
        const x = Number(coordinates[0]);
        const y = Number(coordinates[1]);
        if (Number.isFinite(x) && Number.isFinite(y) && (Math.abs(x) > 180 || Math.abs(y) > 90)) {
          return mercatorToLngLat(x, y);
        }
        return [x, y];
      }
      return coordinates.map((item) => convertCoordinates(item));
    };

    const normalizeGeoJSON = (value) => {
      const parsed = parseJson(value);
      if (!parsed) return null;

      if (parsed.type === 'FeatureCollection') {
        return {
          ...parsed,
          features: Array.isArray(parsed.features) ? parsed.features.map((feature) => normalizeGeoJSON(feature)).filter(Boolean) : []
        };
      }

      if (parsed.type === 'Feature') {
        if (!parsed.geometry) return null;
        return {
          ...parsed,
          geometry: normalizeGeoJSON(parsed.geometry)
        };
      }

      if (parsed.type && Array.isArray(parsed.coordinates)) {
        return {
          ...parsed,
          coordinates: convertCoordinates(parsed.coordinates)
        };
      }

      return null;
    };

    const normalizedGeoJSON = normalizeGeoJSON(geojson);
    this.originalBoundaryGeoJSON = normalizedGeoJSON;
    this.clearOriginalBoundaryLayer();
    return null;
  }

  // 从数据库数据渲染地块 (Zone) 到地图
  renderPlotFromData(data) {
    // 优化目的: 统一兼容 geom_json / geometry / meta_json / type / category / 子类别，并在渲染前自动完成 3857 -> 4326 转换。
    const validation = this.getZoneRenderValidation(data, { areaId: this.getCurrentEditAreaId() });
    if (!validation.ok) {
      console.warn(`跳过非编辑态有效地块 [${data?.name || '未命名'} (ID: ${data?.id || 'unknown'})]: ${validation.reason}`);
      return null;
    }

    const parseJson = (value) => {
      let current = value;
      for (let i = 0; i < 3 && typeof current === 'string'; i += 1) {
        try {
          current = JSON.parse(current);
        } catch (_) {
          break;
        }
      }
      return current;
    };

    const mercatorToLngLat = (x, y) => {
      const lng = (x / 20037508.34) * 180;
      let lat = (y / 20037508.34) * 180;
      lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
      return [lng, lat];
    };

    const convertCoordinates = (coordinates) => {
      if (!Array.isArray(coordinates)) return coordinates;
      if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
        const x = Number(coordinates[0]);
        const y = Number(coordinates[1]);
        if (Number.isFinite(x) && Number.isFinite(y) && (Math.abs(x) > 180 || Math.abs(y) > 90)) {
          return mercatorToLngLat(x, y);
        }
        return [x, y];
      }
      return coordinates.map((item) => convertCoordinates(item));
    };

    const normalizeGeoJSON = (value) => {
      const parsed = parseJson(value);
      if (!parsed) return null;

      if (parsed.type === 'FeatureCollection') {
        if (!Array.isArray(parsed.features) || parsed.features.length === 0) return null;
        if (parsed.features.length === 1) {
          return normalizeGeoJSON(parsed.features[0]);
        }
        return {
          ...parsed,
          features: parsed.features.map((feature) => normalizeGeoJSON(feature)).filter(Boolean)
        };
      }

      if (parsed.type === 'Feature') {
        if (!parsed.geometry) return null;
        return {
          ...parsed,
          geometry: normalizeGeoJSON(parsed.geometry)
        };
      }

      if (parsed.type && Array.isArray(parsed.coordinates)) {
        return {
          ...parsed,
          coordinates: convertCoordinates(parsed.coordinates)
        };
      }

      return null;
    };

    const geomSource = data?.geom_json || data?.geometry || data?.geojson || null;
    const meta = parseJson(data?.meta_json || data?.meta || {});
    const styleData = parseJson(data?.style_json || data?.style || {});
    const gridData = parseJson(data?.grid_json || data?.grid || null);
    const normalizedGeoJSON = normalizeGeoJSON(geomSource);

    if (!normalizedGeoJSON) {
      console.warn(`跳过无效地块 [${data?.name || '未命名'} (ID: ${data?.id || 'unknown'})]: 缺少有效 GeoJSON 数据`, geomSource);
      return null;
    }

    const category = this.normalizePlotTypeKey(
      data?.category
      || data?.type
      || meta?.standard_type
      || meta?.category
      || meta?.type
      || data?.type_label
    );
    const subType = data?.subcategory || data?.subtype || data?.sub_type || meta?.sub_type || meta?.subcategory || '';
    const visible = styleData?.visible !== false;
    const locked = !!styleData?.locked;

    const properties = {
      name: data?.name || meta?.name || `地块 ${data?.id || this.userPlots.length + 1}`,
      type: category,
      category: category,
      riskLevel: data?.risk_level || meta?.risk_level || 'low',
      description: data?.description || meta?.description || '',
      areaHa: 0,
      subType: subType,
      subcategory: subType,
      subcategoryName: data?.subtype_label || data?.subcategory_name || meta?.subtype_label || meta?.subcategory_name || subType
    };
    properties.areaHa = this.calculateGeoJSONAreaHa(normalizedGeoJSON, data?.area || meta?.area || 0);

    const baseStyle = this.getPlotStyle(properties, false, false);
    const layerStyle = {
      ...baseStyle
    };

    if (styleData?.color) layerStyle.color = styleData.color;
    if (styleData?.fillColor) layerStyle.fillColor = styleData.fillColor;
    if (typeof styleData?.weight === 'number') layerStyle.weight = styleData.weight;
    if (typeof styleData?.fillOpacity === 'number') layerStyle.fillOpacity = styleData.fillOpacity;
    if (typeof styleData?.opacity === 'number') layerStyle.opacity = styleData.opacity;

    let layer;
    try {
      layer = L.geoJSON(normalizedGeoJSON, {
        style: layerStyle,
        interactive: !locked
      });
    } catch (err) {
      console.error(`渲染地块 [${properties.name} (ID: ${data?.id || 'unknown'})] 失败:`, err, normalizedGeoJSON);
      return null;
    }

    const plot = {
      id: data?.client_id || `plot_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      db_id: data?.id,
      geojson: normalizedGeoJSON,
      gridData: gridData,
      properties: properties,
      meta: meta,
      style: styleData,
      elements: Array.isArray(data?.elements) ? data.elements : [],
      visible: visible,
      locked: locked,
      layer: layer
    };

    if (plot.visible && this.layerManager.layerGroups?.working) {
      this.layerManager.layerGroups.working.addLayer(layer);
    }

    this.userPlots.push(plot);
    this.bindPlotSelectionEvents(plot);
    this.refreshPlotInteractivity();
    return plot;
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
    const ensureFeature = (geojson, properties = {}) => {
      if (!geojson || typeof geojson !== 'object') {
        return null;
      }
      if (geojson.type === 'Feature') {
        return {
          ...geojson,
          properties: {
            ...(geojson.properties || {}),
            ...properties
          }
        };
      }
      if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
        return {
          type: 'Feature',
          geometry: geojson,
          properties: { ...properties }
        };
      }
      return null;
    };

    const buildBoundsFromGeoJSON = (geojson) => {
      if (!geojson) {
        return null;
      }
      try {
        const layer = L.geoJSON(geojson);
        const bounds = layer.getBounds();
        if (!bounds?.isValid?.()) {
          return null;
        }
        return {
          south_west: [bounds.getWest(), bounds.getSouth()],
          north_east: [bounds.getEast(), bounds.getNorth()]
        };
      } catch (_) {
        return null;
      }
    };

    const terrainName = document.getElementById('terrainName')?.value?.trim() || this.areaData?.name || '未命名地形';
    const terrainDesc = document.getElementById('terrainDesc')?.value?.trim() || this.areaData?.description || '';
    const boundarySource = this.originalBoundaryGeoJSON || this.areaData?.boundary_json || this.areaData?.boundary || null;
    const boundaryFeature = ensureFeature(boundarySource);

    const plots = this.userPlots.map((plot) => {
      const landType = this.normalizePlotTypeKey(plot?.properties?.type);
      const subtype = String(plot?.properties?.subType || plot?.properties?.subcategory || '').trim();
      const subtypeLabel = String(
        plot?.properties?.subcategoryName
        || plot?.properties?.subtype_label
        || subtype
      ).trim();
      const areaHa = this.calculateGeoJSONAreaHa(plot?.geojson, plot?.properties?.areaHa || 0);
      if (plot?.properties) {
        plot.properties.areaHa = areaHa;
      }
      const geometry = ensureFeature(plot.geojson, {
        id: plot.db_id || plot.id || null,
        name: plot?.properties?.name || '未命名地块',
        type: landType,
        type_label: this.getPlotTypeLabel(landType),
        subtype: subtype,
        subtype_label: subtypeLabel,
        area: areaHa
      });
      if (!geometry) {
        return null;
      }
      return {
        id: plot.db_id || null,
        name: plot?.properties?.name || '未命名地块',
        type: landType,
        type_label: this.getPlotTypeLabel(landType),
        subtype: subtype,
        subtype_label: subtypeLabel,
        area: areaHa,
        geometry
      };
    }).filter(Boolean);

    const totalPlotArea = plots.reduce((sum, plot) => sum + (Number(plot.area) || 0), 0);
    const exportPayload = {
      id: this.areaId || this.areaData?.id || null,
      name: terrainName,
      risk_level: this.areaData?.risk_level || 'low',
      area: Number(this.areaData?.area) || Number(totalPlotArea.toFixed(4)),
      accuracy: this.areaData?.accuracy || 98,
      description: terrainDesc,
      bounds: buildBoundsFromGeoJSON(boundaryFeature),
      geometry: boundaryFeature,
      plots
    };

    const geojsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([geojsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terrain_export_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`地形 JSON 导出成功，已包含 ${plots.length} 个地块`);
  }

  getPlotColor(type) {
    const normalizedType = this.normalizePlotTypeKey(type);
    if (normalizedType && this.colorScheme[normalizedType]) return this.colorScheme[normalizedType];
    return this.colorScheme.selected;
  }

  normalizeRiskLevel(value) {
    const rawValue = String(value || '').trim();
    const mapping = {
      high: 'high',
      medium: 'medium',
      low: 'low',
      none: 'none',
      '高风险': 'high',
      '中风险': 'medium',
      '低风险': 'low',
      '未评估': 'none',
      '未标记': 'none',
      '高': 'high',
      '中': 'medium',
      '低': 'low',
      '普通': 'low',
      '一般': 'low',
      '': 'none'
    };
    return mapping[rawValue] || mapping[rawValue.toLowerCase?.()] || 'none';
  }

  getRiskDisplayLabel(value) {
    const mapping = {
      high: '高风险',
      medium: '中风险',
      low: '低风险',
      none: '未评估'
    };
    return mapping[this.normalizeRiskLevel(value)] || '未评估';
  }

  getRiskBorderColor(value) {
    const mapping = {
      high: '#dc2626',
      medium: '#ea580c',
      low: '#16a34a',
      none: '#64748b'
    };
    return mapping[this.normalizeRiskLevel(value)] || '#64748b';
  }

  getPlotStyle(typeOrProperties, isActive, isMultiSelected = false) {
    const properties = typeOrProperties && typeof typeOrProperties === 'object'
      ? typeOrProperties
      : { type: typeOrProperties };
    const fill = this.getPlotColor(properties.type);
    const riskBorder = this.getRiskBorderColor(properties.riskLevel);
    if (isActive) {
      return {
        color: riskBorder,
        weight: 4,
        opacity: 0.98,
        fillColor: fill,
        fillOpacity: 0.45,
        dashArray: '8 4'
      };
    }
    if (isMultiSelected) {
      return {
        color: riskBorder,
        weight: 4,
        opacity: 0.96,
        fillColor: fill,
        fillOpacity: 0.42,
        dashArray: '6 4'
      };
    }
    return {
      color: riskBorder,
      weight: 2,
      opacity: 0.92,
      fillColor: fill,
      fillOpacity: 0.35
    };
  }

  getCurrentPlotPropertiesFromForm() {
    const name = document.getElementById('plotName')?.value || '未命名地块';
    const type = document.getElementById('plotType')?.value || 'forest';
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
    const nextProperties = {
      ...(properties || {})
    };
    nextProperties.areaHa = this.calculateGeoJSONAreaHa(geojson, nextProperties.areaHa || 0);
    const id = `plot_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const layer = L.geoJSON(geojson, {
      style: this.getPlotStyle(nextProperties, false, false),
      interactive: this.currentTool === 'move-layer',
      renderer: this.canvasRenderer
    });
    this.layerManager.layerGroups.working.addLayer(layer);

    const plot = {
      id,
      db_id, // 允许传入数据库 ID
      geojson,
      gridData: gridData || { grid_size: 10, cells: [] },
      properties: nextProperties,
      visible: true,
      locked: false,
      layer
    };

    this.bindPlotSelectionEvents(plot);
    this.refreshPlotInteractivity();
    return plot;
  }

  // 提示添加标记
  async promptAddElement(plotId) {
    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot || !plot.db_id) {
      alert('请先保存地块再添加标记');
      return;
    }
    
    const name = prompt('请输入标记名称:', '新标记');
    if (!name) return;
    const type = prompt('请输入标记类型:', '观测点');
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
      console.error('添加标记异常:', e);
    }
  }

  // 删除标记
  async deleteElement(elementId, plotId) {
    if (!confirm('确定要删除该标记吗？')) return;
    
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
      console.error('删除标记异常:', e);
    }
  }

  // 彻底删除地块 (包括后端)
  async deletePlot(plotId) {
    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot) return;

    if (plot.db_id) {
      this.confirmAction(`确定要永久删除地块 "${plot.properties.name || '未命名'}" 吗？`, async () => {
        try {
          const response = await fetch(`/terrain/api/zones/${plot.db_id}/delete/`, {
            method: 'DELETE',
            headers: {
              'X-CSRFToken': this.getCookie('csrftoken')
            }
          });
          const result = await response.json();
          if (result.code !== 0) {
            this.alertAction('删除失败: ' + result.msg);
            return;
          }
          if (this.areaId) {
            sessionStorage.setItem('terrainRiskUpdated', String(this.areaId));
          }
          localStorage.setItem('terrain_plot_changed', '1');
          
          this._removePlotInternal(plotId);
          this.updateSelectedPlotsList();
          this.captureHistorySnapshot();
        } catch (e) {
          console.error('删除请求异常:', e);
          this.alertAction('删除异常: ' + e.message);
        }
      }, null, 'danger');
      return;
    }

    this._removePlotInternal(plotId);
    this.updateSelectedPlotsList();
    this.captureHistorySnapshot();
  }

  // 删除整个地形
  async deleteTerrain() {
    if (!this.areaId) {
      this.alertAction('当前地形尚未保存，无法删除。');
      return;
    }

    const terrainName = document.getElementById('terrainName')?.value || '当前地形';
    this.confirmAction(`确认要删除整个地形 "${terrainName}" 吗？\n删除后，该地形及其关联的所有地块将不可恢复。`, async () => {
      try {
        const response = await fetch(`/terrain/api/areas/${this.areaId}/delete/`, {
          method: 'POST',
          headers: {
            'X-CSRFToken': this.getCookie('csrftoken')
          }
        });
        const result = await response.json();
        if (result.code === 0) {
          this.alertAction('地形已成功删除');
          // 设置刷新标记并跳转
          localStorage.setItem('terrain_list_should_refresh', '1');
          window.location.href = '/terrain/';
        } else {
          this.alertAction('删除失败: ' + result.msg);
        }
      } catch (e) {
        console.error('删除地形异常:', e);
        this.alertAction('删除过程中发生异常，请检查网络。');
      }
    }, null, 'danger');
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
    this.refreshPlotInteractivity();
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
        plot.layer.setStyle(this.getPlotStyle(plot.properties, plot.id === this.activePlotId, this.multiSelectedPlotIds.has(plot.id)));
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
    const totalAreaEl = document.getElementById('totalArea');

    if (!this.userPlots.length) {
      if (totalAreaEl) totalAreaEl.textContent = '地形总面积: -';
      return;
    }

    // 计算地形内所有地块的总面积
    const totalAreaHa = this.userPlots.reduce((sum, p) => sum + (Number(p.properties?.areaHa) || 0), 0);
    if (totalAreaEl) totalAreaEl.textContent = `地形总面积: ${totalAreaHa.toFixed(2)} ha`;
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
    // 优化目的: 编辑态默认只保留当前 area 的 working layer，屏蔽历史/业务背景层回流。
    console.log('=== 开始加载地形数据 ===');
    console.log('数据内容:', data);

    this.addLayerGroups();
    this.clearManagedBackgroundLayers();

    const terrainFeatures = [];
    const businessBoundaries = [];
    const allLayers = [];
    const currentAreaId = this.getCurrentEditAreaId();
    const isEditMode = !!currentAreaId;

    const ensureBusinessBucket = (bucketName) => {
      if (!this.layers.business[bucketName]) {
        this.layers.business[bucketName] = L.featureGroup();
      }
      return this.layers.business[bucketName];
    };

    const registerBusinessLayer = (bucketName, polygon) => {
      const bucket = ensureBusinessBucket(bucketName);
      bucket.addLayer(polygon);
    };

    const registerLayerKey = (key) => {
      this.backgroundLayerKeys.push(key);
      return key;
    };

    const filterByCurrentArea = (items) => {
      if (!Array.isArray(items)) {
        return [];
      }
      if (!isEditMode) {
        return items;
      }
      return items.filter((item) => this.matchesCurrentArea(item, currentAreaId));
    };

    const terrainBoundaries = filterByCurrentArea(data?.terrainBoundaries);
    const riskAreas = filterByCurrentArea(data?.riskAreas);
    const noFlyZones = filterByCurrentArea(data?.noFlyZones);
    const forestAreas = filterByCurrentArea(data?.forestAreas);
    const farmAreas = filterByCurrentArea(data?.farmAreas);
    const existingPlots = filterByCurrentArea(data?.existingPlots);

    if (isEditMode) {
      console.log('编辑态已启用 area 过滤，仅保留当前 area 相关背景数据:', {
        currentAreaId,
        terrainBoundaries: terrainBoundaries.length,
        riskAreas: riskAreas.length,
        noFlyZones: noFlyZones.length,
        forestAreas: forestAreas.length,
        farmAreas: farmAreas.length,
        existingPlots: existingPlots.length
      });
    }

    if (!isEditMode && terrainBoundaries.length) {
      console.log('=== 加载地形边界 ===');
      console.log('地形边界数量:', terrainBoundaries.length);

      terrainBoundaries.forEach((boundary) => {
        const polygon = L.polygon(boundary.coordinates, {
          color: '#6c757d',
          weight: 2,
          fillColor: '#6c757d',
          fillOpacity: 0.3
        });
        polygon.bindPopup(`<strong>${boundary.name}</strong><br>类型: ${boundary.type}`);
        const layerKey = registerLayerKey(`terrain-${boundary.id}`);
        this.layerManager.addLayer(layerKey, polygon, 'base');
        this.layers.base.terrain = polygon;
        terrainFeatures.push(boundary);
        allLayers.push(polygon);
      });
    } else if (isEditMode && terrainBoundaries.length) {
      console.log('编辑态跳过 terrainBoundaries 地图渲染，避免当前地形外的边界回流');
    }

    if (!isEditMode && riskAreas.length) {
      console.log('=== 加载风险区域 ===');
      console.log('风险区域数量:', riskAreas.length);

      riskAreas.forEach((zone) => {
        const polygon = L.polygon(zone.coordinates, {
          color: '#dc3545',
          weight: 2,
          fillColor: '#dc3545',
          fillOpacity: 0.3
        });
        polygon.bindPopup(`<strong>${zone.name}</strong><br>风险等级: ${zone.level}`);
        const layerKey = registerLayerKey(`risk-${zone.id}`);
        this.layerManager.addLayer(layerKey, polygon, 'base');
        this.layers.base.risk = polygon;
        allLayers.push(polygon);
      });
    }

    if (!isEditMode && noFlyZones.length) {
      console.log('=== 加载禁飞区 ===');
      console.log('禁飞区数量:', noFlyZones.length);

      noFlyZones.forEach((zone) => {
        const polygon = L.polygon(zone.coordinates, {
          color: '#6f42c1',
          weight: 2,
          fillColor: '#6f42c1',
          fillOpacity: 0.3
        });
        polygon.bindPopup(`<strong>${zone.name}</strong><br>原因: ${zone.reason}`);
        const layerKey = registerLayerKey(`noFly-${zone.id}`);
        this.layerManager.addLayer(layerKey, polygon, 'base');
        this.layers.base.noFly = polygon;
        allLayers.push(polygon);
      });
    }

    if (!isEditMode && forestAreas.length) {
      console.log('=== 加载林区 ===');
      console.log('林区数量:', forestAreas.length);

      forestAreas.forEach((area) => {
        const polygon = L.polygon(area.coordinates, {
          color: '#198754',
          weight: 2,
          fillColor: '#198754',
          fillOpacity: 0.3
        });
        polygon.bindPopup(`<strong>${area.name}</strong><br>类型: ${area.type}`);
        const layerKey = registerLayerKey(`forest-${area.id}`);
        this.layerManager.addLayer(layerKey, polygon, 'business');
        registerBusinessLayer('forest', polygon);
        businessBoundaries.push(area);
        allLayers.push(polygon);
      });
    } else if (isEditMode && forestAreas.length) {
      businessBoundaries.push(...forestAreas);
    }

    if (!isEditMode && farmAreas.length) {
      console.log('=== 加载农田 ===');
      console.log('农田数量:', farmAreas.length);

      farmAreas.forEach((area) => {
        const polygon = L.polygon(area.coordinates, {
          color: '#fd7e14',
          weight: 2,
          fillColor: '#fd7e14',
          fillOpacity: 0.3
        });
        polygon.bindPopup(`<strong>${area.name}</strong><br>作物: ${area.crop}`);
        const layerKey = registerLayerKey(`farm-${area.id}`);
        this.layerManager.addLayer(layerKey, polygon, 'business');
        registerBusinessLayer('farm', polygon);
        businessBoundaries.push(area);
        allLayers.push(polygon);
      });
    } else if (isEditMode && farmAreas.length) {
      businessBoundaries.push(...farmAreas);
    }

    if (!isEditMode && existingPlots.length) {
      console.log('=== 加载现有地块 ===');
      console.log('现有地块数量:', existingPlots.length);

      existingPlots.forEach((plot) => {
        const polygon = L.polygon(plot.coordinates, {
          color: '#0d6efd',
          weight: 2,
          fillColor: '#0d6efd',
          fillOpacity: 0.3
        });
        polygon.bindPopup(`<strong>${plot.name}</strong><br>类型: ${plot.type}<br>面积: ${plot.area} 公顷<br>风险等级: ${plot.riskLevel}`);
        const layerKey = registerLayerKey(`plot-${plot.id}`);
        this.layerManager.addLayer(layerKey, polygon, 'business');
        registerBusinessLayer('plot', polygon);
        businessBoundaries.push(plot);
        allLayers.push(polygon);
      });
    } else if (isEditMode && existingPlots.length) {
      businessBoundaries.push(...existingPlots);
      console.log('编辑态仅保留当前 area 相关 existingPlots 作为内部数据，不渲染到地图');
    }

    if (this.smartSelection) {
      console.log('=== 传递数据给智能选区 ===');
      console.log('地形特征数量:', terrainFeatures.length);
      console.log('业务边界数量:', businessBoundaries.length);

      this.smartSelection.loadTerrainFeatures(terrainFeatures);
      this.smartSelection.loadBusinessBoundaries(businessBoundaries);
    }

    if (!isEditMode && allLayers.length > 0) {
      console.log('=== 调整地图视野 ===');
      const bounds = L.latLngBounds();
      allLayers.forEach((layer) => {
        if (layer.getBounds) {
          bounds.extend(layer.getBounds());
        }
      });

      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [50, 50] });
      }
    } else if (isEditMode) {
      console.log('编辑态跳过 allLayers 全局视野，保留当前地块聚焦结果');
    }
  }

  // 按模式应用初始视野
  applyInitialViewportByMode(mode, terrainData = null, options = {}) {
    // 优化目的: 编辑态优先使用真实地块 bounds，其次 boundary_json 弱兜底，再次中心点，最后回退重庆全域。
    const runInNextFrame = (callback) => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(callback);
      } else {
        setTimeout(callback, 16);
      }
    };

    if (mode !== 'edit') {
      this.updateMapViewport(terrainData?.area?.boundary_json || terrainData?.boundary_json || null);
      return;
    }

    const attempt = Number(options.attempt || 0);
    const container = this.map?.getContainer ? this.map.getContainer() : null;
    const containerWidth = container?.offsetWidth || 0;
    const containerHeight = container?.offsetHeight || 0;

    if ((!containerWidth || !containerHeight) && attempt < 5) {
      setTimeout(() => {
        runInNextFrame(() => {
          this.applyInitialViewportByMode(mode, terrainData, {
            ...options,
            attempt: attempt + 1
          });
        });
      }, 80);
      return;
    }

    const cqBounds = L.latLngBounds(this.viewportConfig.chongqingBounds);
    const paddingY = Math.max(20, ((1 - this.viewportConfig.targetHeightRatio) / 2) * (containerHeight || 600));
    const paddingX = Math.max(20, ((1 - this.viewportConfig.targetWidthRatio) / 2) * (containerWidth || 900));
    const cqMinZoom = this.map.getBoundsZoom(cqBounds, false, [paddingX, paddingY]);

    this.map.setMinZoom(cqMinZoom);
    this.map.setMaxZoom(18);
    this.map.setMaxBounds(cqBounds.pad(0.2));

    const parseJson = (value) => {
      let current = value;
      for (let i = 0; i < 3 && typeof current === 'string'; i += 1) {
        try {
          current = JSON.parse(current);
        } catch (_) {
          break;
        }
      }
      return current;
    };

    const mercatorToLngLat = (x, y) => {
      const lng = (x / 20037508.34) * 180;
      let lat = (y / 20037508.34) * 180;
      lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
      return [lng, lat];
    };

    const convertCoordinates = (coordinates) => {
      if (!Array.isArray(coordinates)) return coordinates;
      if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
        const x = Number(coordinates[0]);
        const y = Number(coordinates[1]);
        if (Number.isFinite(x) && Number.isFinite(y) && (Math.abs(x) > 180 || Math.abs(y) > 90)) {
          return mercatorToLngLat(x, y);
        }
        return [x, y];
      }
      return coordinates.map((item) => convertCoordinates(item));
    };

    const normalizeGeoJSON = (value) => {
      const parsed = parseJson(value);
      if (!parsed) return null;

      if (parsed.type === 'FeatureCollection') {
        return {
          ...parsed,
          features: Array.isArray(parsed.features) ? parsed.features.map((feature) => normalizeGeoJSON(feature)).filter(Boolean) : []
        };
      }

      if (parsed.type === 'Feature') {
        if (!parsed.geometry) return null;
        return {
          ...parsed,
          geometry: normalizeGeoJSON(parsed.geometry)
        };
      }

      if (parsed.type && Array.isArray(parsed.coordinates)) {
        return {
          ...parsed,
          coordinates: convertCoordinates(parsed.coordinates)
        };
      }

      return null;
    };

    const createBoundsFromGeoJSON = (geojson) => {
      if (!geojson) return null;
      try {
        const layer = L.geoJSON(geojson);
        const bounds = layer.getBounds();
        return bounds.isValid() ? bounds : null;
      } catch (_) {
        return null;
      }
    };

    const getRenderedPlotBounds = () => {
      const bounds = L.latLngBounds();
      this.userPlots.forEach((plot) => {
        if (plot?.visible !== false && plot?.layer?.getBounds) {
          const plotBounds = plot.layer.getBounds();
          if (plotBounds?.isValid()) {
            bounds.extend(plotBounds);
          }
        }
      });
      return bounds.isValid() ? bounds : null;
    };

    const applyBounds = (bounds) => {
      const zoom = Math.max(cqMinZoom, this.map.getBoundsZoom(bounds, false, [paddingX, paddingY]));
      this.map.setView(bounds.getCenter(), zoom, { animate: false });
    };

    const renderedBounds = getRenderedPlotBounds();
    if (renderedBounds) {
      applyBounds(renderedBounds);
      return;
    }

    const zones = Array.isArray(terrainData?.zones) ? terrainData.zones : [];
    const zoneBounds = L.latLngBounds();
    zones.forEach((zone) => {
      const zoneGeoJSON = normalizeGeoJSON(zone?.geom_json || zone?.geometry || zone?.geojson || null);
      const bounds = createBoundsFromGeoJSON(zoneGeoJSON);
      if (bounds) {
        zoneBounds.extend(bounds);
      }
    });
    if (zoneBounds.isValid()) {
      applyBounds(zoneBounds);
      return;
    }

    const boundaryGeoJSON = normalizeGeoJSON(
      terrainData?.area?.boundary_json ||
      terrainData?.area?.boundary ||
      terrainData?.boundary_json ||
      null
    );
    const boundaryBounds = createBoundsFromGeoJSON(boundaryGeoJSON);
    if (boundaryBounds) {
      applyBounds(boundaryBounds);

      if (options.retry !== false && attempt < 4) {
        setTimeout(() => {
          runInNextFrame(() => {
            this.applyInitialViewportByMode(mode, terrainData, {
              ...options,
              attempt: attempt + 1
            });
          });
        }, 140 + attempt * 120);
      }
      return;
    }

    const centerLat = Number(terrainData?.area?.center_lat);
    const centerLng = Number(terrainData?.area?.center_lng);
    if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
      this.map.setView([centerLat, centerLng], Math.max(cqMinZoom, 12), { animate: false });
      return;
    }

    this.map.setView(cqBounds.getCenter(), cqMinZoom, { animate: false });
  }

  /**
   * 切换原始边界图层的可见性
   * @param {boolean} show 是否显示
   */
  toggleOriginalBoundaryLayer(show) {
    this.showOriginalBoundary = false;
    this.clearOriginalBoundaryLayer();
  }
  
  // 切换底图
  switchBasemap(basemap) {
    if (basemap === this.currentBasemap && this.activeBaseLayer) return;
    
    // 移除当前底图实例
    if (this.activeBaseLayer) {
      this.map.removeLayer(this.activeBaseLayer);
    }
    
    // 获取新底图实例
    const newLayer = window.getBaseLayer(basemap);
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
      satellite: '卫星底图',
      grayscale: '标准底图',
      topographic: '等高线底图'
    };
    
    const basemapName = basemapNames[basemap] || '底图';
    
    // 更新侧边栏显示
    const currentBasemapSidebarElement = document.getElementById('currentBasemapNameSidebar');
    if (currentBasemapSidebarElement) {
      currentBasemapSidebarElement.textContent = basemapName;
    }
    
    // 更新侧边栏下拉菜单active状态
    document.querySelectorAll('#basemapDropdownSidebarContainer .dropdown-item[data-basemap]').forEach(item => {
      if (item.getAttribute('data-basemap') === basemap) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // 根据底图模式禁用/启用辅助图层
    this.updateAdminBoundaryAvailability(basemap);
    this.updateTopographicAssistAvailability(basemap);
  }

  /**
   * 根据当前底图模式更新行政区划边界的可用性
   * @param {string} basemap 当前底图模式
   */
  updateAdminBoundaryAvailability(basemap) {
    const isSatellite = this.isAdminBoundaryAvailable(basemap);
    const adminControl = document.getElementById('adminBoundaryControl');
    const toggle = document.getElementById('adminBoundaryToggle');
    const slider = document.getElementById('adminBoundarySlider');

    if (toggle) {
      toggle.checked = this.adminBoundaryEnabled === true;
      toggle.disabled = !isSatellite;
    }

    if (slider) {
      slider.disabled = !isSatellite || this.adminBoundaryEnabled !== true;
      slider.style.cursor = slider.disabled ? 'not-allowed' : 'pointer';
    }

    if (adminControl) {
      if (!isSatellite) {
        adminControl.classList.add('text-muted', 'disabled-item', 'is-disabled');
        adminControl.style.opacity = '0.6';
        adminControl.title = '行政区划边界仅在卫星底图模式下可用';
      } else {
        adminControl.classList.remove('text-muted', 'disabled-item', 'is-disabled');
        adminControl.style.opacity = '1';
        adminControl.title = '叠加显示行政区划边界，便于结合卫星影像识别空间层级';
      }
    }

    this.syncAdminBoundarySliderUI();
    this.applyAdminBoundaryVisibility();
  }

  /**
   * 根据当前底图模式更新等高线参考叠加层的可用性
   * @param {string} basemap 当前底图模式
   */
  updateTopographicAssistAvailability(basemap) {
    const isSatellite = basemap === 'satellite';
    const topoToggle = document.getElementById('topographicAssistToggle');
    const topoSlider = document.getElementById('topographicAssistOpacity');
    const topoControl = document.getElementById('topographicAssistControl');

    if (!topoToggle) return;

    topoToggle.disabled = !isSatellite;

    if (topoControl) {
      if (!isSatellite) {
        topoControl.classList.add('text-muted', 'disabled-item');
        topoControl.style.opacity = '0.6';
        topoControl.title = '等高线参考层仅在卫星底图模式下可用';
      } else {
        topoControl.classList.remove('text-muted', 'disabled-item');
        topoControl.style.opacity = '1';
        topoControl.title = '叠加等高线参考层，便于结合卫星影像判读地形';
      }
    }

    if (topoSlider) {
      topoSlider.disabled = !isSatellite || !topoToggle.checked;
      topoSlider.style.cursor = topoSlider.disabled ? 'not-allowed' : 'pointer';
    }

    if (!isSatellite) {
      this.toggleTopographicAssist(false);
    } else if (topoToggle.checked) {
      this.toggleTopographicAssist(true);
    }
  }

  // --- 新增功能实现 ---

  // 处理新建地块图层
  async handleCreateNewZone() {
    if (this.activePlotId) {
      await this.checkAndSplitDisjointPartsLocally(this.activePlotId);
    }

    this.ensureCreateZoneModalBound();

    const modal = this.getCreateZoneModalInstance();
    const categorySelect = document.getElementById('createZoneCategorySelect');
    const nameInput = document.getElementById('createZoneNameInput');
    if (!modal || !categorySelect || !nameInput) return;

    const defaults = this.getDefaultNewZoneConfig();
    this._createZoneDefaultRiskLevel = defaults.riskLevel;
    this._createZoneNameManuallyEdited = false;
    this._lastCreateZoneAutoName = '';

    categorySelect.value = defaults.type;
    await this.populateCreateZoneSubtypeOptions(defaults.type, defaults.subType);
    this.updateCreateZoneNameSuggestion(true);
    modal.show();
  }

  getDefaultNewZoneConfig() {
    let defaultType = 'forest';
    let defaultSubtype = '';
    let defaultRiskLevel = 'low';

    if (this.activePlotId) {
      const activePlot = this.userPlots.find(p => p.id === this.activePlotId);
      if (activePlot && activePlot.properties) {
        defaultType = activePlot.properties.type || 'forest';
        defaultSubtype = activePlot.properties.subType || '';
        defaultRiskLevel = activePlot.properties.riskLevel || 'low';
      }
    } else {
      // 尝试从当前表单获取作为次优先级
      defaultType = document.getElementById('plotType')?.value || 'forest';
      defaultSubtype = document.getElementById('plotSubType')?.value || '';
      defaultRiskLevel = document.getElementById('riskLevel')?.value || 'low';
    }

    return {
      type: defaultType,
      subType: defaultSubtype,
      riskLevel: defaultRiskLevel
    };
  }

  async handleMergeZones() {
    const ids = Array.from(this.multiSelectedPlotIds);
    if (ids.length < 2) return;

    const plotsToMerge = this.userPlots.filter(p => ids.includes(p.id));
    
    // 校验：锁定的地块不能合并
    if (plotsToMerge.some(p => p.locked)) {
      this.showAlert('选中的地块中有被锁定的项，无法合并。', '操作受限', 'warning');
      return;
    }

    if (!confirm(`确定要合并选中的 ${ids.length} 个地块吗？`)) return;

    try {
      let mergedGeoJSON = JSON.parse(JSON.stringify(plotsToMerge[0].geojson));
      let mergedCells = [];
      const cellMap = new Map();

      plotsToMerge.forEach((plot, index) => {
        // 合并几何 (GeoJSON)
        if (index > 0) {
          const unionResult = turf.union(mergedGeoJSON, plot.geojson);
          if (unionResult) {
            mergedGeoJSON = unionResult;
          }
        }

        // 合并网格数据 (Pixel Cells)
        if (plot.gridData && plot.gridData.cells) {
          plot.gridData.cells.forEach(cell => {
            const key = `${cell.x},${cell.y}`;
            if (!cellMap.has(key)) {
              cellMap.set(key, { ...cell });
            }
          });
        }
      });

      mergedCells = Array.from(cellMap.values());

      // 获取第一个地块的属性作为基准
      const firstPlot = plotsToMerge[0];
      const newProperties = {
        ...firstPlot.properties,
        name: `${firstPlot.properties.name}_合并`,
        areaHa: 0 // 稍后重新计算
      };
      
      const newGridData = {
        grid_size: 10,
        cells: mergedCells
      };

      // 移除旧地块
      plotsToMerge.forEach(p => {
        if (p.layer) this.layerManager.layerGroups.working.removeLayer(p.layer);
      });
      this.userPlots = this.userPlots.filter(p => !ids.includes(p.id));

      // 创建并添加合并后的新地块
      const newPlot = this.createPlotFromGeoJSON(mergedGeoJSON, newProperties, newGridData);
      
      // 重新计算面积
      const rings = this.getLatLngRingsFromLayer(newPlot.layer);
      if (rings && rings.length > 0) {
        newPlot.properties.areaHa = this.calculateArea(rings[0]);
      }

      this.userPlots.push(newPlot);
      
      this.multiSelectedPlotIds.clear();
      this.selectPlot(newPlot.id);
      this.captureHistorySnapshot();
      this.updateSelectedArea();
      this.updateSelectedPlotsList();
      
      this.showAlert('地块合并成功。', '操作成功', 'success');
    } catch (e) {
      console.error('本地合并异常:', e);
      this.showAlert('合并操作失败，请检查控制台。', '操作失败', 'danger');
    }
  }

  async handleBooleanSubtract() {
    const ids = Array.from(this.multiSelectedPlotIds);
    if (ids.length !== 2) {
      this.showAlert('请选择恰好两个地块进行布尔减法操作（第一个选中的减去第二个）。', '提示', 'info');
      return;
    }

    const plotA = this.userPlots.find(p => p.id === ids[0]);
    const plotB = this.userPlots.find(p => p.id === ids[1]);

    if (plotA.locked || plotB.locked) {
      this.showAlert('涉及的地块已被锁定，无法执行布尔运算。', '操作受限', 'warning');
      return;
    }

    if (!confirm(`将执行：${plotA.properties.name} 减去 ${plotB.properties.name}。确定吗？`)) return;

    try {
      // 1. 几何减法
      const diffResult = turf.difference(plotA.geojson, plotB.geojson);
      
      if (!diffResult) {
        this.showAlert('布尔减法结果为空，操作已取消。', '提示', 'warning');
        return;
      }

      // 2. 网格减法 (Pixel Cells)
      if (plotA.gridData && plotA.gridData.cells && plotB.gridData && plotB.gridData.cells) {
        const bCellKeys = new Set(plotB.gridData.cells.map(c => `${c.x},${c.y}`));
        plotA.gridData.cells = plotA.gridData.cells.filter(c => !bCellKeys.has(`${c.x},${c.y}`));
      }

      // 3. 更新 A 地块
      plotA.geojson = diffResult;
      
      // 重新构建图层并计算面积
      this.rebuildPlotLayer(plotA);
      const rings = this.getLatLngRingsFromLayer(plotA.layer);
      if (rings && rings.length > 0) {
        plotA.properties.areaHa = this.calculateArea(rings[0]);
      }

      this.multiSelectedPlotIds.clear();
      this.selectPlot(plotA.id);
      this.captureHistorySnapshot();
      this.updateSelectedArea();
      this.updateSelectedPlotsList();
      
      this.showAlert('布尔减法执行成功。', '操作成功', 'success');
    } catch (e) {
      console.error('本地布尔运算异常:', e);
      this.showAlert('布尔运算失败，请检查控制台。', '操作失败', 'danger');
    }
  }

  async handleSplitZone(plotId = null) {
    const targetId = plotId || this.activePlotId;
    const plot = this.userPlots.find(p => p.id === targetId);
    if (!plot) return;

    if (!plot.db_id) {
      await this.checkAndSplitDisjointPartsLocally(targetId);
      return;
    }

    const shouldSplit = await this.showDisjointSplitConfirm(plot, this.getDisjointRegionCount(plot.geojson));
    if (!shouldSplit) return;

    try {
      const response = await fetch(`/terrain/api/zones/${plot.db_id}/split/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': this.getCookie('csrftoken') }
      });
      const result = await response.json();
      if (result.code === 0) {
        await this.loadAreaEditDetail(this.areaId);
      } else {
        alert('拆分失败: ' + result.msg);
      }
    } catch (e) {
      console.error('拆分异常:', e);
    }
  }

  async checkAndSplitDisjointPartsLocally(plotId) {
    const plot = this.userPlots.find(p => p.id === plotId);
    if (!plot || !plot.geojson || typeof turf === 'undefined') return false;

    const geom = plot.geojson.geometry || plot.geojson;
    if (geom.type !== 'MultiPolygon' || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
      return false;
    }

    const polygons = geom.coordinates.map(coords => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: coords },
      properties: {}
    }));

    const shouldSplit = await this.showDisjointSplitConfirm(plot, polygons.length);
    if (!shouldSplit) return false;

    this._removePlotInternal(plotId);
    const createdPlots = [];
    polygons.forEach((poly, i) => {
      const newPlot = this.createPlotFromGeoJSON(poly, {
        ...plot.properties,
        name: `${this.getPlotDisplayName(plot)}_拆分_${i + 1}`
      });
      this.userPlots.push(newPlot);
      createdPlots.push(newPlot);
    });

    this.captureHistorySnapshot();
    this.updateSelectedArea();
    if (createdPlots.length > 0) {
      this.activePlotId = createdPlots[0].id;
      this.selectPlot(createdPlots[0].id);
    } else {
      this.updateSelectedPlotsList();
    }

    return true;
  }

  getDisjointRegionCount(geojson) {
    const geom = geojson?.geometry || geojson;
    if (!geom || geom.type !== 'MultiPolygon' || !Array.isArray(geom.coordinates)) {
      return 0;
    }

    return geom.coordinates.length;
  }

  async fetchSubCategories(category, forceRefresh = false) {
    const normalizedCategory = this.normalizePlotTypeKey(category);
    if (!normalizedCategory) return [];
    if (!forceRefresh && Array.isArray(this.subcategoryOptionsByCategory[normalizedCategory])) {
      return this.subcategoryOptionsByCategory[normalizedCategory];
    }

    try {
      const response = await fetch(`/terrain/api/zones/subcategories/?category=${normalizedCategory}&area_id=${this.areaId || ''}`);
      const result = await response.json();
      if (result.code === 0 && result.data) {
        this.subcategoryOptionsByCategory[normalizedCategory] = result.data.subcategories || [];
        return this.subcategoryOptionsByCategory[normalizedCategory];
      }
    } catch (e) {
      console.error('加载子类别失败:', e);
    }

    this.subcategoryOptionsByCategory[normalizedCategory] = [];
    return [];
  }

  async loadSubCategories(selectedValue = null, categoryOverride = null) {
    const category = this.normalizePlotTypeKey(categoryOverride || document.getElementById('plotType')?.value);
    if (!category) return;

    const subcategories = await this.fetchSubCategories(category);
    this.renderSubCategoryDropdown(subcategories, selectedValue);
  }

  // 统一地块类型和子类型联动设置方法
  async setPlotCategoryAndLoadSubcategories(category, selectedSubcategory = '') {
    category = this.normalizePlotTypeKey(category);
    const plotTypeInput = document.getElementById('plotType');
    const subTypeGroup = document.getElementById('subTypeGroup');
    
    if (plotTypeInput && category) {
      plotTypeInput.value = category;
      if (subTypeGroup) subTypeGroup.style.display = 'block';
      
      // 更新自定义下拉菜单 UI
      this.updatePlotTypeUI(category);
    }
    
    // 等待子类型加载完成并回填
    await this.loadSubCategories(selectedSubcategory, category);
  }

  /**
   * 更新自定义地块类型下拉菜单的 UI 状态
   * @param {string} category 选中的地块类型值
   */
  updatePlotTypeUI(category) {
    category = this.normalizePlotTypeKey(category);
    const dropdownMenu = document.getElementById('plotTypeDropdownMenu');
    const selectedNameSpan = document.getElementById('selectedPlotTypeName');
    if (!dropdownMenu || !selectedNameSpan) return;

    // 1. 更新下拉项的激活状态
    const items = dropdownMenu.querySelectorAll('.dropdown-item');
    let foundItem = null;
    items.forEach(item => {
      if (item.getAttribute('data-value') === category) {
        item.classList.add('active');
        foundItem = item;
      } else {
        item.classList.remove('active');
      }
    });

    // 2. 同步更新按钮显示内容（颜色方块 + 文本）
    if (foundItem) {
      const colorBox = foundItem.querySelector('.layer-color').cloneNode(true);
      const text = foundItem.textContent.trim();
      
      selectedNameSpan.innerHTML = '';
      selectedNameSpan.appendChild(colorBox);
      const textSpan = document.createElement('span');
      textSpan.textContent = text;
      selectedNameSpan.appendChild(textSpan);
    }
  }

  showSubCategoryDescription(name, description, anchorElement = null) {
    const preview = document.getElementById('subTypeDescriptionPreview');
    if (!preview) return;
    if (preview.parentElement !== document.body) {
      document.body.appendChild(preview);
    }

    const titleEl = preview.querySelector('.subcat-desc-title');
    const bodyEl = preview.querySelector('.subcat-desc-body');
    if (!titleEl || !bodyEl) return;

    const cleanDescription = typeof description === 'string' ? description.trim() : '';
    titleEl.textContent = name || '子类别说明';

    if (cleanDescription) {
      bodyEl.textContent = cleanDescription;
      bodyEl.classList.remove('subcat-desc-empty');
    } else {
      bodyEl.textContent = '无说明';
      bodyEl.classList.add('subcat-desc-empty');
    }

    if (anchorElement) {
      const anchorRect = anchorElement.getBoundingClientRect();
      const previewWidth = Math.min(240, window.innerWidth - 24);
      const horizontalGap = 12;
      const preferLeftOffset = anchorRect.left - previewWidth - horizontalGap;
      const preferRightOffset = anchorRect.right + horizontalGap;
      const topOffset = Math.max(12, Math.min(anchorRect.top - 4, window.innerHeight - 120));
      const leftOffset = preferLeftOffset >= 12
        ? preferLeftOffset
        : Math.min(
            Math.max(12, preferRightOffset),
            Math.max(12, window.innerWidth - previewWidth - 12)
          );

      preview.style.top = `${topOffset}px`;
      preview.style.left = `${leftOffset}px`;
    } else {
      preview.style.top = '12px';
      preview.style.left = '12px';
    }

    preview.classList.add('show');
    preview.setAttribute('aria-hidden', 'false');
  }

  hideSubCategoryDescription() {
    const preview = document.getElementById('subTypeDescriptionPreview');
    if (!preview) return;

    preview.classList.remove('show');
    preview.setAttribute('aria-hidden', 'true');
    preview.style.left = '';
    preview.style.top = '';
  }

  renderSubCategoryDropdown(subcategories, selectedValue = null) {
    const dropdownMenu = document.getElementById('subTypeDropdownMenu');
    const selectedNameSpan = document.getElementById('selectedSubTypeName');
    const subTypeHiddenInput = document.getElementById('plotSubType');
    const dropdownBtn = document.getElementById('subTypeDropdownBtn');
    if (!dropdownMenu) return;

    this.hideSubCategoryDescription();
    if (dropdownBtn && !dropdownBtn.dataset.descPreviewBound) {
      dropdownBtn.addEventListener('hide.bs.dropdown', () => this.hideSubCategoryDescription());
      dropdownBtn.dataset.descPreviewBound = 'true';
    }

    // 清空现有列表
    dropdownMenu.innerHTML = '';

    // 1. 添加“清除选择”项
    const clearLi = document.createElement('li');
    const clearLink = document.createElement('a');
    clearLink.className = 'dropdown-item small text-muted';
    clearLink.href = 'javascript:void(0)';
    clearLink.textContent = '清除选择';
    clearLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.selectSubCategory('');
    });
    clearLi.appendChild(clearLink);
    dropdownMenu.appendChild(clearLi);
    dropdownMenu.appendChild(document.createElement('li')).innerHTML = '<hr class="dropdown-divider m-1">';
    dropdownMenu.onmouseleave = () => this.hideSubCategoryDescription();

    // 2. 动态渲染子类别项
    if (subcategories && subcategories.length > 0) {
      subcategories.forEach(item => {
        const li = document.createElement('li');
        li.className = 'subcat-item-wrapper';

        const itemRow = document.createElement('div');
        itemRow.className = `subcat-item ${selectedValue === item.name ? 'active' : ''}`;
        itemRow.addEventListener('click', () => this.selectSubCategory(item.name));
        itemRow.addEventListener('mouseenter', () => {
          this.showSubCategoryDescription(item.name, item.description || '', itemRow);
        });
        itemRow.addEventListener('focusin', () => {
          this.showSubCategoryDescription(item.name, item.description || '', itemRow);
        });

        const nameWrapper = document.createElement('div');
        nameWrapper.className = 'subcat-name-wrapper';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        nameWrapper.appendChild(nameSpan);

        const countSpan = document.createElement('small');
        countSpan.className = 'text-muted ms-1';
        countSpan.textContent = `(${item.count_area}/${item.count_db})`;
        nameWrapper.appendChild(countSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'subcat-delete-btn';
        deleteBtn.title = `删除 ${item.name}`;
        deleteBtn.setAttribute('aria-label', `删除 ${item.name}`);
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          this.handleDeleteSubCategory(item.id, item.name);
        });

        itemRow.appendChild(nameWrapper);
        itemRow.appendChild(deleteBtn);
        li.appendChild(itemRow);
        dropdownMenu.appendChild(li);
      });
    } else {
      const emptyLi = document.createElement('li');
      emptyLi.innerHTML = `<span class="dropdown-item-text small text-muted text-center">无子类别，请新增</span>`;
      dropdownMenu.appendChild(emptyLi);
    }

    // 3. 更新当前选中状态显示
    if (selectedValue) {
      if (selectedNameSpan) selectedNameSpan.textContent = selectedValue;
      if (subTypeHiddenInput) subTypeHiddenInput.value = selectedValue;
    } else {
      if (selectedNameSpan) selectedNameSpan.textContent = '请选择或新增';
      if (subTypeHiddenInput) subTypeHiddenInput.value = '';
    }
  }

  selectSubCategory(name) {
    const selectedNameSpan = document.getElementById('selectedSubTypeName');
    const subTypeHiddenInput = document.getElementById('plotSubType');
    this.hideSubCategoryDescription();

    if (selectedNameSpan) selectedNameSpan.textContent = name || '请选择或新增';
    if (subTypeHiddenInput) {
      subTypeHiddenInput.value = name;
      // 手动触发 change 事件，以便 editor.js 中的监听器能捕获到
      const event = new Event('change', { bubbles: true });
      subTypeHiddenInput.dispatchEvent(event);
    }

    // 更新当前激活地块的属性
    this.updateActivePlotProperties({ subType: name });
    
    // 重新渲染下拉列表以更新 active 样式
    this.loadSubCategories(name);
  }

  getSubCategoryModalInstance() {
    const modalEl = document.getElementById('subCategoryModal');
    if (!modalEl || typeof bootstrap === 'undefined') {
      return null;
    }

    return bootstrap.Modal.getOrCreateInstance(modalEl);
  }

  getDisjointSplitModalInstance() {
    const modalEl = document.getElementById('disjointSplitModal');
    if (!modalEl || typeof bootstrap === 'undefined') {
      return null;
    }

    return bootstrap.Modal.getOrCreateInstance(modalEl);
  }

  ensureDisjointSplitModalBound() {
    if (this._disjointSplitModalBound) return;

    const modalEl = document.getElementById('disjointSplitModal');
    const confirmBtn = document.getElementById('confirmDisjointSplitBtn');
    if (!modalEl || !confirmBtn) {
      return;
    }

    confirmBtn.addEventListener('click', () => {
      this._disjointSplitModalConfirmed = true;
      const modal = this.getDisjointSplitModalInstance();
      if (modal) modal.hide();
    });

    modalEl.addEventListener('hidden.bs.modal', () => {
      const resolver = this._pendingDisjointSplitResolver;
      const confirmed = this._disjointSplitModalConfirmed === true;

      this._pendingDisjointSplitResolver = null;
      this._disjointSplitModalConfirmed = false;

      if (typeof resolver === 'function') {
        resolver(confirmed);
      }
    });

    this._disjointSplitModalBound = true;
  }

  showDisjointSplitConfirm(plot, regionCount = 0) {
    const plotName = this.getPlotDisplayName(plot);
    const fallbackMessage = Number.isFinite(regionCount) && regionCount > 1
      ? `检测到当前地块“${plotName}”包含 ${regionCount} 个不相连区域，是否拆分为 ${regionCount} 个独立图层？`
      : `检测到当前地块“${plotName}”包含不相连区域，是否拆分为多个独立图层？`;

    this.ensureDisjointSplitModalBound();

    const modal = this.getDisjointSplitModalInstance();
    const subtitleEl = document.getElementById('disjointSplitModalSubtitle');
    const messageEl = document.getElementById('disjointSplitModalMessage');
    if (!modal || !messageEl) {
      return Promise.resolve(window.confirm(fallbackMessage));
    }

    if (subtitleEl) {
      subtitleEl.textContent = `当前地块：${plotName}`;
    }
    messageEl.textContent = fallbackMessage;

    if (typeof this._pendingDisjointSplitResolver === 'function') {
      this._pendingDisjointSplitResolver(false);
      this._pendingDisjointSplitResolver = null;
    }

    this._disjointSplitModalConfirmed = false;

    return new Promise(resolve => {
      this._pendingDisjointSplitResolver = resolve;
      modal.show();
    });
  }

  getCreateZoneModalInstance() {
    const modalEl = document.getElementById('createZoneModal');
    if (!modalEl || typeof bootstrap === 'undefined') {
      return null;
    }

    return bootstrap.Modal.getOrCreateInstance(modalEl);
  }

  ensureCreateZoneModalBound() {
    if (this._createZoneModalBound) return;

    const modalEl = document.getElementById('createZoneModal');
    const formEl = document.getElementById('createZoneForm');
    const categorySelect = document.getElementById('createZoneCategorySelect');
    const subtypeSelect = document.getElementById('createZoneSubtypeSelect');
    const nameInput = document.getElementById('createZoneNameInput');
    const confirmBtn = document.getElementById('confirmCreateZoneBtn');

    if (!modalEl || !formEl || !categorySelect || !subtypeSelect || !nameInput || !confirmBtn) {
      return;
    }

    formEl.addEventListener('submit', this.submitCreateZoneForm.bind(this));
    categorySelect.addEventListener('change', async () => {
      await this.populateCreateZoneSubtypeOptions(categorySelect.value, '');
      this.updateCreateZoneNameSuggestion();
    });
    nameInput.addEventListener('input', () => {
      const currentName = nameInput.value.trim();
      this._createZoneNameManuallyEdited = currentName !== '' && currentName !== this._lastCreateZoneAutoName;
      this.updateCreateZoneNameHint();
    });
    modalEl.addEventListener('shown.bs.modal', () => {
      nameInput.focus();
      nameInput.select();
    });
    modalEl.addEventListener('hidden.bs.modal', () => {
      formEl.reset();
      formEl.classList.remove('was-validated');
      
      const subtypeMenu = document.getElementById('createZoneSubtypeDropdownMenu');
      const subtypeBtn = document.getElementById('createZoneSubtypeDropdownBtn');
      const selectedNameSpan = document.getElementById('createZoneSubtypeSelectedName');
      const subtypeHiddenInput = document.getElementById('createZoneSubtypeSelect');
      
      if (subtypeMenu) subtypeMenu.innerHTML = '<li><span class="dropdown-item-text small text-muted text-center">请选择子类型</span></li>';
      if (selectedNameSpan) selectedNameSpan.textContent = '请选择子类型';
      if (subtypeHiddenInput) subtypeHiddenInput.value = '';
      if (subtypeBtn) subtypeBtn.disabled = false;
      
      this.hideSubCategoryDescription();
      confirmBtn.disabled = false;
      this._createZoneDefaultRiskLevel = 'low';
      this._createZoneNameManuallyEdited = false;
      this._lastCreateZoneAutoName = '';
      this.updateCreateZoneNameHint();
    });

    this._createZoneModalBound = true;
  }

  async populateCreateZoneSubtypeOptions(category, preferredSubtype = '') {
    const subtypeMenu = document.getElementById('createZoneSubtypeDropdownMenu');
    const subtypeBtn = document.getElementById('createZoneSubtypeDropdownBtn');
    const selectedNameSpan = document.getElementById('createZoneSubtypeSelectedName');
    const subtypeHiddenInput = document.getElementById('createZoneSubtypeSelect');
    
    if (!subtypeMenu || !subtypeBtn || !selectedNameSpan || !subtypeHiddenInput) return '';

    const subcategories = await this.fetchSubCategories(category);
    subtypeMenu.innerHTML = '';
    
    // 绑定隐藏提示的逻辑
    if (!subtypeBtn.dataset.descPreviewBound) {
      subtypeBtn.addEventListener('hide.bs.dropdown', () => this.hideSubCategoryDescription());
      subtypeBtn.dataset.descPreviewBound = 'true';
    }
    subtypeMenu.onmouseleave = () => this.hideSubCategoryDescription();

    if (subcategories.length > 0) {
      subcategories.forEach(item => {
        const li = document.createElement('li');
        li.className = 'subcat-item-wrapper';

        const itemRow = document.createElement('div');
        itemRow.className = `subcat-item ${preferredSubtype === item.name ? 'active' : ''}`;
        itemRow.style.padding = '8px 12px';
        itemRow.style.cursor = 'pointer';
        
        itemRow.addEventListener('click', (e) => {
          e.preventDefault();
          this.selectCreateZoneSubCategory(item.name);
        });
        
        itemRow.addEventListener('mouseenter', () => {
          this.showSubCategoryDescription(item.name, item.description || '', itemRow);
        });
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        itemRow.appendChild(nameSpan);
        
        li.appendChild(itemRow);
        subtypeMenu.appendChild(li);
      });
      subtypeBtn.disabled = false;
    } else {
      const li = document.createElement('li');
      li.innerHTML = '<span class="dropdown-item-text small text-muted text-center">暂不设置子类型</span>';
      subtypeMenu.appendChild(li);
      subtypeBtn.disabled = true;
    }

    const hasPreferred = subcategories.some(item => item.name === preferredSubtype);
    const selectedSubtype = hasPreferred ? preferredSubtype : (subcategories[0]?.name || '');
    
    this.selectCreateZoneSubCategory(selectedSubtype, false); // 不触发名称更新建议，避免循环
    return selectedSubtype;
  }

  // 新增：处理新建图层弹窗中的子类别选择
  selectCreateZoneSubCategory(name, triggerUpdate = true) {
    const selectedNameSpan = document.getElementById('createZoneSubtypeSelectedName');
    const subtypeHiddenInput = document.getElementById('createZoneSubtypeSelect');
    const subtypeMenu = document.getElementById('createZoneSubtypeDropdownMenu');
    
    if (selectedNameSpan) selectedNameSpan.textContent = name || '暂不设置子类型';
    if (subtypeHiddenInput) {
      const oldVal = subtypeHiddenInput.value;
      subtypeHiddenInput.value = name;
      if (triggerUpdate && oldVal !== name) {
        this.updateCreateZoneNameSuggestion();
      }
    }

    // 更新菜单中的 active 状态
    if (subtypeMenu) {
      const items = subtypeMenu.querySelectorAll('.subcat-item');
      items.forEach(item => {
        const itemText = item.querySelector('span')?.textContent || '';
        if (name && itemText === name) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }
    
    this.hideSubCategoryDescription();
  }

  buildDefaultPlotName(category, subtype = '') {
    const categoryName = this.getCategoryDisplayName(category);
    const baseName = subtype ? `${categoryName}-${subtype}` : `${categoryName}`;
    const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const namePattern = new RegExp(`^${escapedBaseName}-(\\d+)(?:$|_拆分_\\d+$)`);
    let maxIndex = 0;

    this.userPlots.forEach(plot => {
      const plotName = (plot.properties?.name || '').trim();
      const match = plotName.match(namePattern);
      if (!match) return;

      const currentIndex = parseInt(match[1], 10);
      if (Number.isFinite(currentIndex) && currentIndex > maxIndex) {
        maxIndex = currentIndex;
      }
    });

    return `${baseName}-${String(maxIndex + 1).padStart(2, '0')}`;
  }

  updateCreateZoneNameSuggestion(forceReplace = false) {
    const categorySelect = document.getElementById('createZoneCategorySelect');
    const subtypeSelect = document.getElementById('createZoneSubtypeSelect');
    const nameInput = document.getElementById('createZoneNameInput');
    if (!categorySelect || !subtypeSelect || !nameInput) return;

    const suggestedName = this.buildDefaultPlotName(categorySelect.value, subtypeSelect.value);
    const currentName = nameInput.value.trim();
    const shouldReplace = forceReplace || !currentName || !this._createZoneNameManuallyEdited || currentName === this._lastCreateZoneAutoName;

    this._lastCreateZoneAutoName = suggestedName;
    if (shouldReplace) {
      nameInput.value = suggestedName;
      this._createZoneNameManuallyEdited = false;
    }

    this.updateCreateZoneNameHint();
  }

  updateCreateZoneNameHint() {
    const hintEl = document.getElementById('createZoneNameHint');
    if (!hintEl) return;

    if (this._lastCreateZoneAutoName) {
      hintEl.textContent = `默认名称建议：${this._lastCreateZoneAutoName}。你也可以手动修改为更符合业务场景的名称。`;
    } else {
      hintEl.textContent = '系统将根据当前类型与子类型自动生成默认名称，你也可以手动修改。';
    }
  }

  async submitCreateZoneForm(event) {
    event.preventDefault();

    const formEl = document.getElementById('createZoneForm');
    const categorySelect = document.getElementById('createZoneCategorySelect');
    const subtypeSelect = document.getElementById('createZoneSubtypeSelect');
    const nameInput = document.getElementById('createZoneNameInput');
    const confirmBtn = document.getElementById('confirmCreateZoneBtn');
    const modal = this.getCreateZoneModalInstance();

    if (!formEl || !categorySelect || !subtypeSelect || !nameInput || !confirmBtn || !modal) {
      return;
    }

    const name = nameInput.value.trim();
    if (!name) {
      formEl.classList.add('was-validated');
      nameInput.focus();
      return;
    }

    confirmBtn.disabled = true;

    const properties = {
      name,
      type: categorySelect.value || 'forest',
      subType: subtypeSelect.value || '',
      riskLevel: this._createZoneDefaultRiskLevel || 'low',
      description: '',
      areaHa: 0
    };

    const plot = this.createPlotFromGeoJSON({ type: 'Feature', geometry: null, properties: {} }, properties);
    this.userPlots.push(plot);
    this.activePlotId = plot.id;
    this.applyPlotOrder();
    this.captureHistorySnapshot();
    this.updateSelectedArea();
    this.updateSelectedPlotsList();
    modal.hide();
    this.selectPlot(plot.id);
  }

  ensureSubCategoryModalBound() {
    if (this._subCategoryModalBound) return;

    const modalEl = document.getElementById('subCategoryModal');
    const formEl = document.getElementById('subCategoryForm');
    const nameInput = document.getElementById('subCategoryNameInput');
    const descInput = document.getElementById('subCategoryDescriptionInput');
    const categoryInput = document.getElementById('subCategoryModalCategory');
    const saveBtn = document.getElementById('saveSubCategoryBtn');

    if (!modalEl || !formEl || !nameInput || !descInput || !categoryInput || !saveBtn) {
      return;
    }

    formEl.addEventListener('submit', this.submitAddSubCategoryForm.bind(this));
    modalEl.addEventListener('shown.bs.modal', () => {
      nameInput.focus();
      nameInput.select();
    });
    modalEl.addEventListener('hidden.bs.modal', () => {
      formEl.reset();
      formEl.classList.remove('was-validated');
      categoryInput.value = '';
      saveBtn.disabled = false;
    });

    this._subCategoryModalBound = true;
  }

  getCategoryDisplayName(category) {
    const categoryMap = {
      forest: '林区',
      farmland: '农田',
      building: '建筑',
      water: '水域',
      road: '道路',
      bare_land: '裸地'
    };
    return categoryMap[this.normalizePlotTypeKey(category)] || category;
  }

  getCurrentCategoryDisplayName(category) {
    const activeItem = document.querySelector('#plotTypeDropdownMenu .dropdown-item.active');
    if (activeItem) {
      return activeItem.textContent.trim();
    }

    return this.getCategoryDisplayName(category);
  }

  getSubCategoryExampleData(category) {
    const categoryItems = this.subcategoryOptionsByCategory[category];
    const firstItem = Array.isArray(categoryItems) ? categoryItems.find(item => item && item.name) : null;

    if (firstItem) {
      return {
        name: firstItem.name,
        description: (firstItem.description || '').trim()
      };
    }

    const fallbackMap = {
      forest: {
        name: '针叶林',
        description: '以松、杉等针叶树种为主的林地，树冠形态较整齐，常见于山地或人工培育区域。'
      },
      farmland: {
        name: '普通农田',
        description: '常规耕作农田，主要用于粮食或经济作物种植，地块形态相对规则。'
      },
      building: {
        name: '民房',
        description: '以居住功能为主的普通房屋建筑，多分布于村庄或居民点内部。'
      },
      water: {
        name: '河流',
        description: '天然形成、持续流动的地表水体，具有较稳定的主河道形态。'
      },
      road: {
        name: '主干道',
        description: '承担主要交通组织功能的道路，通行等级和承载能力较高。'
      },
      bare_land: {
        name: '施工裸地',
        description: '受施工、堆放或临时扰动影响形成的裸露地表区域，植被覆盖较少。'
      }
    };

    return fallbackMap[category] || {
      name: '针叶林',
      description: '以松、杉等针叶树种为主的林地，树冠形态较整齐，常见于山地或人工培育区域。'
    };
  }

  handleAddSubCategory() {
    const category = document.getElementById('plotType')?.value;
    if (!category) {
      alert('请先选择地块大类');
      return;
    }

    this.ensureSubCategoryModalBound();

    const modalEl = document.getElementById('subCategoryModal');
    const titleEl = document.getElementById('subCategoryModalLabel');
    const subtitleEl = document.getElementById('subCategoryModalSubtitle');
    const categoryTagEl = document.getElementById('subCategoryModalCategoryTag');
    const categoryInput = document.getElementById('subCategoryModalCategory');
    const nameInput = document.getElementById('subCategoryNameInput');
    const descInput = document.getElementById('subCategoryDescriptionInput');
    const descExampleEl = document.getElementById('subCategoryDescriptionExample');
    const modal = this.getSubCategoryModalInstance();
    const categoryName = this.getCurrentCategoryDisplayName(category);
    const exampleData = this.getSubCategoryExampleData(category);
    const namePlaceholder = `如：${exampleData.name}`;
    const descExampleText = exampleData.description || '暂无示例说明';

    if (!modalEl || !titleEl || !subtitleEl || !categoryTagEl || !categoryInput || !nameInput || !descInput || !descExampleEl || !modal) {
      return;
    }

    titleEl.innerHTML = `新增 <span class="subcat-modal-category-tag" id="subCategoryModalCategoryTag">${categoryName}</span> 子类别`;
    subtitleEl.textContent = `为${categoryName}补充新的子类别名称与说明`;
    categoryInput.value = category;
    nameInput.value = '';
    nameInput.placeholder = namePlaceholder;
    descInput.value = '';
    descExampleEl.textContent = `示例：${descExampleText}`;
    modal.show();
  }

  async submitAddSubCategoryForm(event) {
    event.preventDefault();

    const formEl = document.getElementById('subCategoryForm');
    const categoryInput = document.getElementById('subCategoryModalCategory');
    const nameInput = document.getElementById('subCategoryNameInput');
    const descInput = document.getElementById('subCategoryDescriptionInput');
    const saveBtn = document.getElementById('saveSubCategoryBtn');
    const modal = this.getSubCategoryModalInstance();

    if (!formEl || !categoryInput || !nameInput || !descInput || !saveBtn || !modal) {
      return;
    }

    const category = categoryInput.value;
    const name = nameInput.value.trim();
    const description = descInput.value.trim();

    if (!name) {
      formEl.classList.add('was-validated');
      nameInput.focus();
      return;
    }

    saveBtn.disabled = true;

    try {
      const response = await fetch('/terrain/api/subcategories/add/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.getCookie('csrftoken') },
        body: JSON.stringify({
          category,
          name: name.trim(),
          description,
          area_id: this.areaId
        })
      });
      const result = await response.json();
      if (result.code === 0) {
        delete this.subcategoryOptionsByCategory[category];
        modal.hide();
        await this.loadSubCategories(name.trim(), category);
        this.selectSubCategory(name.trim());
      } else {
        alert('新增失败: ' + result.msg);
        saveBtn.disabled = false;
      }
    } catch (e) {
      console.error('新增子类别异常:', e);
      alert('新增子类别异常，请稍后重试');
      saveBtn.disabled = false;
    }
  }

  async handleDeleteSubCategory(id, name) {
    if (!confirm(`确认删除子类别 "${name}" 吗？\n该操作将移除此分类记录，且相关统计数据将更新。`)) return;

    try {
      const response = await fetch('/terrain/api/subcategories/delete/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.getCookie('csrftoken') },
        body: JSON.stringify({ id })
      });
      const result = await response.json();
      if (result.code === 0) {
        const currentCategory = document.getElementById('plotType')?.value;
        if (currentCategory) {
          delete this.subcategoryOptionsByCategory[currentCategory];
        }
        // 如果当前选中的正是被删除的项，则清除选择
        const subTypeHiddenInput = document.getElementById('plotSubType');
        if (subTypeHiddenInput && subTypeHiddenInput.value === name) {
          this.selectSubCategory('');
        } else {
          // 否则只需刷新列表
          this.loadSubCategories(subTypeHiddenInput ? subTypeHiddenInput.value : null);
        }
      } else {
        alert('删除失败: ' + result.msg);
      }
    } catch (e) {
      console.error('删除子类别异常:', e);
    }
  }

  // ==========================================
  // 通用交互提示方法 (基于 NiceAdmin 风格)
  // ==========================================
  
  // 替代 alert
  showAlert(message, title = '提示', type = 'info') {
    if (typeof window.showAlert === 'function') {
      window.showAlert(message, title, type);
    } else {
      alert(message);
    }
  }

  // 兼容旧方法
  alertAction(message) {
    this.showAlert(message);
  }

  // 替代 confirm
  confirmAction(message, onConfirm, onCancel, type = 'info') {
    if (typeof window.showConfirm === 'function') {
      window.showConfirm(message, onConfirm, onCancel, '确认操作', type);
    } else {
      if (confirm(message)) {
        if (onConfirm) onConfirm();
      } else {
        if (onCancel) onCancel();
      }
    }
  }

  // 替代 prompt
  promptAction(message, defaultValue, onConfirm) {
    if (typeof window.showPrompt === 'function') {
      window.showPrompt(message, defaultValue, onConfirm);
    } else {
      const result = prompt(message, defaultValue);
      if (onConfirm) onConfirm(result);
    }
  }

  calculateGeoJSONAreaHa(geojson, fallback = 0) {
    const fallbackValue = Number(fallback) || 0;
    if (!geojson || typeof turf === 'undefined') {
      return fallbackValue;
    }

    const feature = geojson?.geometry
      ? geojson
      : ((geojson?.type === 'Polygon' || geojson?.type === 'MultiPolygon')
        ? { type: 'Feature', geometry: geojson, properties: {} }
        : null);

    if (!feature?.geometry) {
      return fallbackValue;
    }

    try {
      return Number((turf.area(feature) / 10000).toFixed(2));
    } catch (error) {
      console.warn('地块面积计算失败，回退到现有面积值:', error);
      return fallbackValue;
    }
  }

  syncPlotArea(plot) {
    if (!plot) return 0;
    if (!plot.properties) {
      plot.properties = {};
    }

    const areaHa = this.calculateGeoJSONAreaHa(plot.geojson, plot.properties.areaHa || 0);
    plot.properties.areaHa = areaHa;
    return areaHa;
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
