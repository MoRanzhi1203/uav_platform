// 农田管理页面脚本

new Vue({
  el: '#main',
  data: {
    // 统计数据
    stats: {
      totalFarms: 32,
      pestAlerts: 5,
      activeTasks: 12,
      healthyCrops: 92
    },
    // 搜索表单
    searchForm: {
      name: '',
      cropType: '',
      status: ''
    },
    // 农田列表
    farms: [],
    // 选中的农田
    selectedFarm: null,
    // 分页信息
    currentPage: 1,
    totalPages: 4,
    // 病虫害预警
    pestAlerts: [],
    // 植保记录
    treatments: [],
    // 编辑表单
    formData: {
      name: '',
      area: '',
      cropType: 'rice',
      plantingDate: '',
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
      farm: null,
      pest: null,
      task: null
    }
  },
  mounted() {
    this.loadFarms();
    this.loadPestAlerts();
    this.loadTreatments();
    this.initMap();
  },
  methods: {
    // 加载农田列表
    loadFarms() {
      // 模拟 API 调用
      this.farms = [
        {
          id: 1,
          name: '东风水田',
          area: 50,
          cropType: 'rice',
          cropTypeText: '水稻',
          plantingDate: '2024-01-01',
          status: 'normal',
          statusText: '正常',
          lastTreatment: '2024-01-14 15:30',
          manager: '张三',
          phone: '13800138000'
        },
        {
          id: 2,
          name: '西坡旱田',
          area: 30,
          cropType: 'wheat',
          cropTypeText: '小麦',
          plantingDate: '2023-12-15',
          status: 'warning',
          statusText: '预警',
          lastTreatment: '2024-01-13 10:20',
          manager: '李四',
          phone: '13900139000'
        },
        {
          id: 3,
          name: '南湾菜地',
          area: 20,
          cropType: 'vegetable',
          cropTypeText: '蔬菜',
          plantingDate: '2024-01-05',
          status: 'normal',
          statusText: '正常',
          lastTreatment: '2024-01-15 09:10',
          manager: '王五',
          phone: '13700137000'
        }
      ];
    },
    // 加载病虫害预警
    loadPestAlerts() {
      this.pestAlerts = [
        {
          id: 1,
          farmName: '西坡旱田',
          pestType: '蚜虫',
          time: '2024-01-15 11:20',
          severity: 'medium',
          severityText: '中等',
          status: 'processing',
          statusText: '处理中'
        },
        {
          id: 2,
          farmName: '东风水田',
          pestType: '稻飞虱',
          time: '2024-01-15 10:45',
          severity: 'low',
          severityText: '轻微',
          status: 'pending',
          statusText: '待处理'
        }
      ];
    },
    // 加载植保记录
    loadTreatments() {
      this.treatments = [
        {
          id: 1,
          taskName: '东风水田植保',
          farmName: '东风水田',
          droneName: '无人机 #3',
          startTime: '2024-01-14 14:00',
          endTime: '2024-01-14 15:30',
          status: 'completed',
          statusText: '已完成'
        },
        {
          id: 2,
          taskName: '西坡旱田植保',
          farmName: '西坡旱田',
          droneName: '无人机 #4',
          startTime: '2024-01-15 13:00',
          endTime: null,
          status: 'in_progress',
          statusText: '进行中'
        }
      ];
    },
    // 搜索农田
    searchFarms() {
      // 模拟搜索逻辑
      console.log('搜索条件:', this.searchForm);
      this.loadFarms();
    },
    // 选择农田
    selectFarm(farm) {
      this.selectedFarm = farm;
      this.highlightOnMap(farm);
    },
    // 编辑农田
    editFarm(farm) {
      this.isEdit = true;
      this.editId = farm.id;
      this.formData = {
        name: farm.name,
        area: farm.area,
        cropType: farm.cropType,
        plantingDate: farm.plantingDate,
        manager: farm.manager,
        phone: farm.phone,
        description: ''
      };
      $('#editModal').modal('show');
    },
    // 删除农田
    deleteFarm(id) {
      if (confirm('确定要删除这个农田吗？')) {
        // 模拟删除逻辑
        console.log('删除农田:', id);
        this.loadFarms();
      }
    },
    // 保存农田
    saveFarm() {
      // 模拟保存逻辑
      console.log('保存农田:', this.formData);
      $('#editModal').modal('hide');
      this.loadFarms();
    },
    // 开始植保
    startTreatment(farmId) {
      console.log('开始植保:', farmId);
      alert('植保任务已开始');
    },
    // 查看详情
    viewDetails(farmId) {
      console.log('查看详情:', farmId);
      // 跳转到详情页面
      window.location.href = `/agri/detail/?id=${farmId}`;
    },
    // 处理病虫害
    handlePest(alertId) {
      console.log('处理病虫害:', alertId);
      alert('病虫害已处理');
    },
    // 查看植保记录
    viewTreatment(treatmentId) {
      console.log('查看植保记录:', treatmentId);
      alert('查看植保记录详情');
    },
    // 分页
    changePage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
        this.loadFarms();
      }
    },
    // 初始化地图
    initMap() {
      // 初始化 Leaflet 地图
      this.map = L.map('farmMap', {
        attributionControl: false
      }).setView([30.05, 107.60], 7);
      
      // 添加底图
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
      
      // 初始化图层
      this.layers.farm = L.layerGroup().addTo(this.map);
      this.layers.pest = L.layerGroup().addTo(this.map);
      this.layers.task = L.layerGroup().addTo(this.map);
      
      // 添加农田边界
      this.addFarmBoundaries();
    },
    // 添加农田边界
    addFarmBoundaries() {
      // 模拟 GeoJSON 数据
      const farmsGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { id: 1, name: '东风水田' },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [106.5, 29.6],
                [106.55, 29.6],
                [106.55, 29.55],
                [106.5, 29.55],
                [106.5, 29.6]
              ]]
            }
          },
          {
            type: 'Feature',
            properties: { id: 2, name: '西坡旱田' },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [106.55, 29.6],
                [106.6, 29.6],
                [106.6, 29.55],
                [106.55, 29.55],
                [106.55, 29.6]
              ]]
            }
          }
        ]
      };
      
      // 添加到地图
      L.geoJSON(farmsGeoJSON, {
        style: function(feature) {
          return { color: '#10b981', weight: 2, fillOpacity: 0.2 };
        },
        onEachFeature: (feature, layer) => {
          layer.bindPopup(feature.properties.name);
          layer.on('click', () => {
            const farm = this.farms.find(f => f.id === feature.properties.id);
            if (farm) {
              this.selectFarm(farm);
            }
          });
        }
      }).addTo(this.layers.farm);
    },
    // 在地图上高亮选中的农田
    highlightOnMap(farm) {
      // 模拟高亮逻辑
      console.log('高亮农田:', farm.name);
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
