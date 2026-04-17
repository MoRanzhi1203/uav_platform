const DEFAULT_MAP_CENTER = [30.05, 107.60];
const DEFAULT_MAP_ZOOM = 7;
const RISK_LEVEL_LABELS = {
  high: '高',
  medium: '中',
  low: '低'
};
const PLOT_CATEGORY_LABELS = new Set(['林区', '农田', '水域', '道路', '建筑', '空地', '裸地', '其他']);

const terrainState = {
  terrains: [],
  filteredTerrains: [],
  riskAreas: [],
  surveys: [],
  currentTerrain: null,
  activeTerrainId: null,
  map: null,
  terrainOverlay: null,
  terrainCenterMarker: null,
  detailDrawer: null
};

function initPage() {
  initMap();
  initFilterForm();
  initEvents();
  loadRealData();
}

function initMap() {
  if (window.initMap) {
    terrainState.map = window.initMap('terrainMap');
  } else {
    terrainState.map = L.map('terrainMap').setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(terrainState.map);
  }

  setMapStatus('等待加载区域数据');
  setMapTitle(null);
}

async function loadRealData() {
  try {
    setMapStatus('正在加载地形区域...');
    const response = await fetch('/terrain/api/areas/');
    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(result.message || '地形区域加载失败');
    }

    terrainState.terrains = (result.data || []).map(normalizeTerrainRecord);
    updatePageData();
    applyFilters({ preserveSelection: false });
  } catch (error) {
    console.error('请求区域数据异常:', error);
    renderTerrainList([]);
    setMapStatus('地形区域加载失败');
  }
}

function normalizeTerrainRecord(item) {
  const normalized = {
    id: item.id,
    name: item.name || `未命名地形-${item.id}`,
    area: item.area,
    risk_level: item.risk_level || 'low',
    risk_level_label: translateRiskLevel(item.risk_level),
    plot_count: Number(item.plot_count || 0),
    composition_summary: item.composition_summary || '',
    plot_category_counts: Array.isArray(item.plot_category_counts) ? item.plot_category_counts : [],
    sub_category_count: Number(item.sub_category_count || 0),
    center_lat: toNullableNumber(item.center_lat),
    center_lng: toNullableNumber(item.center_lng),
    bbox: item.bbox,
    geojson: item.geojson,
    boundary_geojson: item.boundary_geojson,
    created_at: item.created_at || '',
    updated_at: item.updated_at || '',
    description: item.description || ''
  };

  normalized.composition_summary = buildCompositionSummary(normalized);
  return normalized;
}

function translateRiskLevel(level) {
  return RISK_LEVEL_LABELS[level] || level || '-';
}

function buildCompositionSummary(record) {
  const rawSummary = typeof record.composition_summary === 'string'
    ? record.composition_summary.trim()
    : '';

  if (rawSummary && !PLOT_CATEGORY_LABELS.has(rawSummary)) {
    return rawSummary;
  }

  const categoryCount = Array.isArray(record.plot_category_counts)
    ? record.plot_category_counts.filter(item => Number(item.count) > 0).length
    : 0;

  if (record.sub_category_count >= 2) {
    return `包含${record.sub_category_count}类地块`;
  }

  if (categoryCount >= 2) {
    return '混合地块';
  }

  if (record.plot_count > 0) {
    return `由${record.plot_count}个地块组成`;
  }

  return '暂无地块';
}

function initFilterForm() {
  document.getElementById('timeRange')?.addEventListener('change', function() {
    const dateRange = document.getElementById('dateRange');
    if (!dateRange) return;
    dateRange.classList.toggle('d-none', this.value !== 'custom');
  });

  document.getElementById('searchBtn')?.addEventListener('click', function() {
    applyFilters({ preserveSelection: true });
  });

  document.getElementById('resetBtn')?.addEventListener('click', function() {
    document.getElementById('terrainFilterForm')?.reset();
    document.getElementById('dateRange')?.classList.add('d-none');
    applyFilters({ preserveSelection: false });
  });
}

