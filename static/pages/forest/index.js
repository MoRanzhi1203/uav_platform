// 林区管理页面全局
// 使用全局变量
// 直接使用全局变量ForestMap，不需要重复定义
// 页面数据
let forestData = {
  forests: [],
  fireAlerts: [],
  patrols: [],
  currentForest: null
};

// 全局地图实例
let forestMap;

// 全局Vue实例
let vueInstances = {};

// 初始化页面
function initPage() {
  console.log('开始初始化页面');
  
  // 初始化Vue实例
  console.log('初始化Vue实例');
  initVue();

  // 初始化筛选表单
  console.log('初始化筛选表单');
  initFilterForm();

  // 初始化表格
  console.log('初始化表格');
  initTables();

  // 初始化事件绑定
  console.log('初始化事件绑定');
  initEvents();

  // 初始化地图
  console.log('初始化地图');
  forestMap = new ForestMap('forestMap');
  forestMap.init();

  // 加载假数据
  console.log('加载假数据');
  loadMockData();
  
  console.log('页面初始化完成');
}

// 加载假数据
function loadMockData() {
  console.log('开始加载假数据');
  // 模拟API请求延迟
  setTimeout(() => {
    // 检查假数据是否加载
    console.log('检查假数据是否加载:', window.forestMockData);
    if (window.forestMockData) {
      console.log('假数据加载成功:', window.forestMockData);
      
      // 确保mapData存在
      const mapData = window.forestMockData.mapData || {};
      const forestBoundaries = mapData.forestBoundaries || [];
      const patrolRoutes = mapData.patrolRoutes || [];
      
      // 加载林区数据
      forestData.forests = window.forestMockData.forests.map(forest => {
        const boundary = forestBoundaries.find(b => b.id === forest.id);
        return {
          ...forest,
          coordinates: boundary ? boundary.coordinates : []
        };
      });
      console.log('林区数据加载完成:', forestData.forests);

      // 加载火点预警数据
      forestData.fireAlerts = window.forestMockData.fireAlerts || [];
      console.log('火点预警数据加载完成:', forestData.fireAlerts);

      // 加载巡林记录数据
      forestData.patrols = (window.forestMockData.patrolRecords || []).map(record => {
        const route = patrolRoutes.find(route => route.forestId === record.forestId);
        return {
          ...record,
          name: `巡林任务-${record.id}`,
          start_time: record.time,
          end_time: record.time,
          coordinates: route ? route.coordinates : []
        };
      });
      console.log('巡林记录数据加载完成:', forestData.patrols);

      console.log('数据加载完成:', forestData);
      // 更新页面数据
      console.log('更新页面数据');
      updatePageData();

      // 加载地图数据
      if (forestMap) {
        console.log('加载地图数据');
        forestMap.loadForests(forestData.forests);
        forestMap.loadFireAlerts(forestData.fireAlerts);
        forestMap.loadPatrolPaths(forestData.patrols);
      } else {
        console.error('forestMap未初始化');
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
      name: document.getElementById('forestName').value,
      region: document.getElementById('region').value,
      status: document.getElementById('status').value,
      timeRange: document.getElementById('timeRange').value
    };
    // 模拟搜索
    console.log('搜索条件:', formData);
    // 这里可以添加实际的搜索逻辑
  });

  // 重置按钮
  document.getElementById('resetBtn').addEventListener('click', function() {
    document.getElementById('forestFilterForm').reset();
    document.getElementById('dateRange').classList.add('d-none');
  });
}

// 初始化表格
function initTables() {
  // 林区表格
  // 这里可以添加表格初始化逻辑，如排序、分页等
}

// 初始化事件绑定
function initEvents() {
  // 新增林区按钮
  document.getElementById('addForestBtn').addEventListener('click', function() {
    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    document.getElementById('editModalLabel').textContent = '新增林区';
    document.getElementById('forestForm').reset();
    document.getElementById('forestId').value = '';
    modal.show();
  });

  // 保存林区按钮
  document.getElementById('saveForestBtn').addEventListener('click', function() {
    const formData = {
      id: document.getElementById('forestId').value,
      name: document.getElementById('name').value,
      area: document.getElementById('area').value,
      region: document.getElementById('formRegion').value,
      manager: document.getElementById('manager').value,
      phone: document.getElementById('phone').value,
      description: document.getElementById('description').value
    };
    console.log('保存林区:', formData);
    // 这里可以添加实际的保存逻辑
    const modal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
    modal.hide();
  });

  // 开始巡林按钮
  document.getElementById('startPatrolBtn').addEventListener('click', function() {
    console.log('开始巡林');
    // 这里可以添加实际的开始巡林逻辑
  });

  // 查看详情按钮
  document.getElementById('viewDetailBtn').addEventListener('click', function() {
    console.log('查看详情');
    // 这里可以添加实际的查看详情逻辑
  });

  // 编辑按钮
  document.getElementById('editDetailBtn').addEventListener('click', function() {
    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    document.getElementById('editModalLabel').textContent = '编辑林区';
    // 这里可以添加实际的编辑逻辑
    modal.show();
  });

  // 地图事件监听
  document.addEventListener('forestSelected', function(e) {
    const forest = e.detail;
    forestData.currentForest = forest;
    updateDetailPanel(forest);
  });
}

// 初始化Vue实例
function initVue() {
  console.log('开始初始化Vue实例');
  
  // 检查DOM元素是否存在
  console.log('DOM元素检查:');
  console.log('forestTable tbody:', document.getElementById('forestTable') ? document.getElementById('forestTable').querySelector('tbody') : '不存在');
  console.log('fireAlertsTable tbody:', document.getElementById('fireAlertsTable') ? document.getElementById('fireAlertsTable').querySelector('tbody') : '不存在');
  console.log('patrolRecordsTable tbody:', document.getElementById('patrolRecordsTable') ? document.getElementById('patrolRecordsTable').querySelector('tbody') : '不存在');
  
  // 林区表格
  console.log('创建林区表格Vue实例');
  vueInstances.forestTable = new Vue({
    el: '#forestTable',
    data: {
      forests: forestData.forests
    },
    template: `
      <table class="table table-hover" id="forestTable">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">林区名称</th>
            <th scope="col">面积(公顷)</th>
            <th scope="col">区域</th>
            <th scope="col">状态</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(forest, index) in forests" :key="forest.id" @click="selectForest(forest)" style="cursor: pointer;">
            <th scope="row">{{ index + 1 }}</th>
            <td>{{ forest.name }}</td>
            <td>{{ forest.area }}</td>
            <td>{{ forest.region }}</td>
            <td>
              <span v-if="forest.status === '正常'" class="badge bg-success">正常</span>
              <span v-else-if="forest.status === '预警'" class="badge bg-warning">预警</span>
              <span v-else-if="forest.status === '危险'" class="badge bg-danger">危险</span>
              <span v-else>{{ forest.status }}</span>
            </td>
            <td>
              <button class="btn btn-sm btn-outline-primary" @click.stop="viewDetail(forest)">
                详情
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    `,
    methods: {
      selectForest: function(forest) {
        // 触发森林选择事件
        const event = new CustomEvent('forestSelected', { detail: forest });
        document.dispatchEvent(event);
        // 打开详情抽屉
        const offcanvas = new bootstrap.Offcanvas(document.getElementById('detailDrawer'));
        offcanvas.show();
      },
      viewDetail: function(forest) {
        // 查看详情
        console.log('查看详情:', forest);
      }
    }
  });
  console.log('林区表格Vue实例创建成功:', vueInstances.forestTable);

  // 火点预警表格
  console.log('创建火点预警表格Vue实例');
  vueInstances.fireAlertsTable = new Vue({
    el: '#fireAlertsTable',
    data: {
      fireAlerts: forestData.fireAlerts
    },
    template: `
      <table class="table table-hover" id="fireAlertsTable">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">火点位置</th>
            <th scope="col">预警时间</th>
            <th scope="col">严重程度</th>
            <th scope="col">处理状态</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(alert, index) in fireAlerts" :key="alert.id">
            <th scope="row">{{ index + 1 }}</th>
            <td>{{ alert.location }}</td>
            <td>{{ alert.time }}</td>
            <td>
              <span v-if="alert.level === '高'" class="badge bg-danger">高</span>
              <span v-else-if="alert.level === '中等'" class="badge bg-warning">中</span>
              <span v-else class="badge bg-info">低</span>
            </td>
            <td>
              <span v-if="alert.status === '处理中'" class="badge bg-primary">处理中</span>
              <span v-else-if="alert.status === '已处理'" class="badge bg-success">已处理</span>
              <span v-else class="badge bg-warning">待处理</span>
            </td>
            <td>
              <button class="btn btn-sm btn-outline-primary">处理</button>
            </td>
          </tr>
        </tbody>
      </table>
    `
  });
  console.log('火点预警表格Vue实例创建成功:', vueInstances.fireAlertsTable);

  // 巡林记录表格
  console.log('创建巡林记录表格Vue实例');
  vueInstances.patrolRecordsTable = new Vue({
    el: '#patrolRecordsTable',
    data: {
      patrols: forestData.patrols
    },
    template: `
      <table class="table table-hover" id="patrolRecordsTable">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">巡林任务</th>
            <th scope="col">无人机</th>
            <th scope="col">开始时间</th>
            <th scope="col">结束时间</th>
            <th scope="col">状态</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(patrol, index) in patrols" :key="patrol.id">
            <th scope="row">{{ index + 1 }}</th>
            <td>{{ patrol.name }}</td>
            <td>无人机-{{ index + 1 }}</td>
            <td>{{ patrol.start_time }}</td>
            <td>{{ patrol.end_time }}</td>
            <td>
              <span v-if="patrol.status === '完成'" class="badge bg-success">已完成</span>
              <span v-else-if="patrol.status === '进行中'" class="badge bg-primary">进行中</span>
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
  console.log('巡林记录表格Vue实例创建成功:', vueInstances.patrolRecordsTable);
  console.log('Vue实例初始化完成');
}

// 更新页面数据
function updatePageData() {
  // 更新统计数据
  document.getElementById('totalForests').textContent = forestData.forests.length;
  document.getElementById('fireAlerts').textContent = forestData.fireAlerts.length;
  document.getElementById('activeTasks').textContent = forestData.patrols.filter(p => p.status === '进行中').length;
  
  // 更新Vue数据
  if (vueInstances.forestTable) {
    vueInstances.forestTable.forests = forestData.forests;
    vueInstances.forestTable.$forceUpdate();
  }
  if (vueInstances.fireAlertsTable) {
    vueInstances.fireAlertsTable.fireAlerts = forestData.fireAlerts;
    vueInstances.fireAlertsTable.$forceUpdate();
  }
  if (vueInstances.patrolRecordsTable) {
    vueInstances.patrolRecordsTable.patrols = forestData.patrols;
    vueInstances.patrolRecordsTable.$forceUpdate();
  }
}

// 更新详情面板
function updateDetailPanel(forest) {
  document.getElementById('detailName').textContent = forest.name;
  document.getElementById('detailArea').textContent = forest.area;
  document.getElementById('detailRegion').textContent = forest.region;
  document.getElementById('detailStatus').textContent = {
    'normal': '正常',
    'warning': '预警',
    'danger': '危险'
  }[forest.status] || forest.status;
  document.getElementById('detailManager').textContent = '管理员';
  document.getElementById('detailPhone').textContent = '13800138000';
  document.getElementById('detailLastPatrol').textContent = '2026-04-12 08:00';
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initPage);