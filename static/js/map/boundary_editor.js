// 边界编辑器类
class BoundaryEditor {
  constructor(map) {
    this.map = map;
    this.editingFeature = null;
    this.editMode = 'vertex'; // vertex, edge, cut, eraser, brush
    this.vertices = [];
    this.edges = [];
    this.draggingVertex = null;
    this.draggingEdge = null;
    this.snappingEnabled = true;
    this.snapDistance = 10; // 像素
  }
  
  // 开始编辑特征
  startEditing(feature) {
    this.editingFeature = feature;
    this.updateVerticesAndEdges();
    this.addEditMarkers();
  }
  
  // 停止编辑
  stopEditing() {
    this.removeEditMarkers();
    this.editingFeature = null;
    this.vertices = [];
    this.edges = [];
  }
  
  // 更新顶点和边
  updateVerticesAndEdges() {
    if (!this.editingFeature) return;
    
    const latLngs = this.editingFeature.getLatLngs()[0];
    this.vertices = [];
    this.edges = [];
    
    // 提取顶点
    for (let i = 0; i < latLngs.length; i++) {
      this.vertices.push({
        latlng: latLngs[i],
        index: i
      });
    }
    
    // 提取边
    for (let i = 0; i < latLngs.length; i++) {
      const start = latLngs[i];
      const end = latLngs[(i + 1) % latLngs.length];
      this.edges.push({
        start: start,
        end: end,
        index: i
      });
    }
  }
  
  // 添加编辑标记
  addEditMarkers() {
    this.removeEditMarkers();
    
    // 添加顶点标记
    this.vertices.forEach(vertex => {
      const marker = L.marker(vertex.latlng, {
        draggable: true,
        icon: L.divIcon({
          className: 'vertex-marker',
          html: `<div style="width: 8px; height: 8px; background: #ffc107; border: 2px solid #000; border-radius: 50%;"></div>`,
          iconSize: [8, 8]
        })
      });
      
      marker.on('dragstart', (e) => {
        this.draggingVertex = vertex;
      });
      
      marker.on('drag', (e) => {
        this.updateVertexPosition(e.target.getLatLng(), vertex.index);
      });
      
      marker.on('dragend', (e) => {
        this.draggingVertex = null;
        this.updateFeatureGeometry();
      });
      
      marker.on('click', (e) => {
        e.stopPropagation();
        this.handleVertexClick(vertex);
      });
      
      marker.addTo(this.map);
      vertex.marker = marker;
    });
    
    // 添加边标记
    this.edges.forEach(edge => {
      const midpoint = L.latLng(
        (edge.start.lat + edge.end.lat) / 2,
        (edge.start.lng + edge.end.lng) / 2
      );
      
      const marker = L.marker(midpoint, {
        draggable: true,
        icon: L.divIcon({
          className: 'edge-marker',
          html: `<div style="width: 6px; height: 6px; background: #198754; border: 2px solid #000; border-radius: 50%;"></div>`,
          iconSize: [6, 6]
        })
      });
      
      marker.on('dragstart', (e) => {
        this.draggingEdge = edge;
      });
      
      marker.on('drag', (e) => {
        this.updateEdgePosition(e.target.getLatLng(), edge.index);
      });
      
      marker.on('dragend', (e) => {
        this.draggingEdge = null;
        this.updateFeatureGeometry();
      });
      
      marker.on('click', (e) => {
        e.stopPropagation();
        this.addVertexAtEdge(edge);
      });
      
      marker.addTo(this.map);
      edge.marker = marker;
    });
  }
  
  // 移除编辑标记
  removeEditMarkers() {
    this.vertices.forEach(vertex => {
      if (vertex.marker) {
        this.map.removeLayer(vertex.marker);
      }
    });
    
    this.edges.forEach(edge => {
      if (edge.marker) {
        this.map.removeLayer(edge.marker);
      }
    });
  }
  
