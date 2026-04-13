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

  // 加载区域及地块数据
  if (terrainEditor) {
    const urlParams = new URLSearchParams(window.location.search);
    const areaId = urlParams.get('area_id');
    
    if (areaId) {
      terrainEditor.loadAreaEditDetail(areaId);
    } else {
      console.warn('未指定区域 ID，部分功能可能受限');
    }
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
      if (this.value) {
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
      // 所有大类都支持显示子类别下拉列表，实现全类型统一
      if (type) {
        subTypeGroup.style.display = 'block';
        if (terrainEditor) {
          // 切换大类时，统一清除旧子类型并加载新大类的可选列表
          terrainEditor.selectSubCategory('');
          terrainEditor.loadSubCategories();
        }
      } else {
        subTypeGroup.style.display = 'none';
      }
      
      // 更新当前激活地块的属性 (如果有)
      if (terrainEditor && terrainEditor.activePlotId) {
        terrainEditor.updateActivePlotProperties({ type: type });
      }
    });
  }

  // 其他属性变化监听，移除 plotRemark (已集成到子类型)
  ['plotName', 'riskLevel', 'description', 'plotSubType'].forEach(id => {
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
    // 保存前检查不相连区域
    if (terrainEditor && terrainEditor.activePlotId) {
      terrainEditor.checkAndSplitDisjointPartsLocally(terrainEditor.activePlotId);
    }
    terrainEditor.save();
  });

  // 图层面板操作按钮
  document.getElementById('mergeZonesBtn')?.addEventListener('click', () => terrainEditor.handleMergeZones());
  document.getElementById('booleanSubtractBtn')?.addEventListener('click', () => terrainEditor.handleBooleanSubtract());
  document.getElementById('splitZoneBtn')?.addEventListener('click', () => terrainEditor.handleSplitZone());
  document.getElementById('createNewZoneBtn')?.addEventListener('click', () => terrainEditor.handleCreateNewZone());

  // 子类别管理按钮
  document.getElementById('addNewSubCatBtn')?.addEventListener('click', () => terrainEditor.handleAddSubCategory());
  
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
  const adminColor = document.getElementById('adminBoundaryColor');
  if (adminToggle) {
    adminToggle.addEventListener('change', function() {
      if (terrainEditor) terrainEditor.toggleAdminBoundaries(this.checked);
    });
  }
  if (adminColor) {
    adminColor.addEventListener('input', function(e) {
      if (terrainEditor) terrainEditor.updateAdminBoundaryColor(e.target.value);
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
