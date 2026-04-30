// 林业管理页面逻辑 - 仿照地形管理风格

const forestData = {
  forests: [],
  filteredForests: [],
  fireAlerts: [],
  patrols: [],
  riskAnalysis: [],
  currentForest: null,
  appliedFilters: {
    name: '',
    riskLevel: '',
    timeRange: 'all'
  },
  hasActiveFilters: false,
  emptyStateMessage: '当前没有可展示的林区区域，请稍后刷新。'
};

let forestMap;
const vueInstances = {};
let forestLayoutObserver = null;
let forestFilterDebounceTimer = 0;

function initPage() {
  console.log('开始初始化林业管理页面');

  initVue();
  
  // 初始化地图
  forestMap = new ForestMap('forestMap');
  forestMap.init();

  resetDetailPanel();
  initFilterForm();
  initTables();
  initEvents();
  
  // 加载真实数据
  loadRealData();
}

async function loadRealData() {
  try {
    // 1. 加载概览统计
    const overviewRes = await fetch('/forest/overview/');
    const overviewData = await overviewRes.json();
    if (overviewData.code === 0) {
      const stats = overviewData.data;
      const updateStat = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.textContent = val;
      };
      updateStat('totalForests', stats.forest_area_count);
      updateStat('totalPlots', stats.forest_plot_count);
      updateStat('fireAlerts', stats.fire_detection_count);
      updateStat('activeTasks', stats.forest_patrol_task_count);
    }

    // 2. 加载林区列表
    const areasRes = await fetch('/forest/areas/');
    const areasData = await areasRes.json();
    if (areasData.code === 0) {
      forestData.forests = areasData.data;
      forestData.filteredForests = [...areasData.data];
      renderForestTable();
      if (forestMap) forestMap.loadForests(areasData.data);
      
      // 如果有数据，默认选择第一个
      if (areasData.data.length > 0) {
          selectForest(areasData.data[0].id);
      }
    }

    // 3. 加载今日火点
    const fireRes = await fetch('/forest/api/dashboard/fire-alerts/');
    const fireData = await fireRes.json();
    if (fireData.code === 0) {
      forestData.fireAlerts = fireData.data.items;
      renderFireAlerts();
    }

    // 4. 加载巡林记录
    const patrolRes = await fetch('/forest/api/dashboard/patrol-tasks/');
    const patrolData = await patrolRes.json();
    if (patrolData.code === 0) {
      forestData.patrols = patrolData.data.items;
      renderPatrolRecords();
    }

    // 5. 加载风险分析数据
    const analysisRes = await fetch('/forest/api/dashboard/risk-analysis/');
    const analysisData = await analysisRes.json();
    if (analysisData.code === 0) {
      forestData.riskAnalysis = analysisData.data.stats;
      renderRiskAnalysisChart();
    }

  } catch (error) { 
    console.error('加载林业数据失败:', error);
    loadMockData();
  }
}

let forestChartInstance = null;

function renderRiskAnalysisChart(type = 'bar') {
  const ctxNode = document.getElementById('forestAnalysisChart');
  if (!ctxNode) return;

  const labels = forestData.riskAnalysis.map(item => {
      const mapping = { high: '高风险', medium: '中风险', low: '低风险' };
      return mapping[item.risk_level] || item.risk_level;
  });
  const values = forestData.riskAnalysis.map(item => item.count);

  if (forestChartInstance) {
      forestChartInstance.destroy();
  }

  // 检查是否加载了 ApexCharts，如果没有则回退到 echarts 或简单显示
  if (window.ApexCharts) {
      const options = {
          series: [{
              name: '地块数量',
              data: values
          }],
          chart: {
              type: type,
              height: 300,
              toolbar: { show: false }
          },
          colors: ['#d32f2f', '#f57c00', '#2e7d32'], // 高、中、低
          xaxis: { categories: labels },
          plotOptions: {
              bar: { borderRadius: 4, horizontal: false }
          }
      };

      if (type === 'pie') {
          options.series = values;
          options.labels = labels;
          delete options.xaxis;
      }

      forestChartInstance = new ApexCharts(ctxNode, options);
      forestChartInstance.render();
  } else if (window.echarts) {
      forestChartInstance = echarts.init(ctxNode);
      const option = {
          tooltip: {},
          xaxis: type === 'bar' ? { data: labels } : undefined,
          yAxis: type === 'bar' ? {} : undefined,
          series: [{
              type: type,
              data: type === 'bar' ? values : forestData.riskAnalysis.map(item => ({
                  name: labels[forestData.riskAnalysis.indexOf(item)],
                  value: item.count
              })),
              radius: type === 'pie' ? '50%' : undefined
          }]
      };
      forestChartInstance.setOption(option);
  }
}