  // 更新顶点位置
  updateVertexPosition(newLatLng, index) {
    if (!this.editingFeature) return;
    
    // 应用吸附
    if (this.snappingEnabled) {
      newLatLng = this.snapToNearest(newLatLng);
    }
    
    const latLngs = this.editingFeature.getLatLngs()[0];
    latLngs[index] = newLatLng;
    this.editingFeature.setLatLngs([latLngs]);
    
    // 只更新当前顶点标记的位置，不重新添加所有标记
    if (this.vertices[index] && this.vertices[index].marker) {
      this.vertices[index].marker.setLatLng(newLatLng);
    }
    
    // 更新相关边的标记位置
    this.updateEdgeMarkers();
  }
  
  // 更新边位置
  updateEdgePosition(newLatLng, edgeIndex) {
    if (!this.editingFeature) return;
    
    // 应用吸附
    if (this.snappingEnabled) {
      newLatLng = this.snapToNearest(newLatLng);
    }
    
    const latLngs = this.editingFeature.getLatLngs()[0];
    const startIndex = edgeIndex;
    const endIndex = (edgeIndex + 1) % latLngs.length;
    
    // 计算偏移量
    const start = latLngs[startIndex];
    const end = latLngs[endIndex];
    const offsetLat = newLatLng.lat - (start.lat + end.lat) / 2;
    const offsetLng = newLatLng.lng - (start.lng + end.lng) / 2;
    
    // 更新两个顶点
    latLngs[startIndex] = L.latLng(start.lat + offsetLat, start.lng + offsetLng);
    latLngs[endIndex] = L.latLng(end.lat + offsetLat, end.lng + offsetLng);
    
    this.editingFeature.setLatLngs([latLngs]);
    
    // 更新相关顶点和边的标记位置
    if (this.vertices[startIndex] && this.vertices[startIndex].marker) {
      this.vertices[startIndex].marker.setLatLng(latLngs[startIndex]);
    }
    if (this.vertices[endIndex] && this.vertices[endIndex].marker) {
      this.vertices[endIndex].marker.setLatLng(latLngs[endIndex]);
    }
    
    this.updateEdgeMarkers();
  }
  
  // 更新边标记位置
  updateEdgeMarkers() {
    this.edges.forEach(edge => {
      if (edge.marker) {
        const midpoint = L.latLng(
          (edge.start.lat + edge.end.lat) / 2,
          (edge.start.lng + edge.end.lng) / 2
        );
        edge.marker.setLatLng(midpoint);
      }
    });
  }
  
  // 在边上添加顶点
  addVertexAtEdge(edge) {
    if (!this.editingFeature) return;
    
    const latLngs = this.editingFeature.getLatLngs()[0];
    const midpoint = L.latLng(
      (edge.start.lat + edge.end.lat) / 2,
      (edge.start.lng + edge.end.lng) / 2
    );
    
    // 在边的位置插入新顶点
    latLngs.splice(edge.index + 1, 0, midpoint);
    this.editingFeature.setLatLngs([latLngs]);
    
    // 更新顶点和边
    this.updateVerticesAndEdges();
    this.addEditMarkers();
  }
  
  // 处理顶点点击
  handleVertexClick(vertex) {
    // 右键删除顶点
    if (event.button === 2) {
      event.preventDefault();
      this.deleteVertex(vertex.index);
    }
  }
  
  // 删除顶点
  deleteVertex(index) {
    if (!this.editingFeature) return;
    
    const latLngs = this.editingFeature.getLatLngs()[0];
    if (latLngs.length <= 3) {
      alert('多边形至少需要3个顶点');
      return;
    }
    
    latLngs.splice(index, 1);
    this.editingFeature.setLatLngs([latLngs]);
    
    // 更新顶点和边
    this.updateVerticesAndEdges();
    this.addEditMarkers();
  }
  
  // 裁剪工具
  cutPolygon(startLatLng, endLatLng) {
    if (!this.editingFeature) return;
    
    // 简化的裁剪逻辑
    // 实际项目中可能需要更复杂的算法
    const latLngs = this.editingFeature.getLatLngs()[0];
    
    // 找到裁剪线与多边形的交点
    const intersectionPoints = this.findIntersections(latLngs, startLatLng, endLatLng);
    
    if (intersectionPoints.length === 2) {
      // 基于交点分割多边形
      const newPolygons = this.splitPolygon(latLngs, intersectionPoints[0], intersectionPoints[1]);
      
      if (newPolygons.length === 2) {
        // 替换原多边形
        this.map.removeLayer(this.editingFeature);
        
        // 添加新多边形
        const polygon1 = L.polygon(newPolygons[0], this.editingFeature.options);
        const polygon2 = L.polygon(newPolygons[1], this.editingFeature.options);
        
        polygon1.addTo(this.map);
        polygon2.addTo(this.map);
        
        this.editingFeature = polygon1;
        this.updateVerticesAndEdges();
        this.addEditMarkers();
      }
    }
  }
  
