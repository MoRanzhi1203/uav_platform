// 林区管理页面脚本

new Vue({
  el: '#main',
  data: {
    // 统计数据
    stats: {
      totalForests: 24,
      fireAlerts: 3,
      activeTasks: 8,
      healthyForests: 85
    },
    // 搜索表单
    searchForm: {
      name: '',
      region: '',
      status: ''
    },
    // 林区列表
    forests: [],
    // 选中的林区
    selectedForest: null,
    // 分页信息
    currentPage: 1,
    totalPages: 3,
    // 火点预警
    fireAlerts: [],
    // 巡林记录
    patrols: [],
    // 编辑表单
    formData: {
      name: '',
      area: '',
      region: 'north',
      manager: '',
      phone: '',
      description: ''
    },
    isEdit: false,
    editId: null,
    // 地图实例
    map: null,
    // 地图图层
    layers: {
      forest: null,
      fire: null,
      task: null
    }
  },
  mounted() {
    this.loadForests();
    this.loadFireAlerts();
    this.loadPatrols();
    this.initMap();
  },
  methods: {
    // 加载林区列表
    loadForests() {
      // 模拟 API 调用
      this.forests = [
        {
          id: 1,
          name: '北部林区',
          area: 1200,
          region: 'north',
          regionText: '北区',
          status: 'normal',
          statusText: '正常',
          lastPatrol: '2024-01-15 10:30',
          manager: '张三',
          phone: '13800138000'
        },
        {
          id: 2,
          name: '南部林区',
          area: 800,
          region: 'south',
          regionText: '南区',
          status: 'warning',
          statusText: '预警',
          lastPatrol: '2024-01-14 14:20',
          manager: '李四',
          phone: '13900139000'
        },
        {
          id: 3,
          name: '东部林区',
          area: 1500,
          region: 'east',
          regionText: '东区',
          status: 'normal',
          statusText: '正常',
          lastPatrol: '2024-01-15 09:15',
          manager: '王五',
          phone: '13700137000'
        }
      ];
    },
    // 加载火点预警
    loadFireAlerts() {
      this.fireAlerts = [
        {
          id: 1,
          location: '北部林区A区',
          time: '2024-01-15 11:20',
          severity: 'medium',
          severityText: '中等',
          status: 'processing',
          statusText: '处理中'
        },
        {
          id: 2,
          location: '南部林区B区',
          time: '2024-01-15 10:45',
          severity: 'high',
          severityText: '严重',
          status: 'pending',
          statusText: '待处理'
        }
      ];
    },
    // 加载巡林记录
    loadPatrols() {
      this.patrols = [
        {
          id: 1,
          taskName: '北部林区日常巡林',
          droneName: '无人机 #1',
          startTime: '2024-01-15 08:00',
          endTime: '2024-01-15 10:30',
          status: 'completed',
          statusText: '已完成'
        },
        {
          id: 2,
          taskName: '南部林区预警巡林',
          droneName: '无人机 #2',
          startTime: '2024-01-15 13:00',
          endTime: null,
          status: 'in_progress',
          statusText: '进行中'
        }
      ];
    },
    // 搜索林区
    searchForests() {
      // 模拟搜索逻辑
      console.log('搜索条件:', this.searchForm);
      this.loadForests();
    },
    // 选择林区
    selectForest(forest) {
      this.selectedForest = forest;
      this.highlightOnMap(forest);
    },
    // 编辑林区
    editForest(forest) {
      this.isEdit = true;
      this.editId = forest.id;
      this.formData = {
        name: forest.name,
        area: forest.area,
        region: forest.region,
        manager: forest.manager,
        phone: forest.phone,
        description: ''
      };
      $('#editModal').modal('show');
    },
    // 删除林区
    deleteForest(id) {
      if (confirm('确定要删除这个林区吗？')) {
        // 模拟删除逻辑
        console.log('删除林区:', id);
        this.loadForests();
      }
    },
    // 保存林区
    saveForest() {
      // 模拟保存逻辑
      console.log('保存林区:', this.formData);
      $('#editModal').modal('hide');
      this.loadForests();
    },
    // 开始巡林
    startPatrol(forestId) {
      console.log('开始巡林:', forestId);
      alert('巡林任务已开始');
    },
    // 查看详情
    viewDetails(forestId) {
      console.log('查看详情:', forestId);
      // 跳转到详情页面
      window.location.href = `/forest/detail/?id=${forestId}`;
    },
    // 处理火点预警
    handleAlert(alertId) {
      console.log('处理火点预警:', alertId);
      alert('火点预警已处理');
    },
    // 查看巡林记录
    viewPatrol(patrolId) {
      console.log('查看巡林记录:', patrolId);
      alert('查看巡林记录详情');
    },
    // 分页
    changePage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
        this.loadForests();
      }
    },
    // 初始化地图
    initMap() {
      // 初始化 Leaflet 地图
      this.map = L.map('forestMap', {
        attributionControl: false
      }).setView([30.05, 107.60], 7);
      
      // 添加底图
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
      
      // 初始化图层
      this.layers.forest = L.layerGroup().addTo(this.map);
      this.layers.fire = L.layerGroup().addTo(this.map);
      this.layers.task = L.layerGroup().addTo(this.map);
      
      // 添加林区边界
      this.addForestBoundaries();
    },
    // 添加林区边界
    addForestBoundaries() {
      // 模拟 GeoJSON 数据
      const forestsGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { id: 1, name: '北部林区' },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [106.5, 29.6],
                [106.6, 29.6],
                [106.6, 29.5],
                [106.5, 29.5],
                [106.5, 29.6]
              ]]
            }
          },
          {
            type: 'Feature',
            properties: { id: 2, name: '南部林区' },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [106.5, 29.5],
                [106.6, 29.5],
                [106.6, 29.4],
                [106.5, 29.4],
                [106.5, 29.5]
              ]]
            }
          }
        ]
      };
      
      // 添加到地图
      L.geoJSON(forestsGeoJSON, {
        style: function(feature) {
          return { color: '#22c55e', weight: 2, fillOpacity: 0.2 };
        },
        onEachFeature: (feature, layer) => {
          layer.bindPopup(feature.properties.name);
          layer.on('click', () => {
            const forest = this.forests.find(f => f.id === feature.properties.id);
            if (forest) {
              this.selectForest(forest);
            }
          });
        }
      }).addTo(this.layers.forest);
    },
    // 在地图上高亮选中的林区
    highlightOnMap(forest) {
      // 模拟高亮逻辑
      console.log('高亮林区:', forest.name);
    },
    // 切换图层
    toggleLayer(layerName) {
      if (this.layers[layerName]) {
        if (this.map.hasLayer(this.layers[layerName])) {
          this.map.removeLayer(this.layers[layerName]);
        } else {
          this.map.addLayer(this.layers[layerName]);
        }
      }
    },
    // 重置地图视图
    resetMap() {
      this.map.setView([29.5630, 106.5516], 12);
    }
  }
});
