// 地形管理页面逻辑
// 使用全局变量
// 直接使用全局变量TerrainMap，不需要重复声明

// 页面数据
let terrainData = {
  terrains: [],
  riskAreas: [],
  surveys: [],
  currentTerrain: null
};

// 全局地图实例
window.terrainMap = null;

// 全局Vue实例
let vueInstances = {};

// 初始化页面
function initPage() {
  console.log('地形管理页面初始化开始...');
  
  // 初始化Vue实例
  initVue();

  // 初始化地图
  window.terrainMap = new TerrainMap('terrainMap');
  window.terrainMap.init();

  // 加载真实数据
  loadRealData();

  // 初始化筛选表单
  initFilterForm();

  // 初始化表格
  initTables();

  // 初始化事件绑定
  initEvents();
}

// 加载真实数据
async function loadRealData() {
  try {
    // 1. 获取地形区域列表
    const response = await fetch('/terrain/api/areas/');
    const result = await response.json();
    
    if (result.code === 0) {
      // 映射后端数据到前端模型
      terrainData.terrains = result.data.map(item => ({
        id: item.id,
        name: item.name,
        area: item.total_area || 0,
        zone_count: item.zone_count || 0,
        type: item.zone_count > 0 ? '混合图层' : '空图层',
        land_type: item.type,
        risk_level: translateRiskLevel(item.risk_level),
        riskLevelRaw: item.risk_level,
        description: item.description,
        boundary_json: item.boundary_json,
        center: [item.center_lat, item.center_lng],
        updated_at: item.updated_at
      }));

      // 更新地图数据
      if (window.terrainMap) {
        console.log('加载地形数据到地图:', terrainData.terrains.length);
        window.terrainMap.loadTerrains(terrainData.terrains);
        
        // 默认选中第一个地形
        if (terrainData.terrains.length > 0) {
          const firstTerrain = terrainData.terrains[0];
          window.terrainMap.selectTerrain(firstTerrain);
          if (vueInstances.terrainTable) {
            vueInstances.terrainTable.currentTerrainId = firstTerrain.id;
          }
        }
      }
      
      // 2. 更新统计数据
      const highRiskCount = result.data.filter(item => item.risk_level === 'high').length;
      const totalArea = terrainData.terrains.reduce((sum, item) => sum + parseFloat(item.area || 0), 0);
      
      document.getElementById('totalTerrains').textContent = terrainData.terrains.length;
      document.getElementById('highRiskAreas').textContent = highRiskCount;
      
      // 3. 统计子地块总数
      const totalZones = result.data.reduce((sum, item) => sum + (item.zone_count || 0), 0);
      document.getElementById('activeTasks').textContent = totalZones;
      
      // 更新页面标题或辅助统计（可选）
      document.getElementById('dataAccuracy').textContent = totalArea.toFixed(2) + ' ha';
      
      // 更新Vue数据
      updatePageData();
    }
  } catch (error) {
    console.error('加载数据失败:', error);
  }
}

// 类型转换辅助函数
function translateLandType(type) {
  const mapping = {
    'mountain': '山地',
    'hill': '丘陵',
    'valley': '山谷',
    'plateau': '高原',
    'plain': '平原',
    'forest': '林区',
    'farm': '农田',
    'farmland': '农田',
    'water': '水域',
    'road': '道路',
    'building': '建筑',
    'mixed': '混合'
  };
  return mapping[type] || type;
}

function translateRiskLevel(level) {
  const mapping = {
    'high': '高',
    'medium': '中',
    'low': '低'
  };
  return mapping[level] || level;
}

// 废弃旧的假数据加载逻辑
function loadMockData() {
  console.warn('loadMockData 已废弃，请使用 loadRealData');
}

// 初始化筛选表单
function initFilterForm() {
  // 时间范围选择
  document.getElementById('timeRange').addEventListener('change', function() {
    const dateRange = document.getElementById('dateRange');
    if (this.value === 'custom') {
      dateRange.classList.remove('d-none');
    } else {
      dateRange.classList.add('d-none');
    }
  });

  // 搜索按钮
  document.getElementById('searchBtn').addEventListener('click', function() {
    const formData = {
      name: document.getElementById('terrainName').value,
      terrainType: document.getElementById('terrainType').value,
      riskLevel: document.getElementById('riskLevel').value,
      timeRange: document.getElementById('timeRange').value
    };
    // 模拟搜索
    console.log('搜索条件:', formData);
    // 这里可以添加实际的搜索逻辑
  });

  // 重置按钮
  document.getElementById('resetBtn').addEventListener('click', function() {
    document.getElementById('terrainFilterForm').reset();
    document.getElementById('dateRange').classList.add('d-none');
  });
}