  // 橡皮擦工具
  erasePolygon(position, radius) {
    if (!this.editingFeature) return;
    
    const latLngs = this.editingFeature.getLatLngs()[0];
    const newLatLngs = [];
    
    // 移除在橡皮擦范围内的顶点
    for (let i = 0; i < latLngs.length; i++) {
      const distance = this.map.distance(position, latLngs[i]);
      if (distance > radius) {
        newLatLngs.push(latLngs[i]);
      }
    }
    
    if (newLatLngs.length >= 3) {
      this.editingFeature.setLatLngs([newLatLngs]);
      this.updateVerticesAndEdges();
      this.addEditMarkers();
    }
  }
  
  // 画笔工具
  drawWithBrush(points) {
    if (!this.editingFeature) return;
    
    const latLngs = this.editingFeature.getLatLngs()[0];
    
    // 将画笔绘制的点添加到多边形
    points.forEach(point => {
      latLngs.push(point);
    });
    
    // 优化边界
    const optimizedLatLngs = this.optimizeBoundary(latLngs);
    this.editingFeature.setLatLngs([optimizedLatLngs]);
    
    this.updateVerticesAndEdges();
    this.addEditMarkers();
  }
  
  // 吸附到最近的点或边
  snapToNearest(latlng) {
    let closestDistance = Infinity;
    let closestPoint = latlng;
    
    // 吸附到顶点
    this.vertices.forEach(vertex => {
      const distance = this.map.distance(latlng, vertex.latlng);
      if (distance < closestDistance && distance < this.snapDistance) {
        closestDistance = distance;
        closestPoint = vertex.latlng;
      }
    });
    
    // 吸附到边
    this.edges.forEach(edge => {
      const distance = this.distanceToLine(latlng, edge.start, edge.end);
      if (distance < closestDistance && distance < this.snapDistance) {
        closestDistance = distance;
        closestPoint = this.projectToLine(latlng, edge.start, edge.end);
      }
    });
    
    return closestPoint;
  }
  
  // 计算点到直线的距离
  distanceToLine(point, lineStart, lineEnd) {
    const a = point.lat - lineStart.lat;
    const b = point.lng - lineStart.lng;
    const c = lineEnd.lat - lineStart.lat;
    const d = lineEnd.lng - lineStart.lng;
    
    const dot = a * c + b * d;
    const lenSq = c * c + d * d;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.lat;
      yy = lineStart.lng;
    } else if (param > 1) {
      xx = lineEnd.lat;
      yy = lineEnd.lng;
    } else {
      xx = lineStart.lat + param * c;
      yy = lineStart.lng + param * d;
    }
    
    const dx = point.lat - xx;
    const dy = point.lng - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  // 将点投影到直线上
  projectToLine(point, lineStart, lineEnd) {
    const a = point.lat - lineStart.lat;
    const b = point.lng - lineStart.lng;
    const c = lineEnd.lat - lineStart.lat;
    const d = lineEnd.lng - lineStart.lng;
    
    const dot = a * c + b * d;
    const lenSq = c * c + d * d;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.lat;
      yy = lineStart.lng;
    } else if (param > 1) {
      xx = lineEnd.lat;
      yy = lineEnd.lng;
    } else {
      xx = lineStart.lat + param * c;
      yy = lineStart.lng + param * d;
    }
    
