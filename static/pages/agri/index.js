// 农田管理页面逻辑
// 使用全局变量
// 直接使用全局变量AgriMap，不需要重复声明

// 页面数据
let agriData = {
  farms: [],
  pestAlerts: [],
  sprays: [],
  currentFarm: null
};

// 全局地图实例
let agriMap;

// 全局Vue实例
let vueInstances = {};

// 初始化页面
function initPage() {
  // 初始化Vue实例
  initVue();

  // 初始化地图
  agriMap = new AgriMap('farmMap');
  agriMap.init();

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
    if (window.agriMockData) {
      // 加载农田数据
      agriData.farms = window.agriMockData.farms.map(farm => ({
        ...farm,
        crop_type: farm.cropType,
        coordinates: window.agriMockData.mapData.farmBoundaries.find(b => b.id === farm.id)?.coordinates || []
      }));

      // 加载病虫害预警数据
      agriData.pestAlerts = window.agriMockData.pestAlerts;

      // 加载植保记录数据
      agriData.sprays = window.agriMockData.sprayTasks.map(task => ({
        ...task,
        start_time: task.time,
        end_time: task.time,
        coordinates: window.agriMockData.mapData.sprayRoutes.find(route => route.farmId === task.farmId)?.coordinates || []
      }));

      // 更新页面数据
      updatePageData();

      // 加载地图数据
      if (agriMap) {
        agriMap.loadFarms(agriData.farms);
        agriMap.loadPestAlerts(agriData.pestAlerts);
        agriMap.loadSprayPaths(agriData.sprays);
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
      name: document.getElementById('farmName').value,
      cropType: document.getElementById('cropType').value,
      status: document.getElementById('status').value,
      timeRange: document.getElementById('timeRange').value
    };
    // 模拟搜索
    console.log('搜索条件:', formData);
    // 这里可以添加实际的搜索逻辑
  });

  // 重置按钮
  document.getElementById('resetBtn').addEventListener('click', function() {
    document.getElementById('farmFilterForm').reset();
    document.getElementById('dateRange').classList.add('d-none');
  });
}

// 初始化表格
function initTables() {
  // 农田表格
  // 这里可以添加表格初始化逻辑，如排序、分页等
}

// 初始化事件绑定
function initEvents() {
  // 新增农田按钮
  document.getElementById('addFarmBtn').addEventListener('click', function() {
    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    document.getElementById('editModalLabel').textContent = '新增农田';
    document.getElementById('farmForm').reset();
    document.getElementById('farmId').value = '';
    modal.show();
  });

  // 保存农田按钮
  document.getElementById('saveFarmBtn').addEventListener('click', function() {
    const formData = {
      id: document.getElementById('farmId').value,
      name: document.getElementById('name').value,
      area: document.getElementById('area').value,
      cropType: document.getElementById('cropType').value,
      manager: document.getElementById('manager').value,
      phone: document.getElementById('phone').value,
      description: document.getElementById('description').value
    };
    console.log('保存农田:', formData);
    // 这里可以添加实际的保存逻辑
    const modal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
    modal.hide();
  });

  // 开始植保按钮
  document.getElementById('startSprayBtn').addEventListener('click', function() {
    console.log('开始植保');
    // 这里可以添加实际的开始植保逻辑
  });

  // 查看详情按钮
  document.getElementById('viewDetailBtn').addEventListener('click', function() {
    console.log('查看详情');
    // 这里可以添加实际的查看详情逻辑
  });

  // 编辑按钮
  document.getElementById('editDetailBtn').addEventListener('click', function() {
    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    document.getElementById('editModalLabel').textContent = '编辑农田';
    // 这里可以添加实际的编辑逻辑
    modal.show();
  });

  // 地图事件监听
  document.addEventListener('farmSelected', function(e) {
    const farm = e.detail;
    agriData.currentFarm = farm;
    updateDetailPanel(farm);
  });
}

