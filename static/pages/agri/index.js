// 农业管理页面逻辑 - 仿照地形管理风格

const agriData = {
  areas: [],
  filteredAreas: [],
  pestAlerts: [],
  tasks: [],
  riskAnalysis: [],
  currentArea: null,
  appliedFilters: {
    name: '',
    riskLevel: '',
    timeRange: 'all'
  },
  hasActiveFilters: false,
  emptyStateMessage: '当前没有可展示的农业示范区，请稍后刷新。'
};

let agriMap;
const vueInstances = {};
let agriChartInstance = null;

function initPage() {
  console.log('--- 农业管理页面初始化开始 ---');

  initVue();
  
  // 初始化地图
  if (window.AgriMap) {
    agriMap = new AgriMap('agriMap');
    agriMap.init();
    console.log('地图组件初始化成功');
  } else {
    console.error('未找到 AgriMap 组件，请检查 agri_map.js 加载情况');
  }

  resetDetailPanel();
  initFilterForm();
  initEvents();
  
  // 加载真实数据
  loadRealData();
}

async function loadRealData() {
  console.log('开始加载 API 数据...');
  Common.showLoading('.agri-list-card');
  const baseUrl = '/agri'; 
  
  try {
    // 1. 加载概览统计
    const overviewRes = await Http.safeFetchJson(`${baseUrl}/overview/`);
    if (overviewRes.success) {
      const stats = overviewRes.data;
      const updateStat = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.textContent = val;
      };
      updateStat('totalAgriAreas', stats.farm_area_count || 0);
      updateStat('totalPlots', stats.farm_plot_count || 0);
      updateStat('pestAlerts', stats.pest_monitor_count || 0);
      updateStat('activeTasks', stats.agri_task_count || 0);
    }

    // 2. 加载区域列表
    const areasRes = await Http.safeFetchJson(`${baseUrl}/farm-plots/`);
    if (areasRes.success) {
      const areas = Array.isArray(areasRes.data) ? areasRes.data : (areasRes.data?.results || []);
      agriData.areas = areas;
      agriData.filteredAreas = [...areas];
      renderAgriTable();
      if (agriMap && areas.length > 0) {
        try {
          agriMap.loadAreas(areas);
        } catch (mapError) {
          console.error('农业地图数据加载失败:', mapError);
        }
      }
      if (areas.length > 0) {
          selectArea(areas[0].id);
      }
    }

    // 3. 加载今日病虫害
    const pestRes = await Http.safeFetchJson(`${baseUrl}/dashboard/pest-alerts/`);
    if (pestRes.success) {
      agriData.pestAlerts = pestRes.data.items || [];
      renderPestAlerts();
    }

    // 4. 加载植保记录
    const taskRes = await Http.safeFetchJson(`${baseUrl}/dashboard/tasks/`);
    if (taskRes.success) {
      agriData.tasks = taskRes.data.items || [];
      renderTaskRecords();
    }

    // 5. 加载风险分析数据
    const analysisRes = await Http.safeFetchJson(`${baseUrl}/dashboard/risk-analysis/`);
    if (analysisRes.success) {
      agriData.riskAnalysis = analysisRes.data.stats || [];
      renderRiskAnalysisChart();
    }

  } catch (error) { 
    console.error('加载农业数据过程中发生严重错误:', error);
    Common.showMessage('农业数据加载失败，请检查网络或后端服务。', 'error');
  } finally {
    Common.hideLoading('.agri-list-card');
  }
}

function renderRiskAnalysisChart(type = 'bar') {
  const ctxNode = document.getElementById('agriAnalysisChart');
  if (!ctxNode) return;

  if (!agriData.riskAnalysis || agriData.riskAnalysis.length === 0) {
    ctxNode.innerHTML = '<div class="p-5 text-center text-muted">暂无风险统计数据</div>';
    return;
  }

  const labels = agriData.riskAnalysis.map(item => {
      const mapping = { high: '高风险', medium: '中风险', low: '低风险' };
      return mapping[item.risk_level] || item.risk_level;
  });
  const values = agriData.riskAnalysis.map(item => item.count);

  if (agriChartInstance) {
      agriChartInstance.destroy();
  }

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
          colors: ['#d32f2f', '#f57c00', '#2e7d32'], // 高(红)、中(橙)、低(绿)
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

      agriChartInstance = new ApexCharts(ctxNode, options);
      agriChartInstance.render();
      console.log('图表渲染完成');
  }
}