    return L.latLng(xx, yy);
  }
  
  // 找到直线与多边形的交点
  findIntersections(latLngs, start, end) {
    const intersections = [];
    
    for (let i = 0; i < latLngs.length; i++) {
      const p1 = latLngs[i];
      const p2 = latLngs[(i + 1) % latLngs.length];
      
      const intersection = this.lineIntersection(start, end, p1, p2);
      if (intersection) {
        intersections.push(intersection);
      }
    }
    
    return intersections;
  }
  
  // 计算两条直线的交点
  lineIntersection(p1, p2, p3, p4) {
    const denom = (p4.lng - p3.lng) * (p2.lat - p1.lat) - (p4.lat - p3.lat) * (p2.lng - p1.lng);
    
    if (denom === 0) {
      return null; // 平行线
    }
    
    const ua = ((p4.lat - p3.lat) * (p2.lng - p1.lng) - (p4.lng - p3.lng) * (p2.lat - p1.lat)) / denom;
    const ub = ((p2.lat - p1.lat) * (p3.lng - p1.lng) - (p2.lng - p1.lng) * (p3.lat - p1.lat)) / denom;
    
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
      const x = p1.lat + ua * (p2.lat - p1.lat);
      const y = p1.lng + ua * (p2.lng - p1.lng);
      return L.latLng(x, y);
    }
    
    return null;
  }
  
  // 分割多边形
  splitPolygon(latLngs, p1, p2) {
    const polygon1 = [];
    const polygon2 = [];
    let foundFirst = false;
    
    for (let i = 0; i < latLngs.length; i++) {
      const point = latLngs[i];
      
      if (!foundFirst) {
        polygon1.push(point);
        if (this.pointsEqual(point, p1)) {
          foundFirst = true;
          polygon1.push(p2);
          polygon2.push(p1);
        }
      } else {
        polygon2.push(point);
        if (this.pointsEqual(point, p2)) {
          polygon2.push(p1);
          break;
        }
      }
    }
    
    return [polygon1, polygon2];
  }
  
  // 检查两个点是否相等
  pointsEqual(p1, p2) {
    return Math.abs(p1.lat - p2.lat) < 0.00001 && Math.abs(p1.lng - p2.lng) < 0.00001;
  }
  
  // 优化边界
  optimizeBoundary(latLngs) {
    // 去重
    const uniquePoints = [];
    const seen = new Set();
    
    latLngs.forEach(point => {
      const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePoints.push(point);
      }
    });
    
    // 确保边界闭合
    if (uniquePoints.length > 0) {
      const first = uniquePoints[0];
      const last = uniquePoints[uniquePoints.length - 1];
      if (!this.pointsEqual(first, last)) {
        uniquePoints.push(first);
      }
    }
    
    return uniquePoints;
  }
  
  // 更新特征几何
  updateFeatureGeometry() {
    if (!this.editingFeature) return;
    
    // 确保多边形不自交
    const latLngs = this.editingFeature.getLatLngs()[0];
    if (this.hasSelfIntersections(latLngs)) {
      // 修复自交
      const fixedLatLngs = this.fixSelfIntersections(latLngs);
      this.editingFeature.setLatLngs([fixedLatLngs]);
    }
  }
  
  // 检查多边形是否自交
  hasSelfIntersections(latLngs) {
    for (let i = 0; i < latLngs.length; i++) {
      const p1 = latLngs[i];
      const p2 = latLngs[(i + 1) % latLngs.length];
      
      for (let j = i + 2; j < latLngs.length; j++) {
        const p3 = latLngs[j];
        const p4 = latLngs[(j + 1) % latLngs.length];
        
        if (this.lineIntersection(p1, p2, p3, p4)) {
          return true;
        }
      }
    }
    return false;
  }
  
  // 修复自交
  fixSelfIntersections(latLngs) {
    // 简单的修复逻辑，实际项目中可能需要更复杂的算法
    // 这里使用凸包算法来确保多边形不自交
    return this.convexHull(latLngs);
  }
  
  // 凸包算法
  convexHull(points) {
    // 按x坐标排序
    points.sort((a, b) => a.lng - b.lng);
    
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
    return (a.lat - o.lat) * (b.lng - o.lng) - (a.lng - o.lng) * (b.lat - o.lat);
  }
}

// 全局变量
try {
  window.BoundaryEditor = BoundaryEditor;
} catch (e) {
  console.error('无法设置全局变量:', e);
}