// 地图数据管理器
class MapDataManager {
  constructor() {
    this.data = {
      terrainBoundaries: [],
      riskAreas: [],
      noFlyZones: [],
      forestAreas: [],
      farmAreas: [],
      existingPlots: []
    };
    this.loading = false;
    this.callbacks = [];
  }
  
  // 加载所有数据
  loadAllData() {
    if (this.loading) return;
    
    this.loading = true;
    
    // 并行加载所有数据
    Promise.all([
      this.loadTerrainBoundaries(),
      this.loadRiskAreas(),
      this.loadNoFlyZones(),
      this.loadForestAreas(),
      this.loadFarmAreas(),
      this.loadExistingPlots()
    ]).then(() => {
      this.loading = false;
      this.notifyCallbacks();
    }).catch((error) => {
      console.error('加载数据失败:', error);
      this.loading = false;
      this.notifyCallbacks();
    });
  }
  
  // 加载地形边界
  loadTerrainBoundaries() {
    return new Promise((resolve, reject) => {
      // 实际项目中应该从API获取
      if (window.terrainMockData && window.terrainMockData.mapData && window.terrainMockData.mapData.terrainBoundaries) {
        this.data.terrainBoundaries = window.terrainMockData.mapData.terrainBoundaries;
        resolve();
      } else {
        // 模拟API请求
        setTimeout(() => {
          this.data.terrainBoundaries = this.generateMockTerrainBoundaries();
          resolve();
        }, 500);
      }
    });
  }
  
  // 加载风险区域
  loadRiskAreas() {
    return new Promise((resolve, reject) => {
      if (window.terrainMockData && window.terrainMockData.dangerZones) {
        this.data.riskAreas = window.terrainMockData.dangerZones;
        resolve();
      } else {
        setTimeout(() => {
          this.data.riskAreas = this.generateMockRiskAreas();
          resolve();
        }, 500);
      }
    });
  }
  
  // 加载禁飞区
  loadNoFlyZones() {
    return new Promise((resolve, reject) => {
      // 模拟API请求
      setTimeout(() => {
        this.data.noFlyZones = this.generateMockNoFlyZones();
        resolve();
      }, 500);
    });
  }
  
  // 加载林区
  loadForestAreas() {
    return new Promise((resolve, reject) => {
      // 模拟API请求
      setTimeout(() => {
        this.data.forestAreas = this.generateMockForestAreas();
        resolve();
      }, 500);
    });
  }
  
  // 加载农田
  loadFarmAreas() {
    return new Promise((resolve, reject) => {
      // 模拟API请求
      setTimeout(() => {
        this.data.farmAreas = this.generateMockFarmAreas();
        resolve();
      }, 500);
    });
  }
  
  // 加载现有地块
  loadExistingPlots() {
    return new Promise((resolve, reject) => {
      // 模拟API请求
      setTimeout(() => {
        this.data.existingPlots = this.generateMockExistingPlots();
        resolve();
      }, 500);
    });
  }
  
  // 生成模拟地形边界
  generateMockTerrainBoundaries() {
    return [
      {
        id: 1,
        name: '北部山地',
        type: 'mountain',
        coordinates: [
          [30.598, 106.568],
          [30.602, 106.572],
          [30.605, 106.569],
          [30.601, 106.565]
        ]
      },
      {
        id: 2,
        name: '南部丘陵',
        type: 'hill',
        coordinates: [
          [30.588, 106.568],
          [30.592, 106.572],
          [30.595, 106.569],
          [30.591, 106.565]
        ]
      },
      {
        id: 3,
        name: '东部峡谷',
        type: 'valley',
        coordinates: [
          [30.598, 106.578],
          [30.602, 106.582],
          [30.605, 106.579],
          [30.601, 106.575]
        ]
      },
      {
        id: 4,
        name: '西部平原',
        type: 'plain',
        coordinates: [
          [30.598, 106.558],
          [30.602, 106.562],
          [30.605, 106.559],
          [30.601, 106.555]
        ]
      }
    ];
  }
  
  // 生成模拟风险区域
  generateMockRiskAreas() {
    return [
      {
        id: 1,
        name: '高风险区1',
        level: '高',
        coordinates: [
          [30.600, 106.570],
          [30.601, 106.571],
          [30.602, 106.570],
          [30.601, 106.569]
        ]
      },
      {
        id: 2,
        name: '高风险区2',
        level: '高',
        coordinates: [
          [30.590, 106.570],
          [30.591, 106.571],
          [30.592, 106.570],
          [30.591, 106.569]
        ]
      }
    ];
  }
  
  // 生成模拟禁飞区
  generateMockNoFlyZones() {
    return [
      {
        id: 1,
        name: '禁飞区1',
        reason: '军事区域',
        coordinates: [
          [30.595, 106.565],
          [30.597, 106.567],
          [30.598, 106.566],
          [30.596, 106.564]
        ]
      }
    ];
  }
  
