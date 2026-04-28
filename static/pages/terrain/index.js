// 地形管理页面逻辑

const terrainData = {
  terrains: [],
  filteredTerrains: [],
  riskAreas: [],
  surveys: [],
  currentTerrain: null,
  appliedFilters: {
    name: '',
    riskLevel: '',
    timeRange: 'all'
  },
  hasActiveFilters: false,
  emptyStateMessage: '当前没有可展示的地形区域，请稍后刷新。'
};

let terrainMap;
const vueInstances = {};
let terrainLayoutObserver = null;
let terrainPanelResizeObserver = null;
let terrainElasticHeightRaf = 0;
let terrainFilterDebounceTimer = 0;

const TERRAIN_PLOT_TYPE_LABELS = {
  forest: '林区',
  farmland: '农田',
  building: '建筑',
  water: '水域',
  road: '道路',
  bare_land: '裸地'
};

const TERRAIN_PLOT_TYPE_ALIASES = {
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

function initPage() {
  if (localStorage.getItem('terrain_list_should_refresh') === '1') {
    localStorage.removeItem('terrain_list_should_refresh');
  }

  initVue();
  syncTerrainMainLayoutBySidebarState();
  bindTerrainMainLayoutSidebarSync();
  bindTerrainLayoutResizeSync();

  terrainMap = new TerrainMap('terrainMap');
  terrainMap.init();

  resetDetailPanel();
  initFilterForm();
  initTables();
  initEvents();
  loadRealData();
}

function translateRiskLevel(level) {
  const mapping = {
    high: '高风险',
    medium: '中风险',
    low: '低风险'
  };
  return mapping[level] || '未评估';
}

function getRiskBadgeClass(level) {
  const mapping = {
    high: 'risk-high',
    medium: 'risk-medium',
    low: 'risk-low'
  };
  return mapping[level] || 'risk-low';
}

function getTerrainSpatialUtils() {
  return window.TerrainSpatialUtils || {};
}

function coerceNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function isValidLatLng(lat, lng) {
  const utils = getTerrainSpatialUtils();
  if (typeof utils.isValidLatLng === 'function') {
    return utils.isValidLatLng(lat, lng);
  }
  return Number.isFinite(lat) && Number.isFinite(lng) && !(Math.abs(lat) < 1e-9 && Math.abs(lng) < 1e-9);
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
}

function normalizeTerrainPlotTypeKey(value) {
  const rawValue = String(value || '').trim();
  return TERRAIN_PLOT_TYPE_ALIASES[rawValue] || TERRAIN_PLOT_TYPE_ALIASES[rawValue.toLowerCase?.()] || '';
}

function getTerrainPlotTypeLabel(value) {
  const typeKey = normalizeTerrainPlotTypeKey(value);
  return TERRAIN_PLOT_TYPE_LABELS[typeKey] || String(value || '').trim() || '未分类';
}

function parseTerrainJson(value) {
  let current = value;
  for (let i = 0; i < 3 && typeof current === 'string'; i += 1) {
    try {
      current = JSON.parse(current);
    } catch (_) {
      return value;
    }
  }
  return current;
}

function normalizeTerrainPlotGeometry(geometry, extraProperties = {}) {
  const parsedGeometry = parseTerrainJson(geometry);
  if (!parsedGeometry || typeof parsedGeometry !== 'object') {
    return null;
  }

  if (parsedGeometry.type === 'Feature') {
    return {
      ...parsedGeometry,
      properties: {
        ...(parsedGeometry.properties || {}),
        ...extraProperties
      }
    };
  }

  if (parsedGeometry.type === 'Polygon' || parsedGeometry.type === 'MultiPolygon') {
    return {
      type: 'Feature',
      geometry: parsedGeometry,
      properties: { ...extraProperties }
    };
  }

  return null;
}

function normalizeTerrainPlots(rawItem) {
  const rawPlots = [
    rawItem?.plots,
    rawItem?.blocks,
    rawItem?.layers,
    rawItem?.features,
    rawItem?.plot_data
  ].find(candidate => Array.isArray(parseTerrainJson(candidate)) && parseTerrainJson(candidate).length) || [];

  const parsedPlots = parseTerrainJson(rawPlots);
  if (!Array.isArray(parsedPlots)) {
    return [];
  }

  return parsedPlots.map((plot, index) => {
    const typeKey = normalizeTerrainPlotTypeKey(
      plot?.type
      || plot?.plot_type
      || plot?.category
      || plot?.properties?.type
      || plot?.type_label
    );
    const geometry = normalizeTerrainPlotGeometry(
      plot?.geometry || plot?.geom_json || plot?.boundary_geojson || plot?.boundary_json,
      {
        name: plot?.name || plot?.properties?.name || `地块 ${index + 1}`,
        type: typeKey || 'bare_land',
        type_label: getTerrainPlotTypeLabel(typeKey || plot?.type_label),
        subtype: plot?.subtype || plot?.sub_type || plot?.subcategory || '',
        subtype_label: plot?.subtype_label || plot?.subcategory_name || plot?.sub_type || plot?.subcategory || ''
      }
    );

    if (!geometry || !typeKey) {
      return null;
    }

    return {
      id: plot?.id ?? null,
      name: plot?.name || plot?.properties?.name || `地块 ${index + 1}`,
      type: typeKey,
      type_label: getTerrainPlotTypeLabel(plot?.type_label || typeKey),
      subtype: plot?.subtype || plot?.sub_type || plot?.subcategory || '',
      subtype_label: plot?.subtype_label || plot?.subcategory_name || plot?.sub_type || plot?.subcategory || '',
      area: coerceNumber(plot?.area) ?? 0,
      geometry
    };
  }).filter(Boolean);
}

function requestTerrainMapResize() {
  if (!terrainMap?.map) {
    return;
  }

  window.requestAnimationFrame(() => {
    if (terrainMap?.map) {
      terrainMap.map.invalidateSize();
    }
  });

  window.setTimeout(() => {
    if (terrainMap?.map) {
      terrainMap.map.invalidateSize();
    }
  }, 260);
}

function getTerrainSidebarState() {
  if (!document.body) {
    return 'expanded';
  }
  return document.body.classList.contains('toggle-sidebar') ? 'collapsed' : 'expanded';
}

function applyTerrainMainLayoutBootstrapCols(sidebarState) {
  const listPanel = document.getElementById('terrainListPanel');
  const topicPanel = document.getElementById('terrainTopicPanel');

  if (!listPanel || !topicPanel) {
    return;
  }

  listPanel.classList.remove('col-lg-5', 'col-lg-6', 'col-lg-7');
  topicPanel.classList.remove('col-lg-5', 'col-lg-6', 'col-lg-7');

  if (sidebarState === 'collapsed') {
    listPanel.classList.add('col-lg-5');
    topicPanel.classList.add('col-lg-7');
    return;
  }

  listPanel.classList.add('col-lg-5');
  topicPanel.classList.add('col-lg-7');
}

function syncTerrainMainLayoutBySidebarState() {
  const layout = document.getElementById('terrainMainLayout') || document.querySelector('.terrain-main-layout');
  if (!layout) {
    return;
  }

  const nextState = getTerrainSidebarState();
  const changed = layout.dataset.sidebarState !== nextState;
  layout.dataset.sidebarState = nextState;
  applyTerrainMainLayoutBootstrapCols(nextState);

  if (changed) {
    requestTerrainMapResize();
  }
  scheduleTerrainDetailElasticHeightSync();
}

function bindTerrainMainLayoutSidebarSync() {
  if (terrainLayoutObserver || !document.body) {
    return;
  }

  terrainLayoutObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        syncTerrainMainLayoutBySidebarState();
        break;
      }
    }
  });

  terrainLayoutObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });
}

