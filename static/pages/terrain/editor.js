// 地块编辑器页面逻辑

// 全局编辑器实例
let terrainEditor;

// 初始化页面
function initEditor() {
  // 初始化编辑器
  terrainEditor = new TerrainEditor('editorMap');
  
  // 加载地形数据
  loadTerrainData();
  
  // 绑定工具按钮事件
  bindToolEvents();
  
  // 绑定操作按钮事件
  bindActionEvents();
  
  // 绑定图层控制事件
  bindLayerEvents();
}

// 加载地形数据
function loadTerrainData() {
  // 模拟加载地形数据
  console.log('=== editor.js: 加载地形数据 ===');
  console.log('window.terrainMockData:', window.terrainMockData);
  
  if (window.terrainMockData) {
    console.log('=== 使用 window.terrainMockData ===');
    console.log('地形边界:', window.terrainMockData.mapData.terrainBoundaries);
    console.log('风险区域:', window.terrainMockData.dangerZones);
    console.log('林区:', window.terrainMockData.forestAreas);
    console.log('农田:', window.terrainMockData.farmAreas);
    console.log('现有地块:', window.terrainMockData.existingPlots);
    
    terrainEditor.loadTerrainData({
      terrainBoundaries: window.terrainMockData.mapData.terrainBoundaries,
      riskAreas: window.terrainMockData.dangerZones,
      forestAreas: window.terrainMockData.forestAreas,
      farmAreas: window.terrainMockData.farmAreas,
      existingPlots: window.terrainMockData.existingPlots
    });
  }
}

// 绑定工具按钮事件
function bindToolEvents() {
  // 工具按钮点击事件
  document.querySelectorAll('[data-tool]').forEach(button => {
    button.addEventListener('click', function() {
      const tool = this.getAttribute('data-tool');
      selectTool(tool, this);
    });
  });
}

// 选择工具
function selectTool(tool, button) {
  // 移除所有工具按钮的激活状态
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // 激活当前工具按钮
  button.classList.add('active');
  
  // 设置当前工具
  terrainEditor.currentTool = tool;
  
  // 执行工具切换逻辑
  switch (tool) {
    case 'select':
      terrainEditor.updateEditMode('选择');
      break;
    case 'smart-select':
      terrainEditor.updateEditMode('智能选区');
      break;
    case 'multiselect':
      terrainEditor.updateEditMode('多选');
      break;
    case 'merge':
      terrainEditor.mergeFeatures();
      break;
    case 'vertex-edit':
      terrainEditor.enableVertexEdit();
      break;
    case 'edge-edit':
      terrainEditor.enableEdgeEdit();
      break;
    case 'cut':
      terrainEditor.enableCut();
      break;
    case 'eraser':
      terrainEditor.enableEraser();
      break;
    case 'brush':
      terrainEditor.enableBrush();
      break;
  }
}

// 绑定操作按钮事件
function bindActionEvents() {
  // 撤销按钮
  document.querySelector('[data-action="undo"]').addEventListener('click', function() {
    terrainEditor.undo();
  });
  
  // 重做按钮
  document.querySelector('[data-action="redo"]').addEventListener('click', function() {
    terrainEditor.redo();
  });
  
  // 取消按钮
  document.querySelector('[data-action="cancel"]').addEventListener('click', function() {
    if (confirm('确定要取消编辑吗？未保存的更改将会丢失。')) {
      window.location.href = '/terrain/';
    }
  });
  
  // 保存按钮
  document.querySelector('[data-action="save"]').addEventListener('click', function() {
    terrainEditor.save();
  });
  
  // 合并选中地块按钮
  document.getElementById('mergeSelectedBtn').addEventListener('click', function() {
    terrainEditor.mergeFeatures();
  });
  
  // 底图切换
  document.querySelectorAll('[data-basemap]').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const basemap = this.getAttribute('data-basemap');
      terrainEditor.switchBasemap(basemap);
    });
  });
}

// 绑定图层控制事件
function bindLayerEvents() {
  // 图层复选框事件
  document.querySelectorAll('.layer-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const layerName = this.nextElementSibling.textContent.trim();
      const visible = this.checked;
      
      // 切换图层可见性
      switch (layerName) {
        case '地形边界':
          terrainEditor.layerManager.toggleLayer('base', visible);
          break;
        case '风险区域':
          // 切换风险区域图层
          break;
        case '禁飞区':
          // 切换禁飞区图层
          break;
        case '林区边界':
          // 切换林区边界图层
          break;
        case '农田边界':
          // 切换农田边界图层
          break;
      }
    });
  });
  
  // 已选地块项点击事件
  document.querySelectorAll('#selectedAreas .layer-item').forEach(item => {
    item.addEventListener('click', function() {
      // 移除所有项的激活状态
      document.querySelectorAll('#selectedAreas .layer-item').forEach(i => {
        i.classList.remove('active');
      });
      
      // 激活当前项
      this.classList.add('active');
    });
  });
  
  // 已选地块删除按钮事件
  document.querySelectorAll('#selectedAreas .btn-danger').forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      const item = this.closest('.layer-item');
      item.remove();
    });
  });
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initEditor);