// 初始化表格
function initTables() {
  // 地形表格
  // 这里可以添加表格初始化逻辑，如排序、分页等
}

// 初始化事件绑定
function initEvents() {
  // 监听跨页面数据同步标记
  window.addEventListener('focus', function() {
    if (localStorage.getItem('terrain_plot_changed') === '1') {
      console.log('检测到地块数据变动，自动刷新列表');
      loadRealData();
      localStorage.removeItem('terrain_plot_changed');
    }
  });

  // 新增地形按钮
  document.getElementById('addTerrainBtn').addEventListener('click', function() {
    // 跳转到地块编辑器页面
    window.location.href = '/terrain/editor/';
  });

  // 刷新按钮
  document.getElementById('refreshBtn').addEventListener('click', function() {
    console.log('手动刷新数据');
    loadRealData();
  });

  // 保存地形按钮
  document.getElementById('saveTerrainBtn').addEventListener('click', function() {
    const formData = {
      id: document.getElementById('terrainId').value,
      name: document.getElementById('name').value,
      area: document.getElementById('area').value,
      terrainType: document.getElementById('terrainType').value,
      riskLevel: document.getElementById('riskLevel').value,
      description: document.getElementById('description').value
    };
    console.log('保存地形:', formData);
    // 这里可以添加实际的保存逻辑
    const modal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
    modal.hide();
  });

  // 开始测绘按钮
  document.getElementById('startSurveyBtn').addEventListener('click', function() {
    console.log('开始测绘');
    // 这里可以添加实际的开始测绘逻辑
  });

  // 查看详情按钮
  document.getElementById('viewDetailBtn').addEventListener('click', function() {
    console.log('查看详情');
    // 这里可以添加实际的查看详情逻辑
  });

  // 编辑按钮
  document.getElementById('editDetailBtn').addEventListener('click', function() {
    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    document.getElementById('editModalLabel').textContent = '编辑地形';
    // 这里可以添加实际的编辑逻辑
    modal.show();
  });

  // 地图事件监听
  document.addEventListener('terrainSelected', function(e) {
    const terrain = e.detail;
    terrainData.currentTerrain = terrain;
    updateDetailPanel(terrain);
  });
}