function runAfterTerrainLayoutRender(callback) {
  const invoke = () => window.requestAnimationFrame(() => {
    window.requestAnimationFrame(callback);
  });

  if (window.Vue?.nextTick) {
    window.Vue.nextTick(invoke);
    return;
  }

  invoke();
}

function scheduleTerrainDetailElasticHeightSync() {
  if (terrainElasticHeightRaf) {
    window.cancelAnimationFrame(terrainElasticHeightRaf);
  }

  terrainElasticHeightRaf = window.requestAnimationFrame(() => {
    terrainElasticHeightRaf = 0;
    runAfterTerrainLayoutRender(syncTerrainDetailElasticHeight);
  });
}

function syncTerrainDetailElasticHeight() {
  const listCard = document.getElementById('terrainListCard');
  const topicCard = document.getElementById('terrainTopicCard');
  const descriptionBlock = document.getElementById('terrainDescriptionBlock');

  if (!listCard || !topicCard || !descriptionBlock) {
    return;
  }

  const computedStyles = window.getComputedStyle(descriptionBlock);
  const baseMinHeight = Number(descriptionBlock.dataset.baseMinHeight)
    || Math.max(
      Math.ceil(parseFloat(computedStyles.minHeight) || 0),
      0
    );

  if (!descriptionBlock.dataset.baseMinHeight) {
    descriptionBlock.dataset.baseMinHeight = String(baseMinHeight);
  }

  descriptionBlock.style.minHeight = `${baseMinHeight}px`;

  const leftHeight = Math.ceil(listCard.getBoundingClientRect().height);
  const rightHeight = Math.ceil(topicCard.getBoundingClientRect().height);
  const heightDiff = leftHeight - rightHeight;

  if (heightDiff > 0) {
    descriptionBlock.style.minHeight = `${baseMinHeight + heightDiff}px`;
  }
}

function bindTerrainLayoutResizeSync() {
  window.addEventListener('resize', scheduleTerrainDetailElasticHeightSync, { passive: true });

  if (terrainPanelResizeObserver || typeof window.ResizeObserver !== 'function') {
    return;
  }

  const resizeTargets = [
    document.getElementById('terrainListCard'),
    document.getElementById('terrainTopicCard'),
    document.getElementById('terrainInfoPanel')
  ].filter(Boolean);

  if (!resizeTargets.length) {
    return;
  }

  terrainPanelResizeObserver = new ResizeObserver(() => {
    scheduleTerrainDetailElasticHeightSync();
  });

  resizeTargets.forEach(target => terrainPanelResizeObserver.observe(target));
}

function formatCoordinate(value) {
  const numeric = coerceNumber(value);
  return Number.isFinite(numeric) ? numeric.toFixed(5) : '-';
}

function buildBBoxObject(raw) {
  const minLng = coerceNumber(raw?.bbox_min_lng ?? raw?.minLng);
  const minLat = coerceNumber(raw?.bbox_min_lat ?? raw?.minLat);
  const maxLng = coerceNumber(raw?.bbox_max_lng ?? raw?.maxLng);
  const maxLat = coerceNumber(raw?.bbox_max_lat ?? raw?.maxLat);

  if (!isValidLatLng(minLat, minLng) || !isValidLatLng(maxLat, maxLng)) {
    return null;
  }
  if (minLng === maxLng || minLat === maxLat) {
    return null;
  }

  return { minLng, minLat, maxLng, maxLat };
}

function formatArea(area) {
  const numericArea = coerceNumber(area);
  if (!isPositiveNumber(numericArea)) {
    return '-';
  }
  return `${numericArea.toFixed(numericArea >= 100 ? 1 : 2)} 公顷`;
}

