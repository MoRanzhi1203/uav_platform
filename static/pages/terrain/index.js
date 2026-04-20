// 地形管理页面逻辑

const terrainData = {
  terrains: [],
  filteredTerrains: [],
  riskAreas: [],
  surveys: [],
  currentTerrain: null
};

let terrainMap;
const vueInstances = {};
let terrainLayoutObserver = null;

function initPage() {
  if (localStorage.getItem('terrain_list_should_refresh') === '1') {
    localStorage.removeItem('terrain_list_should_refresh');
  }

  initVue();
  syncTerrainMainLayoutBySidebarState();
  bindTerrainMainLayoutSidebarSync();

  terrainMap = new TerrainMap('terrainMap');
  terrainMap.init();

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

function syncTerrainMainLayoutBySidebarState() {
  const layout = document.querySelector('.terrain-main-layout');
  if (!layout) {
    return;
  }

  const nextState = getTerrainSidebarState();
  if (layout.dataset.sidebarState === nextState) {
    return;
  }

  layout.dataset.sidebarState = nextState;
  requestTerrainMapResize();
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

function getDataStatusMeta(item) {
  const hasAccuracy = item.data_accuracy !== null
    && item.data_accuracy !== undefined
    && item.data_accuracy !== ''
    && item.data_accuracy !== '待补充';
  if (hasAccuracy) {
    return {
      label: '数据完备',
      className: 'status-ready'
    };
  }

  return {
    label: '待补精度',
    className: 'status-pending'
  };
}

function getBoundaryStatusMeta(item) {
  const hasBoundary = Boolean(item.has_boundary || item.boundary_geojson || item.boundary_json);
  return {
    label: hasBoundary ? '边界完整' : '缺少边界',
    className: hasBoundary ? 'status-ready' : 'status-missing',
    hasBoundary
  };
}

function normalizeSpatialStatus(item, hasBoundary) {
  if (item.spatial_status) {
    return item.spatial_status;
  }
  const hasCenter = isValidLatLng(item.center_lat, item.center_lng);
  if (hasBoundary && hasCenter) {
    return '边界与中心点完整';
  }
  return hasBoundary ? '空间可视化就绪' : '仅中心点定位';
}

function standardizeTerrainRecord(rawItem) {
  const utils = getTerrainSpatialUtils();
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
  const plotCount = Math.max(0, Number(pickFirstDefined(rawItem.plot_count, 0)) || 0);
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
    plot_count: plotCount,
    data_accuracy: pickFirstDefined(rawItem.data_accuracy, '待补充'),
    has_boundary: hasBoundary,
    data_status: pickFirstDefined(rawItem.data_status, hasBoundary ? '基础边界已接入' : '原始影像阶段'),
    spatial_status: normalizeSpatialStatus({
      spatial_status: rawItem.spatial_status,
      center_lat: centerLat,
      center_lng: centerLng
    }, hasBoundary),
    center_lat: isValidLatLng(centerLat, centerLng) ? centerLat : null,
    center_lng: isValidLatLng(centerLat, centerLng) ? centerLng : null
  };
}

function normalizeTerrainItem(item) {
  const standardized = standardizeTerrainRecord(item);
  const boundaryMeta = getBoundaryStatusMeta(standardized);
  const dataStatusMeta = getDataStatusMeta(standardized);
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
    center: isValidLatLng(standardized.center_lat, standardized.center_lng)
      ? [standardized.center_lat, standardized.center_lng]
      : null,
    centerLabel: formatCenterLabel(standardized.center_lat, standardized.center_lng),
    updatedAtLabel: formatDateTime(standardized.updated_at),
    plotCount: standardized.plot_count,
    plotCountLabel: `${standardized.plot_count} 个地块`,
    hasBoundary: boundaryMeta.hasBoundary,
    boundaryStatusLabel: boundaryMeta.label,
    boundaryStatusClass: boundaryMeta.className,
    dataStatusLabel: standardized.data_status || dataStatusMeta.label,
    dataStatusClass: dataStatusMeta.className,
    dataAccuracyLabel: standardized.data_accuracy ? `${standardized.data_accuracy}` : '待补充',
    spatialStatusLabel: standardized.spatial_status,
    dataStatusText: standardized.data_status || dataStatusMeta.label,
    bbox: {
      minLng: formatCoordinate(bbox.minLng),
      minLat: formatCoordinate(bbox.minLat),
      maxLng: formatCoordinate(bbox.maxLng),
      maxLat: formatCoordinate(bbox.maxLat),
      raw: standardized.bbox
    }
  };
}

function updateTerrainListCount(count) {
  const countNode = document.getElementById('terrainListCount');
  if (countNode) {
    countNode.textContent = `${count} 条`;
  }
}

function updateMapSelectionHint(terrain) {
  const hintNode = document.getElementById('terrainMapSelectionHint');
  const titleNode = document.getElementById('terrainMapTitle');
  if (!hintNode || !titleNode) {
    return;
  }

  if (!terrain) {
    titleNode.textContent = '当前地形专题';
    hintNode.textContent = '当前未选中地形，请从左侧列表选择。';
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
}

function clearCurrentSelection() {
  terrainData.currentTerrain = null;
  updateMapSelectionHint(null);

  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.selectedTerrainId = null;
  }

  if (terrainMap) {
    terrainMap.clearCurrentTopic();
  }
}

