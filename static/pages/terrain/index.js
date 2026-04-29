// 地形管理页面逻辑

const terrainData = {
  terrains: [],
  filteredTerrains: [],
  riskAreas: [],
  surveys: [],
  riskAnalysis: [],
  riskAnalysisDetails: [],
  currentTerrain: null,
  pendingRiskTerrainId: null,
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
let terrainBottomRefreshTimer = 0;
let terrainBottomTabEventsBound = false;

const terrainDashboardState = {
  refreshIntervalMs: 5 * 60 * 1000,
  chartType: 'bar',
  chartInstance: null,
  lastRefreshedAt: '',
  risk: {
    page: 1,
    pageSize: 10,
    pagination: null
  },
  survey: {
    page: 1,
    pageSize: 10,
    pagination: null
  },
  analysis: {
    page: 1,
    pageSize: 10,
    pagination: null,
    total: 0
  },
  terrain: {
    page: 1,
    pageSize: 20,
    pagination: null
  }
};

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
  terrainData.pendingRiskTerrainId = consumeTerrainRiskUpdateFlag();

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
  loadRealData({ preferredTerrainId: terrainData.pendingRiskTerrainId });
}

function normalizeTerrainRiskLevel(level) {
  const rawLevel = String(level || '').trim();
  const normalized = {
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
  return normalized[rawLevel] || normalized[rawLevel.toLowerCase?.()] || 'none';
}

function translateRiskLevel(level) {
  const mapping = {
    high: '高风险',
    medium: '中风险',
    low: '低风险',
    none: '未评估'
  };
  return mapping[normalizeTerrainRiskLevel(level)] || '未评估';
}

function getRiskBadgeClass(level) {
  const mapping = {
    high: 'risk-high',
    medium: 'risk-medium',
    low: 'risk-low',
    none: 'risk-none'
  };
  return mapping[normalizeTerrainRiskLevel(level)] || 'risk-none';
}

function consumeTerrainRiskUpdateFlag() {
  const updatedTerrainId = sessionStorage.getItem('terrainRiskUpdated');
  if (updatedTerrainId) {
    sessionStorage.removeItem('terrainRiskUpdated');
  }
  if (localStorage.getItem('terrain_list_should_refresh') === '1') {
    localStorage.removeItem('terrain_list_should_refresh');
  }
  return updatedTerrainId || null;
}

function buildTerrainRiskComposition(summary) {
  return [
    `高风险地块 ${summary.high_risk_plot_count || 0} 个`,
    `中风险地块 ${summary.medium_risk_plot_count || 0} 个`,
    `低风险地块 ${summary.low_risk_plot_count || 0} 个`,
    `未标记 ${summary.unknown_risk_plot_count || 0} 个`
  ].join('，');
}

function buildTerrainRiskHoverText(summary) {
  const score = Number(summary.risk_score || 0);
  return `${buildTerrainRiskComposition(summary)}，风险分值 ${score}${summary.risk_reason ? `，${summary.risk_reason}` : ''}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTimestamp(value) {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function getTaskBadgeClass(status) {
  const mapping = {
    completed: 'bg-success',
    done: 'bg-success',
    finished: 'bg-success',
    success: 'bg-success',
    running: 'bg-primary',
    in_progress: 'bg-primary',
    processing: 'bg-primary',
    failed: 'bg-danger',
    error: 'bg-danger',
    cancelled: 'bg-secondary',
    pending: 'bg-warning text-dark',
    created: 'bg-warning text-dark',
    queued: 'bg-warning text-dark'
  };
  return mapping[String(status || '').toLowerCase()] || 'bg-secondary';
}

function updateTerrainBottomRefreshLabel(value) {
  const labelNode = document.getElementById('terrainBottomLastUpdated');
  if (labelNode) {
    labelNode.textContent = `最近更新：${formatTimestamp(value)}`;
  }
}

async function fetchTerrainDashboardJson(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
  const result = await response.json();
  if (result.code !== 0) {
    throw new Error(result.message || '请求失败');
  }
  return result.data || {};
}

async function loadRiskAreaModule(options = {}) {
  const {
    page = terrainDashboardState.risk.page,
    silent = false
  } = options;
  const listNode = document.getElementById('terrainRiskModuleList');
  if (listNode && !silent) {
    listNode.innerHTML = '<div class="terrain-module-loading">风险区域加载中...</div>';
  }

  const data = await fetchTerrainDashboardJson(`/terrain/api/dashboard/risk-areas/?page=${page}&page_size=${terrainDashboardState.risk.pageSize}`);
  terrainData.riskAreas = Array.isArray(data.items) ? data.items : [];
  terrainDashboardState.risk.page = data.pagination?.page || page;
  terrainDashboardState.risk.pagination = data.pagination || null;
  terrainDashboardState.lastRefreshedAt = data.refreshed_at || terrainDashboardState.lastRefreshedAt;
  renderRiskAreaModule();
}

async function loadSurveyRecordModule(options = {}) {
  const {
    page = terrainDashboardState.survey.page,
    silent = false
  } = options;
  const listNode = document.getElementById('terrainSurveyModuleList');
  if (listNode && !silent) {
    listNode.innerHTML = '<div class="terrain-module-loading">测绘记录加载中...</div>';
  }

  const data = await fetchTerrainDashboardJson(`/terrain/api/dashboard/survey-records/?page=${page}&page_size=${terrainDashboardState.survey.pageSize}`);
  terrainData.surveys = Array.isArray(data.items) ? data.items : [];
  terrainDashboardState.survey.page = data.pagination?.page || page;
  terrainDashboardState.survey.pagination = data.pagination || null;
  terrainDashboardState.lastRefreshedAt = data.refreshed_at || terrainDashboardState.lastRefreshedAt;
  renderSurveyRecordModule();
}

async function loadRiskAnalysisModule(options = {}) {
  const chartNode = document.getElementById('terrainAnalysisChart');
  if (chartNode && !terrainData.riskAnalysis.length) {
    chartNode.innerHTML = '<div class="terrain-module-loading">风险分析加载中...</div>';
  }

  const data = await fetchTerrainDashboardJson(`/terrain/api/dashboard/risk-analysis/`);
  terrainData.riskAnalysis = Array.isArray(data.items) ? data.items : [];
  terrainData.riskAnalysisDetails = buildRiskAnalysisDetails(
    terrainData.riskAnalysis,
    data.total || 0
  );
  terrainDashboardState.analysis.total = data.total || 0;
  terrainDashboardState.lastRefreshedAt = data.refreshed_at || terrainDashboardState.lastRefreshedAt;
  renderRiskAnalysisModule();
}

function resizeTerrainAnalysisChart() {
  if (!terrainDashboardState.chartInstance) {
    return;
  }
  window.requestAnimationFrame(() => {
    terrainDashboardState.chartInstance?.resize();
  });
}

async function loadTerrainBottomTabModule(targetId, options = {}) {
  switch (targetId) {
    case '#survey-content':
      await loadSurveyRecordModule(options);
      break;
    case '#analysis-content':
      await loadRiskAnalysisModule(options);
      resizeTerrainAnalysisChart();
      break;
    case '#risk-content':
    default:
      await loadRiskAreaModule(options);
      break;
  }

  updateTerrainBottomRefreshLabel(terrainDashboardState.lastRefreshedAt);
}

function bindTerrainBottomTabEvents() {
  if (terrainBottomTabEventsBound) {
    return;
  }

  const tabButtons = document.querySelectorAll('#terrainBottomTabs button[data-bs-toggle="tab"]');
  if (!tabButtons.length) {
    return;
  }

  tabButtons.forEach((button) => {
    button.addEventListener('shown.bs.tab', async (event) => {
      const targetId = event.target.getAttribute('data-bs-target');
      if (!targetId) {
        return;
      }

      try {
        await loadTerrainBottomTabModule(targetId);
      } catch (error) {
        console.error('切换底部模块标签失败:', error);
        showToast('标签内容加载失败，请稍后重试', 'danger');
      }
    });
  });

  terrainBottomTabEventsBound = true;
}

async function loadTerrainDashboardModules(options = {}) {
  const {
    silent = false
  } = options;
  try {
    const activeTab = document.querySelector('#terrainBottomTabs .active');
    const targetId = activeTab?.getAttribute('data-bs-target');
    await loadTerrainBottomTabModule(targetId, { silent });
  } catch (error) {
    console.error('加载底部模块失败:', error);
    if (!silent) {
      showToast('底部模块加载失败，请稍后重试', 'danger');
    }
  }
}

function renderModulePagination(containerId, pagination, moduleType) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }
  if (!pagination || pagination.total_pages <= 1) {
    container.innerHTML = pagination
      ? `<div class="terrain-module-pagination-info">共 ${pagination.total} 条</div>`
      : '';
    return;
  }

  const pageButtons = getPaginationPageNumbers(pagination).map((pageNumber) => `
    <button
      type="button"
      class="btn btn-sm ${pageNumber === pagination.page ? 'btn-primary' : 'btn-outline-secondary'}"
      data-module-page="${moduleType}"
      data-page="${pageNumber}"
      ${pageNumber === pagination.page ? 'aria-current="page"' : ''}
    >${pageNumber}</button>
  `).join('');

  container.innerHTML = `
    <div class="terrain-module-pagination-info">
      第 ${pagination.page} / ${pagination.total_pages} 页，共 ${pagination.total} 条
    </div>
    <div class="terrain-module-pagination-actions">
      <button type="button" class="btn btn-sm btn-outline-secondary" data-module-page="${moduleType}" data-page="${pagination.page - 1}" ${pagination.has_previous ? '' : 'disabled'}>上一页</button>
      ${pageButtons}
      <button type="button" class="btn btn-sm btn-outline-secondary" data-module-page="${moduleType}" data-page="${pagination.page + 1}" ${pagination.has_next ? '' : 'disabled'}>下一页</button>
    </div>
  `;
}

function getPaginationPageNumbers(pagination) {
  if (!pagination || pagination.total_pages <= 1) {
    return [];
  }
  const maxButtons = 5;
  let start = Math.max(1, pagination.page - 2);
  let end = Math.min(pagination.total_pages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);
  const pages = [];
  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pages.push(pageNumber);
  }
  return pages;
}

function buildRiskAnalysisDetails(items, total) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const detailItems = (Array.isArray(items) ? items : []).map((item) => {
    const count = Math.max(0, Number(item.count) || 0);
    const ratio = safeTotal > 0 ? ((count / safeTotal) * 100).toFixed(1) : '0.0';
    return {
      key: item.risk_level || 'none',
      title: `${item.risk_level_label || '未评估'}地块`,
      subtitle: '当前风险统计',
      badgeLabel: `${count} 个`,
      badgeClass: getRiskBadgeClass(item.risk_level),
      detailText: `占全部地块 ${ratio}%`,
      helperText: '统计口径：当前项目内全部有效地块',
      count
    };
  });

  detailItems.push({
    key: 'total',
    title: '地块总数',
    subtitle: '总体规模',
    badgeLabel: `${safeTotal} 个`,
    badgeClass: 'terrain-risk-badge risk-low',
    detailText: '用于计算各风险等级占比',
    helperText: '统计口径：当前项目内全部有效地块',
    count: safeTotal
  });

  return detailItems;
}

function renderRiskAreaModule() {
  const listNode = document.getElementById('terrainRiskModuleList');
  if (!listNode) return;

  if (!terrainData.riskAreas.length) {
    listNode.innerHTML = '<div class="terrain-module-empty">暂无高风险或中风险地块数据</div>';
  } else {
    listNode.innerHTML = terrainData.riskAreas.map((area, index) => `
      <article class="terrain-module-item" title="${escapeHtml(area.detail_text || '')}">
        <div class="terrain-module-item-header">
          <div class="terrain-module-item-title">
            <span class="badge bg-light text-dark border">${(terrainDashboardState.risk.page - 1) * terrainDashboardState.risk.pageSize + index + 1}</span>
            <span class="terrain-module-item-name">${escapeHtml(area.plot_name || '未命名地块')}</span>
            <span class="terrain-module-item-subtitle">${escapeHtml(area.terrain_name || '未绑定地形')}</span>
          </div>
          <span class="terrain-risk-badge ${getRiskBadgeClass(area.risk_level)}">${escapeHtml(area.risk_level_label || '未评估')}</span>
        </div>
        <div class="terrain-module-item-footer">
          <span>面积：${escapeHtml(area.area_label || '-')}</span>
          <span>更新时间：${escapeHtml(area.updated_at_label || '--')}</span>
          <div class="terrain-module-item-actions">
            <button type="button" class="btn btn-sm btn-outline-secondary" data-module-toggle="detail">展开详情</button>
            <button type="button" class="btn btn-sm btn-outline-primary" data-select-terrain-id="${escapeHtml(area.terrain_id || '')}">定位地形</button>
          </div>
        </div>
        <div class="terrain-module-item-detail">
          ${escapeHtml(area.description || area.detail_text || '暂无详细说明')}
        </div>
      </article>
    `).join('');
  }

  renderModulePagination('terrainRiskModulePagination', terrainDashboardState.risk.pagination, 'risk');
}

function renderSurveyRecordModule() {
  const listNode = document.getElementById('terrainSurveyModuleList');
  if (!listNode) return;

  if (!terrainData.surveys.length) {
    listNode.innerHTML = '<div class="terrain-module-empty">暂无测绘任务记录</div>';
  } else {
    listNode.innerHTML = terrainData.surveys.map((survey, index) => `
      <article class="terrain-module-item">
        <div class="terrain-module-item-header">
          <div class="terrain-module-item-title">
            <span class="badge bg-light text-dark border">${(terrainDashboardState.survey.page - 1) * terrainDashboardState.survey.pageSize + index + 1}</span>
            <span class="terrain-module-item-name">${escapeHtml(survey.task_name || '未命名任务')}</span>
            <span class="terrain-module-item-subtitle">${escapeHtml(survey.terrain_name || '未绑定地形')}</span>
          </div>
          <span class="badge ${getTaskBadgeClass(survey.status)}">${escapeHtml(survey.status_label || '未开始')}</span>
        </div>
        <div class="terrain-module-item-footer">
          <span>更新时间：${escapeHtml(survey.updated_at_label || '--')}</span>
          <span>场景：${escapeHtml(survey.scene_label || '--')}</span>
          <div class="terrain-module-item-actions">
            <button type="button" class="btn btn-sm btn-outline-secondary" data-task-detail-id="${survey.id}">查看详情</button>
            <a class="btn btn-sm btn-outline-primary" href="${escapeHtml(survey.detail_url || '#')}">管理任务</a>
          </div>
        </div>
        <div class="terrain-module-item-detail">
          <div>开始时间：${escapeHtml(survey.planned_start_label || '--')}</div>
          <div>结束时间：${escapeHtml(survey.planned_end_label || '--')}</div>
          <div>说明：${escapeHtml(survey.description || '暂无任务说明')}</div>
        </div>
      </article>
    `).join('');
  }

  renderModulePagination('terrainSurveyModulePagination', terrainDashboardState.survey.pagination, 'survey');
}

function ensureTerrainAnalysisChart() {
  const chartNode = document.getElementById('terrainAnalysisChart');
  if (!chartNode || typeof echarts === 'undefined') {
    return null;
  }
  if (!terrainDashboardState.chartInstance) {
    terrainDashboardState.chartInstance = echarts.init(chartNode);
  }
  return terrainDashboardState.chartInstance;
}

function renderRiskAnalysisModule() {
  const summaryNode = document.getElementById('terrainAnalysisSummary');
  if (summaryNode) {
    summaryNode.innerHTML = terrainData.riskAnalysisDetails.map(item => `
      <div class="analysis-item mb-2 p-2 border rounded">
        <div class="d-flex justify-content-between">
          <span class="small text-muted">${item.title}</span>
          <span class="badge ${item.badgeClass}">${item.badgeLabel}</span>
        </div>
        <div class="small fw-bold">${item.detailText}</div>
      </div>
    `).join('');
  }

  const chart = ensureTerrainAnalysisChart();
  if (!chart) return;

  const labels = terrainData.riskAnalysis.map(item => item.risk_level_label || '未评估');
  const values = terrainData.riskAnalysis.map(item => Number(item.count || 0));
  const colors = ['#22c55e', '#f59e0b', '#ef4444'];

  const option = terrainDashboardState.chartType === 'pie'
    ? {
        color: colors,
        tooltip: { trigger: 'item' },
        legend: { bottom: 0 },
        series: [
          {
            type: 'pie',
            radius: ['38%', '68%'],
            center: ['50%', '45%'],
            data: terrainData.riskAnalysis.map((item, index) => ({
              name: item.risk_level_label || '未评估',
              value: Number(item.count || 0),
              itemStyle: { color: colors[index % colors.length] }
            })),
            label: { formatter: '{b}: {c}' }
          }
        ]
      }
    : {
        color: colors,
        tooltip: { trigger: 'axis' },
        grid: { left: 36, right: 24, top: 24, bottom: 36, containLabel: true },
        xAxis: {
          type: 'category',
          data: labels
        },
        yAxis: {
          type: 'value',
          minInterval: 1
        },
        series: [
          {
            type: 'bar',
            barWidth: 42,
            data: values.map((value, index) => ({
              value,
              itemStyle: { color: colors[index % colors.length], borderRadius: [8, 8, 0, 0] }
            }))
          }
        ]
      };

  chart.setOption(option, true);
  window.setTimeout(() => chart.resize(), 0);
}

function startTerrainBottomAutoRefresh() {
  if (terrainBottomRefreshTimer) {
    window.clearInterval(terrainBottomRefreshTimer);
  }
  terrainBottomRefreshTimer = window.setInterval(() => {
    loadTerrainDashboardModules({ silent: true });
  }, terrainDashboardState.refreshIntervalMs);
}

function requestTerrainMapResize() {
  if (!terrainMap?.map) return;
  window.requestAnimationFrame(() => terrainMap.map.invalidateSize());
  window.setTimeout(() => terrainMap?.map?.invalidateSize(), 260);
}

function getTerrainSidebarState() {
  return document.body.classList.contains('toggle-sidebar') ? 'collapsed' : 'expanded';
}

function applyTerrainMainLayoutBootstrapCols(sidebarState) {
  const listPanel = document.getElementById('terrainListPanel');
  const topicPanel = document.getElementById('terrainTopicPanel');
  if (!listPanel || !topicPanel) return;
  listPanel.className = sidebarState === 'collapsed' ? 'col-12 col-lg-5 terrain-main-panel terrain-main-col' : 'col-12 col-lg-5 terrain-main-panel terrain-main-col';
  topicPanel.className = sidebarState === 'collapsed' ? 'col-12 col-lg-7 terrain-main-panel terrain-main-col' : 'col-12 col-lg-7 terrain-main-panel terrain-main-col';
}

function syncTerrainMainLayoutBySidebarState() {
  const layout = document.getElementById('terrainMainLayout');
  if (!layout) return;
  const nextState = getTerrainSidebarState();
  const changed = layout.dataset.sidebarState !== nextState;
  layout.dataset.sidebarState = nextState;
  applyTerrainMainLayoutBootstrapCols(nextState);
  if (changed) requestTerrainMapResize();
  scheduleTerrainDetailElasticHeightSync();
}

function bindTerrainMainLayoutSidebarSync() {
  if (terrainLayoutObserver) return;
  terrainLayoutObserver = new MutationObserver(() => syncTerrainMainLayoutBySidebarState());
  terrainLayoutObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

function scheduleTerrainDetailElasticHeightSync() {
  if (terrainElasticHeightRaf) window.cancelAnimationFrame(terrainElasticHeightRaf);
  terrainElasticHeightRaf = window.requestAnimationFrame(() => {
    terrainElasticHeightRaf = 0;
    syncTerrainDetailElasticHeight();
  });
}

function syncTerrainDetailElasticHeight() {
  const listCard = document.getElementById('terrainListCard');
  const topicCard = document.getElementById('terrainTopicCard');
  const descriptionBlock = document.getElementById('terrainDescriptionBlock');
  if (!listCard || !topicCard || !descriptionBlock) return;
  
  descriptionBlock.style.minHeight = '60px';
  const leftHeight = listCard.offsetHeight;
  const rightHeight = topicCard.offsetHeight;
  if (leftHeight > rightHeight) {
    descriptionBlock.style.minHeight = (60 + leftHeight - rightHeight) + 'px';
  }
}

function bindTerrainLayoutResizeSync() {
  window.addEventListener('resize', scheduleTerrainDetailElasticHeightSync, { passive: true });
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => scheduleTerrainDetailElasticHeightSync());
    ['terrainListCard', 'terrainTopicCard', 'terrainInfoPanel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }
}

function formatArea(area) {
  const numericArea = Number(area);
  return isFinite(numericArea) && numericArea > 0 ? `${numericArea.toFixed(2)} 公顷` : '-';
}

function normalizeTerrainItem(raw) {
  const riskLevel = normalizeTerrainRiskLevel(raw.risk_level);
  return {
    ...raw,
    riskLevelRaw: riskLevel,
    riskLabel: translateRiskLevel(riskLevel),
    riskClass: getRiskBadgeClass(riskLevel),
    areaLabel: formatArea(raw.area),
    updatedAtLabel: formatTimestamp(raw.updated_at),
    plotCountLabel: `${raw.plot_count || 0} 个`,
    riskCompositionText: buildTerrainRiskComposition(raw),
    riskHoverText: buildTerrainRiskHoverText(raw),
    bbox: buildBBoxObject(raw),
    dataAccuracyLabel: raw.accuracy ? `${raw.accuracy}%` : '待补充'
  };
}

function buildBBoxObject(raw) {
  const minLng = Number(raw.bbox_min_lng);
  const minLat = Number(raw.bbox_min_lat);
  const maxLng = Number(raw.bbox_max_lng);
  const maxLat = Number(raw.bbox_max_lat);
  if (!isFinite(minLng) || !isFinite(minLat)) return null;
  return { minLng, minLat, maxLng, maxLat };
}

function getTerrainById(id) {
  return terrainData.terrains.find(item => String(item.id) === String(id));
}

async function selectTerrainRow(id, options = {}) {
  const terrain = getTerrainById(id);
  if (!terrain) return;

  terrainData.currentTerrain = terrain;
  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.selectedTerrainId = terrain.id;
  }

  updateDetailPanel(terrain);
  
  if (options.syncMap && terrainMap) {
    terrainMap.selectTerrain(terrain, options);
  }
  
  setTerrainEditButtonDisabled(false);
}

function clearCurrentSelection(options = {}) {
  terrainData.currentTerrain = null;
  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.selectedTerrainId = null;
  }
  resetDetailPanel();
  const hintNode = document.getElementById('terrainMapSelectionHint');
  if (hintNode) hintNode.textContent = options.emptyMessage || '当前未选中地形。';
  setTerrainEditButtonDisabled(true);
}

async function loadRealData(options = {}) {
  const { preferredTerrainId = null, page = 1 } = options;
  try {
    const response = await fetch(`/terrain/api/areas/?page=${page}&page_size=${terrainDashboardState.terrain.pageSize}&_ts=${Date.now()}`);
    const result = await response.json();
    if (result.code !== 0) return;

    terrainData.terrains = result.data.items.map(normalizeTerrainItem);
    terrainData.filteredTerrains = [...terrainData.terrains];
    terrainDashboardState.terrain.pagination = result.data.pagination;

    if (terrainMap) terrainMap.loadTerrains(terrainData.terrains);
    
    updatePageData();
    const preferredTerrain = preferredTerrainId ? getTerrainById(preferredTerrainId) : null;
    if (preferredTerrain) {
      await selectTerrainRow(preferredTerrain.id, { syncMap: true, fit: true });
    } else if (terrainData.terrains.length) {
      await selectTerrainRow(terrainData.terrains[0].id, { syncMap: true, fit: true });
    }
  } catch (error) {
    console.error('加载地形列表异常:', error);
  }
}

function initVue() {
  vueInstances.terrainTable = new Vue({
    el: '#terrainTable',
    data: {
      terrains: [],
      selectedTerrainId: null,
      emptyStateMessage: ''
    },
    template: `
      <div>
        <div v-if="terrains.length" class="terrain-table-wrap">
          <table class="table table-hover mb-0">
            <thead>
              <tr>
                <th width="60">序号</th>
                <th>地形名称</th>
                <th width="100">风险等级</th>
                <th width="120">面积</th>
                <th width="80">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(t, i) in terrains" :key="t.id" 
                  :class="{'table-primary': selectedTerrainId === t.id}"
                  @click="select(t)">
                <td>{{ i + 1 }}</td>
                <td><div class="fw-bold">{{ t.name }}</div></td>
                <td><span class="badge" :class="t.riskClass">{{ t.riskLabel }}</span></td>
                <td>{{ t.areaLabel }}</td>
                <td>
                  <button class="btn btn-sm btn-outline-primary" @click.stop="edit(t)">编辑</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="p-4 text-center text-muted">{{ emptyStateMessage }}</div>
      </div>
    `,
    methods: {
      select(t) { selectTerrainRow(t.id, { syncMap: true, fit: true }); },
      edit(t) { openEditModal(t); }
    }
  });

  vueInstances.pagination = new Vue({
    el: '#pagination',
    data: { pagination: null },
    template: `
      <div v-if="pagination && pagination.total_pages > 1" class="d-flex justify-content-between align-items-center w-100">
        <div class="small text-muted">共 {{ pagination.total }} 条</div>
        <ul class="pagination pagination-sm mb-0">
          <li class="page-item" :class="{disabled: !pagination.has_previous}">
            <a class="page-link" @click="setPage(pagination.page - 1)">上一页</a>
          </li>
          <li v-for="p in pagination.total_pages" :key="p" class="page-item" :class="{active: p === pagination.page}">
            <a class="page-link" @click="setPage(p)">{{ p }}</a>
          </li>
          <li class="page-item" :class="{disabled: !pagination.has_next}">
            <a class="page-link" @click="setPage(pagination.page + 1)">下一页</a>
          </li>
        </ul>
      </div>
    `,
    methods: {
      setPage(p) { loadRealData({ page: p }); }
    }
  });
}

function updatePageData() {
  document.getElementById('totalTerrains').textContent = terrainDashboardState.terrain.pagination?.total || 0;
  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.terrains = terrainData.terrains;
    vueInstances.terrainTable.emptyStateMessage = terrainData.emptyStateMessage;
  }
  if (vueInstances.pagination) {
    vueInstances.pagination.pagination = terrainDashboardState.terrain.pagination;
  }
}

function updateDetailPanel(terrain) {
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('infoName', terrain.name);
  setText('infoArea', terrain.areaLabel);
  setText('infoAccuracy', terrain.dataAccuracyLabel);
  setText('infoUpdatedAt', terrain.updatedAtLabel);
  setText('infoPlotCount', terrain.plotCountLabel);
  setText('infoRiskComposition', terrain.riskCompositionText);
  setText('infoRiskScore', terrain.risk_score || 0);
  setText('infoRiskReason', terrain.risk_reason || '暂无风险判定说明');
  setText('infoBboxMin', terrain.bbox ? `${terrain.bbox.minLng.toFixed(4)}, ${terrain.bbox.minLat.toFixed(4)}` : '-');
  setText('infoBboxMax', terrain.bbox ? `${terrain.bbox.maxLng.toFixed(4)}, ${terrain.bbox.maxLat.toFixed(4)}` : '-');
  setText('infoDescription', terrain.description || '无补充描述');
  const r = document.getElementById('infoRisk');
  if (r) { r.textContent = terrain.riskLabel; r.className = `badge ${terrain.riskClass}`; }
}

function initEvents() {
  document.getElementById('addTerrainBtn').addEventListener('click', () => { window.location.href = '/terrain/editor/'; });
  document.getElementById('editTerrainMapBtn').addEventListener('click', () => {
    if (terrainData.currentTerrain) window.location.href = `/terrain/editor/?area_id=${terrainData.currentTerrain.id}`;
  });

  document.getElementById('terrainBottomRefreshBtn').addEventListener('click', async () => {
    await loadTerrainDashboardModules();
    showToast('刷新成功');
  });

  document.getElementById('executeTaskBtn').addEventListener('click', openTaskModal);
  document.getElementById('startTaskBtn').addEventListener('click', startSurveyTask);

  document.addEventListener('click', (e) => {
    const detailBtn = e.target.closest('[data-module-toggle="detail"]');
    if (detailBtn) {
      const item = detailBtn.closest('.terrain-module-item');
      item.classList.toggle('is-expanded');
      detailBtn.textContent = item.classList.contains('is-expanded') ? '收起详情' : '展开详情';
    }

    const pageBtn = e.target.closest('[data-module-page]');
    if (pageBtn) {
      const m = pageBtn.dataset.modulePage;
      const p = Number(pageBtn.dataset.page);
      if (m === 'risk') loadRiskAreaModule({ page: p });
      else if (m === 'survey') loadSurveyRecordModule({ page: p });
    }

    const taskDetailBtn = e.target.closest('[data-task-detail-id]');
    if (taskDetailBtn) {
      showTaskDetail(taskDetailBtn.dataset.taskDetailId);
    }
  });

  document.getElementById('saveTerrainBtn').addEventListener('click', saveTerrainInfo);

  initToolbarActions();
}

async function openEditModal(terrain) {
  document.getElementById('terrainId').value = terrain.id;
  document.getElementById('name').value = terrain.name;
  document.getElementById('area').value = terrain.area;
  document.getElementById('editRiskLevel').value = terrain.riskLevelRaw;
  document.getElementById('description').value = terrain.description || '';
  
  // 加载可用无人机
  const resp = await fetch(`/terrain/api/drones/available/?terrain_id=${terrain.id}`);
  const result = await resp.json();
  const select = document.getElementById('editDroneId');
  select.innerHTML = '<option value="0">暂不绑定</option>';
  result.data.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.drone_name} (${d.model_name})`;
    if (d.terrain_id == terrain.id) opt.selected = true;
    select.appendChild(opt);
  });

  new bootstrap.Modal(document.getElementById('editModal')).show();
}