function initEvents() {
  window.addEventListener('focus', function() {
    if (localStorage.getItem('terrain_plot_changed') === '1') {
      loadRealData();
      localStorage.removeItem('terrain_plot_changed');
    }
  });

  document.getElementById('terrainTable')?.addEventListener('click', handleTerrainTableClick);
  document.getElementById('addTerrainBtn')?.addEventListener('click', () => {
    window.location.href = '/terrain/editor/';
  });
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    loadRealData();
  });
  document.getElementById('resetMapBtn')?.addEventListener('click', () => {
    if (terrainState.currentTerrain) {
      focusTerrainOnMap(terrainState.currentTerrain);
    } else {
      resetMapToDefault('未选中地形，已回到重庆默认视角');
    }
  });

  document.querySelectorAll('[data-layer]').forEach(button => {
    button.addEventListener('click', function() {
      document.querySelectorAll('[data-layer]').forEach(item => item.classList.remove('active'));
      this.classList.add('active');

      const layerType = this.getAttribute('data-layer');
      if (layerType === 'terrain' && terrainState.currentTerrain) {
        focusTerrainOnMap(terrainState.currentTerrain);
      }
    });
  });
  document.querySelector('[data-layer="terrain"]')?.classList.add('active');

  document.getElementById('saveTerrainBtn')?.addEventListener('click', function() {
    const formData = {
      id: document.getElementById('terrainId')?.value,
      name: document.getElementById('terrainFormName')?.value,
      area: document.getElementById('terrainFormArea')?.value,
      terrainType: document.getElementById('terrainFormType')?.value,
      riskLevel: document.getElementById('terrainFormRiskLevel')?.value,
      description: document.getElementById('terrainFormDescription')?.value
    };
    console.log('保存地形:', formData);
    bootstrap.Modal.getInstance(document.getElementById('editModal'))?.hide();
  });

  document.getElementById('viewDetailBtn')?.addEventListener('click', function() {
    if (terrainState.currentTerrain) {
      window.location.href = `/terrain/editor/?area_id=${terrainState.currentTerrain.id}`;
    }
  });

  document.getElementById('editDetailBtn')?.addEventListener('click', function() {
    if (terrainState.currentTerrain) {
      window.location.href = `/terrain/editor/?area_id=${terrainState.currentTerrain.id}`;
    }
  });
}

function handleTerrainTableClick(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (actionButton) {
    const terrainId = Number(actionButton.dataset.terrainId);
    if (!Number.isFinite(terrainId)) return;

    const terrain = terrainState.filteredTerrains.find(item => item.id === terrainId)
      || terrainState.terrains.find(item => item.id === terrainId);
    if (!terrain) return;

    if (actionButton.dataset.action === 'focus') {
      selectTerrainRecord(terrain, { showDrawer: false });
      return;
    }

    if (actionButton.dataset.action === 'edit') {
      window.location.href = `/terrain/editor/?area_id=${terrain.id}`;
    }
    return;
  }

  const row = event.target.closest('tr[data-terrain-id]');
  if (!row) return;

  const terrainId = Number(row.dataset.terrainId);
  const terrain = terrainState.filteredTerrains.find(item => item.id === terrainId);
  if (!terrain) return;

  selectTerrainRecord(terrain, { showDrawer: true });
}

function updatePageData() {
  document.getElementById('totalTerrains').textContent = terrainState.terrains.length;
  document.getElementById('highRiskAreas').textContent = terrainState.terrains.filter(item => item.risk_level === 'high').length;
  document.getElementById('activeTasks').textContent = terrainState.surveys.filter(item => item.status === '进行中').length;
  document.getElementById('dataAccuracy').textContent = '92%';
}

function applyFilters(options = {}) {
  const { preserveSelection = true } = options;
  const nameKeyword = (document.getElementById('terrainName')?.value || '').trim().toLowerCase();
  const riskLevel = document.getElementById('riskLevel')?.value || '';
  const timeRange = document.getElementById('timeRange')?.value || '';
  const customStartDate = document.getElementById('startDate')?.value || '';

  terrainState.filteredTerrains = terrainState.terrains.filter(record => {
    if (nameKeyword && !record.name.toLowerCase().includes(nameKeyword)) {
      return false;
    }

    if (riskLevel && record.risk_level !== riskLevel) {
      return false;
    }

    if (!passesTimeRange(record, timeRange, customStartDate)) {
      return false;
    }

    return true;
  });

  renderTerrainList(terrainState.filteredTerrains);

  const selectedId = preserveSelection ? terrainState.activeTerrainId : null;
  const nextActive = terrainState.filteredTerrains.find(item => item.id === selectedId) || terrainState.filteredTerrains[0];

  if (nextActive) {
    selectTerrainRecord(nextActive, { showDrawer: false });
  } else {
    terrainState.currentTerrain = null;
    terrainState.activeTerrainId = null;
    clearTerrainOverlay();
    updateDetailPanel(null);
    setMapTitle(null);
    resetMapToDefault('当前筛选条件下无可展示地形');
  }
}

