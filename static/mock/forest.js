// 林区管理假数据
const forestMockData = {
  // 统计数据
  stats: {
    totalForests: 128,
    fireAlerts: 3,
    patrolTasks: 5,
    healthStatus: 85
  },
  // 林区列表
  forests: [
    {
      id: 1,
      name: "北部林区",
      area: 1250,
      region: "北部区域",
      status: "正常",
      health: 92,
      lastPatrol: "2026-04-10 14:30",
      riskLevel: "低"
    },
    {
      id: 2,
      name: "南部林区",
      area: 2100,
      region: "南部区域",
      status: "正常",
      health: 88,
      lastPatrol: "2026-04-11 09:15",
      riskLevel: "中"
    },
    {
      id: 3,
      name: "东部林区",
      area: 1850,
      region: "东部区域",
      status: "预警",
      health: 75,
      lastPatrol: "2026-04-09 16:45",
      riskLevel: "高"
    },
    {
      id: 4,
      name: "西部林区",
      area: 1520,
      region: "西部区域",
      status: "正常",
      health: 90,
      lastPatrol: "2026-04-10 11:20",
      riskLevel: "低"
    },
    {
      id: 5,
      name: "中部林区",
      area: 2300,
      region: "中部区域",
      status: "预警",
      health: 80,
      lastPatrol: "2026-04-11 10:30",
      riskLevel: "中"
    }
  ],
  // 火点预警
  fireAlerts: [
    {
      id: 1,
      location: "北部林区-12号区域",
      time: "2026-04-12 08:30",
      level: "高",
      status: "处理中"
    },
    {
      id: 2,
      location: "东部林区-8号区域",
      time: "2026-04-12 09:15",
      level: "中等",
      status: "待处理"
    },
    {
      id: 3,
      location: "南部林区-5号区域",
      time: "2026-04-12 10:20",
      level: "低",
      status: "已处理"
    }
  ],
  // 巡林记录
  patrolRecords: [
    {
      id: 1,
      forestId: 1,
      time: "2026-04-12 08:00",
      status: "进行中"
    },
    {
      id: 2,
      forestId: 2,
      time: "2026-04-12 09:30",
      status: "完成"
    },
    {
      id: 3,
      forestId: 3,
      time: "2026-04-12 10:00",
      status: "完成"
    },
    {
      id: 4,
      forestId: 4,
      time: "2026-04-12 11:00",
      status: "完成"
    },
    {
      id: 5,
      forestId: 5,
      time: "2026-04-12 12:00",
      status: "进行中"
    }
  ],
  // 地图数据
  mapData: {
    // 林区边界
    forestBoundaries: [
      {
        id: 1,
        coordinates: [
          [106.5, 29.5],
          [106.6, 29.5],
          [106.6, 29.6],
          [106.5, 29.6],
          [106.5, 29.5]
        ]
      },
      {
        id: 2,
        coordinates: [
          [106.6, 29.5],
          [106.7, 29.5],
          [106.7, 29.6],
          [106.6, 29.6],
          [106.6, 29.5]
        ]
      },
      {
        id: 3,
        coordinates: [
          [106.5, 29.6],
          [106.6, 29.6],
          [106.6, 29.7],
          [106.5, 29.7],
          [106.5, 29.6]
        ]
      },
      {
        id: 4,
        coordinates: [
          [106.6, 29.6],
          [106.7, 29.6],
          [106.7, 29.7],
          [106.6, 29.7],
          [106.6, 29.6]
        ]
      },
      {
        id: 5,
        coordinates: [
          [106.55, 29.55],
          [106.65, 29.55],
          [106.65, 29.65],
          [106.55, 29.65],
          [106.55, 29.55]
        ]
      }
    ],
    // 巡林路线
    patrolRoutes: [
      {
        id: 1,
        forestId: 1,
        coordinates: [
          [106.5, 29.5],
          [106.55, 29.55],
          [106.6, 29.5]
        ]
      },
      {
        id: 2,
        forestId: 2,
        coordinates: [
          [106.6, 29.5],
          [106.65, 29.55],
          [106.7, 29.5]
        ]
      },
      {
        id: 3,
        forestId: 3,
        coordinates: [
          [106.5, 29.6],
          [106.55, 29.65],
          [106.6, 29.6]
        ]
      },
      {
        id: 4,
        forestId: 4,
        coordinates: [
          [106.6, 29.6],
          [106.65, 29.65],
          [106.7, 29.6]
        ]
      },
      {
        id: 5,
        forestId: 5,
        coordinates: [
          [106.55, 29.55],
          [106.6, 29.6],
          [106.65, 29.55]
        ]
      }
    ],
    // 火点位置
    fireLocations: [
      {
        id: 1,
        coordinates: [106.52, 29.52]
      },
      {
        id: 2,
        coordinates: [106.58, 29.62]
      },
      {
        id: 3,
        coordinates: [106.62, 29.58]
      }
    ]
  }
};

// 将数据暴露到全局
if (typeof window !== 'undefined') {
  window.forestMockData = forestMockData;
}
