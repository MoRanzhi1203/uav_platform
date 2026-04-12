// 农田管理假数据
const agriMockData = {
  // 统计数据
  stats: {
    totalFarms: 256,
    pestAlerts: 7,
    sprayTasks: 12,
    cropHealth: 78
  },
  // 农田列表
  farms: [
    {
      id: 1,
      name: "东部农田",
      area: 850,
      cropType: "水稻",
      status: "正常",
      health: 85,
      lastSpray: "2026-04-10 10:30",
      yield: "预期良好"
    },
    {
      id: 2,
      name: "西部农田",
      area: 620,
      cropType: "小麦",
      status: "预警",
      health: 65,
      lastSpray: "2026-04-09 14:15",
      yield: "预期一般"
    },
    {
      id: 3,
      name: "南部农田",
      area: 980,
      cropType: "玉米",
      status: "正常",
      health: 90,
      lastSpray: "2026-04-11 08:45",
      yield: "预期良好"
    },
    {
      id: 4,
      name: "北部农田",
      area: 750,
      cropType: "水稻",
      status: "正常",
      health: 82,
      lastSpray: "2026-04-10 16:20",
      yield: "预期良好"
    },
    {
      id: 5,
      name: "中部农田",
      area: 1100,
      cropType: "玉米",
      status: "预警",
      health: 70,
      lastSpray: "2026-04-08 11:30",
      yield: "预期一般"
    }
  ],
  // 病虫害预警
  pestAlerts: [
    {
      id: 1,
      farmId: 2,
      location: "西部农田北部",
      latitude: 29.565,
      longitude: 106.540,
      type: "蚜虫",
      level: "中等",
      time: "2026-04-12 07:30",
      status: "处理中"
    },
    {
      id: 2,
      farmId: 2,
      location: "西部农田中部",
      latitude: 29.560,
      longitude: 106.540,
      type: "蚜虫",
      level: "低",
      time: "2026-04-12 08:15",
      status: "已处理"
    },
    {
      id: 3,
      farmId: 5,
      location: "中部农田南部",
      latitude: 29.555,
      longitude: 106.550,
      type: "玉米螟",
      level: "高",
      time: "2026-04-12 09:20",
      status: "待处理"
    },
    {
      id: 4,
      farmId: 5,
      location: "中部农田西部",
      latitude: 29.555,
      longitude: 106.545,
      type: "玉米螟",
      level: "中等",
      time: "2026-04-12 10:10",
      status: "待处理"
    },
    {
      id: 5,
      farmId: 5,
      location: "中部农田东部",
      latitude: 29.555,
      longitude: 106.555,
      type: "玉米螟",
      level: "低",
      time: "2026-04-12 10:30",
      status: "待处理"
    },
    {
      id: 6,
      farmId: 2,
      location: "西部农田南部",
      latitude: 29.555,
      longitude: 106.540,
      type: "蚜虫",
      level: "低",
      time: "2026-04-12 11:00",
      status: "待处理"
    },
    {
      id: 7,
      farmId: 2,
      location: "西部农田西部",
      latitude: 29.560,
      longitude: 106.535,
      type: "蚜虫",
      level: "低",
      time: "2026-04-12 11:30",
      status: "待处理"
    }
  ],
  // 植保任务
  sprayTasks: [
    {
      id: 1,
      farmId: 1,
      taskName: "东部农田病虫害防治",
      droneId: "DR-001",
      operator: "张三",
      time: "2026-04-10 10:30",
      duration: "1小时",
      status: "完成"
    },
    {
      id: 2,
      farmId: 2,
      taskName: "西部农田蚜虫防治",
      droneId: "DR-002",
      operator: "李四",
      time: "2026-04-09 14:15",
      duration: "1.5小时",
      status: "完成"
    },
    {
      id: 3,
      farmId: 3,
      taskName: "南部农田常规植保",
      droneId: "DR-003",
      operator: "王五",
      time: "2026-04-11 08:45",
      duration: "1小时",
      status: "完成"
    },
    {
      id: 4,
      farmId: 4,
      taskName: "北部农田病虫害防治",
      droneId: "DR-001",
      operator: "赵六",
      time: "2026-04-10 16:20",
      duration: "1.5小时",
      status: "完成"
    },
    {
      id: 5,
      farmId: 5,
      taskName: "中部农田玉米螟防治",
      droneId: "DR-002",
      operator: "钱七",
      time: "2026-04-08 11:30",
      duration: "2小时",
      status: "完成"
    },
    {
      id: 6,
      farmId: 2,
      taskName: "西部农田蚜虫防治",
      droneId: "DR-003",
      operator: "张三",
      time: "2026-04-12 14:00",
      duration: "1.5小时",
      status: "待执行"
    },
    {
      id: 7,
      farmId: 5,
      taskName: "中部农田玉米螟防治",
      droneId: "DR-001",
      operator: "李四",
      time: "2026-04-12 15:30",
      duration: "2小时",
      status: "待执行"
    },
    {
      id: 8,
      farmId: 1,
      taskName: "东部农田常规植保",
      droneId: "DR-002",
      operator: "王五",
      time: "2026-04-13 09:00",
      duration: "1小时",
      status: "待执行"
    },
    {
      id: 9,
      farmId: 3,
      taskName: "南部农田常规植保",
      droneId: "DR-003",
      operator: "赵六",
      time: "2026-04-13 10:30",
      duration: "1小时",
      status: "待执行"
    },
    {
      id: 10,
      farmId: 4,
      taskName: "北部农田常规植保",
      droneId: "DR-001",
      operator: "钱七",
      time: "2026-04-13 14:00",
      duration: "1.5小时",
      status: "待执行"
    },
    {
      id: 11,
      farmId: 2,
      taskName: "西部农田蚜虫防治",
      droneId: "DR-002",
      operator: "张三",
      time: "2026-04-14 09:00",
      duration: "1.5小时",
      status: "待执行"
    },
    {
      id: 12,
      farmId: 5,
      taskName: "中部农田玉米螟防治",
      droneId: "DR-003",
      operator: "李四",
      time: "2026-04-14 10:30",
      duration: "2小时",
      status: "待执行"
    }
  ],
  // 地图数据
  mapData: {
    // 农田边界
    farmBoundaries: [
      {
        id: 1,
        name: "东部农田",
        coordinates: [
          [106.560, 29.565],
          [106.570, 29.565],
          [106.570, 29.555],
          [106.560, 29.555],
          [106.560, 29.565]
        ]
      },
      {
        id: 2,
        name: "西部农田",
        coordinates: [
          [106.530, 29.565],
          [106.540, 29.565],
          [106.540, 29.555],
          [106.530, 29.555],
          [106.530, 29.565]
        ]
      },
      {
        id: 3,
        name: "南部农田",
        coordinates: [
          [106.540, 29.550],
          [106.560, 29.550],
          [106.560, 29.540],
          [106.540, 29.540],
          [106.540, 29.550]
        ]
      },
      {
        id: 4,
        name: "北部农田",
        coordinates: [
          [106.540, 29.570],
          [106.560, 29.570],
          [106.560, 29.560],
          [106.540, 29.560],
          [106.540, 29.570]
        ]
      },
      {
        id: 5,
        name: "中部农田",
        coordinates: [
          [106.540, 29.565],
          [106.560, 29.565],
          [106.560, 29.555],
          [106.540, 29.555],
          [106.540, 29.565]
        ]
      }
    ],
    // 病虫害点
    pestPoints: [
      {
        id: 1,
        farmId: 2,
        name: "蚜虫1",
        latitude: 29.565,
        longitude: 106.540,
        type: "蚜虫",
        level: "中等"
      },
      {
        id: 2,
        farmId: 2,
        name: "蚜虫2",
        latitude: 29.560,
        longitude: 106.540,
        type: "蚜虫",
        level: "低"
      },
      {
        id: 3,
        farmId: 5,
        name: "玉米螟1",
        latitude: 29.555,
        longitude: 106.550,
        type: "玉米螟",
        level: "高"
      },
      {
        id: 4,
        farmId: 5,
        name: "玉米螟2",
        latitude: 29.555,
        longitude: 106.545,
        type: "玉米螟",
        level: "中等"
      },
      {
        id: 5,
        farmId: 5,
        name: "玉米螟3",
        latitude: 29.555,
        longitude: 106.555,
        type: "玉米螟",
        level: "低"
      },
      {
        id: 6,
        farmId: 2,
        name: "蚜虫3",
        latitude: 29.555,
        longitude: 106.540,
        type: "蚜虫",
        level: "低"
      },
      {
        id: 7,
        farmId: 2,
        name: "蚜虫4",
        latitude: 29.560,
        longitude: 106.535,
        type: "蚜虫",
        level: "低"
      }
    ],
    // 植保轨迹
    sprayRoutes: [
      {
        id: 1,
        farmId: 1,
        name: "东部农田植保",
        coordinates: [
          [106.560, 29.565],
          [106.565, 29.563],
          [106.570, 29.560],
          [106.568, 29.558],
          [106.565, 29.555],
          [106.560, 29.557],
          [106.562, 29.560],
          [106.560, 29.565]
        ]
      },
      {
        id: 2,
        farmId: 2,
        name: "西部农田植保",
        coordinates: [
          [106.530, 29.565],
          [106.535, 29.563],
          [106.540, 29.560],
          [106.538, 29.558],
          [106.535, 29.555],
          [106.530, 29.557],
          [106.532, 29.560],
          [106.530, 29.565]
        ]
      }
    ]
  }
};

// 导出数据
if (typeof module !== 'undefined' && module.exports) {
  module.exports = agriMockData;
} else if (typeof window !== 'undefined') {
  window.agriMockData = agriMockData;
}