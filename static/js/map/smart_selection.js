// 智能选区逻辑
class SmartSelection {
  constructor(map) {
    this.map = map;
    this.terrainFeatures = [];
    this.businessBoundaries = [];
    this.selectedFeatures = [];
  }
  
  // 加载地形特征数据
  loadTerrainFeatures(features) {
    this.terrainFeatures = features;
  }
  
  // 加载业务边界数据
  loadBusinessBoundaries(boundaries) {
    this.businessBoundaries = boundaries;
  }
  
  // 智能选区
  selectAt(latlng) {
    console.log('=== 智能选区命中检测开始 ===');
    console.log('点击坐标:', latlng);
    
    // 1. 优先从业务边界中进行命中检测
    const hitFeature = this.findHitFeature(latlng);
    
    console.log('命中检测结果:', hitFeature);
    
    if (hitFeature) {
      return hitFeature;
    }
    
    // 2. 如果没有命中，返回null，不生成默认四边形
    return null;
  }
  
  // 查找点击位置命中的特征
  findHitFeature(latlng) {
    console.log('=== 开始遍历业务边界 ===');
    console.log('业务边界数量:', this.businessBoundaries.length);
    
    // 优先检查业务边界
    for (let i = 0; i < this.businessBoundaries.length; i++) {
      const feature = this.businessBoundaries[i];
      console.log('检查业务边界:', i, feature.name, feature.type);
      
      if (this.isPointInFeature(latlng, feature)) {
        console.log('命中业务边界:', feature.name, feature.type);
        return feature;
      }
    }
    
    console.log('=== 开始遍历地形特征 ===');
    console.log('地形特征数量:', this.terrainFeatures.length);
    
    // 再检查地形特征
    for (let i = 0; i < this.terrainFeatures.length; i++) {
      const feature = this.terrainFeatures[i];
      console.log('检查地形特征:', i, feature.name, feature.type);
      
      if (this.isPointInFeature(latlng, feature)) {
        console.log('命中地形特征:', feature.name, feature.type);
        return feature;
      }
    }
    
    console.log('=== 未命中任何特征 ===');
    return null;
  }
  
  // 查找附近的地形特征
  findNearbyFeatures(latlng, radius = 50) { // 50米半径
    const nearby = [];
    
    // 查找地形特征
    this.terrainFeatures.forEach(feature => {
      if (this.isPointNearFeature(latlng, feature, radius)) {
        nearby.push(feature);
      }
    });
    
    // 查找业务边界
    this.businessBoundaries.forEach(boundary => {
      if (this.isPointNearFeature(latlng, boundary, radius)) {
        nearby.push(boundary);
      }
    });
    
    return nearby;
  }
  
  // 检查点是否靠近特征
  isPointNearFeature(latlng, feature, radius) {
    if (!feature.coordinates) return false;
    
    // 计算点到多边形的距离
    const polygon = L.polygon(feature.coordinates);
    const distance = this.map.distance(latlng, polygon.getBounds().getCenter());
    
    return distance <= radius;
  }
  
  // 基于地形特征识别地块
  identifyFeatures(nearbyFeatures, latlng) {
    const identified = [];
    
    nearbyFeatures.forEach(feature => {
      // 检查点是否在特征内部
      if (this.isPointInFeature(latlng, feature)) {
        identified.push(feature);
      }
    });
    
    // 如果没有找到，尝试基于地形轮廓创建选区
    if (identified.length === 0) {
      const createdFeature = this.createFeatureFromTerrain(latlng);
      if (createdFeature) {
        identified.push(createdFeature);
      }
    }
    
    return identified;
  }
  
  // 检查点是否在特征内部
  isPointInFeature(latlng, feature) {
    if (!feature.coordinates) return false;
    
    const polygon = L.polygon(feature.coordinates);
    return polygon.contains(latlng);
  }
  