  // 生成模拟林区
  generateMockForestAreas() {
    return [
      {
        id: 1,
        name: '松林',
        type: 'coniferous',
        coordinates: [
          [30.599, 106.569],
          [30.601, 106.571],
          [30.603, 106.570],
          [30.601, 106.568]
        ]
      },
      {
        id: 2,
        name: '阔叶林',
        type: 'broadleaf',
        coordinates: [
          [30.589, 106.569],
          [30.591, 106.571],
          [30.593, 106.570],
          [30.591, 106.568]
        ]
      }
    ];
  }
  
  // 生成模拟农田
  generateMockFarmAreas() {
    return [
      {
        id: 1,
        name: '稻田',
        crop: 'rice',
        coordinates: [
          [30.599, 106.561],
          [30.601, 106.563],
          [30.603, 106.562],
          [30.601, 106.560]
        ]
      },
      {
        id: 2,
        name: '菜地',
        crop: 'vegetable',
        coordinates: [
          [30.589, 106.561],
          [30.591, 106.563],
          [30.593, 106.562],
          [30.591, 106.560]
        ]
      }
    ];
  }
  
  // 生成模拟现有地块
  generateMockExistingPlots() {
    return [
      {
        id: 1,
        name: '试验地块1',
        type: 'forest',
        area: 1500,
        riskLevel: '低',
        coordinates: [
          [30.600, 106.572],
          [30.602, 106.574],
          [30.604, 106.573],
          [30.602, 106.571]
        ]
      },
      {
        id: 2,
        name: '试验地块2',
        type: 'farm',
        area: 1200,
        riskLevel: '中',
        coordinates: [
          [30.590, 106.572],
          [30.592, 106.574],
          [30.594, 106.573],
          [30.592, 106.571]
        ]
      }
    ];
  }
  
  // 获取地形边界
  getTerrainBoundaries() {
    return this.data.terrainBoundaries;
  }
  
  // 获取风险区域
  getRiskAreas() {
    return this.data.riskAreas;
  }
  
  // 获取禁飞区
  getNoFlyZones() {
    return this.data.noFlyZones;
  }
  
  // 获取林区
  getForestAreas() {
    return this.data.forestAreas;
  }
  
  // 获取农田
  getFarmAreas() {
    return this.data.farmAreas;
  }
  
  // 获取现有地块
  getExistingPlots() {
    return this.data.existingPlots;
  }
  
  // 注册数据加载完成回调
  onDataLoaded(callback) {
    this.callbacks.push(callback);
  }
  
  // 通知所有回调
  notifyCallbacks() {
    this.callbacks.forEach(callback => {
      callback(this.data);
    });
  }
  
  // 保存新地块
  savePlot(plotData) {
    return new Promise((resolve, reject) => {
      // 实际项目中应该发送到API
      console.log('保存地块数据:', plotData);
      
      // 模拟保存成功
      setTimeout(() => {
        // 添加到现有地块
        const newPlot = {
          id: this.data.existingPlots.length + 1,
          ...plotData
        };
        this.data.existingPlots.push(newPlot);
        resolve(newPlot);
      }, 1000);
    });
  }
  
  // 更新地块
  updatePlot(plotId, plotData) {
    return new Promise((resolve, reject) => {
      // 实际项目中应该发送到API
      console.log('更新地块数据:', plotId, plotData);
      
      // 模拟更新成功
      setTimeout(() => {
        const index = this.data.existingPlots.findIndex(p => p.id === plotId);
        if (index !== -1) {
          this.data.existingPlots[index] = {
            ...this.data.existingPlots[index],
            ...plotData
          };
          resolve(this.data.existingPlots[index]);
        } else {
          reject('地块不存在');
        }
      }, 1000);
    });
  }
  
  // 删除地块
  deletePlot(plotId) {
    return new Promise((resolve, reject) => {
      // 实际项目中应该发送到API
      console.log('删除地块:', plotId);
      
      // 模拟删除成功
      setTimeout(() => {
        const index = this.data.existingPlots.findIndex(p => p.id === plotId);
        if (index !== -1) {
          this.data.existingPlots.splice(index, 1);
          resolve();
        } else {
          reject('地块不存在');
        }
      }, 1000);
    });
  }
  
  // 搜索地块
  searchPlots(query) {
    return this.data.existingPlots.filter(plot => {
      return plot.name.toLowerCase().includes(query.toLowerCase()) ||
             plot.type.toLowerCase().includes(query.toLowerCase());
    });
  }
  
  // 根据类型筛选地块
  filterPlotsByType(type) {
    if (!type) return this.data.existingPlots;
    return this.data.existingPlots.filter(plot => plot.type === type);
  }
  
  // 根据风险等级筛选地块
  filterPlotsByRiskLevel(riskLevel) {
    if (!riskLevel) return this.data.existingPlots;
    return this.data.existingPlots.filter(plot => plot.riskLevel === riskLevel);
  }
}

// 全局变量
try {
  window.MapDataManager = MapDataManager;
} catch (e) {
  console.error('无法设置全局变量:', e);
}