async function saveTerrainInfo() {
  const data = {
    terrain: {
      id: document.getElementById('terrainId').value,
      name: document.getElementById('name').value,
      area: document.getElementById('area').value,
      risk_level: document.getElementById('editRiskLevel').value,
      description: document.getElementById('description').value,
      drone_id: document.getElementById('editDroneId').value
    },
    plots: [] // 仅更新地形信息
  };

  const resp = await fetch('/terrain/api/terrain/save/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
    body: JSON.stringify(data)
  });
  
  const result = await resp.json();
  if (result.code === 0) {
    showToast('保存成功');
    bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
    loadRealData({ preferredTerrainId: data.terrain.id });
  } else {
    showToast(result.message, 'danger');
  }
}

async function openTaskModal() {
  if (!terrainData.currentTerrain) return;
  const t = terrainData.currentTerrain;
  document.getElementById('taskTerrainId').value = t.id;
  document.getElementById('taskTerrainName').value = t.name;
  document.getElementById('taskName').value = `${t.name}测绘任务`;
  
  const info = document.getElementById('taskDroneInfo');
  const warn = document.getElementById('noDroneWarning');
  const btn = document.getElementById('startTaskBtn');
  
  if (t.drone) {
    info.innerHTML = `<strong>绑定无人机:</strong> ${t.drone.drone_name} (${t.drone.model_name})`;
    info.classList.remove('d-none');
    warn.classList.add('d-none');
    btn.disabled = false;
  } else {
    info.classList.add('d-none');
    warn.classList.remove('d-none');
    btn.disabled = true;
  }
  
  new bootstrap.Modal(document.getElementById('taskModal')).show();
}