  // 基于地形创建特征
  createFeatureFromTerrain(latlng) {
    // 1. 分析地形特征
    const terrainType = this.analyzeTerrainType(latlng);
    
    // 2. 基于地形类型创建合适的选区
    switch (terrainType) {
      case 'forest':
        return this.createForestFeature(latlng);
      case 'farm':
        return this.createFarmFeature(latlng);
      case 'mountain':
        return this.createMountainFeature(latlng);
      default:
        return this.createDefaultFeature(latlng);
    }
  }
  
  // 分析地形类型
  analyzeTerrainType(latlng) {
    // 这里可以集成地形分析API或使用预设数据
    // 模拟地形类型分析
    const random = Math.random();
    if (random < 0.4) return 'forest';
    if (random < 0.7) return 'farm';
    if (random < 0.9) return 'mountain';
    return 'default';
  }
  
  // 创建林区特征
  createForestFeature(latlng) {
    const buffer = 0.0015; // 约150米
    return {
      type: 'forest',
      coordinates: [
        [latlng.lat - buffer, latlng.lng - buffer * 1.5],
        [latlng.lat - buffer, latlng.lng + buffer * 1.5],
        [latlng.lat + buffer, latlng.lng + buffer * 1.5],
        [latlng.lat + buffer, latlng.lng - buffer * 1.5]
      ]
    };
  }
  
  // 创建农田特征
  createFarmFeature(latlng) {
    const buffer = 0.002; // 约200米
    return {
      type: 'farm',
      coordinates: [
        [latlng.lat - buffer, latlng.lng - buffer],
        [latlng.lat - buffer, latlng.lng + buffer],
        [latlng.lat + buffer, latlng.lng + buffer],
        [latlng.lat + buffer, latlng.lng - buffer]
      ]
    };
  }
  
  // 创建山地特征
  createMountainFeature(latlng) {
    const buffer = 0.003; // 约300米
    return {
      type: 'mountain',
      coordinates: [
        [latlng.lat - buffer * 0.8, latlng.lng - buffer],
        [latlng.lat - buffer, latlng.lng + buffer],
        [latlng.lat + buffer * 1.2, latlng.lng + buffer * 0.8],
        [latlng.lat + buffer, latlng.lng - buffer * 1.2]
      ]
    };
  }
  
  // 创建默认特征
  createDefaultFeature(latlng) {
    const buffer = 0.001; // 约100米
    return {
      type: 'default',
      coordinates: [
        [latlng.lat - buffer, latlng.lng - buffer],
        [latlng.lat - buffer, latlng.lng + buffer],
        [latlng.lat + buffer, latlng.lng + buffer],
        [latlng.lat + buffer, latlng.lng - buffer]
      ]
    };
  }
  
  // 扩展选区
  extendSelection(features) {
    const extended = [...features];
    
    // 基于地形连续性扩展
    features.forEach(feature => {
      const adjacentFeatures = this.findAdjacentFeatures(feature);
      adjacentFeatures.forEach(adjacent => {
        if (!extended.includes(adjacent)) {
          extended.push(adjacent);
        }
      });
    });
    
    return extended;
  }
  
  // 查找相邻特征
  findAdjacentFeatures(feature) {
    const adjacent = [];
    
    this.terrainFeatures.forEach(otherFeature => {
      if (feature !== otherFeature && this.areFeaturesAdjacent(feature, otherFeature)) {
        adjacent.push(otherFeature);
      }
    });
    
    this.businessBoundaries.forEach(boundary => {
      if (this.areFeaturesAdjacent(feature, boundary)) {
        adjacent.push(boundary);
      }
    });
    
    return adjacent;
  }
  
  // 检查特征是否相邻
  areFeaturesAdjacent(feature1, feature2) {
    if (!feature1.coordinates || !feature2.coordinates) return false;
    
    const polygon1 = L.polygon(feature1.coordinates);
    const polygon2 = L.polygon(feature2.coordinates);
    
    // 检查边界是否相交
    return polygon1.getBounds().intersects(polygon2.getBounds());
  }
  
