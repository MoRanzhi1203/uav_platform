// 地块编辑器页面逻辑

// 全局编辑器实例
let terrainEditor;

// 初始化页面
function initEditor() {
  // 初始化编辑器
  terrainEditor = new TerrainEditor('editorMap');
  
  // 绑定工具按钮事件
  bindToolEvents();
  
  // 绑定操作按钮事件
  bindActionEvents();

  // 绑定辅助图层事件
  bindAssistLayerEvents();

  // 绑定属性面板事件
  bindAttributeEvents();

  // 默认进入像素画笔模式
  const brushBtn = document.querySelector('[data-tool="brush"]');
  if (brushBtn) {
    selectTool('brush', brushBtn);
  }
  // 画笔大小下拉菜单
  document.querySelectorAll('[data-brush-size]').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const raw = this.getAttribute('data-brush-size');
      let size = parseInt(raw);
      if (Number.isNaN(size)) {
        const input = prompt('请输入笔刷大小（1~99，表示 NxN 网格）', '1');
        size = parseInt(input, 10);
      }
      if (!Number.isFinite(size) || size < 1) return;
      size = Math.min(size, 99);
      
      // 更新按钮文本
      document.getElementById('currentBrushSize').textContent = `${size}x${size}`;
      
      // 更新激活状态
      document.querySelectorAll('[data-brush-size]').forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      
      // 传递给编辑器
      if (terrainEditor) {
        terrainEditor.setBrushSize(size);
        
        // 如果当前不是画笔或橡皮擦模式，切换到画笔模式
        if (terrainEditor.currentTool !== 'brush' && terrainEditor.currentTool !== 'eraser') {
          selectTool('brush', document.querySelector('[data-tool="brush"]'));
        }
      }
    });
  });

  // 橡皮擦模式下拉菜单
  document.querySelectorAll('[data-eraser-mode]').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const mode = this.getAttribute('data-eraser-mode');
      const label = mode === 'block' ? '整块' : '画笔';
      
      // 更新按钮文本
      document.getElementById('currentEraserMode').textContent = label;
      
      // 更新激活状态
      document.querySelectorAll('[data-eraser-mode]').forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      
      // 传递给编辑器
      if (terrainEditor) {
        terrainEditor.setEraserMode(mode);
        
        // 如果当前不是橡皮擦模式，切换到橡皮擦模式
        if (terrainEditor.currentTool !== 'eraser') {
          selectTool('eraser', document.querySelector('[data-tool="eraser"]'));
        } else {
          // 重新启用以切换子模式监听器
          terrainEditor.enableEraser();
        }
      }
    });
  });

  // 地块类型选择联动
  const plotTypeSelect = document.getElementById('plotType');
  const subTypeGroup = document.getElementById('subTypeGroup');
  if (plotTypeSelect && subTypeGroup) {
    plotTypeSelect.addEventListener('change', function() {
      if (this.value === 'farmland' || this.value === 'mixed') {
        subTypeGroup.style.display = 'block';
      } else {
        subTypeGroup.style.display = 'none';
        document.getElementById('plotSubType').value = '';
      }
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

// 绑定属性面板事件
function bindAttributeEvents() {
  const plotType = document.getElementById('plotType');
  const subTypeGroup = document.getElementById('subTypeGroup');
  const remarkGroup = document.getElementById('remarkGroup');
  const plotSubType = document.getElementById('plotSubType');

  if (plotType) {
    plotType.addEventListener('change', function() {
      const type = this.value;
      // 农田支持水稻池子类型
      if (type === 'farmland') {
        subTypeGroup.style.display = 'block';
        remarkGroup.style.display = 'none';
        plotSubType.innerHTML = `
          <option value="">普通农田</option>
          <option value="rice">水稻种植池</option>
        `;
      } else if (type === 'mixed') {
        subTypeGroup.style.display = 'none';
        remarkGroup.style.display = 'block';
      } else {
        subTypeGroup.style.display = 'none';
        remarkGroup.style.display = 'none';
      }
      
      // 更新当前激活地块的属性 (如果有)
      if (terrainEditor && terrainEditor.activePlotId) {
        terrainEditor.updateActivePlotProperties({ type: type });
      }
    });
  }

  // 其他属性变化监听
  ['plotName', 'plotSubType', 'riskLevel', 'description', 'plotRemark'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', function() {
        if (terrainEditor && terrainEditor.activePlotId) {
          const props = {};
          let key = id.replace('plot', '').charAt(0).toLowerCase() + id.replace('plot', '').slice(1);
          props[key] = this.value;
          terrainEditor.updateActivePlotProperties(props);
        }
      });
    }
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
    case 'brush':
      terrainEditor.enableBrush();
      break;
    case 'eraser':
      terrainEditor.enableEraser();
      break;
    case 'pan':
      terrainEditor.enablePan();
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
  
  // 底图切换
  document.querySelectorAll('[data-basemap]').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const basemap = this.getAttribute('data-basemap');
      terrainEditor.switchBasemap(basemap);
    });
  });
}

// 绑定辅助图层事件
function bindAssistLayerEvents() {
  // 10m 网格
  const grid10m = document.getElementById('gridToggle10m');
  if (grid10m) {
    grid10m.addEventListener('change', function() {
      if (terrainEditor) terrainEditor.toggleReferenceGrid('10m', this.checked);
    });
  }

  // 1000m 网格
  const grid1km = document.getElementById('gridToggle1km');
  if (grid1km) {
    grid1km.addEventListener('change', function() {
      if (terrainEditor) terrainEditor.toggleReferenceGrid('1km', this.checked);
    });
  }

  // 行政区划边界切换
  const adminToggle = document.getElementById('adminBoundaryToggle');
  if (adminToggle) {
    adminToggle.addEventListener('change', function() {
      if (terrainEditor) terrainEditor.toggleAdminBoundaries(this.checked);
    });
  }

  // 历史地块提示切换
  const historyToggle = document.getElementById('historyToggle');
  if (historyToggle) {
    historyToggle.addEventListener('change', function() {
      if (terrainEditor) terrainEditor.toggleHistoryHints(this.checked);
    });
  }
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initEditor);
