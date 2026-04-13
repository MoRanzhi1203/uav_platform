// 地形管理页面脚本

new Vue({
  el: '#main',
  data: {
    // 统计数据
    stats: {
      totalTerrains: 18,
      highRiskAreas: 4,
      activeTasks: 6,
      averageAccuracy: 5
    },
    // 搜索表单
    searchForm: {
      name: '',
      terrainType: '',
      riskLevel: ''
    },
    // 地形列表
    terrains: [],
    // 选中的地形
    selectedTerrain: null,
    // 分页信息
    currentPage: 1,
    totalPages: 3,
    // 风险区域
    riskAreas: [],
    // 测绘记录
    surveys: [],
    // 编辑表单
    formData: {
      name: '',
      area: '',
      terrainType: 'mountain',
      minElevation: '',
      maxElevation: '',
      riskLevel: 'low',
      description: ''
    },
    isEdit: false,
    editId: null,
    // 地图实例
    map: null,
    // 地图图层
    layers: {
      terrain: null,
      risk: null,
      task: null
    }
  },
  mounted() {
    this.loadTerrains();
    this.loadRiskAreas();
    this.loadSurveys();
    this.initMap();
  },
  methods: {
    // 加载地形列表
    loadTerrains() {
      // 模拟 API 调用
      this.terrains = [
        {
          id: 1,
          name: '北部山地',
          area: 50,
          terrainType: 'mountain',
          terrainTypeText: '山地',
          minElevation: 500,
          maxElevation: 1200,
          riskLevel: 'medium',
          riskLevelText: '中风险',
          lastSurvey: '2024-01-15 08:30',
          accuracy: 3
        },
        {
          id: 2,
          name: '南部山谷',
          area: 30,
          terrainType: 'valley',
          terrainTypeText: '山谷',
          minElevation: 200,
          maxElevation: 600,
          riskLevel: 'low',
          riskLevelText: '低风险',
          lastSurvey: '2024-01-14 14:20',
          accuracy: 5
        },
        {
          id: 3,
          name: '西部高原',
          area: 80,
          terrainType: 'plateau',
          terrainTypeText: '高原',
          minElevation: 800,
          maxElevation: 1500,
          riskLevel: 'high',
          riskLevelText: '高风险',
          lastSurvey: '2024-01-15 10:15',
          accuracy: 4
        }
      ];
    },
    // 加载风险区域
    loadRiskAreas() {
      this.riskAreas = [
        {
          id: 1,
          name: '西部高原A区',
          terrainName: '西部高原',
          riskType: '滑坡风险',
          riskLevel: 'high',
          riskLevelText: '高风险',
          discoveryTime: '2024-01-15 09:30'
        },
        {
          id: 2,
          name: '北部山地B区',
          terrainName: '北部山地',
          riskType: '泥石流风险',
          riskLevel: 'medium',
          riskLevelText: '中风险',
          discoveryTime: '2024-01-14 16:45'
        }
      ];
    },
    // 加载测绘记录
    loadSurveys() {
      this.surveys = [
        {
          id: 1,
          taskName: '北部山地测绘',
          terrainName: '北部山地',
          droneName: '无人机 #5',
          startTime: '2024-01-15 08:00',
          endTime: '2024-01-15 10:30',
          accuracy: 3,
          status: 'completed',
          statusText: '已完成'
        },
        {
          id: 2,
          taskName: '西部高原测绘',
          terrainName: '西部高原',
          droneName: '无人机 #6',
          startTime: '2024-01-15 13:00',
          endTime: null,
          accuracy: null,
          status: 'in_progress',
          statusText: '进行中'
        }
      ];
    },
    // 搜索地形
    searchTerrains() {
      // 模拟搜索逻辑
      console.log('搜索条件:', this.searchForm);
      this.loadTerrains();
    },
    // 选择地形
    selectTerrain(terrain) {
      this.selectedTerrain = terrain;
      this.highlightOnMap(terrain);
    },
    // 编辑地形
    editTerrain(terrain) {
      this.isEdit = true;
      this.editId = terrain.id;
      this.formData = {
        name: terrain.name,
        area: terrain.area,
        terrainType: terrain.terrainType,
        minElevation: terrain.minElevation,
        maxElevation: terrain.maxElevation,
        riskLevel: terrain.riskLevel,
        description: ''
      };
      $('#editModal').modal('show');
    },
    // 删除地形
    deleteTerrain(id) {
      if (confirm('确定要删除这个地形吗？')) {
        // 模拟删除逻辑
        console.log('删除地形:', id);
        this.loadTerrains();
      }
    },
    // 保存地形
    saveTerrain() {
      // 模拟保存逻辑
      console.log('保存地形:', this.formData);
      $('#editModal').modal('hide');
      this.loadTerrains();
    },
    // 开始测绘
    startSurvey(terrainId) {
      console.log('开始测绘:', terrainId);
      alert('测绘任务已开始');
    },
    // 查看详情
    viewDetails(terrainId) {
      console.log('查看详情:', terrainId);
      // 跳转到详情页面
      window.location.href = `/terrain/detail/?id=${terrainId}`;
    },
    // 处理风险
    handleRisk(riskId) {
      console.log('处理风险:', riskId);
      alert('风险已处理');
    },
    // 查看测绘记录
    viewSurvey(surveyId) {
      console.log('查看测绘记录:', surveyId);
      alert('查看测绘记录详情');
    },
    // 分页
    changePage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
        this.loadTerrains();
      }
    },
    // 初始化地图
    initMap() {
      // 初始化 Leaflet 地图
      this.map = L.map('terrainMap').setView([30.05, 107.60], 7);
      
      // 添加底图
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(this.map);
      
      // 初始化图层
      this.layers.terrain = L.layerGroup().addTo(this.map);
      this.layers.risk = L.layerGroup().addTo(this.map);
      this.layers.task = L.layerGroup().addTo(this.map);
      
      // 添加地形边界
      this.addTerrainBoundaries();
    },
    // 添加地形边界
    addTerrainBoundaries() {
      // 模拟 GeoJSON 数据
      const terrainsGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { id: 1, name: '北部山地' },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [106.5, 29.6],
                [106.6, 29.6],
                [106.6, 29.55],
                [106.5, 29.55],
                [106.5, 29.6]
              ]]
            }
          },
          {
            type: 'Feature',
            properties: { id: 2, name: '南部山谷' },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [106.5, 29.55],
                [106.6, 29.55],
                [106.6, 29.5],
                [106.5, 29.5],
                [106.5, 29.55]
              ]]
            }
          }
        ]
      };
      
      // 添加到地图
      L.geoJSON(terrainsGeoJSON, {
        style: function(feature) {
          return { color: '#3b82f6', weight: 2, fillOpacity: 0.2 };
        },
        onEachFeature: (feature, layer) => {
          layer.bindPopup(feature.properties.name);
          layer.on('click', () => {
            const terrain = this.terrains.find(t => t.id === feature.properties.id);
            if (terrain) {
              this.selectTerrain(terrain);
            }
          });
        }
      }).addTo(this.layers.terrain);
    },
    // 在地图上高亮选中的地形
    highlightOnMap(terrain) {
      // 模拟高亮逻辑
      console.log('高亮地形:', terrain.name);
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