  // 合并特征
  mergeFeatures(features) {
    if (features.length === 0) return null;
    if (features.length === 1) return features[0];
    
    // 收集所有边界点
    let allPoints = [];
    
    features.forEach(feature => {
      if (feature.coordinates) {
        feature.coordinates.forEach(ring => {
          ring.forEach(point => {
            allPoints.push(point);
          });
        });
      }
    });
    
    // 去重
    const uniquePoints = this.removeDuplicatePoints(allPoints);
    
    // 排序点（凸包算法）
    const sortedPoints = this.convexHull(uniquePoints);
    
    return {
      type: 'merged',
      coordinates: [sortedPoints]
    };
  }
  
  // 移除重复点
  removeDuplicatePoints(points) {
    const unique = [];
    const seen = new Set();
    
    points.forEach(point => {
      const key = `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(point);
      }
    });
    
    return unique;
  }
  
  // 凸包算法
  convexHull(points) {
    // 按x坐标排序
    points.sort((a, b) => a[1] - b[1]);
    
    // 构建上凸壳
    const upper = [];
    for (let i = 0; i < points.length; i++) {
      while (upper.length >= 2 && this.cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
        upper.pop();
      }
      upper.push(points[i]);
    }
    
    // 构建下凸壳
    const lower = [];
    for (let i = points.length - 1; i >= 0; i--) {
      while (lower.length >= 2 && this.cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
        lower.pop();
      }
      lower.push(points[i]);
    }
    
    // 合并并移除重复点
    lower.pop();
    upper.pop();
    return upper.concat(lower);
  }
  
  // 计算叉积
  cross(o, a, b) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  }
  
  // 追加选区
  appendSelection(existingFeature, newFeature) {
    const combined = this.mergeFeatures([existingFeature, newFeature]);
    return combined;
  }
  
  // 更新合并后的边界
  updateMergedBoundary(mergedFeature) {
    // 1. 平滑边界
    const smoothed = this.smoothBoundary(mergedFeature.coordinates[0]);
    
    // 2. 确保边界闭合
    const closed = this.ensureBoundaryClosed(smoothed);
    
    // 3. 优化边界点
    const optimized = this.optimizeBoundaryPoints(closed);
    
    return {
      ...mergedFeature,
      coordinates: [optimized]
    };
  }
  
  // 平滑边界
  smoothBoundary(points, iterations = 1) {
    for (let i = 0; i < iterations; i++) {
      const newPoints = [];
      for (let j = 0; j < points.length; j++) {
        const prev = points[(j - 1 + points.length) % points.length];
        const curr = points[j];
        const next = points[(j + 1) % points.length];
        
        const newPoint = [
          (prev[0] + curr[0] + next[0]) / 3,
          (prev[1] + curr[1] + next[1]) / 3
        ];
        newPoints.push(newPoint);
      }
      points = newPoints;
    }
    return points;
  }
  
  // 确保边界闭合
  ensureBoundaryClosed(points) {
    if (points.length === 0) return [];
    
    const first = points[0];
    const last = points[points.length - 1];
    
    if (first[0] !== last[0] || first[1] !== last[1]) {
      points.push(first);
    }
    
    return points;
  }
  
  // 优化边界点
  optimizeBoundaryPoints(points, tolerance = 0.0001) {
    if (points.length <= 2) return points;
    
    const optimized = [points[0]];
    
    for (let i = 1; i < points.length - 1; i++) {
      const prev = optimized[optimized.length - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      // 检查三点是否近似共线
      if (this.distanceFromLine(prev, next, curr) > tolerance) {
        optimized.push(curr);
      }
    }
    
    optimized.push(points[points.length - 1]);
    return optimized;
  }
  
  // 计算点到直线的距离
  distanceFromLine(p1, p2, p) {
    const numerator = Math.abs((p2[1] - p1[1]) * p[0] - (p2[0] - p1[0]) * p[1] + p2[0] * p1[1] - p2[1] * p1[0]);
    const denominator = Math.sqrt(Math.pow(p2[1] - p1[1], 2) + Math.pow(p2[0] - p1[0], 2));
    return numerator / denominator;
  }
}

// 全局变量
try {
  window.SmartSelection = SmartSelection;
} catch (e) {
  console.error('无法设置全局变量:', e);
}