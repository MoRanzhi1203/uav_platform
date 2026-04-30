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
  // 统一使用 /agri 前缀，匹配 urls.py 中的配置
  const baseUrl = '/agri'; 
  console.log(`使用 API 基础路径: ${baseUrl}`);

  try {
    // 1. 加载概览统计
    console.log(`请求概览: ${baseUrl}/overview/`);
    const overviewRes = await fetch(`${baseUrl}/overview/`);
    if (!overviewRes.ok) throw new Error(`概览接口请求失败: ${overviewRes.status}`);
    const overviewData = await overviewRes.json();
    console.log('概览响应:', overviewData);
    if (overviewData.code === 0) {
      const stats = overviewData.data;
      const updateStat = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.textContent = val;
      };
      updateStat('totalAgriAreas', stats.farm_area_count);
      updateStat('totalPlots', stats.farm_plot_count);
      updateStat('pestAlerts', stats.pest_monitor_count);
      updateStat('activeTasks', stats.agri_task_count);
    } else {
      console.warn('概览接口返回错误代码:', overviewData);
    }

    // 2. 加载区域列表
    console.log(`请求区域列表: ${baseUrl}/farm-plots/`);
    const areasRes = await fetch(`${baseUrl}/farm-plots/`);
    if (!areasRes.ok) throw new Error(`区域列表接口请求失败: ${areasRes.status}`);
    const areasData = await areasRes.json();
    console.log('区域列表响应:', areasData);
    if (areasData.code === 0) {
      agriData.areas = areasData.data;
      agriData.filteredAreas = [...areasData.data];
      renderAgriTable();
      if (agriMap && areasData.data.length > 0) {
        agriMap.loadAreas(areasData.data);
      }
      
      // 如果有数据，默认选择第一个
      if (areasData.data.length > 0) {
          selectArea(areasData.data[0].id);
      }
    } else {
      console.warn('区域列表接口返回错误代码:', areasData);
    }

    // 3. 加载今日病虫害
    console.log(`请求病虫害: ${baseUrl}/dashboard/pest-alerts/`);
    const pestRes = await fetch(`${baseUrl}/dashboard/pest-alerts/`);
    if (pestRes.ok) {
        const pestData = await pestRes.json();
        if (pestData.code === 0) {
          agriData.pestAlerts = pestData.data.items;
          renderPestAlerts();
        }
    }

    // 4. 加载植保记录
    console.log(`请求任务: ${baseUrl}/dashboard/tasks/`);
    const taskRes = await fetch(`${baseUrl}/dashboard/tasks/`);
    if (taskRes.ok) {
        const taskData = await taskRes.json();
        if (taskData.code === 0) {
          agriData.tasks = taskData.data.items;
          renderTaskRecords();
        }
    }

    // 5. 加载风险分析数据
    console.log(`请求风险分析: ${baseUrl}/dashboard/risk-analysis/`);
    const analysisRes = await fetch(`${baseUrl}/dashboard/risk-analysis/`);
    if (analysisRes.ok) {
        const analysisData = await analysisRes.json();
        if (analysisData.code === 0) {
          agriData.riskAnalysis = analysisData.data.stats;
          renderRiskAnalysisChart();
        }
    }

  } catch (error) { 
    console.error('加载农业数据过程中发生严重错误:', error);
    alert('农业数据加载失败，请检查网络或后端服务。详情见控制台日志。');
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
    const res = await fetch(`/agri/farm-plots/${id}/`);
    const data = await res.json();
    if (data.code === 0) {
      const areaFull = data.data;
      agriData.currentArea = areaFull;
      updateDetailPanel(areaFull);
      
      if (agriMap) {
        agriMap.focusOnArea(id);
        if (areaFull.plots) {
          agriMap.loadPlots(areaFull.plots);
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
  const riskLevel = riskInput.value;

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