// 初始化Vue实例
function initVue() {
  // 检查DOM元素是否存在
  console.log('DOM元素检查:');
  console.log('terrainTableContainer:', document.getElementById('terrainTableContainer') ? '存在' : '不存在');
  console.log('riskAreasTable:', document.getElementById('riskAreasTable') ? '存在' : '不存在');
  console.log('surveyRecordsTable:', document.getElementById('surveyRecordsTable') ? '存在' : '不存在');
  
  // 地形表格
  console.log('创建地形表格Vue实例');
  vueInstances.terrainTable = new Vue({
    el: '#terrainTableContainer',
    data: {
      terrains: terrainData.terrains,
      currentTerrainId: null
    },
    template: `
      <div class="table-responsive">
        <table class="table table-hover align-middle" id="terrainTable">
          <thead class="table-light">
            <tr>
              <th scope="col" class="text-center" style="width: 40px;">#</th>
              <th scope="col">地形名称</th>
              <th scope="col">面积(ha)</th>
              <th scope="col" class="text-center">地块</th>
              <th scope="col" class="text-center">风险</th>
              <th scope="col" class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(terrain, index) in terrains" :key="terrain.id" 
                :class="{'table-primary': currentTerrainId === terrain.id}"
                @click="selectTerrain(terrain)" style="cursor: pointer; transition: background-color 0.2s;">
              <th scope="row" class="text-center text-muted">{{ index + 1 }}</th>
              <td class="fw-bold text-dark">{{ terrain.name }}</td>
              <td>{{ parseFloat(terrain.area).toFixed(2) }}</td>
              <td class="text-center"><span class="badge bg-secondary rounded-pill">{{ terrain.zone_count }}</span></td>
              <td class="text-center">
                <span v-if="terrain.riskLevelRaw === 'high'" class="badge bg-danger">高</span>
                <span v-else-if="terrain.riskLevelRaw === 'medium'" class="badge bg-warning text-dark">中</span>
                <span v-else class="badge bg-success">低</span>
              </td>
              <td class="text-center">
                <button class="btn btn-sm btn-outline-primary rounded-pill px-3" @click.stop="viewDetail(terrain)">
                  <i class="bi bi-pencil-square me-1"></i>编辑
                </button>
              </td>
            </tr>
            <tr v-if="terrains.length === 0">
              <td colspan="6" class="text-center text-muted py-5">
                <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                暂无地形数据
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `,
    methods: {
      selectTerrain: function(terrain) {
        this.currentTerrainId = terrain.id;
        // 触发地形选择事件
        if (window.terrainMap) window.terrainMap.selectTerrain(terrain);
        const event = new CustomEvent('terrainSelected', { detail: terrain });
        document.dispatchEvent(event);
        // 打开详情抽屉
        const offcanvas = new bootstrap.Offcanvas(document.getElementById('detailDrawer'));
        offcanvas.show();
      },
      viewDetail: function(terrain) {
        // 直接跳转到地块编辑器，传递区域 ID
        window.location.href = `/terrain/editor/?area_id=${terrain.id}`;
      }
    }
  });

  // 风险区域表格
  console.log('创建风险区域表格Vue实例');
  vueInstances.riskAreasTable = new Vue({
    el: '#riskAreasTable',
    data: {
      riskAreas: terrainData.riskAreas
    },
    template: `
      <div class="table-responsive mt-3">
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
              <td>
                <span v-if="area.risk_level === '高'" class="badge bg-danger">高</span>
                <span v-else-if="area.risk_level === '中等'" class="badge bg-warning">中</span>
                <span v-else class="badge bg-success">低</span>
              </td>
              <td>{{ area.area }}</td>
              <td>{{ area.discovery_time }}</td>
              <td>
                <button class="btn btn-sm btn-outline-primary">查看</button>
              </td>
            </tr>
            <tr v-if="riskAreas.length === 0">
              <td colspan="7" class="text-center text-muted py-4">暂无风险区域</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  });

  // 测绘记录表格
  console.log('创建测绘记录表格Vue实例');
  vueInstances.surveyRecordsTable = new Vue({
    el: '#surveyRecordsTable',
    data: {
      surveys: terrainData.surveys
    },
    template: `
      <div class="table-responsive mt-3">
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
              <td>
                <button class="btn btn-sm btn-outline-primary">查看</button>
              </td>
            </tr>
            <tr v-if="surveys.length === 0">
              <td colspan="8" class="text-center text-muted py-4">暂无测绘记录</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  });
  console.log('测绘记录表格Vue实例创建成功:', vueInstances.surveyRecordsTable);
  console.log('Vue实例初始化完成');
}

// 更新页面数据
function updatePageData() {
  // 1. 更新统计数据
  document.getElementById('totalTerrains').textContent = terrainData.terrains.length;
  const highRiskCount = terrainData.terrains.filter(t => t.riskLevelRaw === 'high').length;
  document.getElementById('highRiskAreas').textContent = highRiskCount;
  
  // 测绘任务和数据精度暂时保持静态或由 loadRealData 更新
  
  // 2. 更新 Vue 实例数据
  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.terrains = terrainData.terrains;
  }
  if (vueInstances.riskAreasTable) {
    vueInstances.riskAreasTable.riskAreas = terrainData.riskAreas;
  }
  if (vueInstances.surveyRecordsTable) {
    vueInstances.surveyRecordsTable.surveys = terrainData.surveys;
  }
}

// 更新详情面板
function updateDetailPanel(terrain) {
  document.getElementById('detailName').textContent = terrain.name;
  document.getElementById('detailArea').textContent = parseFloat(terrain.area).toFixed(2);
  
  const typeEl = document.getElementById('detailType');
  typeEl.textContent = terrain.type;
  typeEl.className = 'badge ' + (terrain.zone_count > 0 ? 'bg-primary' : 'bg-secondary');

  const riskEl = document.getElementById('detailRisk');
  const riskText = {
    'high': '高',
    'medium': '中',
    'low': '低'
  }[terrain.risk_level] || terrain.risk_level;
  riskEl.textContent = riskText + '风险';
  
  let riskClass = 'bg-success';
  if (terrain.riskLevelRaw === 'high') riskClass = 'bg-danger';
  else if (terrain.riskLevelRaw === 'medium') riskClass = 'bg-warning text-dark';
  riskEl.className = 'badge ' + riskClass;

  document.getElementById('detailAccuracy').textContent = '92%';
  document.getElementById('detailLastSurvey').textContent = '2026-04-12 10:00';
  document.getElementById('detailElevation').textContent = '850';
  document.getElementById('detailSlope').textContent = '25';
  document.getElementById('detailCoverage').textContent = '85';
  document.getElementById('detailSoil').textContent = '黄壤';
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initPage);