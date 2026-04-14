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
let terrainMap;

// 全局Vue实例
let vueInstances = {};

// 初始化页面
function initPage() {
  // 检查是否需要刷新列表 (来自编辑器保存或删除后的跳转)
  if (localStorage.getItem('terrain_list_should_refresh') === '1') {
    localStorage.removeItem('terrain_list_should_refresh');
    // 可以延迟一小会刷新，或者直接执行 loadRealData
  }

  // 初始化Vue实例
  initVue();

  // 初始化地图
  terrainMap = new TerrainMap('terrainMap');
  terrainMap.init();

  // 加载真实数据 (已清理伪数据)
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
    // 1. 加载区域列表 (Area List)
    const response = await fetch('/terrain/api/areas/');
    const result = await response.json();
    
    if (result.code === 0) {
      // 转换后端数据为前端格式
      terrainData.terrains = result.data.map(item => ({
        id: item.id,
        name: item.name,
        area: item.area,
        type: translateLandType(item.type),
        land_type: item.type,
        risk_level: translateRiskLevel(item.risk_level),
        riskLevelRaw: item.risk_level,
        description: item.description,
        boundary_json: item.boundary_json,
        center: [item.center_lat, item.center_lng],
        updated_at: item.updated_at
      }));

      // 更新页面显示
      updatePageData();

      // 同步到地图
      if (terrainMap) {
        terrainMap.loadTerrains(terrainData.terrains);
      }
    } else {
      console.error('加载区域数据失败:', result.message);
    }
  } catch (e) {
    console.error('请求区域数据异常:', e);
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
  console.log('terrainTable:', document.getElementById('terrainTable') ? '存在' : '不存在');
  console.log('riskAreasTable:', document.getElementById('riskAreasTable') ? '存在' : '不存在');
  console.log('surveyRecordsTable:', document.getElementById('surveyRecordsTable') ? '存在' : '不存在');
  
  // 地形表格
  console.log('创建地形表格Vue实例');
  vueInstances.terrainTable = new Vue({
    el: '#terrainTable',
    data: {
      terrains: terrainData.terrains
    },
    template: `
      <table class="table table-hover" id="terrainTable">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">地形名称</th>
            <th scope="col">面积(公顷)</th>
            <th scope="col">类型</th>
            <th scope="col">风险等级</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(terrain, index) in terrains" :key="terrain.id" @click="selectTerrain(terrain)" style="cursor: pointer;">
            <th scope="row">{{ index + 1 }}</th>
            <td>{{ terrain.name }}</td>
            <td>{{ terrain.area }}</td>
            <td>{{ terrain.type }}</td>
            <td>
              <span v-if="terrain.risk_level === '高'" class="badge bg-danger">高</span>
              <span v-else-if="terrain.risk_level === '中等'" class="badge bg-warning">中</span>
              <span v-else class="badge bg-success">低</span>
            </td>
            <td>
              <button class="btn btn-sm btn-outline-primary" @click.stop="viewDetail(terrain)">
                详情
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    `,
    methods: {
      selectTerrain: function(terrain) {
        // 触发地形选择事件
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
        </tbody>
      </table>
    `
  });
  console.log('风险区域表格Vue实例创建成功:', vueInstances.riskAreasTable);

  // 测绘记录表格
  console.log('创建测绘记录表格Vue实例');
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
            <td>
              <button class="btn btn-sm btn-outline-primary">查看</button>
            </td>
          </tr>
        </tbody>
      </table>
    `
  });
  console.log('测绘记录表格Vue实例创建成功:', vueInstances.surveyRecordsTable);
  console.log('Vue实例初始化完成');
}

// 更新页面数据
function updatePageData() {
  // 更新统计数据
  document.getElementById('totalTerrains').textContent = terrainData.terrains.length;
  document.getElementById('highRiskAreas').textContent = terrainData.riskAreas.filter(a => a.risk_level === '高').length;
  document.getElementById('activeTasks').textContent = terrainData.surveys.filter(s => s.status === '进行中').length;
  document.getElementById('dataAccuracy').textContent = '92%';
  
  // 更新Vue数据
  if (vueInstances.terrainTable) {
    vueInstances.terrainTable.terrains = terrainData.terrains;
    vueInstances.terrainTable.$forceUpdate();
  }
  if (vueInstances.riskAreasTable) {
    vueInstances.riskAreasTable.riskAreas = terrainData.riskAreas;
    vueInstances.riskAreasTable.$forceUpdate();
  }
  if (vueInstances.surveyRecordsTable) {
    vueInstances.surveyRecordsTable.surveys = terrainData.surveys;
    vueInstances.surveyRecordsTable.$forceUpdate();
  }
}

// 更新详情面板
function updateDetailPanel(terrain) {
  document.getElementById('detailName').textContent = terrain.name;
  document.getElementById('detailArea').textContent = terrain.area;
  document.getElementById('detailType').textContent = terrain.type;
  document.getElementById('detailRisk').textContent = {
    'high': '高',
    'medium': '中',
    'low': '低'
  }[terrain.risk_level] || terrain.risk_level;
  document.getElementById('detailAccuracy').textContent = '92%';
  document.getElementById('detailLastSurvey').textContent = '2026-04-12 10:00';
  document.getElementById('detailElevation').textContent = '850';
  document.getElementById('detailSlope').textContent = '25';
  document.getElementById('detailCoverage').textContent = '85';
  document.getElementById('detailSoil').textContent = '黄壤';
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initPage);