function formatDateTime(value) {
  if (!value) {
    return '暂无更新记录';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatCenterLabel(lat, lng) {
  const numericLat = coerceNumber(lat);
  const numericLng = coerceNumber(lng);
  if (!isValidLatLng(numericLat, numericLng)) {
    return '待补定位';
  }
  return `${numericLat.toFixed(5)}, ${numericLng.toFixed(5)}`;
}

function standardizeTerrainRecord(rawItem) {
  const utils = getTerrainSpatialUtils();
  const plots = normalizeTerrainPlots(rawItem);
  const boundaryGeoJSON = pickFirstDefined(rawItem.boundary_geojson, rawItem.boundary_json, rawItem.boundary, rawItem.geometry);
  const normalizedBoundary = typeof utils.normalizeGeoJSON === 'function'
    ? utils.normalizeGeoJSON(boundaryGeoJSON)
    : boundaryGeoJSON;

  const rawBBox = buildBBoxObject({
    bbox_min_lng: rawItem.bbox_min_lng,
    bbox_min_lat: rawItem.bbox_min_lat,
    bbox_max_lng: rawItem.bbox_max_lng,
    bbox_max_lat: rawItem.bbox_max_lat
  });
  const derivedBBox = !rawBBox && typeof utils.getBBoxFromGeoJSON === 'function'
    ? buildBBoxObject(utils.getBBoxFromGeoJSON(normalizedBoundary))
    : null;
  const bbox = rawBBox || derivedBBox;

  let centerLat = coerceNumber(pickFirstDefined(rawItem.center_lat, rawItem.center?.[0]));
  let centerLng = coerceNumber(pickFirstDefined(rawItem.center_lng, rawItem.center?.[1]));
  if (!isValidLatLng(centerLat, centerLng) && bbox) {
    centerLat = (bbox.minLat + bbox.maxLat) / 2;
    centerLng = (bbox.minLng + bbox.maxLng) / 2;
  }

  let areaHa = coerceNumber(pickFirstDefined(
    rawItem.area_ha,
    rawItem.total_area,
    rawItem.area,
    rawItem.areaHa,
    rawItem.totalArea
  ));
  if (!isPositiveNumber(areaHa) && normalizedBoundary && typeof utils.getAreaHaFromGeoJSON === 'function') {
    areaHa = utils.getAreaHaFromGeoJSON(normalizedBoundary);
  }
  const plotCount = Math.max(plots.length, Number(pickFirstDefined(rawItem.plot_count, 0)) || 0);
  const hasBoundary = Boolean(rawItem.has_boundary ?? normalizedBoundary ?? bbox);

  return {
    id: rawItem.id,
    name: pickFirstDefined(rawItem.name, '未命名地形'),
    area_ha: isPositiveNumber(areaHa) ? areaHa : null,
    risk_level: pickFirstDefined(rawItem.risk_level, 'low'),
    updated_at: rawItem.updated_at || rawItem.created_at || null,
    description: rawItem.description || '',
    boundary_geojson: normalizedBoundary,
    bbox_min_lng: bbox?.minLng ?? null,
    bbox_min_lat: bbox?.minLat ?? null,
    bbox_max_lng: bbox?.maxLng ?? null,
    bbox_max_lat: bbox?.maxLat ?? null,
    bbox,
    plots,
    plot_count: plotCount,
    data_accuracy: pickFirstDefined(rawItem.data_accuracy, '待补充'),
    has_boundary: hasBoundary,
    center_lat: isValidLatLng(centerLat, centerLng) ? centerLat : null,
    center_lng: isValidLatLng(centerLat, centerLng) ? centerLng : null
  };
}

function normalizeTerrainItem(item) {
  const standardized = standardizeTerrainRecord(item);
  const bbox = standardized.bbox || {
    minLng: null,
    minLat: null,
    maxLng: null,
    maxLat: null
  };

  return {
    ...standardized,
    area: standardized.area_ha,
    areaLabel: formatArea(standardized.area_ha),
    riskLabel: translateRiskLevel(standardized.risk_level),
    riskLevelRaw: standardized.risk_level,
    riskClass: getRiskBadgeClass(standardized.risk_level),
    boundary_json: standardized.boundary_geojson,
    plots: standardized.plots,
    center: isValidLatLng(standardized.center_lat, standardized.center_lng)
      ? [standardized.center_lat, standardized.center_lng]
      : null,
    centerLabel: formatCenterLabel(standardized.center_lat, standardized.center_lng),
    updatedAtLabel: formatDateTime(standardized.updated_at),
    plotCount: standardized.plot_count,
    plotCountLabel: `${standardized.plot_count} 个地块`,
    hasBoundary: standardized.has_boundary,
    dataAccuracyLabel: standardized.data_accuracy ? `${standardized.data_accuracy}` : '待补充',
    bbox: {
      minLng: formatCoordinate(bbox.minLng),
      minLat: formatCoordinate(bbox.minLat),
      maxLng: formatCoordinate(bbox.maxLng),
      maxLat: formatCoordinate(bbox.maxLat),
      raw: standardized.bbox
    }
  };
}

function updateTerrainListCount(count, total = terrainData.terrains.length) {
  const countNode = document.getElementById('terrainListCount');
  if (countNode) {
    countNode.textContent = terrainData.hasActiveFilters ? `${count} / ${total} 条` : `${count} 条`;
  }
}

function updateMapSelectionHint(terrain, options = {}) {
  const {
    emptyMessage = '当前未选中地形，请从左侧列表选择。'
  } = options;
  const hintNode = document.getElementById('terrainMapSelectionHint');
  const titleNode = document.getElementById('terrainMapTitle');
  if (!hintNode || !titleNode) {
    return;
  }

  if (!terrain) {
    titleNode.textContent = '当前地形专题';
    hintNode.textContent = emptyMessage;
    return;
  }

  titleNode.textContent = `当前地形：${terrain.name}`;
  if (terrain.hasBoundary) {
    hintNode.innerHTML = `<span class="terrain-map-selection-chip">${terrain.name}</span> 已按真实边界加载专题与混合地块`;
    return;
  }

  if (terrain.center) {
    hintNode.innerHTML = `<span class="terrain-map-selection-chip">${terrain.name}</span> 缺少边界数据，当前仅保留中心点参考`;
    return;
  }

  hintNode.innerHTML = `<span class="terrain-map-selection-chip">${terrain.name}</span> 缺少有效空间数据，地图保持当前视图`;
}

function getTerrainById(terrainId) {
  return terrainData.terrains.find(item => String(item.id) === String(terrainId)) || null;
}

async function selectTerrainRow(terrainId, options = {}) {
  const {
    syncMap = true,
    fit = true,
    openPopup = false
  } = options;

  const terrain = getTerrainById(terrainId);
  if (!terrain) {
    return;
  }

  terrainData.currentTerrain = terrain;
  updateDetailPanel(terrain);
  updateMapSelectionHint(terrain);
  setTerrainEditButtonDisabled(false);

  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.selectedTerrainId = terrain.id;
  }

  if (syncMap && terrainMap) {
    await terrainMap.selectTerrain(terrain, {
      emitEvent: false,
      fit,
      openPopup
    });
  }

  scheduleTerrainDetailElasticHeightSync();
}

function clearCurrentSelection(options = {}) {
  const {
    preserveMap = false,
    emptyMessage = '当前未选中地形，请从左侧列表选择。'
  } = options;
  terrainData.currentTerrain = null;
  updateMapSelectionHint(null, { emptyMessage });
  resetDetailPanel();
  setTerrainEditButtonDisabled(true);

  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.selectedTerrainId = null;
  }

  if (!preserveMap && terrainMap) {
    terrainMap.clearCurrentTopic();
  }

  scheduleTerrainDetailElasticHeightSync();
}

