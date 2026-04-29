// 地形管理假数据
const terrainMockData = {
  // 统计数据
  stats: {
    totalTerrains: 89,
    dangerZones: 12,
    surveyTasks: 8,
    dataAccuracy: 92
  },
  // 地形区域列表
  terrains: [
    {
      id: 1,
      name: "北部山地",
      area: 1500,
      type: "山地",
      riskLevel: "低",
      elevation: "500-800米",
      lastSurvey: "2026-04-10 10:30",
      accuracy: 95
    },
    {
      id: 2,
      name: "南部丘陵",
      area: 1200,
      type: "丘陵",
      riskLevel: "中",
      elevation: "300-500米",
      lastSurvey: "2026-04-09 14:15",
      accuracy: 92
    },
    {
      id: 3,
      name: "东部峡谷",
      area: 800,
      type: "峡谷",
      riskLevel: "高",
      elevation: "200-600米",
      lastSurvey: "2026-04-11 08:45",
      accuracy: 90
    },
    {
      id: 4,
      name: "西部平原",
      area: 2000,
      type: "平原",
      riskLevel: "低",
      elevation: "100-200米",
      lastSurvey: "2026-04-10 16:20",
      accuracy: 98
    },
    {
      id: 5,
      name: "中部盆地",
      area: 1800,
      type: "盆地",
      riskLevel: "中",
      elevation: "200-300米",
      lastSurvey: "2026-04-08 11:30",
      accuracy: 94
    }
  ],
  // 风险区域
  dangerZones: [
    {
      id: 1,
      terrainId: 3,
      name: "东部峡谷危险区1",
      location: "东部峡谷北部",
      latitude: 29.570,
      longitude: 106.565,
      type: "滑坡风险",
      level: "高",
      time: "2026-04-12 07:30",
      status: "监控中"
    },
    {
      id: 2,
      terrainId: 3,
      name: "东部峡谷危险区2",
      location: "东部峡谷中部",
      latitude: 29.565,
      longitude: 106.565,
      type: "滑坡风险",
      level: "中",
      time: "2026-04-12 08:15",
      status: "监控中"
    },
    {
      id: 3,
      terrainId: 3,
      name: "东部峡谷危险区3",
      location: "东部峡谷南部",
      latitude: 29.560,
      longitude: 106.565,
      type: "滑坡风险",
      level: "低",
      time: "2026-04-12 09:20",
      status: "监控中"
    },
    {
      id: 4,
      terrainId: 2,
      name: "南部丘陵危险区1",
      location: "南部丘陵西部",
      latitude: 29.550,
      longitude: 106.545,
      type: "泥石流风险",
      level: "中",
      time: "2026-04-12 10:10",
      status: "监控中"
    },
    {
      id: 5,
      terrainId: 2,
      name: "南部丘陵危险区2",
      location: "南部丘陵东部",
      latitude: 29.550,
      longitude: 106.555,
      type: "泥石流风险",
      level: "低",
      time: "2026-04-12 10:30",
      status: "监控中"
    },
    {
      id: 6,
      terrainId: 5,
      name: "中部盆地危险区1",
      location: "中部盆地北部",
      latitude: 29.560,
      longitude: 106.550,
      type: "洪水风险",
      level: "中",
      time: "2026-04-12 11:00",
      status: "监控中"
    },
    {
      id: 7,
      terrainId: 5,
      name: "中部盆地危险区2",
      location: "中部盆地南部",
      latitude: 29.550,
      longitude: 106.550,
      type: "洪水风险",
      level: "低",
      time: "2026-04-12 11:30",
      status: "监控中"
    },
    {
      id: 8,
      terrainId: 1,
      name: "北部山地危险区1",
      location: "北部山地西部",
      latitude: 29.575,
      longitude: 106.545,
      type: "滑坡风险",
      level: "低",
      time: "2026-04-12 12:00",
      status: "监控中"
    },
    {
      id: 9,
      terrainId: 1,
      name: "北部山地危险区2",
      location: "北部山地东部",
      latitude: 29.575,
      longitude: 106.555,
      type: "滑坡风险",
      level: "低",
      time: "2026-04-12 12:30",
      status: "监控中"
    },
    {
      id: 10,
      terrainId: 3,
      name: "东部峡谷危险区4",
      location: "东部峡谷西部",
      latitude: 29.565,
      longitude: 106.560,
      type: "滑坡风险",
      level: "中",
      time: "2026-04-12 13:00",
      status: "监控中"
    },
    {
      id: 11,
      terrainId: 3,
      name: "东部峡谷危险区5",
      location: "东部峡谷东部",
      latitude: 29.565,
      longitude: 106.570,
      type: "滑坡风险",
      level: "中",
      time: "2026-04-12 13:30",
      status: "监控中"
    },
    {
      id: 12,
      terrainId: 2,
      name: "南部丘陵危险区3",
      location: "南部丘陵中部",
      latitude: 29.550,
      longitude: 106.550,
      type: "泥石流风险",
      level: "低",
      time: "2026-04-12 14:00",
      status: "监控中"
    }
  ],
  // 测绘记录
  surveyRecords: [
    {
      id: 1,
      terrainId: 1,
      surveyName: "北部山地测绘",
      droneId: "DR-001",
      operator: "张三",
      time: "2026-04-10 10:30",
      duration: "2小时",
      status: "完成",
      accuracy: 95
    },
    {
      id: 2,
      terrainId: 2,
      surveyName: "南部丘陵测绘",
      droneId: "DR-002",
      operator: "李四",
      time: "2026-04-09 14:15",
      duration: "1.5小时",
      status: "完成",
      accuracy: 92
    },
    {
      id: 3,
      terrainId: 3,
      surveyName: "东部峡谷测绘",
      droneId: "DR-003",
      operator: "王五",
      time: "2026-04-11 08:45",
      duration: "3小时",
      status: "完成",
      accuracy: 90
    },
    {
      id: 4,
      terrainId: 4,
      surveyName: "西部平原测绘",
      droneId: "DR-001",
      operator: "赵六",
      time: "2026-04-10 16:20",
      duration: "1.5小时",
      status: "完成",
      accuracy: 98
    },
    {
      id: 5,
      terrainId: 5,
      surveyName: "中部盆地测绘",
      droneId: "DR-002",
      operator: "钱七",
      time: "2026-04-08 11:30",
      duration: "2小时",
      status: "完成",
      accuracy: 94
    },
    {
      id: 6,
      terrainId: 3,
      surveyName: "东部峡谷详细测绘",
      droneId: "DR-003",
      operator: "张三",
      time: "2026-04-12 14:00",
      duration: "4小时",
      status: "待执行",
      accuracy: 0
    },
    {
      id: 7,
      terrainId: 2,
      surveyName: "南部丘陵详细测绘",
      droneId: "DR-001",
      operator: "李四",
      time: "2026-04-13 09:00",
      duration: "3小时",
      status: "待执行",
      accuracy: 0
    },
    {
      id: 8,
      terrainId: 5,
      surveyName: "中部盆地详细测绘",
      droneId: "DR-002",
      operator: "王五",
      time: "2026-04-13 14:00",
      duration: "2.5小时",
      status: "待执行",
      accuracy: 0
    }
  ],
  // 地图数据
  mapData: {
    // 地形边界
    terrainBoundaries: [
      {
        id: 1,
        name: "北部山地",
        coordinates: [
          [106.540, 29.580],
          [106.560, 29.580],
          [106.560, 29.570],
          [106.540, 29.570],
          [106.540, 29.580]
        ]
      },
      {
        id: 2,
        name: "南部丘陵",
        coordinates: [
          [106.540, 29.550],
          [106.560, 29.550],
          [106.560, 29.540],
          [106.540, 29.540],
          [106.540, 29.550]
        ]
      },
      {
        id: 3,
        name: "东部峡谷",
        coordinates: [
          [106.560, 29.570],
          [106.570, 29.570],
          [106.570, 29.540],
          [106.560, 29.540],
          [106.560, 29.570]
        ]
      },
      {
        id: 4,
        name: "西部平原",
        coordinates: [
          [106.530, 29.570],
          [106.540, 29.570],
          [106.540, 29.540],
          [106.530, 29.540],
          [106.530, 29.570]
        ]
      },
      {
        id: 5,
        name: "中部盆地",
        coordinates: [
          [106.540, 29.570],
          [106.560, 29.570],
          [106.560, 29.540],
          [106.540, 29.540],
          [106.540, 29.570]
        ]
      }
    ],
    // 风险区域
    dangerAreas: [
      {
        id: 1,
        terrainId: 3,
        name: "东部峡谷危险区1",
        coordinates: [
          [106.565, 29.570],
          [106.570, 29.570],
          [106.570, 29.565],
          [106.565, 29.565],
          [106.565, 29.570]
        ],
        level: "高"
      },
      {
        id: 2,
        terrainId: 3,
        name: "东部峡谷危险区2",
        coordinates: [
          [106.565, 29.565],
          [106.570, 29.565],
          [106.570, 29.560],
          [106.565, 29.560],
          [106.565, 29.565]
        ],
        level: "中"
      },
      {
        id: 3,
        terrainId: 3,
        name: "东部峡谷危险区3",
        coordinates: [
          [106.565, 29.560],
          [106.570, 29.560],
          [106.570, 29.555],
          [106.565, 29.555],
          [106.565, 29.560]
        ],
        level: "低"
      },
      {
        id: 4,
        terrainId: 2,
        name: "南部丘陵危险区1",
        coordinates: [
          [106.540, 29.550],
          [106.545, 29.550],
          [106.545, 29.545],
          [106.540, 29.545],
          [106.540, 29.550]
        ],
        level: "中"
      },
      {
        id: 5,
        terrainId: 2,
        name: "南部丘陵危险区2",
        coordinates: [
          [106.555, 29.550],
          [106.560, 29.550],
          [106.560, 29.545],
          [106.555, 29.545],
          [106.555, 29.550]
        ],
        level: "低"
      }
    ],
    // 测绘轨迹
    surveyRoutes: [
      {
        id: 1,
        terrainId: 1,
        name: "北部山地测绘",
        coordinates: [
          [106.540, 29.580],
          [106.545, 29.578],
          [106.550, 29.575],
          [106.555, 29.573],
          [106.560, 29.570],
          [106.555, 29.572],
          [106.550, 29.575],
          [106.545, 29.578],
          [106.540, 29.580]
        ]
      },
      {
        id: 2,
        terrainId: 2,
        name: "南部丘陵测绘",
        coordinates: [
          [106.540, 29.550],
          [106.545, 29.548],
          [106.550, 29.545],
          [106.555, 29.543],
          [106.560, 29.540],
          [106.555, 29.542],
          [106.550, 29.545],
          [106.545, 29.548],
          [106.540, 29.550]
        ]
      }
    ]
  }
};

// 导出数据
if (typeof module !== 'undefined' && module.exports) {
  module.exports = terrainMockData;
} else if (typeof window !== 'undefined') {
  window.terrainMockData = terrainMockData;
}