async function startSurveyTask() {
  const data = {
    terrain_id: document.getElementById('taskTerrainId').value,
    task_name: document.getElementById('taskName').value,
    description: document.getElementById('taskDescription').value
  };

  const resp = await fetch('/terrain/api/terrain/execute-task/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
    body: JSON.stringify(data)
  });
  
  const result = await resp.json();
  if (result.code === 0) {
    showToast('任务已启动');
    bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
    loadSurveyRecordModule();
  } else {
    showToast(result.message, 'danger');
  }
}

function showTaskDetail(taskId) {
  const task = terrainData.surveys.find(s => s.id == taskId);
  if (!task) return;
  
  document.getElementById('detailTaskName').textContent = task.task_name;
  const statusEl = document.getElementById('detailTaskStatus');
  statusEl.textContent = task.status_label;
  statusEl.className = `badge ${getTaskBadgeClass(task.status)}`;
  
  const body = document.getElementById('shiftListBody');
  body.innerHTML = (task.shifts || []).map((s, i) => `
    <tr>
      <td>班次 ${i + 1}</td>
      <td>${s.drone_name}</td>
      <td>${s.start_time_label}</td>
      <td>${s.end_time_label}</td>
      <td><span class="badge bg-info">${s.status}</span></td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="text-center text-muted">暂无班次信息</td></tr>';
  
  new bootstrap.Modal(document.getElementById('taskDetailModal')).show();
}

function initTables() {
  bindTerrainBottomTabEvents();
  loadTerrainBottomTabModule('#risk-content');
  startTerrainBottomAutoRefresh();
}

function getCSRFToken() {
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const c = cookies[i].trim();
    if (c.startsWith('csrftoken=')) return decodeURIComponent(c.substring(10));
  }
  return null;
}

function initToolbarActions() {
  const b = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  b('btnImportTerrain', openImportModal);
  b('btnExportTerrain', exportTerrainData);
  b('btnRefreshTerrain', () => loadRealData());
  b('btnDownloadImportTemplate', downloadImportTemplate);
  b('btnStartImportTerrain', startImportTerrain);
}

function openImportModal() {
  document.getElementById('terrainImportFile').value = '';
  document.getElementById('terrainImportError').classList.add('d-none');
  new bootstrap.Modal(document.getElementById('terrainImportModal')).show();
}

async function startImportTerrain() {
  const file = document.getElementById('terrainImportFile').files[0];
  if (!file) return showToast('请选择文件', 'warning');
  const fd = new FormData();
  fd.append('file', file);
  const resp = await fetch('/terrain/api/areas/import/', {
    method: 'POST',
    headers: { 'X-CSRFToken': getCSRFToken() },
    body: fd
  });
  const res = await resp.json();
  if (res.success || res.code === 0) {
    showToast('导入成功');
    bootstrap.Modal.getInstance(document.getElementById('terrainImportModal')).hide();
    loadRealData();
  } else {
    showToast(res.message || '导入失败', 'danger');
  }
}

function exportTerrainData() {
  const list = terrainData.terrains.map(t => ({ id: t.id, name: t.name, risk: t.riskLevelRaw, area: t.area }));
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'terrain_data.json';
  a.click();
}

async function downloadImportTemplate() {
  const resp = await fetch('/terrain/api/areas/import-template/');
  const data = await resp.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'terrain_template.json';
  a.click();
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container') || (() => {
    const d = document.createElement('div');
    d.id = 'toast-container';
    d.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
    document.body.appendChild(d);
    return d;
  })();
  const t = document.createElement('div');
  t.className = `toast align-items-center text-white bg-${type} border-0 mb-2 show`;
  t.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function updateTerrainListCount(f, t) {
  const el = document.getElementById('terrainListCount');
  if (el) el.textContent = `${f} / ${t} 条`;
}

function setTerrainEditButtonDisabled(d) {
  const b = document.getElementById('editTerrainMapBtn');
  const e = document.getElementById('executeTaskBtn');
  if (b) b.disabled = d;
  if (e) e.disabled = d;
}

function resetDetailPanel() {
  ['infoName','infoArea','infoAccuracy','infoUpdatedAt','infoPlotCount','infoRiskComposition','infoRiskScore','infoRiskReason','infoBboxMin','infoBboxMax','infoDescription'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '-';
  });
  const r = document.getElementById('infoRisk'); if (r) { r.textContent = '-'; r.className = 'badge bg-secondary'; }
}

function initFilterForm() {
  const f = document.getElementById('terrainFilterForm');
  f.addEventListener('submit', (e) => { e.preventDefault(); loadRealData(); });
  document.getElementById('resetBtn').addEventListener('click', () => { f.reset(); loadRealData(); });
}

window.addEventListener('DOMContentLoaded', initPage);