async function syncDefaultTerrainSelection(options = {}) {
  const {
    preserveMapWhenEmpty = false,
    emptyMessage = '当前未选中地形，请从左侧列表选择。'
  } = options;
  const sourceTerrains = terrainData.hasActiveFilters ? terrainData.filteredTerrains : terrainData.terrains;
  if (!sourceTerrains.length) {
    clearCurrentSelection({
      preserveMap: preserveMapWhenEmpty,
      emptyMessage
    });
    return;
  }

  const page = vueInstances.terrainTable ? vueInstances.terrainTable.currentPage : 1;
  const pageSize = vueInstances.terrainTable ? vueInstances.terrainTable.pageSize : 10;
  const pageStart = (page - 1) * pageSize;
  const currentPageTerrains = sourceTerrains.slice(pageStart, pageStart + pageSize);
  if (!currentPageTerrains.length) {
    clearCurrentSelection({
      preserveMap: preserveMapWhenEmpty,
      emptyMessage
    });
    return;
  }

  const preservedId = terrainData.currentTerrain?.id;
  let targetTerrain = currentPageTerrains.find(item => String(item.id) === String(preservedId));
  if (!targetTerrain) {
    targetTerrain = currentPageTerrains[0];
  }

  await selectTerrainRow(targetTerrain.id, {
    syncMap: true,
    fit: true,
    openPopup: false
  });
}

async function loadRealData() {
  try {
    const response = await fetch('/terrain/api/areas/');
    const result = await response.json();

    if (result.code !== 0) {
      console.error('加载区域数据失败:', result.message);
      return;
    }

    terrainData.terrains = Array.isArray(result.data) ? result.data.map(normalizeTerrainItem) : [];
    terrainData.filteredTerrains = [...terrainData.terrains];

    if (terrainMap) {
      terrainMap.loadTerrains(terrainData.terrains);
    }

    updateEmptyStateMessage();
    if (terrainData.hasActiveFilters) {
      await applyFilters();
      return;
    }

    updatePageData();
    await syncDefaultTerrainSelection();
    scheduleTerrainDetailElasticHeightSync();
  } catch (error) {
    console.error('请求区域数据异常:', error);
  }
}

function setAppliedFilters(filters) {
  terrainData.appliedFilters = {
    name: filters.name || '',
    riskLevel: filters.riskLevel || '',
    timeRange: filters.timeRange || 'all'
  };
  terrainData.hasActiveFilters = hasActiveFilters(terrainData.appliedFilters);
}

function getFilterValues() {
  return {
    name: document.getElementById('terrainName').value.trim().toLowerCase(),
    riskLevel: document.getElementById('filterRiskLevel').value,
    timeRange: document.getElementById('timeRange').value
  };
}

function hasActiveFilters(filters) {
  return Boolean(
    filters.name
    || filters.riskLevel
    || (filters.timeRange && filters.timeRange !== 'all')
  );
}

function updateFilterSummary() {
  const summaryNode = document.getElementById('terrainFilterSummary');
  const badgeNode = document.getElementById('terrainFilterStateBadge');
  if (summaryNode) {
    summaryNode.textContent = `共 ${terrainData.terrains.length} 条，当前显示 ${terrainData.filteredTerrains.length} 条`;
  }
  if (badgeNode) {
    badgeNode.classList.toggle('d-none', !terrainData.hasActiveFilters);
  }
}

function updateEmptyStateMessage() {
  terrainData.emptyStateMessage = terrainData.hasActiveFilters
    ? '未找到符合条件的地形'
    : '当前没有可展示的地形区域，请稍后刷新。';
}

function setTerrainEditButtonDisabled(disabled) {
  const editBtn = document.getElementById('editTerrainMapBtn');
  if (editBtn) {
    editBtn.disabled = disabled;
  }
}

