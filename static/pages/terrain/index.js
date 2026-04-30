// 地形管理页面逻辑

const terrainData = {
  terrains: [],
  filteredTerrains: [],
  riskAreas: [],
  surveys: [],
  surveyMessage: '',
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
    pageSize: 10,
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
  let result = null;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error(response.ok ? '服务返回格式异常' : `请求失败(${response.status})`);
  }
  if (!response.ok) {
    throw new Error(result?.message || `请求失败(${response.status})`);
  }
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
  if (terrainData.currentTerrain) {
    updateDetailPanel(terrainData.currentTerrain);
  }
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
  terrainData.surveyMessage = '';

  try {
    const data = await fetchTerrainDashboardJson(`/terrain/api/dashboard/survey-records/?page=${page}&page_size=${terrainDashboardState.survey.pageSize}`);
    terrainData.surveys = Array.isArray(data.items) ? data.items : [];
    terrainData.surveyMessage = terrainData.surveys.length ? '' : '暂无测绘记录';
    terrainDashboardState.survey.page = data.pagination?.page || page;
    terrainDashboardState.survey.pagination = data.pagination || null;
    terrainDashboardState.lastRefreshedAt = data.refreshed_at || terrainDashboardState.lastRefreshedAt;
  } catch (error) {
    console.error('加载测绘记录失败:', error);
    terrainData.surveys = [];
    terrainData.surveyMessage = '暂无测绘记录';
    terrainDashboardState.survey.page = page;
    terrainDashboardState.survey.pagination = null;
  }

  renderSurveyRecordModule();
  if (terrainData.currentTerrain) {
    updateDetailPanel(terrainData.currentTerrain);
  }
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

function buildSelectedTerrainRiskAnalysis(terrain) {
  if (!terrain?.id) {
    return {
      items: terrainData.riskAnalysis,
      details: terrainData.riskAnalysisDetails
    };
  }
  const items = [
    {
      risk_level: 'high',
      risk_level_label: '高风险',
      count: Number(terrain.high_risk_plot_count || 0)
    },
    {
      risk_level: 'medium',
      risk_level_label: '中风险',
      count: Number(terrain.medium_risk_plot_count || 0)
    },
    {
      risk_level: 'low',
      risk_level_label: '低风险',
      count: Number(terrain.low_risk_plot_count || 0)
    },
    {
      risk_level: 'none',
      risk_level_label: '未评估',
      count: Number(terrain.unknown_risk_plot_count || 0)
    }
  ];
  const total = items.reduce((sum, item) => sum + Number(item.count || 0), 0);
  return {
    items,
    details: buildRiskAnalysisDetails(items, total)
  };
}