function passesTimeRange(record, timeRange, customStartDate) {
  if (!timeRange) {
    return true;
  }

  if (timeRange === 'custom') {
    if (!customStartDate) {
      return true;
    }
    const recordDate = parseDate(record.updated_at || record.created_at);
    const startDate = parseDate(customStartDate);
    if (!recordDate || !startDate) {
      return true;
    }
    return recordDate >= startDate;
  }

  const days = Number(timeRange);
  if (!Number.isFinite(days) || days <= 0) {
    return true;
  }

  const recordDate = parseDate(record.updated_at || record.created_at);
  if (!recordDate) {
    return true;
  }

  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - days);
  return recordDate >= threshold;
}

function renderTerrainList(data) {
  const tbody = document.querySelector('#terrainTable tbody');
  if (!tbody) return;

  if (!Array.isArray(data) || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">暂无匹配的地形区域</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map((record, index) => `
    <tr class="terrain-row${record.id === terrainState.activeTerrainId ? ' active' : ''}" data-terrain-id="${record.id}">
      <th scope="row">${index + 1}</th>
      <td class="terrain-name-cell">
        <div class="terrain-name-main">${escapeHtml(record.name)}</div>
        <div class="terrain-composition-text">${escapeHtml(buildCompositionSummary(record))}</div>
      </td>
      <td>${formatArea(record.area)}</td>
      <td>${buildRiskBadge(record.risk_level)}</td>
      <td>${record.plot_count}块</td>
      <td class="terrain-actions-cell">
        <button type="button" class="btn btn-sm btn-outline-primary" data-action="focus" data-terrain-id="${record.id}">定位</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="edit" data-terrain-id="${record.id}">编辑</button>
      </td>
    </tr>
  `).join('');
}

function setActiveTerrainRow(id) {
  terrainState.activeTerrainId = id;
  document.querySelectorAll('#terrainTable tbody tr[data-terrain-id]').forEach(row => {
    row.classList.toggle('active', Number(row.dataset.terrainId) === id);
  });
}

function selectTerrainRecord(record, options = {}) {
  const { showDrawer = false } = options;
  terrainState.currentTerrain = record;
  setActiveTerrainRow(record.id);
  updateDetailPanel(record);
  focusTerrainOnMap(record);

  if (showDrawer) {
    getDetailDrawer().show();
  }
}

function parseTerrainGeometry(record) {
  const geojson = parseGeoJSON(record?.geojson);
  if (geojson) {
    return { mode: 'geojson', value: geojson };
  }

  const boundaryGeoJSON = parseGeoJSON(record?.boundary_geojson);
  if (boundaryGeoJSON) {
    return { mode: 'geojson', value: boundaryGeoJSON };
  }

  const bbox = parseBBox(record?.bbox);
  if (bbox) {
    return { mode: 'bbox', value: bbox };
  }

  const center = parseCenter(record?.center_lat, record?.center_lng);
  if (center) {
    return { mode: 'center', value: center };
  }

  return { mode: 'default', value: null };
}

function clearTerrainOverlay() {
  if (terrainState.terrainOverlay && terrainState.map) {
    terrainState.map.removeLayer(terrainState.terrainOverlay);
  }
  if (terrainState.terrainCenterMarker && terrainState.map) {
    terrainState.map.removeLayer(terrainState.terrainCenterMarker);
  }
  terrainState.terrainOverlay = null;
  terrainState.terrainCenterMarker = null;
}

function focusTerrainOnMap(record) {
  if (!terrainState.map || !record) {
    return;
  }

  clearTerrainOverlay();
  setMapTitle(record.name);

  const parsedGeometry = parseTerrainGeometry(record);
  if (parsedGeometry.mode === 'geojson') {
    terrainState.terrainOverlay = L.geoJSON(parsedGeometry.value, {
      style: {
        color: '#2563eb',
        weight: 3,
        fillColor: '#60a5fa',
        fillOpacity: 0.2
      },
      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, {
          radius: 6,
          color: '#1d4ed8',
          fillColor: '#60a5fa',
          fillOpacity: 0.9
        });
      }
    }).addTo(terrainState.map);

    const bounds = terrainState.terrainOverlay.getBounds();
    if (bounds.isValid()) {
      terrainState.map.fitBounds(bounds, { padding: [32, 32] });
      setMapStatus('已按区域边界定位');
    } else {
      resetMapToDefault('地形空间数据无有效范围，已回退默认视角');
    }
    return;
  }

  if (parsedGeometry.mode === 'bbox') {
    const [[minLat, minLng], [maxLat, maxLng]] = parsedGeometry.value;
    terrainState.terrainOverlay = L.rectangle([[minLat, minLng], [maxLat, maxLng]], {
      color: '#2563eb',
      weight: 2,
      fillColor: '#93c5fd',
      fillOpacity: 0.18
    }).addTo(terrainState.map);
    terrainState.map.fitBounds(terrainState.terrainOverlay.getBounds(), { padding: [32, 32] });
    setMapStatus('已按边界框定位');
    return;
  }

  if (parsedGeometry.mode === 'center') {
    terrainState.terrainCenterMarker = L.marker(parsedGeometry.value).addTo(terrainState.map);
    terrainState.map.setView(parsedGeometry.value, 14);
    setMapStatus('缺少边界数据，已按中心点定位');
    return;
  }

  resetMapToDefault('当前地形缺少空间数据，已回退重庆默认视角');
}

function updateDetailPanel(record) {
  document.getElementById('detailName').textContent = record ? record.name : '-';
  document.getElementById('detailArea').textContent = record ? formatArea(record.area) : '-';
  document.getElementById('detailComposition').textContent = record ? buildCompositionSummary(record) : '-';
  document.getElementById('detailRisk').textContent = record ? record.risk_level_label : '-';
  document.getElementById('detailPlotCount').textContent = record ? `${record.plot_count}块` : '-';
  document.getElementById('detailUpdatedAt').textContent = record ? formatDateTime(record.updated_at || record.created_at) : '-';
  document.getElementById('detailAccuracy').textContent = record ? '92%' : '-';
  document.getElementById('detailElevation').textContent = record ? '850' : '-';
  document.getElementById('detailSlope').textContent = record ? '25' : '-';
  document.getElementById('detailCoverage').textContent = record ? '85' : '-';
  document.getElementById('detailSoil').textContent = record ? '黄壤' : '-';
}

function buildRiskBadge(riskLevel) {
  const label = translateRiskLevel(riskLevel);
  const badgeClass = riskLevel === 'high'
    ? 'bg-danger'
    : riskLevel === 'medium'
      ? 'bg-warning text-dark'
      : 'bg-success';
  return `<span class="badge ${badgeClass}">${label}</span>`;
}

function formatArea(value) {
  const areaNumber = Number(value);
  if (!Number.isFinite(areaNumber)) {
    return '-';
  }
  return areaNumber.toFixed(2);
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) {
    return '-';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const parsedDate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function parseGeoJSON(value) {
  if (!value) {
    return null;
  }

  let parsedValue = value;
  if (typeof parsedValue === 'string') {
    try {
      parsedValue = JSON.parse(parsedValue);
    } catch (error) {
      return null;
    }
  }

  return parsedValue && typeof parsedValue === 'object' && parsedValue.type ? parsedValue : null;
}

function parseBBox(value) {
  if (!Array.isArray(value) || value.length !== 4) {
    return null;
  }

  const [minLng, minLat, maxLng, maxLat] = value.map(Number);
  if ([minLng, minLat, maxLng, maxLat].some(item => !Number.isFinite(item))) {
    return null;
  }

  return [[minLat, minLng], [maxLat, maxLng]];
}

function parseCenter(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return [latitude, longitude];
}

function resetMapToDefault(message) {
  clearTerrainOverlay();
  if (terrainState.map) {
    terrainState.map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
  }
  setMapStatus(message);
}

function setMapTitle(name) {
  const titleElement = document.getElementById('terrainMapTitle');
  if (!titleElement) return;
  titleElement.textContent = name ? `当前地形：${name}` : '当前地形：未选择';
}

function setMapStatus(message) {
  const statusElement = document.getElementById('terrainMapStatus');
  if (!statusElement) return;
  statusElement.textContent = message;
}

function getDetailDrawer() {
  if (!terrainState.detailDrawer) {
    terrainState.detailDrawer = new bootstrap.Offcanvas(document.getElementById('detailDrawer'));
  }
  return terrainState.detailDrawer;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toNullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

window.addEventListener('DOMContentLoaded', initPage);