function resetDetailPanel() {
  const placeholders = {
    infoName: '-',
    infoArea: '-',
    infoAccuracy: '-',
    infoUpdatedAt: '-',
    infoPlotCount: '-',
    infoBboxMin: '-',
    infoBboxMax: '-',
    infoDescription: '无补充描述'
  };

  Object.entries(placeholders).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  });

  const riskNode = document.getElementById('infoRisk');
  if (riskNode) {
    riskNode.textContent = '-';
    riskNode.className = 'fw-bold';
  }
}

function isWithinTimeRange(updatedAt, filters) {
  if (!filters.timeRange || filters.timeRange === 'all') {
    return true;
  }

  if (!updatedAt) {
    return false;
  }

  const updatedDate = new Date(updatedAt);
  if (Number.isNaN(updatedDate.getTime())) {
    return false;
  }

  const now = new Date();
  if (filters.timeRange === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return updatedDate >= monthStart && updatedDate <= now;
  }

  if (filters.timeRange === 'quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const quarterStart = new Date(now.getFullYear(), quarterStartMonth, 1);
    return updatedDate >= quarterStart && updatedDate <= now;
  }

  const days = Number(filters.timeRange);
  if (!Number.isFinite(days) || days <= 0) {
    return true;
  }

  const diffMs = Date.now() - updatedDate.getTime();
  return diffMs <= days * 24 * 60 * 60 * 1000;
}

async function applyFilters() {
  const filters = getFilterValues();
  setAppliedFilters(filters);
  terrainData.filteredTerrains = terrainData.terrains.filter(terrain => {
    const matchesName = !filters.name || terrain.name.toLowerCase().includes(filters.name);
    const matchesRisk = !filters.riskLevel || terrain.riskLevelRaw === filters.riskLevel;
    const matchesTime = isWithinTimeRange(terrain.updated_at, filters);
    return matchesName && matchesRisk && matchesTime;
  });

  updateEmptyStateMessage();
  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.currentPage = 1;
  }
  updatePageData();
  await syncDefaultTerrainSelection({
    preserveMapWhenEmpty: true,
    emptyMessage: '未找到符合条件的地形，地图保留当前视图。'
  });
}

function scheduleNameAutoFilter() {
  window.clearTimeout(terrainFilterDebounceTimer);
  terrainFilterDebounceTimer = window.setTimeout(() => {
    applyFilters();
  }, 300);
}

function initFilterForm() {
  const filterForm = document.getElementById('terrainFilterForm');
  const terrainName = document.getElementById('terrainName');
  const resetBtn = document.getElementById('resetBtn');
  const filterRiskLevel = document.getElementById('filterRiskLevel');
  const timeRange = document.getElementById('timeRange');

  filterForm.addEventListener('submit', function onFilterSubmit(event) {
    event.preventDefault();
    applyFilters();
  });

  terrainName.addEventListener('input', function onNameInput() {
    scheduleNameAutoFilter();
  });

  filterRiskLevel.addEventListener('change', function onRiskChange() {
    applyFilters();
  });

  timeRange.addEventListener('change', function onTimeRangeChange() {
    applyFilters();
  });

  resetBtn.addEventListener('click', function onResetClick() {
    window.clearTimeout(terrainFilterDebounceTimer);
    filterForm.reset();
    setAppliedFilters({
      name: '',
      riskLevel: '',
      timeRange: 'all'
    });
    terrainData.filteredTerrains = [...terrainData.terrains];
    updateEmptyStateMessage();
    if (vueInstances.terrainTable) {
      vueInstances.terrainTable.currentPage = 1;
    }
    updatePageData();
    syncDefaultTerrainSelection();
  });
}

function initTables() {
}

function initEvents() {
  window.addEventListener('focus', function onWindowFocus() {
    if (localStorage.getItem('terrain_plot_changed') === '1') {
      loadRealData();
      localStorage.removeItem('terrain_plot_changed');
    }
  });

  document.getElementById('addTerrainBtn').addEventListener('click', function onAddTerrain() {
    window.location.href = '/terrain/editor/';
  });

  document.getElementById('saveTerrainBtn').addEventListener('click', function onSaveTerrain() {
    const formData = {
      id: document.getElementById('terrainId').value,
      name: document.getElementById('name').value,
      area: document.getElementById('area').value,
      riskLevel: document.getElementById('editRiskLevel').value,
      description: document.getElementById('description').value
    };
    console.log('保存地形:', formData);
    const modal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
    if (modal) {
      modal.hide();
    }
  });

  document.getElementById('editTerrainMapBtn').addEventListener('click', function onEditTerrainMap() {
    if (!terrainData.currentTerrain) {
      return;
    }
    window.location.href = `/terrain/editor/?area_id=${terrainData.currentTerrain.id}`;
  });

  document.addEventListener('terrainSelected', function onTerrainSelected(event) {
    const terrain = event.detail;
    selectTerrainRow(terrain.id, {
      syncMap: false,
      fit: false,
      openPopup: false
    });
  });

  initToolbarActions();

  window.setTimeout(scheduleTerrainDetailElasticHeightSync, 0);
}

// ==================== 新增功能：批量导入、导出数据、刷新 ====================

function showToast(message, type = 'success') {
  // 简单的 Toast 提示实现
  const toastContainer = document.getElementById('toast-container') || (() => {
    const div = document.createElement('div');
    div.id = 'toast-container';
    div.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
    document.body.appendChild(div);
    return div;
  })();

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-success' : (type === 'warning' ? 'bg-warning text-dark' : 'bg-danger');
  toast.className = `toast align-items-center text-white ${bgClass} border-0 mb-2`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  toast.style.opacity = 0;
  toast.style.transition = 'opacity 0.3s ease-in-out';
  
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // 初始化 Bootstrap Toast
  const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 2500 });
  bsToast.show();
  toast.style.opacity = 1;
  
  toast.addEventListener('hidden.bs.toast', () => {
    toast.remove();
  });
}