async function syncDefaultTerrainSelection() {
  const sourceTerrains = terrainData.filteredTerrains.length ? terrainData.filteredTerrains : terrainData.terrains;
  if (!sourceTerrains.length) {
    clearCurrentSelection();
    return;
  }

  const page = vueInstances.terrainTable ? vueInstances.terrainTable.currentPage : 1;
  const pageSize = vueInstances.terrainTable ? vueInstances.terrainTable.pageSize : 10;
  const pageStart = (page - 1) * pageSize;
  const currentPageTerrains = sourceTerrains.slice(pageStart, pageStart + pageSize);
  if (!currentPageTerrains.length) {
    clearCurrentSelection();
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

    updatePageData();
    await syncDefaultTerrainSelection();
  } catch (error) {
    console.error('请求区域数据异常:', error);
  }
}

function toggleCustomDateRange(show) {
  ['startDateWrap', 'endDateWrap'].forEach(id => {
    const node = document.getElementById(id);
    if (node) {
      node.classList.toggle('d-none', !show);
    }
  });
}

function getFilterValues() {
  return {
    name: document.getElementById('terrainName').value.trim().toLowerCase(),
    riskLevel: document.getElementById('filterRiskLevel').value,
    timeRange: document.getElementById('timeRange').value,
    startDate: document.getElementById('startDate').value,
    endDate: document.getElementById('endDate').value
  };
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

  if (filters.timeRange === 'custom') {
    const startDate = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
    const endDate = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;
    if (startDate && updatedDate < startDate) {
      return false;
    }
    if (endDate && updatedDate > endDate) {
      return false;
    }
    return true;
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
  terrainData.filteredTerrains = terrainData.terrains.filter(terrain => {
    const matchesName = !filters.name || terrain.name.toLowerCase().includes(filters.name);
    const matchesRisk = !filters.riskLevel || terrain.riskLevelRaw === filters.riskLevel;
    const matchesTime = isWithinTimeRange(terrain.updated_at, filters);
    return matchesName && matchesRisk && matchesTime;
  });

  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.currentPage = 1;
  }
  updatePageData();
  await syncDefaultTerrainSelection();
}

function initFilterForm() {
  const timeRange = document.getElementById('timeRange');
  const searchBtn = document.getElementById('searchBtn');
  const resetBtn = document.getElementById('resetBtn');

  timeRange.addEventListener('change', function onChangeTimeRange() {
    toggleCustomDateRange(this.value === 'custom');
  });

  searchBtn.addEventListener('click', function onSearchClick() {
    applyFilters();
  });

  resetBtn.addEventListener('click', function onResetClick() {
    document.getElementById('terrainFilterForm').reset();
    toggleCustomDateRange(false);
    terrainData.filteredTerrains = [...terrainData.terrains];
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

  document.getElementById('refreshBtn').addEventListener('click', function onRefresh() {
    loadRealData();
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
}

function initVue() {
  vueInstances.terrainTable = new Vue({
    el: '#terrainTable',
    data: {
      terrains: terrainData.filteredTerrains,
      selectedTerrainId: null,
      currentPage: 1,
      pageSize: 10
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
              <col class="col-space">
              <col class="col-risk">
              <col class="col-area">
              <col class="col-actions">
            </colgroup>
            <thead>
              <tr>
                <th>序号</th>
                <th>地形名称</th>
                <th>空间数据</th>
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
                <td>
                  <span class="terrain-name-main">{{ terrain.name }}</span>
                </td>
                <td>
                  <div class="terrain-space-coord">
                    <div><span class="coord-label">左下:</span>{{ terrain.bbox.minLng }}, {{ terrain.bbox.minLat }}</div>
                    <div><span class="coord-label">右上:</span>{{ terrain.bbox.maxLng }}, {{ terrain.bbox.maxLat }}</div>
                  </div>
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
          当前没有可展示的地形区域，请调整筛选条件或稍后刷新。
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
      }
    },
    mounted() {
      this.tableInstance = vueInstances.terrainTable;
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

  updateTerrainListCount(terrainData.filteredTerrains.length);

  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.terrains = terrainData.filteredTerrains;
    const totalPages = Math.max(Math.ceil(terrainData.filteredTerrains.length / vueInstances.terrainTable.pageSize), 1);
    vueInstances.terrainTable.currentPage = Math.min(vueInstances.terrainTable.currentPage, totalPages);
  }
  if (vueInstances.riskAreasTable) {
    vueInstances.riskAreasTable.riskAreas = terrainData.riskAreas;
  }
  if (vueInstances.surveyRecordsTable) {
    vueInstances.surveyRecordsTable.surveys = terrainData.surveys;
  }
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

  const boundaryNode = document.getElementById('infoBoundaryStatus');
  if (boundaryNode) {
    boundaryNode.textContent = terrain.boundaryStatusLabel;
    boundaryNode.className = `badge ${terrain.boundaryStatusClass === 'status-ready' ? 'bg-success' : 'bg-warning'}`;
  }

  const dataNode = document.getElementById('infoDataStatus');
  if (dataNode) {
    dataNode.textContent = terrain.dataStatusLabel;
    dataNode.className = `badge ${terrain.dataStatusClass === 'status-ready' ? 'bg-primary' : 'bg-secondary'}`;
  }
}

window.addEventListener('DOMContentLoaded', initPage);