function initVue() {
  // 暂时使用简单的对象模拟，避免 Vue 未加载导致的错误
  vueInstances.stats = true; 
}

function renderAgriTable() {
  const tableBody = document.querySelector('#agriTable');
  if (!tableBody) return;

  if (agriData.filteredAreas.length === 0) {
    tableBody.innerHTML = `<div class="p-4 text-center text-muted">${agriData.emptyStateMessage}</div>`;
    return;
  }

  let html = `
    <table class="table table-hover mb-0">
      <thead>
        <tr>
          <th>示范区名称</th>
          <th>面积(公顷)</th>
          <th>地块数</th>
          <th>风险等级</th>
        </tr>
      </thead>
      <tbody>
  `;

  agriData.filteredAreas.forEach(area => {
    const riskClass = getRiskBadgeClass(area.risk_level);
    const riskText = area.risk_level === 'high' ? '高' : area.risk_level === 'medium' ? '中' : '低';
    html += `
      <tr class="agri-row" data-id="${area.id}" style="cursor:pointer">
        <td><div class="fw-bold">${area.area_name}</div><div class="small text-muted">${area.region}</div></td>
        <td>${area.coverage_ha}</td>
        <td>${area.plot_count || 0}</td>
        <td><span class="risk-badge ${riskClass}">${riskText}</span></td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  tableBody.innerHTML = html;

  document.querySelectorAll('.agri-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = parseInt(row.dataset.id);
      selectArea(id);
    });
  });

  const countLabel = document.getElementById('agriListCount');
  if (countLabel) countLabel.textContent = `${agriData.filteredAreas.length} 条`;
}

async function selectArea(id) {
  console.log(`选中示范区 ID: ${id}`);
  const areaBasic = agriData.areas.find(f => f.id === id);
  if (!areaBasic) return;

  updateDetailPanel(areaBasic);

  try {
    const response = await Http.safeFetchJson(`/agri/farm-plots/${id}/`);
    if (response.success) {
      const areaFull = response.data;
      agriData.currentArea = areaFull;
      updateDetailPanel(areaFull);
      
      if (agriMap) {
        try {
          agriMap.focusOnArea(id);
          if (areaFull.plots) {
            agriMap.loadPlots(areaFull.plots);
          }
        } catch (mapError) {
          console.error('农业地图详情加载失败:', mapError);
        }
      }
    }
  } catch (error) {
    console.error('加载农田详情失败:', error);
  }
}

function updateDetailPanel(area) {
  const updateText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  updateText('infoName', area.area_name);
  const infoRisk = document.getElementById('infoRisk');
  if (infoRisk) {
    const riskClass = getRiskBadgeClass(area.risk_level);
    const riskText = area.risk_level === 'high' ? '高风险' : area.risk_level === 'medium' ? '中风险' : '低风险';
    infoRisk.innerHTML = `<span class="risk-badge ${riskClass}">${riskText}</span>`;
  }
  updateText('infoArea', `${area.coverage_ha} 公顷`);
  updateText('infoPlotCount', area.plot_count || 0);
  
  const centerText = area.center_lat ? `${parseFloat(area.center_lng).toFixed(4)}, ${parseFloat(area.center_lat).toFixed(4)}` : '106.5500, 29.5600';
  updateText('infoCenter', centerText);
  
  updateText('infoManager', area.manager_name || '未指派');
  updateText('infoRegion', area.region);
  updateText('infoUpdatedAt', area.updated_at || area.created_at || '2026-04-30 10:30');
  
  const mockDescriptions = [
    "该区域土壤肥沃，目前正处于水稻插秧期，需关注水分供应。",
    "现代农业园示范区，主要种植智慧蔬菜，采用水肥一体化管理。",
    "生态农业带核心区，主要作物为小麦，近期病虫害压力中等。",
    "九龙坡农耕地块，土壤墒情良好，适宜玉米种植。",
    "渝北智慧农场，已全面覆盖物联网监测设备，实现精准植保。"
  ];
  updateText('infoDescription', area.description || mockDescriptions[area.id % mockDescriptions.length]);

  const plotsTableBody = document.getElementById('agriPlotsTableBody');
  if (plotsTableBody) {
    if (area.plots && area.plots.length > 0) {
      let html = '';
      area.plots.forEach(plot => {
        const riskClass = getRiskBadgeClass(plot.risk_level);
        const riskText = plot.risk_level === 'high' ? '高' : plot.risk_level === 'medium' ? '中' : '低';
        html += `
          <tr>
            <td>${plot.name}</td>
            <td>${plot.area}</td>
            <td><span class="risk-badge ${riskClass}">${riskText}</span></td>
          </tr>
        `;
      });
      plotsTableBody.innerHTML = html;
    } else {
      plotsTableBody.innerHTML = '<tr><td colspan="3" class="text-center py-3 text-muted">暂无地块明细数据</td></tr>';
    }
  }

  const hint = document.getElementById('agriMapSelectionHint');
  if (hint) hint.classList.add('d-none');
  const title = document.getElementById('agriMapTitle');
  if (title) title.textContent = `当前选中: ${area.area_name}`;
}

function renderPestAlerts() {
  const container = document.getElementById('agriPestModuleList');
  if (!container) return;

  let html = '';
  agriData.pestAlerts.forEach(alert => {
    const levelClass = alert.level.includes('红色') ? 'bg-danger' : alert.level.includes('橙色') ? 'bg-warning text-dark' : 'bg-info';
    html += `
      <div class="agri-item">
        <div style="flex: 1">
          <div class="fw-bold"><i class="bi bi-bug-fill text-danger"></i> ${alert.location}</div>
          <div class="small text-muted">${alert.time}</div>
        </div>
        <div class="text-end">
          <span class="badge ${levelClass} mb-1">${alert.level}</span><br>
          <span class="badge bg-light text-dark border">${alert.status}</span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html || '<div class="p-3 text-center text-muted">今日无病虫害预警</div>';
}

function renderTaskRecords() {
  const container = document.getElementById('agriTaskModuleList');
  if (!container) return;

  let html = '';
  agriData.tasks.forEach(task => {
    const statusClass = task.status === '已完成' ? 'bg-success' : task.status === '进行中' ? 'bg-primary' : 'bg-secondary';
    html += `
      <div class="agri-item">
        <div style="flex: 1">
          <div class="fw-bold">${task.task_code}</div>
          <div class="small text-muted">${task.time}</div>
        </div>
        <span class="badge ${statusClass}">${task.status}</span>
      </div>
    `;
  });
  container.innerHTML = html || '<div class="p-3 text-center text-muted">暂无植保记录</div>';
}

function initFilterForm() {
  const form = document.getElementById('agriFilterForm');
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
  const nameInput = document.getElementById('agriName');
  const riskInput = document.getElementById('filterRiskLevel');
  if (!nameInput || !riskInput) return;

  const name = nameInput.value.toLowerCase();
  const riskLevel = ['all', '全部等级', 'undefined', 'null'].includes(riskInput.value) ? '' : riskInput.value;

  agriData.filteredAreas = agriData.areas.filter(f => {
    const matchName = (f.area_name || '').toLowerCase().includes(name);
    const matchRisk = !riskLevel || f.risk_level === riskLevel;
    return matchName && matchRisk;
  });

  renderAgriTable();
  
  const badge = document.getElementById('agriFilterStateBadge');
  if (badge) {
    if (name || riskLevel) {
      badge.classList.remove('d-none');
    } else {
      badge.classList.add('d-none');
    }
  }
}

function initEvents() {
  const refreshBtn = document.getElementById('btnRefreshAgri');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadRealData();
    });
  }

  document.querySelectorAll('.agri-analysis-toolbar button').forEach(btn => {
      btn.addEventListener('click', () => {
          const type = btn.dataset.chartType;
          document.querySelectorAll('.agri-analysis-toolbar button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderRiskAnalysisChart(type);
      });
  });
}

function resetDetailPanel() {
  const hint = document.getElementById('agriMapSelectionHint');
  if (hint) hint.classList.remove('d-none');
}

function getRiskBadgeClass(level) {
  if (level === '高' || level === 'high') return 'risk-high';
  if (level === '中' || level === 'medium') return 'risk-medium';
  return 'risk-low';
}

document.addEventListener('DOMContentLoaded', initPage);