function getCSRFToken() {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, 10) === 'csrftoken=') {
        cookieValue = decodeURIComponent(cookie.substring(10));
        break;
      }
    }
  }
  return cookieValue;
}

function initToolbarActions() {
  const btnImportTerrain = document.getElementById('btnImportTerrain');
  const btnExportTerrain = document.getElementById('btnExportTerrain');
  const btnRefreshTerrain = document.getElementById('btnRefreshTerrain');
  const btnDownloadImportTemplate = document.getElementById('btnDownloadImportTemplate');
  const btnStartImportTerrain = document.getElementById('btnStartImportTerrain');

  if (btnImportTerrain) {
    btnImportTerrain.addEventListener('click', openImportModal);
  }

  if (btnExportTerrain) {
    btnExportTerrain.addEventListener('click', exportTerrainData);
  }

  if (btnRefreshTerrain) {
    btnRefreshTerrain.addEventListener('click', refreshTerrainData);
  }

  if (btnDownloadImportTemplate) {
    btnDownloadImportTemplate.addEventListener('click', downloadImportTemplate);
  }

  if (btnStartImportTerrain) {
    btnStartImportTerrain.addEventListener('click', startImportTerrain);
  }
}

function openImportModal() {
  const fileInput = document.getElementById('terrainImportFile');
  const errorArea = document.getElementById('terrainImportError');
  
  if (fileInput) fileInput.value = '';
  if (errorArea) {
    errorArea.classList.add('d-none');
    errorArea.innerHTML = '';
  }
  
  const modalEl = document.getElementById('terrainImportModal');
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

async function startImportTerrain() {
  const fileInput = document.getElementById('terrainImportFile');
  const btnStart = document.getElementById('btnStartImportTerrain');
  const errorArea = document.getElementById('terrainImportError');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('请先选择要导入的文件', 'warning');
    return;
  }

  const file = fileInput.files[0];
  const validExts = ['.json', '.geojson', '.csv'];
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
  if (!validExts.includes(ext)) {
    showToast('仅支持 .json, .geojson, .csv 格式', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    if (btnStart) {
      btnStart.disabled = true;
      btnStart.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 导入中...';
    }
    
    if (errorArea) {
      errorArea.classList.add('d-none');
      errorArea.innerHTML = '';
    }

    const response = await fetch('/terrain/api/areas/import/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCSRFToken()
      },
      body: formData
    });

    const result = await response.json();

    if (result.success || result.code === 0) {
      // 兼容两种格式，如果是 views 返回的 success
      const isSuccess = result.success || result.code === 0;
      if (isSuccess) {
        const msg = result.message || '导入成功';
        showToast(`${msg} (新增:${result.created || 0}, 更新:${result.updated || 0})`, 'success');
        
        // 成功后关闭弹窗
        const modalEl = document.getElementById('terrainImportModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        
        // 刷新列表
        await refreshTerrainData();
      } else {
        throw new Error(result.message || '导入失败');
      }
    } else {
      // 显示错误
      if (errorArea) {
        errorArea.classList.remove('d-none');
        let errorHtml = `<strong>${result.message || '导入失败'}</strong><br/>`;
        if (result.errors && result.errors.length > 0) {
          errorHtml += '<ul class="mb-0 ps-3">';
          result.errors.forEach(err => {
            errorHtml += `<li>${err}</li>`;
          });
          errorHtml += '</ul>';
        }
        errorArea.innerHTML = errorHtml;
      }
      showToast('导入遇到错误，请查看详情', 'danger');
    }
  } catch (error) {
    console.error('导入异常:', error);
    showToast('网络请求或解析异常，请重试', 'danger');
  } finally {
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.innerHTML = '开始导入';
    }
  }
}

function normalizeTerrainExportItem(item) {
  const normalizedPlots = normalizeTerrainPlots(item);
  return {
    "id": item.id,
    "name": item.name,
    "risk_level": item.riskLevelRaw || item.risk_level,
    "area": item.area || item.area_ha || 0,
    "accuracy": item.accuracy || (item.dataAccuracyLabel !== '待补充' ? parseFloat(item.dataAccuracyLabel) : 0) || 0,
    "description": item.description || '',
    "bounds": item.bbox && item.bbox.raw ? {
      "south_west": [item.bbox.raw.minLng, item.bbox.raw.minLat],
      "north_east": [item.bbox.raw.maxLng, item.bbox.raw.maxLat]
    } : (item.bounds || null),
    "geometry": item.geometry || item.boundary_json || item.boundary_geojson || null,
    "plots": normalizedPlots
  };
}