function initVue() {
  // 暂时移除 Vue 实例，改用直接 DOM 操作以确保兼容性
  vueInstances.stats = true; 
}

function loadMockData() {
  if (window.forestMockData) {
    const data = window.forestMockData;
    
    // 更新 Vue 统计
    if (vueInstances.stats) {
      vueInstances.stats.totalForests = data.stats.totalForests;
      vueInstances.stats.fireAlerts = data.stats.fireAlerts;
      vueInstances.stats.activeTasks = data.stats.patrolTasks;
      vueInstances.stats.healthyForests = data.stats.healthStatus + '%';
    }

    forestData.forests = data.forests;
    forestData.filteredForests = [...data.forests];
    forestData.fireAlerts = data.fireAlerts;
    forestData.patrols = data.patrolRecords;

    renderForestTable();
    renderFireAlerts();
    renderPatrolRecords();
    
    if (forestMap) {
      forestMap.loadForests(data.forests);
    }
  }
}

function renderForestTable() {
  const tableBody = document.querySelector('#forestTable');
  if (!tableBody) return;

  if (forestData.filteredForests.length === 0) {
    tableBody.innerHTML = `<div class="p-4 text-center text-muted">${forestData.emptyStateMessage}</div>`;
    return;
  }

  let html = `
    <table class="table table-hover mb-0">
      <thead>
        <tr>
          <th>林区名称</th>
          <th>面积(km²)</th>
          <th>地块数</th>
          <th>风险等级</th>
        </tr>
      </thead>
      <tbody>
  `;

  forestData.filteredForests.forEach(forest => {
    const riskClass = getRiskBadgeClass(forest.risk_level);
    html += `
      <tr class="forest-row" data-id="${forest.id}" style="cursor:pointer">
        <td><div class="fw-bold">${forest.area_name}</div><div class="small text-muted">${forest.region}</div></td>
        <td>${forest.coverage_km2}</td>
        <td>${forest.plot_count || 0}</td>
        <td><span class="risk-badge ${riskClass}">${forest.risk_level}</span></td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  tableBody.innerHTML = html;

  document.querySelectorAll('.forest-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = parseInt(row.dataset.id);
      selectForest(id);
    });
  });

  const countLabel = document.getElementById('forestListCount');
  if (countLabel) countLabel.textContent = `${forestData.filteredForests.length} 条`;
}

async function selectForest(id) {
  // 查找基本信息
  const forestBasic = forestData.forests.find(f => f.id === id);
  if (!forestBasic) return;

  // 设置基本信息（即时反馈）
  updateDetailPanel(forestBasic);

  try {
    // 异步加载完整详情（包含地块明细）
    const res = await fetch(`/forest/areas/${id}/`);
    const data = await res.json();
    if (data.code === 0) {
      const forestFull = data.data;
      forestData.currentForest = forestFull;
      updateDetailPanel(forestFull);
      
      if (forestMap) {
        forestMap.focusOnForest(id);
        // 如果有地块数据，在地图上展示地块
        if (forestFull.plots) {
          forestMap.loadPlots(forestFull.plots);
        }
      }
    }
  } catch (error) {
    console.error('加载林区详情失败:', error);
  }
}

function updateDetailPanel(forest) {
  const updateText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  updateText('infoName', forest.area_name);
  const infoRisk = document.getElementById('infoRisk');
  if (infoRisk) infoRisk.innerHTML = `<span class="risk-badge ${getRiskBadgeClass(forest.risk_level)}">${forest.risk_level === 'high' ? '高风险' : forest.risk_level === 'medium' ? '中风险' : '低风险'}</span>`;
  updateText('infoArea', `${forest.coverage_km2} km²`);
  updateText('infoPlotCount', forest.plot_count || 0);
  
  const centerText = forest.center_lat ? `${parseFloat(forest.center_lng).toFixed(4)}, ${parseFloat(forest.center_lat).toFixed(4)}` : '106.5500, 29.5600';
  updateText('infoCenter', centerText);
  
  updateText('infoManager', forest.manager_name || '未指派');
  updateText('infoRegion', forest.region);
  updateText('infoUpdatedAt', forest.updated_at || forest.created_at || '2026-04-29 10:30');
  
  // 生成更合理的描述
  const mockDescriptions = [
    "该区域植被茂密，主要以针叶林和阔叶林为主，近期空气干燥，需加强巡护。",
    "林区内地形复杂，无人机巡检需注意避障，重点监测东侧山脊区域。",
    "该片区为重点保护林地，包含多种珍稀植物，已部署多处红外监测设备。",
    "近期有游客进入林区迹象，建议加强入山口管控和防火宣传。",
    "林区边缘靠近居民区，需重点排查生活用火隐患，保持防火隔离带畅通。"
  ];
  updateText('infoDescription', forest.description || mockDescriptions[forest.id % mockDescriptions.length]);

  // 渲染地块列表
  const plotsTableBody = document.getElementById('forestPlotsTableBody');
  if (plotsTableBody) {
    if (forest.plots && forest.plots.length > 0) {
      let html = '';
      forest.plots.forEach(plot => {
        html += `
          <tr>
            <td>${plot.name}</td>
            <td>${plot.area}</td>
            <td><span class="risk-badge ${getRiskBadgeClass(plot.risk_level)}">${plot.risk_level}</span></td>
          </tr>
        `;
      });
      plotsTableBody.innerHTML = html;
    } else {
      plotsTableBody.innerHTML = '<tr><td colspan="3" class="text-center py-3 text-muted">暂无地块明细</td></tr>';
    }
  }

  const hint = document.getElementById('forestMapSelectionHint');
  if (hint) hint.classList.add('d-none');
  const title = document.getElementById('forestMapTitle');
  if (title) title.textContent = `当前选中: ${forest.area_name}`;
}

function renderFireAlerts() {
  const container = document.getElementById('forestFireModuleList');
  if (!container) return;

  let html = '';
  forestData.fireAlerts.forEach(alert => {
    const levelClass = alert.level.includes('红色') ? 'bg-danger' : alert.level.includes('橙色') ? 'bg-warning text-dark' : 'bg-info';
    html += `
      <div class="forest-item">
        <div style="flex: 1">
          <div class="fw-bold"><i class="bi bi-exclamation-triangle-fill text-danger"></i> ${alert.location}</div>
          <div class="small text-muted">${alert.time}</div>
        </div>
        <div class="text-end">
          <span class="badge ${levelClass} mb-1">${alert.level}</span><br>
          <span class="badge bg-light text-dark border">${alert.status}</span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html || '<div class="p-3 text-center text-muted">今日无火点预警</div>';
}

function renderPatrolRecords() {
  const container = document.getElementById('forestPatrolModuleList');
  if (!container) return;

  let html = '';
  forestData.patrols.forEach(patrol => {
    const statusClass = patrol.status === '已完成' ? 'bg-success' : patrol.status === '进行中' ? 'bg-primary' : 'bg-secondary';
    html += `
      <div class="forest-item">
        <div style="flex: 1">
          <div class="fw-bold">${patrol.task_code}</div>
          <div class="small text-muted">${patrol.time}</div>
        </div>
        <span class="badge ${statusClass}">${patrol.status}</span>
      </div>
    `;
  });
  container.innerHTML = html || '<div class="p-3 text-center text-muted">暂无巡林记录</div>';
}

function initFilterForm() {
  const form = document.getElementById('forestFilterForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      applyFilters();
    });
  }

  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (form) form.reset();
      applyFilters();
    });
  }
}