// 初始化Vue实例
function initVue() {
  // 检查DOM元素是否存在
  console.log('DOM元素检查:');
  console.log('farmTable:', document.getElementById('farmTable') ? '存在' : '不存在');
  console.log('pestAlertsTable:', document.getElementById('pestAlertsTable') ? '存在' : '不存在');
  console.log('sprayRecordsTable:', document.getElementById('sprayRecordsTable') ? '存在' : '不存在');
  
  // 农田表格
  console.log('创建农田表格Vue实例');
  vueInstances.farmTable = new Vue({
    el: '#farmTable',
    data: {
      farms: agriData.farms
    },
    template: `
      <table class="table table-hover" id="farmTable">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">农田名称</th>
            <th scope="col">面积(公顷)</th>
            <th scope="col">作物类型</th>
            <th scope="col">状态</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(farm, index) in farms" :key="farm.id" @click="selectFarm(farm)" style="cursor: pointer;">
            <th scope="row">{{ index + 1 }}</th>
            <td>{{ farm.name }}</td>
            <td>{{ farm.area }}</td>
            <td>{{ farm.crop_type }}</td>
            <td>
              <span v-if="farm.status === '正常'" class="badge bg-success">正常</span>
              <span v-else-if="farm.status === '预警'" class="badge bg-warning">预警</span>
              <span v-else-if="farm.status === '危险'" class="badge bg-danger">危险</span>
              <span v-else>{{ farm.status }}</span>
            </td>
            <td>
              <button class="btn btn-sm btn-outline-primary" @click.stop="viewDetail(farm)">
                详情
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    `,
    methods: {
      selectFarm: function(farm) {
        // 触发农田选择事件
        const event = new CustomEvent('farmSelected', { detail: farm });
        document.dispatchEvent(event);
        // 打开详情抽屉
        const offcanvas = new bootstrap.Offcanvas(document.getElementById('detailDrawer'));
        offcanvas.show();
      },
      viewDetail: function(farm) {
        // 查看详情
        console.log('查看详情:', farm);
      }
    }
  });

  // 病虫害预警表格
  console.log('创建病虫害预警表格Vue实例');
  vueInstances.pestAlertsTable = new Vue({
    el: '#pestAlertsTable',
    data: {
      pestAlerts: agriData.pestAlerts
    },
    template: `
      <table class="table table-hover" id="pestAlertsTable">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">病虫害位置</th>
            <th scope="col">预警时间</th>
            <th scope="col">类型</th>
            <th scope="col">严重程度</th>
            <th scope="col">处理状态</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(alert, index) in pestAlerts" :key="alert.id">
            <th scope="row">{{ index + 1 }}</th>
            <td>{{ alert.name }}</td>
            <td>{{ alert.discoveryTime }}</td>
            <td>{{ alert.type }}</td>
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
  console.log('病虫害预警表格Vue实例创建成功:', vueInstances.pestAlertsTable);

  // 植保记录表格
  console.log('创建植保记录表格Vue实例');
  vueInstances.sprayRecordsTable = new Vue({
    el: '#sprayRecordsTable',
    data: {
      sprays: agriData.sprays
    },
    template: `
      <table class="table table-hover" id="sprayRecordsTable">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">植保任务</th>
            <th scope="col">无人机</th>
            <th scope="col">开始时间</th>
            <th scope="col">结束时间</th>
            <th scope="col">状态</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(spray, index) in sprays" :key="spray.id">
            <th scope="row">{{ index + 1 }}</th>
            <td>{{ spray.taskName }}</td>
            <td>无人机-{{ index + 1 }}</td>
            <td>{{ spray.start_time }}</td>
            <td>{{ spray.end_time }}</td>
            <td>
              <span v-if="spray.status === '完成'" class="badge bg-success">已完成</span>
              <span v-else-if="spray.status === '进行中'" class="badge bg-primary">进行中</span>
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
  console.log('植保记录表格Vue实例创建成功:', vueInstances.sprayRecordsTable);
  console.log('Vue实例初始化完成');
}

// 更新页面数据
function updatePageData() {
  // 更新统计数据
  document.getElementById('totalFarms').textContent = agriData.farms.length;
  document.getElementById('pestAlerts').textContent = agriData.pestAlerts.length;
  document.getElementById('activeTasks').textContent = agriData.sprays.filter(s => s.status === '进行中').length;
  
  // 更新Vue数据
  if (vueInstances.farmTable) {
    vueInstances.farmTable.farms = agriData.farms;
    vueInstances.farmTable.$forceUpdate();
  }
  if (vueInstances.pestAlertsTable) {
    vueInstances.pestAlertsTable.pestAlerts = agriData.pestAlerts;
    vueInstances.pestAlertsTable.$forceUpdate();
  }
  if (vueInstances.sprayRecordsTable) {
    vueInstances.sprayRecordsTable.sprays = agriData.sprays;
    vueInstances.sprayRecordsTable.$forceUpdate();
  }
}

// 更新详情面板
function updateDetailPanel(farm) {
  document.getElementById('detailName').textContent = farm.name;
  document.getElementById('detailArea').textContent = farm.area;
  document.getElementById('detailCrop').textContent = farm.crop_type;
  document.getElementById('detailStatus').textContent = {
    'normal': '正常',
    'warning': '预警',
    'danger': '危险'
  }[farm.status] || farm.status;
  document.getElementById('detailManager').textContent = '管理员';
  document.getElementById('detailPhone').textContent = '13800138000';
  document.getElementById('detailLastSpray').textContent = '2026-04-12 09:00';
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initPage);