function exportTerrainData() {
  const dataToExport = terrainData.filteredTerrains && terrainData.filteredTerrains.length > 0 
    ? terrainData.filteredTerrains 
    : terrainData.terrains;

  if (!dataToExport || dataToExport.length === 0) {
    showToast('暂无可导出的地形数据', 'warning');
    return;
  }

  const exportList = dataToExport.map(normalizeTerrainExportItem);
  const jsonStr = JSON.stringify(exportList, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const filename = `terrain_export_${yyyy}${mm}${dd}_${hh}${min}${ss}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`已导出 ${exportList.length} 条地形数据`, 'success');
}

async function refreshTerrainData() {
  const btnRefresh = document.getElementById('btnRefreshTerrain');
  const originalHtml = btnRefresh ? btnRefresh.innerHTML : '';
  
  if (btnRefresh) {
    btnRefresh.disabled = true;
    btnRefresh.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> 刷新中...';
  }

  try {
    await loadRealData(); // 内部已包含应用筛选条件和更新页面逻辑
    showToast('刷新成功', 'success');
  } catch (error) {
    console.error('刷新失败:', error);
    showToast('刷新失败，请重试', 'danger');
  } finally {
    if (btnRefresh) {
      btnRefresh.disabled = false;
      btnRefresh.innerHTML = originalHtml;
    }
  }
}

async function downloadImportTemplate() {
  try {
    const response = await fetch('/terrain/api/areas/import-template/');
    if (response.ok) {
      const data = await response.json();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'terrain_import_template.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      throw new Error('接口请求失败');
    }
  } catch (error) {
    console.error('获取模板失败，使用默认模板:', error);
    // 前端生成默认模板
    const defaultTemplate = [
      {
        "name": "示例地形区域",
        "risk_level": "low",
        "area": 120.5,
        "accuracy": 98,
        "description": "示例导入数据",
        "bounds": {
          "south_west": [106.09, 29.09],
          "north_east": [106.11, 29.11]
        },
        "geometry": {
          "type": "Feature",
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [106.09, 29.09],
                [106.11, 29.09],
                [106.11, 29.11],
                [106.09, 29.11],
                [106.09, 29.09]
              ]
            ]
          },
          "properties": {}
        },
        "plots": [
          {
            "name": "示例农田地块",
            "type": "farmland",
            "type_label": "农田",
            "subtype": "dry_field",
            "subtype_label": "旱地",
            "area": 35.2,
            "geometry": {
              "type": "Feature",
              "geometry": {
                "type": "Polygon",
                "coordinates": [
                  [
                    [106.094, 29.094],
                    [106.102, 29.094],
                    [106.102, 29.101],
                    [106.094, 29.101],
                    [106.094, 29.094]
                  ]
                ]
              },
              "properties": {
                "name": "示例农田地块",
                "type": "farmland",
                "type_label": "农田",
                "subtype": "dry_field",
                "subtype_label": "旱地"
              }
            }
          },
          {
            "name": "示例林区地块",
            "type": "forest",
            "type_label": "林区",
            "subtype": "mixed_forest",
            "subtype_label": "混交林",
            "area": 42.6,
            "geometry": {
              "type": "Feature",
              "geometry": {
                "type": "Polygon",
                "coordinates": [
                  [
                    [106.102, 29.101],
                    [106.108, 29.101],
                    [106.108, 29.108],
                    [106.102, 29.108],
                    [106.102, 29.101]
                  ]
                ]
              },
              "properties": {
                "name": "示例林区地块",
                "type": "forest",
                "type_label": "林区",
                "subtype": "mixed_forest",
                "subtype_label": "混交林"
              }
            }
          }
        ]
      }
    ];
    const jsonStr = JSON.stringify(defaultTemplate, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'terrain_import_template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

function initVue() {
  vueInstances.terrainTable = new Vue({
    el: '#terrainTable',
    data: {
      terrains: terrainData.filteredTerrains,
      selectedTerrainId: null,
      currentPage: 1,
      pageSize: 15,
      emptyStateMessage: terrainData.emptyStateMessage
    },
    computed: {
      pagedTerrains() {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.terrains.slice(start, start + this.pageSize);
      },
      totalPages() {
        return Math.ceil(this.terrains.length / this.pageSize) || 1;
      }
    },
    template: `
      <div>
        <div v-if="terrains.length" class="terrain-table-wrap">
          <table class="terrain-table">
            <colgroup>
              <col class="col-index">
              <col class="col-name">
              <col class="col-risk">
              <col class="col-area">
              <col class="col-actions">
            </colgroup>
            <thead>
              <tr>
                <th>序号</th>
                <th>地形名称</th>
                <th>风险等级</th>
                <th>面积</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(terrain, index) in pagedTerrains"
                :key="terrain.id"
                :class="{ 'is-selected': selectedTerrainId === terrain.id }"
                @click="selectTerrain(terrain)"
              >
                <td class="terrain-cell-index">{{ (currentPage - 1) * pageSize + index + 1 }}</td>
                <td class="terrain-name-cell">
                  <span class="terrain-name-main">{{ terrain.name }}</span>
                </td>
                <td>
                  <span class="terrain-risk-badge" :class="terrain.riskClass">{{ terrain.riskLabel }}</span>
                </td>
                <td>
                  <span class="terrain-area-value">{{ formatAreaValue(terrain.area) }}</span>
                  <span v-if="formatAreaValue(terrain.area) !== '-'" class="terrain-area-unit">公顷</span>
                </td>
                <td class="terrain-actions-cell">
                  <button class="btn btn-sm btn-outline-primary terrain-edit-btn" @click.stop="editTerrain(terrain)">
                    编辑
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="terrain-empty-state">
          {{ emptyStateMessage }}
        </div>
      </div>
    `,
    methods: {
      async selectTerrain(terrain) {
        await selectTerrainRow(terrain.id, {
          syncMap: true,
          fit: true,
          openPopup: false
        });
      },
      formatAreaValue(area) {
        const numericArea = coerceNumber(area);
        if (!isPositiveNumber(numericArea)) {
          return '-';
        }
        return numericArea.toFixed(numericArea >= 100 ? 1 : 2);
      },
      editTerrain(terrain) {
        window.location.href = `/terrain/editor/?area_id=${terrain.id}`;
      }
    },
    mounted() {
      scheduleTerrainDetailElasticHeightSync();
    },
    updated() {
      scheduleTerrainDetailElasticHeightSync();
    }
  });

  // NiceAdmin 风格分页 Vue 实例
  vueInstances.pagination = new Vue({
    el: '#pagination',
    data: {
      tableInstance: null
    },
    computed: {
      currentPage() { return this.tableInstance?.currentPage || 1; },
      totalPages() { return this.tableInstance?.totalPages || 1; }
    },
    template: `
      <div class="pagination-container d-flex justify-content-between align-items-center">
        <div class="text-muted small">
          第 {{ currentPage }} / {{ totalPages }} 页
        </div>
        <nav aria-label="Page navigation">
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <a class="page-link" href="#" @click.prevent="setPage(currentPage - 1)">上一页</a>
            </li>
            <li v-for="p in totalPages" :key="p" class="page-item" :class="{ active: p === currentPage }">
              <a class="page-link" href="#" @click.prevent="setPage(p)">{{ p }}</a>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === totalPages }">
              <a class="page-link" href="#" @click.prevent="setPage(currentPage + 1)">下一页</a>
            </li>
          </ul>
        </nav>
      </div>
    `,
    methods: {
      async setPage(p) {
        if (p < 1 || p > this.totalPages || !this.tableInstance) return;
        this.tableInstance.currentPage = p;
        await syncDefaultTerrainSelection();
        scheduleTerrainDetailElasticHeightSync();
      }
    },
    mounted() {
      this.tableInstance = vueInstances.terrainTable;
      scheduleTerrainDetailElasticHeightSync();
    },
    updated() {
      scheduleTerrainDetailElasticHeightSync();
    }
  });

  vueInstances.riskAreasTable = new Vue({
    el: '#riskAreasTable',
    data: {
      riskAreas: terrainData.riskAreas
    },
    template: `
      <table class="table table-hover" id="riskAreasTable">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">风险区域</th>
            <th scope="col">所属地形</th>
            <th scope="col">风险等级</th>
            <th scope="col">面积(公顷)</th>
            <th scope="col">发现时间</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(area, index) in riskAreas" :key="area.id">
            <th scope="row">{{ index + 1 }}</th>
            <td>{{ area.name }}</td>
            <td>{{ area.terrain_name }}</td>
            <td><span class="badge bg-secondary">{{ area.risk_level }}</span></td>
            <td>{{ area.area }}</td>
            <td>{{ area.discovery_time }}</td>
            <td><button class="btn btn-sm btn-outline-primary">查看</button></td>
          </tr>
        </tbody>
      </table>
    `
  });

  vueInstances.surveyRecordsTable = new Vue({
    el: '#surveyRecordsTable',
    data: {
      surveys: terrainData.surveys
    },
    template: `
      <table class="table table-hover" id="surveyRecordsTable">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">测绘任务</th>
            <th scope="col">无人机</th>
            <th scope="col">开始时间</th>
            <th scope="col">结束时间</th>
            <th scope="col">数据精度</th>
            <th scope="col">状态</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(survey, index) in surveys" :key="survey.id">
            <th scope="row">{{ index + 1 }}</th>
            <td>{{ survey.name }}</td>
            <td>无人机-{{ index + 1 }}</td>
            <td>{{ survey.start_time }}</td>
            <td>{{ survey.end_time }}</td>
            <td>{{ survey.accuracy }}%</td>
            <td>
              <span v-if="survey.status === '完成'" class="badge bg-success">已完成</span>
              <span v-else-if="survey.status === '进行中'" class="badge bg-primary">进行中</span>
              <span v-else class="badge bg-warning">未开始</span>
            </td>
            <td><button class="btn btn-sm btn-outline-primary">查看</button></td>
          </tr>
        </tbody>
      </table>
    `
  });
}

function updatePageData() {
  const averageAccuracy = terrainData.terrains.length
    ? Math.round(
      terrainData.terrains.reduce((sum, item) => {
        const value = parseFloat(item.dataAccuracyLabel);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0) / Math.max(terrainData.terrains.filter(item => Number.isFinite(parseFloat(item.dataAccuracyLabel))).length, 1)
    )
    : 0;

  document.getElementById('totalTerrains').textContent = terrainData.terrains.length;
  document.getElementById('highRiskAreas').textContent = terrainData.terrains.filter(item => item.riskLevelRaw === 'high').length;
  document.getElementById('activeTasks').textContent = terrainData.surveys.filter(survey => survey.status === '进行中').length;
  document.getElementById('dataAccuracy').textContent = averageAccuracy ? `${averageAccuracy}%` : '-';

  updateTerrainListCount(terrainData.filteredTerrains.length, terrainData.terrains.length);
  updateFilterSummary();

  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.terrains = terrainData.filteredTerrains;
    vueInstances.terrainTable.emptyStateMessage = terrainData.emptyStateMessage;
    const totalPages = Math.max(Math.ceil(terrainData.filteredTerrains.length / vueInstances.terrainTable.pageSize), 1);
    vueInstances.terrainTable.currentPage = Math.min(vueInstances.terrainTable.currentPage, totalPages);
  }
  if (vueInstances.riskAreasTable) {
    vueInstances.riskAreasTable.riskAreas = terrainData.riskAreas;
  }
  if (vueInstances.surveyRecordsTable) {
    vueInstances.surveyRecordsTable.surveys = terrainData.surveys;
  }

  scheduleTerrainDetailElasticHeightSync();
}

function updateDetailPanel(terrain) {
  if (!terrain) return;

  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  };

  setText('infoName', terrain.name);
  setText('infoArea', terrain.areaLabel);
  setText('infoAccuracy', terrain.dataAccuracyLabel);
  setText('infoUpdatedAt', terrain.updatedAtLabel);
  setText('infoPlotCount', terrain.plotCountLabel);
  setText('infoBboxMin', `${terrain.bbox.minLng}, ${terrain.bbox.minLat}`);
  setText('infoBboxMax', `${terrain.bbox.maxLng}, ${terrain.bbox.maxLat}`);
  setText('infoDescription', terrain.description || '无补充描述');

  const riskNode = document.getElementById('infoRisk');
  if (riskNode) {
    riskNode.textContent = terrain.riskLabel;
    riskNode.className = `fw-bold ${terrain.riskClass}`;
  }

  scheduleTerrainDetailElasticHeightSync();
}

window.addEventListener('DOMContentLoaded', initPage);
