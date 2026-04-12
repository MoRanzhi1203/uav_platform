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
  // 初始化Vue实例
  initVue();

  // 初始化地图
  terrainMap = new TerrainMap('terrainMap');
  terrainMap.init();

  // 加载假数据
  loadMockData();

  // 初始化筛选表单
  initFilterForm();

  // 初始化表格
  initTables();

  // 初始化事件绑定
  initEvents();
}

// 加载假数据
function loadMockData() {
  // 模拟API请求延迟
  setTimeout(() => {
    // 检查假数据是否加载
    if (window.terrainMockData) {
      // 加载地形数据
      terrainData.terrains = window.terrainMockData.terrains.map(terrain => ({
        ...terrain,
        risk_level: terrain.riskLevel,
        coordinates: window.terrainMockData.mapData.terrainBoundaries.find(b => b.id === terrain.id)?.coordinates || []
      }));

      // 加载风险区域数据
      terrainData.riskAreas = window.terrainMockData.dangerZones.map(area => ({
        ...area,
        terrain_name: area.name,
        risk_level: area.level,
        discovery_time: area.time,
        coordinates: []
      }));

      // 加载测绘记录数据
      terrainData.surveys = window.terrainMockData.surveyRecords.map(task => ({
        ...task,
        start_time: task.time,
        end_time: task.time,
        coordinates: []
      }));

      // 更新页面数据
      updatePageData();

      // 加载地图数据
      if (terrainMap) {
        terrainMap.loadTerrains(terrainData.terrains);
        terrainMap.loadRiskAreas(terrainData.riskAreas);
        terrainMap.loadSurveyPaths(terrainData.surveys);
      }
    } else {
      console.error('假数据未加载');
    }

  }, 500);
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
  // 新增地形按钮
  document.getElementById('addTerrainBtn').addEventListener('click', function() {
    // 跳转到地块编辑器页面
    window.location.href = '/terrain/editor/';
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
        // 查看详情
        console.log('查看详情:', terrain);
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