function applyFilters() {
  const nameInput = document.getElementById('forestName');
  const riskInput = document.getElementById('filterRiskLevel');
  if (!nameInput || !riskInput) return;

  const name = nameInput.value.toLowerCase();
  const riskLevel = riskInput.value;

  forestData.filteredForests = forestData.forests.filter(f => {
    const matchName = f.name.toLowerCase().includes(name);
    const matchRisk = !riskLevel || f.riskLevel === (riskLevel === 'high' ? '高' : riskLevel === 'medium' ? '中' : '低');
    return matchName && matchRisk;
  });

  renderForestTable();
  
  const badge = document.getElementById('forestFilterStateBadge');
  if (badge) {
    if (name || riskLevel) {
      badge.classList.remove('d-none');
    } else {
      badge.classList.add('d-none');
    }
  }
}

function initTables() {}
function initEvents() {
  const refreshBtn = document.getElementById('btnRefreshForest');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadRealData();
    });
  }

  // 图表类型切换
  document.querySelectorAll('.forest-analysis-toolbar button').forEach(btn => {
      btn.addEventListener('click', () => {
          const type = btn.dataset.chartType;
          document.querySelectorAll('.forest-analysis-toolbar button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderRiskAnalysisChart(type);
      });
  });
}
function resetDetailPanel() {
  document.getElementById('forestMapSelectionHint').classList.remove('d-none');
}

function getRiskBadgeClass(level) {
  if (level === '高' || level === 'high') return 'risk-high';
  if (level === '中' || level === 'medium') return 'risk-medium';
  return 'risk-low';
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initPage);