function renderRiskAreaModule() {
  const listNode = document.getElementById('terrainRiskModuleList');
  if (!listNode) return;

  const filteredItems = getCurrentTerrainFilteredItems(terrainData.riskAreas, matchesCurrentTerrain);
  if (!filteredItems.length) {
    listNode.innerHTML = `<div class="terrain-module-empty">${terrainData.currentTerrain ? '当前地形暂无高风险或中风险地块数据' : '暂无高风险或中风险地块数据'}</div>`;
  } else {
    listNode.innerHTML = filteredItems.map((area, index) => `
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

  const filteredItems = getCurrentTerrainFilteredItems(terrainData.surveys, matchesCurrentTerrain);
  if (!filteredItems.length) {
    listNode.innerHTML = `<div class="terrain-module-empty">${escapeHtml(terrainData.currentTerrain ? '当前地形暂无测绘记录' : (terrainData.surveyMessage || '暂无测绘记录'))}</div>`;
  } else {
    listNode.innerHTML = filteredItems.map((survey, index) => `
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
  const riskAnalysisPayload = buildSelectedTerrainRiskAnalysis(terrainData.currentTerrain);
  const summaryNode = document.getElementById('terrainAnalysisSummary');
  if (summaryNode) {
    summaryNode.innerHTML = riskAnalysisPayload.details.map(item => `
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

  const labels = riskAnalysisPayload.items.map(item => item.risk_level_label || '未评估');
  const values = riskAnalysisPayload.items.map(item => Number(item.count || 0));
  const colors = ['#ef4444', '#f59e0b', '#22c55e', '#94a3b8'];

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
            data: riskAnalysisPayload.items.map((item, index) => ({
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
  window.setTimeout(() => terrainMap?.map?.invalidateSize(), 520);
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
  const descriptionBlock = document.getElementById('terrainDescriptionBlock');
  if (!descriptionBlock) return;
  descriptionBlock.style.minHeight = '';
  requestTerrainMapResize();
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

function formatAreaCompact(area) {
  const numericArea = Number(area);
  return Number.isFinite(numericArea) && numericArea > 0 ? `${numericArea.toFixed(2)} 公顷` : '面积待补充';
}

function toFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeTerrainItem(raw) {
  const riskLevel = normalizeTerrainRiskLevel(raw.risk_level);
  const drones = Array.isArray(raw.drones)
    ? raw.drones
    : (raw.drone ? [raw.drone] : []);
  const droneIds = Array.isArray(raw.drone_ids)
    ? raw.drone_ids
    : (raw.drone_id ? [raw.drone_id] : []);
  return {
    ...raw,
    drones,
    droneIds,
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
  const values = [raw.bbox_min_lng, raw.bbox_min_lat, raw.bbox_max_lng, raw.bbox_max_lat];
  const hasMissingValue = values.some(value => value === null || value === undefined || value === '');
  if (hasMissingValue) return null;
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null;
  return { minLng, minLat, maxLng, maxLat };
}

function formatCoordinateValue(value) {
  const numericValue = toFiniteNumber(value);
  return numericValue === null ? '-' : numericValue.toFixed(4);
}

function formatCenterCoord(terrain) {
  const centerLng = toFiniteNumber(terrain?.center_lng);
  const centerLat = toFiniteNumber(terrain?.center_lat);
  if (centerLng === null || centerLat === null) {
    return '-';
  }
  return `${centerLng.toFixed(4)}, ${centerLat.toFixed(4)}`;
}

function buildCoverageRangeLabel(terrain) {
  if (!terrain?.bbox) {
    return '边界范围待补充';
  }
  const lngSpan = terrain.bbox.maxLng - terrain.bbox.minLng;
  const latSpan = terrain.bbox.maxLat - terrain.bbox.minLat;
  if (!Number.isFinite(lngSpan) || !Number.isFinite(latSpan)) {
    return '边界范围待补充';
  }
  return `经差 ${lngSpan.toFixed(4)} / 纬差 ${latSpan.toFixed(4)}`;
}

function getCurrentLayerModeLabel() {
  const boundaryButton = document.getElementById('btn-boundary');
  return boundaryButton?.classList.contains('active') ? '边界' : '地块';
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function toggleCommandBoardState(hasTerrain) {
  const emptyState = document.getElementById('terrainCommandEmptyState');
  const detailPanel = document.getElementById('terrainDetailPanel');
  if (emptyState) {
    emptyState.classList.toggle('d-none', hasTerrain);
  }
  if (detailPanel) {
    detailPanel.classList.toggle('d-none', !hasTerrain);
  }
}

function getCurrentTerrainFilteredItems(items, resolver) {
  if (!terrainData.currentTerrain) {
    return Array.isArray(items) ? items : [];
  }
  return (Array.isArray(items) ? items : []).filter((item) => resolver(item, terrainData.currentTerrain));
}

function matchesCurrentTerrain(item, terrain) {
  if (!terrain) {
    return true;
  }
  if (item?.terrain_id && String(item.terrain_id) === String(terrain.id)) {
    return true;
  }
  const terrainName = String(terrain?.name || '').trim();
  return terrainName && String(item?.terrain_name || '').trim() === terrainName;
}

function getPlotGeometry(plot) {
  return plot?.geometry || plot?.geom_json || plot?.boundary_json || null;
}

function focusPlotGeometryOnMap(plot) {
  const geometry = getPlotGeometry(plot);
  if (!geometry || !terrainMap?.map || typeof L === 'undefined') {
    terrainMap?.focusTerrainTopic?.(terrainData.currentTerrain);
    return;
  }
  try {
    const layer = L.geoJSON(geometry);
    const bounds = layer.getBounds?.();
    if (bounds?.isValid?.()) {
      terrainMap.map.fitBounds(bounds, {
        padding: [28, 28],
        maxZoom: 17
      });
      return;
    }
  } catch (error) {
    console.warn('定位地块失败，改为定位地形:', error);
  }
  terrainMap?.focusTerrainTopic?.(terrainData.currentTerrain);
}

function buildPlotRiskBadge(level, display) {
  const normalizedLevel = normalizeTerrainRiskLevel(level);
  return `<span class="terrain-risk-badge ${getRiskBadgeClass(normalizedLevel)}">${escapeHtml(display || translateRiskLevel(normalizedLevel))}</span>`;
}

function renderPlotDetailModule(terrain) {
  const listNode = document.getElementById('terrainPlotList');
  const countNode = document.getElementById('terrainPlotPanelCount');
  const subtitleNode = document.getElementById('terrainPlotPanelSubtitle');
  if (!listNode) {
    return;
  }

  const plots = Array.isArray(terrain?.plots) ? terrain.plots : [];
  if (countNode) {
    countNode.textContent = `${plots.length} 个地块`;
  }
  if (subtitleNode) {
    subtitleNode.textContent = terrain?.name
      ? `展示 ${terrain.name} 的组成地块，可展开详情并在地图中定位。`
      : '展示当前地形的组成地块，可展开详情并在地图中定位。';
  }

  if (!terrain?.id) {
    listNode.innerHTML = '<div class="terrain-module-empty">请先选择地形后查看地块明细</div>';
    return;
  }

  if (!plots.length) {
    listNode.innerHTML = '<div class="terrain-module-empty">当前地形暂无地块明细数据</div>';
    return;
  }

  listNode.innerHTML = plots.map((plot, index) => {
    const plotName = plot?.name || plot?.plot_name || `地块 ${index + 1}`;
    const typeLabel = plot?.type_label || TERRAIN_PLOT_TYPE_LABELS[plot?.category] || plot?.category || '未分类';
    const subtypeLabel = plot?.subtype_label || plot?.subtype || '';
    const areaLabel = formatAreaCompact(plot?.area);
    const riskLabel = plot?.risk_level_display || plot?.risk_level_label || translateRiskLevel(plot?.risk_level);
    const description = plot?.description || plot?.remark || '暂无地块说明';
    return `
      <article class="terrain-plot-item" data-plot-index="${index}">
        <div class="terrain-plot-item-header">
          <div>
            <div class="terrain-plot-item-name">${escapeHtml(plotName)}</div>
            <div class="terrain-plot-item-meta">
              <span>${escapeHtml(typeLabel)}${subtypeLabel ? ` / ${escapeHtml(subtypeLabel)}` : ''}</span>
              <span>${escapeHtml(areaLabel)}</span>
            </div>
          </div>
          ${buildPlotRiskBadge(plot?.risk_level, riskLabel)}
        </div>
        <div class="terrain-plot-item-footer">
          <div class="terrain-plot-item-meta">
            <span>编号：${escapeHtml(plot?.id || '--')}</span>
            <span>更新时间：${escapeHtml(formatTimestamp(plot?.updated_at) || '--')}</span>
          </div>
          <div class="terrain-plot-item-actions">
            <button type="button" class="btn btn-sm btn-outline-primary" data-plot-locate="${index}">定位地块</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" data-plot-toggle="${index}">展开详情</button>
          </div>
        </div>
        <div class="terrain-plot-detail">
          <div>风险说明：${escapeHtml(description)}</div>
          <div>坐标数据：${getPlotGeometry(plot) ? '已同步' : '待补充'}</div>
        </div>
      </article>
    `;
  }).join('');
}

function getTerrainById(id) {
  return terrainData.terrains.find(item => String(item.id) === String(id));
}

function openTerrainEditor(terrain) {
  if (!terrain?.id) return;
  window.location.href = `/terrain/editor/?area_id=${terrain.id}`;
}

function buildSpatialSummary(terrain) {
  if (!terrain?.bbox) {
    return '当前缺少范围坐标，请先在编辑器中保存有效边界。';
  }
  if (terrain?.has_boundary === false) {
    return '当前地形边界待补充，地图仅展示已有地块范围。';
  }
  return terrain.accuracy
    ? `边界已生成，当前精度 ${terrain.dataAccuracyLabel}，可用于空间定位与任务执行。`
    : '边界已生成，可用于地图定位与任务执行。';
}

function formatDroneLabel(drone) {
  if (!drone) {
    return '未绑定';
  }
  return `${drone.drone_name || '未命名无人机'}${drone.model_name ? ` (${drone.model_name})` : ''}`;
}

function getTerrainBoundDrones(terrain) {
  if (Array.isArray(terrain?.drones) && terrain.drones.length) {
    return terrain.drones;
  }
  if (terrain?.drone) {
    return [terrain.drone];
  }
  return [];
}

function getTerrainSurveyPresentation(terrain) {
  const terrainId = terrain?.id;
  const terrainName = String(terrain?.name || '').trim();
  const terrainSurveys = (Array.isArray(terrainData.surveys) ? terrainData.surveys : []).filter((survey) => {
    if (terrainId && String(survey?.terrain_id || '') === String(terrainId)) {
      return true;
    }
    return terrainName && String(survey?.terrain_name || '').trim() === terrainName;
  });

  if (!getTerrainBoundDrones(terrain).length) {
    return { label: '未配置无人机', metricLabel: '未配置无人机' };
  }
  if (!terrainSurveys.length) {
    return { label: '待调度', metricLabel: '待调度' };
  }

  const firstRunning = terrainSurveys.find((survey) => ['running', 'in_progress', 'processing'].includes(String(survey?.status || '').toLowerCase()));
  if (firstRunning) {
    return {
      label: terrainSurveys.length > 1 ? `执行中 · ${terrainSurveys.length} 个任务` : '执行中',
      metricLabel: '执行中'
    };
  }

  const firstPending = terrainSurveys.find((survey) => ['pending', 'created', 'queued'].includes(String(survey?.status || '').toLowerCase()));
  if (firstPending) {
    return {
      label: terrainSurveys.length > 1 ? `待执行 · ${terrainSurveys.length} 个任务` : '待执行',
      metricLabel: '待执行'
    };
  }

  const latestSurvey = terrainSurveys[0];
  return {
    label: latestSurvey?.status_label || '已完成',
    metricLabel: latestSurvey?.status_label || '已完成'
  };
}

function getDroneGroupingMode(drones) {
  const hasExplicitPurpose = drones.some((drone) => (
    drone?.purpose || drone?.usage || drone?.usage_type || drone?.scene_type
  ));
  return hasExplicitPurpose ? 'purpose' : 'model';
}

function normalizeDroneGroupLabelByPurpose(rawValue) {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!value) return '未分类无人机';
  if (/(survey|map|测绘)/.test(value)) return '测绘无人机';
  if (/(patrol|inspect|巡检)/.test(value)) return '巡检无人机';
  if (/(relay|transport|cargo|中继|运输)/.test(value)) return '运输/中继无人机';
  if (/(backup|reserve|spare|备用)/.test(value)) return '备用无人机';
  return '未分类无人机';
}

function normalizeDroneGroupLabelByModel(drone) {
  const rawModel = `${drone?.model_name || ''} ${drone?.drone_name || ''}`.toLowerCase();
  if (!rawModel.trim()) return '未分类机型';
  if (/(vtol|垂直起降)/.test(rawModel)) return '垂直起降固定翼';
  if (/(fixed|固定翼)/.test(rawModel)) return '固定翼';
  if (/(quad|multi|rotor|多旋翼|旋翼)/.test(rawModel)) return '多旋翼';
  if (/(helicopter|直升机)/.test(rawModel)) return '其他机型';
  return '其他机型';
}

function groupDronesForDisplay(drones) {
  const mode = getDroneGroupingMode(drones);
  const modeLabel = mode === 'purpose' ? '按用途分组展示当前可调度无人机' : '按机型分组展示当前可调度无人机';
  const groupsMap = new Map();
  drones.forEach((drone) => {
    const explicitPurpose = drone?.purpose || drone?.usage || drone?.usage_type || drone?.scene_type;
    const groupLabel = mode === 'purpose'
      ? normalizeDroneGroupLabelByPurpose(explicitPurpose)
      : normalizeDroneGroupLabelByModel(drone);
    if (!groupsMap.has(groupLabel)) {
      groupsMap.set(groupLabel, []);
    }
    groupsMap.get(groupLabel).push(drone);
  });

  const groups = Array.from(groupsMap.entries()).map(([label, items]) => ({ label, items }));
  return { modeLabel, groups };
}

function isDroneOnline(drone) {
  const rawStatus = String(drone?.status || '').trim().toLowerCase();
  if (!rawStatus) return false;
  return ['idle', 'ready', 'running', 'processing', 'standby', 'available', 'online'].includes(rawStatus);
}

function getDroneTaskStatusLabel(drone) {
  const rawStatus = String(drone?.status || '').trim().toLowerCase();
  if (!rawStatus) return '状态待同步';
  if (['running', 'processing'].includes(rawStatus)) return '当前任务：执行中';
  if (['idle', 'ready', 'available'].includes(rawStatus)) return '当前任务：待命';
  if (['standby'].includes(rawStatus)) return '当前任务：备用';
  if (['offline', 'error', 'fault'].includes(rawStatus)) return '当前任务：不可执行';
  return `当前任务：${rawStatus}`;
}

function getDroneAvailabilityLabel(drone) {
  const rawStatus = String(drone?.status || '').trim().toLowerCase();
  if (['offline', 'error', 'fault'].includes(rawStatus)) return '不可用';
  if (['running', 'processing'].includes(rawStatus)) return '执行中';
  return '可用';
}

function getDroneBatteryLevel(drone) {
  const candidates = [
    drone?.battery_level,
    drone?.battery_percent,
    drone?.battery,
    drone?.power_percent,
    drone?.power_level
  ];
  for (const item of candidates) {
    const numericValue = toFiniteNumber(item);
    if (numericValue !== null && numericValue >= 0 && numericValue <= 100) {
      return numericValue;
    }
  }
  return null;
}

function getDroneBatteryPresentation(drone) {
  const batteryLevel = getDroneBatteryLevel(drone);
  if (batteryLevel === null) {
    return { label: '电量 -', className: '' };
  }
  if (batteryLevel < 20) {
    return { label: `电量 ${batteryLevel.toFixed(0)}%`, className: 'level-low' };
  }
  if (batteryLevel <= 50) {
    return { label: `电量 ${batteryLevel.toFixed(0)}%`, className: 'level-medium' };
  }
  return { label: `电量 ${batteryLevel.toFixed(0)}%`, className: 'level-high' };
}

function getTerrainDronePresentation(terrain) {
  const drones = getTerrainBoundDrones(terrain);
  if (drones.length) {
    const modelNames = [...new Set(drones.map(drone => drone.model_name).filter(Boolean))];
    return {
      count: drones.length,
      status: `已绑定 ${drones.length} 台无人机`,
      meta: modelNames.length
        ? `当前覆盖机型：${modelNames.join('、')}`
        : '已绑定多台无人机，可直接用于当前地形的测绘任务执行。',
      buttonLabel: '管理绑定',
      isBound: true,
      drones
    };
  }

  return {
    count: 0,
    status: '未绑定无人机',
    meta: '绑定后可直接执行测绘任务，并支持多机协同执行。',
    buttonLabel: '管理绑定',
    isBound: false,
    drones: []
  };
}

function renderRiskBreakdown(terrain) {
  const container = document.getElementById('infoRiskBreakdown');
  if (!container) {
    return;
  }
  const counts = {
    high: Number(terrain?.high_risk_plot_count || 0),
    medium: Number(terrain?.medium_risk_plot_count || 0),
    low: Number(terrain?.low_risk_plot_count || 0),
    none: Number(terrain?.unknown_risk_plot_count || 0)
  };
  const items = [
    { label: '高风险', value: counts.high, className: 'risk-high', icon: 'bi-exclamation-diamond', hint: '高风险区域：建议优先测绘或巡检' },
    { label: '中风险', value: counts.medium, className: 'risk-medium', icon: 'bi-exclamation-triangle', hint: '中风险区域：建议重点巡检或持续关注' },
    { label: '低风险', value: counts.low, className: 'risk-low', icon: 'bi-shield-check', hint: '低风险区域：保持常规巡检即可' },
    { label: '未评估', value: counts.none, className: 'risk-none', icon: 'bi-question-diamond', hint: '未评估区域：需要补充风险评估' }
  ];
  container.innerHTML = items.map(item => `
    <div class="terrain-risk-tile ${item.className}" title="${escapeHtml(item.hint)}">
      <span class="terrain-risk-tile-icon"><i class="bi ${item.icon}"></i></span>
      <strong>${item.value}</strong>
      <span>${item.label}</span>
    </div>
  `).join('');

  const assessedCount = counts.high + counts.medium + counts.low;
  const totalCount = assessedCount + counts.none;
  let judgement = '未完成风险评估';
  if (totalCount === 0 && Number(terrain?.plot_count || 0) === 0) {
    judgement = '暂无地块数据';
  } else if (counts.high > 0) {
    judgement = '高风险地形，建议优先测绘';
  } else if (counts.medium > 0) {
    judgement = '中风险地形，建议重点巡检';
  } else if (counts.low > 0 && counts.high === 0 && counts.medium === 0) {
    judgement = '当前暂无风险区域';
  } else if (counts.none > 0) {
    judgement = '未完成风险评估';
  }

  const sourceText = terrain?.updatedAtLabel && terrain.updatedAtLabel !== '--'
    ? `风险统计更新于 ${terrain.updatedAtLabel}`
    : '风险数据来源：当前地块统计结果';
  const judgementNode = document.getElementById('infoRiskJudgement');
  const sourceNode = document.getElementById('infoRiskSource');
  if (judgementNode) judgementNode.textContent = judgement;
  if (sourceNode) sourceNode.textContent = sourceText;
}

function renderDroneBindings(terrain) {
  const list = document.getElementById('infoDroneList');
  if (!list) {
    return;
  }
  const drones = getTerrainBoundDrones(terrain);
  if (!drones.length) {
    list.innerHTML = '<div class="terrain-drone-empty">当前未绑定无人机</div>';
    const modeNode = document.getElementById('infoDroneGroupMode');
    const groupCountNode = document.getElementById('infoDroneGroupCount');
    if (modeNode) modeNode.textContent = '按机型分组展示当前可调度无人机';
    if (groupCountNode) groupCountNode.textContent = '0 组';
    return;
  }

  const { modeLabel, groups } = groupDronesForDisplay(drones);
  const modeNode = document.getElementById('infoDroneGroupMode');
  const groupCountNode = document.getElementById('infoDroneGroupCount');
  if (modeNode) modeNode.textContent = modeLabel;
  if (groupCountNode) groupCountNode.textContent = `${groups.length} 组`;

  list.innerHTML = groups.map(group => `
    <section class="terrain-drone-group">
      <div class="terrain-drone-group-head">
        <div class="terrain-drone-group-title">${escapeHtml(group.label)}</div>
        <span class="terrain-drone-group-count">${group.items.length} 台</span>
      </div>
      <div class="terrain-drone-group-body">
        ${group.items.map((drone) => {
          const online = isDroneOnline(drone);
          const battery = getDroneBatteryPresentation(drone);
          return `
            <article class="terrain-drone-item">
              <div class="terrain-drone-item-head">
                <div class="terrain-drone-item-name">${escapeHtml(drone.drone_name || '未命名无人机')}</div>
                <span class="terrain-drone-item-model">${escapeHtml(drone.model_name || '未标注机型')}</span>
              </div>
              <div class="terrain-drone-item-status">
                <span class="terrain-status-dot ${online ? 'is-online' : 'is-offline'}"></span>
                <span class="terrain-status-chip">${escapeHtml(online ? '在线' : '离线')}</span>
                <span class="terrain-battery-chip ${battery.className}">${escapeHtml(battery.label)}</span>
                <span class="terrain-availability-chip">${escapeHtml(getDroneAvailabilityLabel(drone))}</span>
              </div>
              <div class="terrain-drone-item-meta">
                <div>设备编号：${escapeHtml(drone.drone_code || '--')}</div>
                <div>${escapeHtml(getDroneTaskStatusLabel(drone))}</div>
                <div>最近更新：${escapeHtml(formatTimestamp(drone.updated_at) || '--')}</div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `).join('');
}

function updateBindDroneSelectionSummary() {
  const summary = document.getElementById('bindDroneSelectionSummary');
  if (!summary) {
    return;
  }
  const checkedCount = document.querySelectorAll('#bindDroneChecklist input[type="checkbox"]:checked').length;
  summary.textContent = `已选择 ${checkedCount} 台`;
}

function renderBindDroneChecklist(drones, selectedIds = []) {
  const container = document.getElementById('bindDroneChecklist');
  if (!container) {
    return;
  }

  if (!Array.isArray(drones) || !drones.length) {
    container.innerHTML = '<div class="terrain-drone-empty">暂无可绑定无人机</div>';
    updateBindDroneSelectionSummary();
    return;
  }

  const selectedIdSet = new Set(selectedIds.map(id => String(id)));
  container.innerHTML = drones.map((drone) => `
    <label class="bind-drone-option">
      <input
        type="checkbox"
        name="bindDroneIds"
        value="${escapeHtml(drone.id)}"
        ${selectedIdSet.has(String(drone.id)) ? 'checked' : ''}
      >
      <span>
        <div class="bind-drone-option-name">${escapeHtml(drone.drone_name || '未命名无人机')}</div>
        <div class="bind-drone-option-meta">
          <div>机型：${escapeHtml(drone.model_name || '--')}</div>
          <div>编号：${escapeHtml(drone.drone_code || '--')}</div>
          <div>状态：${escapeHtml(isDroneOnline(drone) ? '在线' : '离线')}</div>
        </div>
      </span>
    </label>
  `).join('');
  updateBindDroneSelectionSummary();
}

function updateTerrainMapSummary(terrain) {
  const layerMode = getCurrentLayerModeLabel();
  const centerCoord = formatCenterCoord(terrain);
  const coverageRange = buildCoverageRangeLabel(terrain);
  const topicStatus = terrain?.id
    ? (terrain?.has_boundary === false ? '已选中，边界待补充' : '已选中，可进行空间预览')
    : '待选择地形';

  setText('terrainMapTitle', terrain?.name ? `${terrain.name} 空间预览` : '当前地形空间预览');
  setText(
    'terrainMapSelectionHint',
    terrain?.name
      ? `已联动当前地形，可切换边界或地块图层查看空间分布。`
      : '当前未选中地形，请从左侧列表选择。'
  );
  setText('terrainMapCenter', centerCoord);
  setText('terrainMapArea', terrain?.areaLabel || '-');
  setText('terrainMapPlotCount', terrain?.plotCountLabel || '-');
  setText('terrainMapLayerMode', layerMode);
  setText('terrainMapAccuracy', terrain?.dataAccuracyLabel || '待补充');
  setText('infoCenterCoord', `中心坐标：${centerCoord}`);
  setText('infoCoverageRange', `覆盖范围：${coverageRange}`);
  setText('infoLayerModeSummary', `当前图层：${layerMode}`);
  setText('infoTopicStatus', `状态：${topicStatus}`);
}

async function selectTerrainRow(id, options = {}) {
  const terrain = getTerrainById(id);
  if (!terrain) return;

  terrainData.currentTerrain = terrain;
  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.selectedTerrainId = terrain.id;
  }

  updateDetailPanel(terrain);
  renderPlotDetailModule(terrain);
  renderRiskAreaModule();
  renderSurveyRecordModule();
  renderRiskAnalysisModule();
  
  if (options.syncMap && terrainMap) {
    terrainMap.selectTerrain(terrain, options);
  }

  requestTerrainMapResize();
  
  setTerrainEditButtonDisabled(false);
}

function clearCurrentSelection(options = {}) {
  terrainData.currentTerrain = null;
  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.selectedTerrainId = null;
  }
  resetDetailPanel();
  renderPlotDetailModule(null);
  renderRiskAreaModule();
  renderSurveyRecordModule();
  renderRiskAnalysisModule();
  const hintNode = document.getElementById('terrainMapSelectionHint');
  if (hintNode) hintNode.textContent = options.emptyMessage || '当前未选中地形。';
  requestTerrainMapResize();
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
    terrainDashboardState.terrain.page = result.data.pagination?.page || page;

    if (terrainMap) terrainMap.loadTerrains(terrainData.terrains);
    requestTerrainMapResize();
    
    updatePageData();
    const fallbackTerrainId = preferredTerrainId || terrainData.currentTerrain?.id || null;
    const preferredTerrain = fallbackTerrainId ? getTerrainById(fallbackTerrainId) : null;
    if (preferredTerrain) {
      await selectTerrainRow(preferredTerrain.id, { syncMap: true, fit: true });
    } else if (terrainData.terrains.length) {
      await selectTerrainRow(terrainData.terrains[0].id, { syncMap: true, fit: true });
    } else {
      clearCurrentSelection({ emptyMessage: '当前页暂无地形数据。' });
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
      edit(t) { openTerrainEditor(t); }
    }
  });

  vueInstances.pagination = new Vue({
    el: '#pagination',
    data: {
      pagination: null,
      jumpPage: ''
    },
    template: `
      <div v-if="pagination" class="terrain-pagination-bar">
        <div class="terrain-pagination-meta">
          <div class="small text-muted">共 {{ pagination.total }} 条</div>
          <div v-if="pagination.total_pages > 1" class="terrain-pagination-jump">
            <label class="small text-muted mb-0" for="terrainJumpPageInput">跳至</label>
            <input
              id="terrainJumpPageInput"
              class="form-control form-control-sm terrain-pagination-input"
              type="number"
              min="1"
              :max="pagination.total_pages"
              inputmode="numeric"
              v-model.trim="jumpPage"
              @keyup.enter="jumpToPage"
              @blur="jumpToPage"
            >
            <span class="small text-muted">页</span>
          </div>
        </div>
        <ul v-if="pagination.total_pages > 1" class="pagination pagination-sm mb-0">
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
      setPage(p) {
        if (!this.pagination || p < 1 || p > this.pagination.total_pages) return;
        loadRealData({
          page: p,
          preferredTerrainId: terrainData.currentTerrain?.id || null
        });
      },
      jumpToPage() {
        if (!this.pagination) return;
        const targetPage = Number(this.jumpPage);
        if (!Number.isFinite(targetPage)) {
          this.jumpPage = String(this.pagination.page || 1);
          return;
        }
        const normalizedPage = Math.min(Math.max(Math.trunc(targetPage), 1), this.pagination.total_pages);
        this.jumpPage = String(normalizedPage);
        if (normalizedPage === this.pagination.page) return;
        loadRealData({
          page: normalizedPage,
          preferredTerrainId: terrainData.currentTerrain?.id || null
        });
      }
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
    vueInstances.pagination.jumpPage = terrainDashboardState.terrain.pagination?.page
      ? String(terrainDashboardState.terrain.pagination.page)
      : '';
  }
}

function updateDetailPanel(terrain) {
  const dronePresentation = getTerrainDronePresentation(terrain);
  const surveyPresentation = getTerrainSurveyPresentation(terrain);
  toggleCommandBoardState(Boolean(terrain?.id));
  setText('terrainCommandSubtitle', terrain?.name ? `当前地形：${terrain.name}` : '请先从上方地形区域列表中选择一个地形');
  setText('infoName', terrain.name || '未命名地形');
  setText('infoArea', terrain.areaLabel);
  setText('infoAccuracy', terrain.dataAccuracyLabel);
  setText('infoUpdatedAt', terrain.updatedAtLabel);
  setText('infoPlotCount', terrain.plotCountLabel);
  setText('infoDroneCount', `${dronePresentation.count} 台设备`);
  setText('infoDroneCountMetric', `${dronePresentation.count} 台`);
  setText('infoDroneStatus', dronePresentation.status);
  setText('infoDroneMeta', dronePresentation.meta);
  setText('infoSurveyStatus', surveyPresentation.label);
  setText('infoSurveyStatusMetric', surveyPresentation.metricLabel);
  setText('infoRiskComposition', terrain.riskCompositionText);
  setText('infoRiskScore', terrain.risk_score || 0);
  setText('infoRiskReason', terrain.risk_reason || '暂无风险判定说明');
  setText('infoDescription', terrain.description || '无补充描述');
  const r = document.getElementById('infoRisk');
  if (r) { r.textContent = terrain.riskLabel; r.className = `badge ${terrain.riskClass}`; }
  renderRiskBreakdown(terrain);
  renderDroneBindings(terrain);
  updateTerrainMapSummary(terrain);
  const droneStatus = document.getElementById('infoDroneStatus');
  if (droneStatus) {
    droneStatus.classList.toggle('is-unbound', !dronePresentation.isBound);
  }
  const bindBtn = document.getElementById('bindDroneBtn');
  if (bindBtn) {
    bindBtn.innerHTML = `<i class="bi bi-link-45deg"></i> ${dronePresentation.buttonLabel}`;
  }
}

function initEvents() {
  document.getElementById('addTerrainBtn').addEventListener('click', () => { window.location.href = '/terrain/editor/'; });
  document.getElementById('editTerrainMapBtn').addEventListener('click', () => {
    openTerrainEditor(terrainData.currentTerrain);
  });
  document.getElementById('locateTerrainBtn').addEventListener('click', () => {
    if (!terrainData.currentTerrain) {
      showToast('请先选择地形', 'warning');
      return;
    }
    terrainMap?.focusTerrainTopic?.(terrainData.currentTerrain);
  });

  document.getElementById('terrainBottomRefreshBtn').addEventListener('click', async () => {
    await loadTerrainDashboardModules();
    showToast('刷新成功');
  });

  document.getElementById('executeTaskBtn').addEventListener('click', openTaskModal);
  document.getElementById('startTaskBtn').addEventListener('click', startSurveyTask);
  document.getElementById('bindDroneBtn').addEventListener('click', openBindDroneModal);
  document.getElementById('saveBindDroneBtn').addEventListener('click', saveBindDroneBinding);
  document.getElementById('btn-boundary').addEventListener('click', () => {
    if (terrainData.currentTerrain) updateTerrainMapSummary(terrainData.currentTerrain);
    requestTerrainMapResize();
  });
  document.getElementById('btn-plot').addEventListener('click', () => {
    if (terrainData.currentTerrain) updateTerrainMapSummary(terrainData.currentTerrain);
    requestTerrainMapResize();
  });

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

    const selectTerrainBtn = e.target.closest('[data-select-terrain-id]');
    if (selectTerrainBtn) {
      selectTerrainRow(selectTerrainBtn.dataset.selectTerrainId, { syncMap: true, fit: true });
    }

    const taskDetailBtn = e.target.closest('[data-task-detail-id]');
    if (taskDetailBtn) {
      showTaskDetail(taskDetailBtn.dataset.taskDetailId);
    }

    const plotLocateBtn = e.target.closest('[data-plot-locate]');
    if (plotLocateBtn) {
      const plotIndex = Number(plotLocateBtn.dataset.plotLocate);
      const plots = Array.isArray(terrainData.currentTerrain?.plots) ? terrainData.currentTerrain.plots : [];
      const plot = plots[plotIndex];
      if (plot) {
        focusPlotGeometryOnMap(plot);
      }
    }

    const plotToggleBtn = e.target.closest('[data-plot-toggle]');
    if (plotToggleBtn) {
      const item = plotToggleBtn.closest('.terrain-plot-item');
      if (item) {
        item.classList.toggle('is-expanded');
        plotToggleBtn.textContent = item.classList.contains('is-expanded') ? '收起详情' : '展开详情';
      }
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.matches('#bindDroneChecklist input[type="checkbox"]')) {
      updateBindDroneSelectionSummary();
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
  const select = document.getElementById('editDroneId');
  select.innerHTML = '<option value="0">暂不绑定</option>';

  try {
    const resp = await fetch(`/terrain/api/drones/available/?terrain_id=${terrain.id}`, {
      headers: { Accept: 'application/json' }
    });
    const result = await resp.json();
    if (!resp.ok || result.code !== 0) {
      throw new Error(result.message || '无人机列表加载失败');
    }

    const drones = Array.isArray(result.data) ? result.data : [];
    drones.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.drone_name} (${d.model_name})`;
      if (d.terrain_id == terrain.id) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (error) {
    console.error('加载可用无人机失败:', error);
    showToast('无人机列表加载失败，当前可先编辑地形信息', 'warning');
  }

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

async function openBindDroneModal() {
  const terrain = terrainData.currentTerrain;
  if (!terrain?.id) {
    showToast('请先选择地形', 'warning');
    return;
  }

  document.getElementById('bindDroneTerrainName').value = terrain.name || '';

  const currentInfo = document.getElementById('bindDroneCurrentInfo');
  const currentDrones = getTerrainBoundDrones(terrain);
  currentInfo.innerHTML = currentDrones.length
    ? `当前已绑定 ${currentDrones.length} 台：${currentDrones.map(formatDroneLabel).map(escapeHtml).join('、')}`
    : '当前未绑定无人机，保存后即可用于当前地形。';

  renderBindDroneChecklist([], []);

  const modal = new bootstrap.Modal(document.getElementById('bindDroneModal'));
  modal.show();

  try {
    const response = await fetch(`/terrain/api/drones/available/?terrain_id=${terrain.id}`, {
      headers: { Accept: 'application/json' }
    });
    const result = await response.json();
    if (!response.ok || result.code !== 0) {
      throw new Error(result.message || '无人机列表加载失败');
    }

    const drones = Array.isArray(result.data) ? result.data : [];
    renderBindDroneChecklist(drones, currentDrones.map(drone => drone.id));
  } catch (error) {
    console.error('加载绑定无人机列表失败:', error);
    renderBindDroneChecklist([], []);
    showToast('无人机列表加载失败，请稍后重试', 'danger');
  }
}

async function saveBindDroneBinding() {
  const terrain = terrainData.currentTerrain;
  if (!terrain?.id) {
    showToast('请先选择地形', 'warning');
    return;
  }

  const droneIds = Array.from(document.querySelectorAll('#bindDroneChecklist input[type="checkbox"]:checked'))
    .map(node => Number(node.value))
    .filter(Number.isFinite);
  const saveButton = document.getElementById('saveBindDroneBtn');
  if (saveButton) {
    saveButton.disabled = true;
  }

  try {
    const response = await fetch('/terrain/api/drones/bind/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFToken()
      },
      body: JSON.stringify({
        terrain_id: terrain.id,
        drone_ids: droneIds
      })
    });
    const result = await response.json();
    if (!response.ok || result.code !== 0) {
      throw new Error(result.message || '绑定无人机失败');
    }

    showToast(droneIds.length ? '无人机绑定已更新' : '已解除全部无人机绑定');
    bootstrap.Modal.getInstance(document.getElementById('bindDroneModal'))?.hide();
    await loadRealData({
      preferredTerrainId: terrain.id,
      page: terrainDashboardState.terrain.pagination?.page || 1
    });
  } catch (error) {
    console.error('保存无人机绑定失败:', error);
    showToast(error.message || '保存无人机绑定失败', 'danger');
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
    }
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
  const drones = getTerrainBoundDrones(t);
  
  if (drones.length) {
    info.innerHTML = `
      <strong>已绑定无人机 (${drones.length} 台，可创建多无人机 / 多班次测绘任务):</strong>
      <div class="mt-2">${drones.map(drone => `<span class="badge bg-light text-dark border me-1 mb-1">${escapeHtml(formatDroneLabel(drone))}</span>`).join('')}</div>
    `;
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
    const droneCount = Number(result.data?.drone_count || 0);
    const shiftCount = Number(result.data?.shifts_count || 0);
    const taskMessage = droneCount > 1 || shiftCount > 1
      ? `已创建多无人机 / 多班次测绘任务（${Math.max(droneCount, 1)} 台无人机，${Math.max(shiftCount, 1)} 个班次）`
      : '任务已启动';
    showToast(taskMessage);
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
  const shifts = Array.isArray(task.shifts) ? task.shifts : [];
  body.innerHTML = shifts.map((s, i) => `
    <tr>
      <td>班次 ${i + 1}</td>
      <td>${escapeHtml(s.drone_name || '-')}</td>
      <td>${escapeHtml(s.start_time_label || '--')}</td>
      <td>${escapeHtml(s.end_time_label || '--')}</td>
      <td><span class="badge bg-info">${escapeHtml(s.status || 'pending')}</span></td>
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
  const bind = document.getElementById('bindDroneBtn');
  const locate = document.getElementById('locateTerrainBtn');
  if (b) b.disabled = d;
  if (e) e.disabled = d;
  if (bind) bind.disabled = d;
  if (locate) locate.disabled = d;
}

function resetDetailPanel() {
  toggleCommandBoardState(false);
  setText('terrainCommandSubtitle', '请先从上方地形区域列表中选择一个地形');
  ['infoName','infoArea','infoAccuracy','infoUpdatedAt','infoPlotCount','infoRiskComposition','infoRiskScore','infoRiskReason','infoDescription','infoDroneCount','infoDroneCountMetric','infoSurveyStatus','infoSurveyStatusMetric','infoRiskJudgement','infoRiskSource','terrainMapCenter','terrainMapArea','terrainMapPlotCount','terrainMapLayerMode','terrainMapAccuracy'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '-';
  });
  const droneStatus = document.getElementById('infoDroneStatus');
  if (droneStatus) {
    droneStatus.textContent = '未绑定无人机';
    droneStatus.classList.add('is-unbound');
  }
  const droneList = document.getElementById('infoDroneList');
  if (droneList) droneList.innerHTML = '<div class="terrain-drone-empty">当前未绑定无人机</div>';
  const droneGroupMode = document.getElementById('infoDroneGroupMode');
  if (droneGroupMode) droneGroupMode.textContent = '按机型分组展示当前可调度无人机';
  const droneGroupCount = document.getElementById('infoDroneGroupCount');
  if (droneGroupCount) droneGroupCount.textContent = '0 组';
  const droneMeta = document.getElementById('infoDroneMeta');
  if (droneMeta) droneMeta.textContent = '绑定后可直接执行测绘任务，并支持多机协同执行。';
  const coverageRange = document.getElementById('infoCoverageRange');
  if (coverageRange) coverageRange.textContent = '覆盖范围：待选择地形后显示';
  const centerCoord = document.getElementById('infoCenterCoord');
  if (centerCoord) centerCoord.textContent = '中心坐标：-';
  const riskBreakdown = document.getElementById('infoRiskBreakdown');
  if (riskBreakdown) {
    riskBreakdown.innerHTML = `
      <div class="terrain-risk-tile risk-high" title="高风险区域：建议优先测绘或巡检">
        <span class="terrain-risk-tile-icon"><i class="bi bi-exclamation-diamond"></i></span>
        <strong>0</strong>
        <span>高风险</span>
      </div>
      <div class="terrain-risk-tile risk-medium" title="中风险区域：建议重点关注变化情况">
        <span class="terrain-risk-tile-icon"><i class="bi bi-exclamation-triangle"></i></span>
        <strong>0</strong>
        <span>中风险</span>
      </div>
      <div class="terrain-risk-tile risk-low" title="低风险区域：保持常规巡检">
        <span class="terrain-risk-tile-icon"><i class="bi bi-shield-check"></i></span>
        <strong>0</strong>
        <span>低风险</span>
      </div>
      <div class="terrain-risk-tile risk-none" title="未评估区域：需补充风险评估">
        <span class="terrain-risk-tile-icon"><i class="bi bi-question-diamond"></i></span>
        <strong>0</strong>
        <span>未评估</span>
      </div>
    `;
  }
  const riskJudgement = document.getElementById('infoRiskJudgement');
  if (riskJudgement) riskJudgement.textContent = '未完成风险评估';
  const riskSource = document.getElementById('infoRiskSource');
  if (riskSource) riskSource.textContent = '风险数据来源待同步';
  const bindBtn = document.getElementById('bindDroneBtn');
  if (bindBtn) bindBtn.innerHTML = '<i class="bi bi-link-45deg"></i> 管理绑定';
  const mapTitle = document.getElementById('terrainMapTitle');
  if (mapTitle) mapTitle.textContent = '当前地形空间预览';
  const mapHint = document.getElementById('terrainMapSelectionHint');
  if (mapHint) mapHint.textContent = '当前未选中地形，请从左侧列表选择。';
  const mapLayerMode = document.getElementById('terrainMapLayerMode');
  if (mapLayerMode) mapLayerMode.textContent = '地块';
  const infoLayerModeSummary = document.getElementById('infoLayerModeSummary');
  if (infoLayerModeSummary) infoLayerModeSummary.textContent = '当前图层：地块';
  const infoTopicStatus = document.getElementById('infoTopicStatus');
  if (infoTopicStatus) infoTopicStatus.textContent = '状态：待选择地形';
  const r = document.getElementById('infoRisk'); if (r) { r.textContent = '-'; r.className = 'badge bg-secondary'; }
  renderPlotDetailModule(null);
}

function initFilterForm() {
  const f = document.getElementById('terrainFilterForm');
  f.addEventListener('submit', (e) => { e.preventDefault(); loadRealData(); });
  document.getElementById('resetBtn').addEventListener('click', () => { f.reset(); loadRealData(); });
}

window.addEventListener('DOMContentLoaded', initPage);
