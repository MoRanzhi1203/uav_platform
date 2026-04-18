// 地块编辑器页面逻辑

// 全局编辑器实例
let terrainEditor;
let workspaceLayout = null;

const WORKSPACE_LAYOUT_KEY = 'terrain-editor-workspace-layout';
const WORKSPACE_LAYOUT_DEFAULTS = {
  leftWidth: 320,
  leftCollapsedWidth: 260,
  rightWidth: 360
};
const WORKSPACE_LEFT_MIN = 240;
const WORKSPACE_LEFT_MAX = 520;
const WORKSPACE_LEFT_COLLAPSED_MIN = 260;
const WORKSPACE_LEFT_COLLAPSED_MAX = 340;
const WORKSPACE_RIGHT_MIN = 280;
const WORKSPACE_RIGHT_MAX = 560;

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

  // 绑定自定义地块类型下拉菜单事件
  bindCustomPlotTypeDropdown();

  // 绑定顶部工具栏下拉菜单展开态，避免菜单被工具栏容器裁切
  bindToolbarDropdownState();

  // 绑定左右工作台的显示/隐藏与拖拽调宽
  initWorkspacePanels();

  // 默认进入鼠标模式，仅保留基础拖拽和缩放
  if (terrainEditor) {
    selectTool('browse');
  }

  // 加载区域及地块数据
  if (terrainEditor) {
    const urlParams = new URLSearchParams(window.location.search);
    const areaId = urlParams.get('area_id');
    
    // 初始化时控制删除按钮可用状态（如果是新建地形，则禁用删除按钮）
    const deleteBtn = document.getElementById('deleteTerrainBtn');
    if (deleteBtn) {
      deleteBtn.disabled = !areaId;
    }

    if (areaId) {
      terrainEditor.loadAreaEditDetail(areaId);
    } else {
      console.warn('未指定区域 ID，部分功能可能受限');
      
      // 新建地形时，触发默认分类（如林区）的子类型加载联动
      const defaultPlotType = document.getElementById('plotType')?.value;
      if (defaultPlotType) {
        terrainEditor.setPlotCategoryAndLoadSubcategories(defaultPlotType, '');
      }
    }
  }

  // 画笔大小滑动条
   const brushSizeSlider = document.getElementById('brushSizeSlider');
   if (brushSizeSlider) {
     brushSizeSlider.addEventListener('input', function() {
       const size = parseInt(this.value, 10);
       if (!Number.isFinite(size) || size < 1) return;
       
       // 更新显示文本 (按钮和下拉菜单内部)
       const sizeText = `${size}x${size}`;
       document.getElementById('currentBrushSize').textContent = sizeText;
       const badge = document.getElementById('brushSizeBadge');
       if (badge) badge.textContent = sizeText;
       
       // 传递给编辑器
       if (terrainEditor) {
         terrainEditor.setBrushSize(size);
         
         // 如果当前不是画笔或橡皮擦模式，且用户正在调整大小，切换到画笔模式
         if (terrainEditor.currentTool !== 'brush' && terrainEditor.currentTool !== 'eraser') {
           selectTool('brush', document.querySelector('[data-tool="brush"]'));
         }
       }
     });
   }

  // 画笔形状下拉菜单
  document.querySelectorAll('[data-brush-shape]').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const shape = this.getAttribute('data-brush-shape');
      const label = shape === 'square' ? '方形' : '圆形';
      const iconClass = shape === 'square' ? 'bi-square' : 'bi-circle';
      
      // 更新按钮文本和图标
      document.getElementById('currentBrushShapeText').textContent = label;
      const icon = document.getElementById('currentBrushShapeIcon');
      if (icon) icon.className = `bi ${iconClass}`;
      
      // 更新激活状态
      document.querySelectorAll('[data-brush-shape]').forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      
      // 传递给编辑器
      if (terrainEditor) {
        terrainEditor.setBrushShape(shape);
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

function initWorkspacePanels() {
  const workspace = document.getElementById('editorWorkspace');
  const leftPanel = document.getElementById('editorSidebar');
  const rightPanel = document.getElementById('editorPanel');
  const leftResizer = document.getElementById('leftPanelResizer');
  const rightResizer = document.getElementById('rightPanelResizer');

  if (!workspace || !leftPanel || !rightPanel || !leftResizer || !rightResizer) {
    return;
  }

  workspaceLayout = loadWorkspaceLayout();
  applyWorkspaceLayout();
  bindWorkspaceSidebarState();

  bindPanelResizer(leftResizer, 'left');
  bindPanelResizer(rightResizer, 'right');

  window.addEventListener('resize', () => {
    applyWorkspaceLayout({ persist: false });
  });
}

function loadWorkspaceLayout() {
  try {
    const saved = window.localStorage.getItem(WORKSPACE_LAYOUT_KEY);
    if (!saved) return { ...WORKSPACE_LAYOUT_DEFAULTS };

    const parsed = JSON.parse(saved);
    return {
      leftWidth: clampWidth(parsed.leftWidth, WORKSPACE_LEFT_MIN, WORKSPACE_LEFT_MAX, WORKSPACE_LAYOUT_DEFAULTS.leftWidth),
      leftCollapsedWidth: clampWidth(
        parsed.leftCollapsedWidth,
        WORKSPACE_LEFT_COLLAPSED_MIN,
        WORKSPACE_LEFT_COLLAPSED_MAX,
        WORKSPACE_LAYOUT_DEFAULTS.leftCollapsedWidth
      ),
      rightWidth: clampWidth(parsed.rightWidth, WORKSPACE_RIGHT_MIN, WORKSPACE_RIGHT_MAX, WORKSPACE_LAYOUT_DEFAULTS.rightWidth)
    };
  } catch (error) {
    console.warn('读取工作台布局配置失败，已恢复默认布局:', error);
    return { ...WORKSPACE_LAYOUT_DEFAULTS };
  }
}

function saveWorkspaceLayout() {
  if (!workspaceLayout) return;

  try {
    window.localStorage.setItem(WORKSPACE_LAYOUT_KEY, JSON.stringify(workspaceLayout));
  } catch (error) {
    console.warn('保存工作台布局配置失败:', error);
  }
}

function applyWorkspaceLayout(options = {}) {
  const { persist = false } = options;
  const container = document.querySelector('.editor-container');

  if (!container || !workspaceLayout) return;

  container.style.setProperty('--left-panel-width', `${workspaceLayout.leftWidth}px`);
  container.style.setProperty('--left-panel-collapsed-width', `${workspaceLayout.leftCollapsedWidth}px`);
  container.style.setProperty('--right-panel-width', `${workspaceLayout.rightWidth}px`);

  if (persist) {
    saveWorkspaceLayout();
  }

  requestMapResize();
}

function bindWorkspaceSidebarState() {
  const body = document.body;
  if (!body) return;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        applyWorkspaceLayout({ persist: false });
        break;
      }
    }
  });

  observer.observe(body, { attributes: true, attributeFilter: ['class'] });
}

function bindPanelResizer(resizer, side) {
  resizer.addEventListener('mousedown', function(e) {
    if (window.matchMedia('(max-width: 992px)').matches) return;

    e.preventDefault();
    startPanelResize(side, e.clientX);
  });
}

function startPanelResize(side, startX) {
  const container = document.querySelector('.editor-container');
  const leftPanel = document.getElementById('editorSidebar');
  const rightPanel = document.getElementById('editorPanel');

  if (!container || !leftPanel || !rightPanel || !workspaceLayout) return;

  const startWidth = side === 'left'
    ? leftPanel.getBoundingClientRect().width
    : rightPanel.getBoundingClientRect().width;

  container.classList.add('is-resizing');

  const handleMouseMove = (event) => {
    const deltaX = event.clientX - startX;

    if (side === 'left') {
      if (isAdminSidebarExpanded()) {
        workspaceLayout.leftCollapsedWidth = clampWidth(
          startWidth + deltaX,
          WORKSPACE_LEFT_COLLAPSED_MIN,
          WORKSPACE_LEFT_COLLAPSED_MAX,
          WORKSPACE_LAYOUT_DEFAULTS.leftCollapsedWidth
        );
      } else {
        workspaceLayout.leftWidth = clampWidth(
          startWidth + deltaX,
          WORKSPACE_LEFT_MIN,
          WORKSPACE_LEFT_MAX,
          WORKSPACE_LAYOUT_DEFAULTS.leftWidth
        );
      }
    } else {
      workspaceLayout.rightWidth = clampWidth(startWidth - deltaX, WORKSPACE_RIGHT_MIN, WORKSPACE_RIGHT_MAX, WORKSPACE_LAYOUT_DEFAULTS.rightWidth);
    }

    applyWorkspaceLayout();
  };

  const handleMouseUp = () => {
    container.classList.remove('is-resizing');
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    saveWorkspaceLayout();
    requestMapResize();
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

function isAdminSidebarExpanded() {
  return document.body && !document.body.classList.contains('toggle-sidebar');
}

function clampWidth(value, min, max, fallback) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(max, Math.max(min, numericValue));
}

function requestMapResize() {
  if (!terrainEditor || !terrainEditor.map) return;

  window.requestAnimationFrame(() => {
    terrainEditor.map.invalidateSize();
  });

  window.setTimeout(() => {
    if (terrainEditor && terrainEditor.map) {
      terrainEditor.map.invalidateSize();
    }
  }, 240);
}

// 绑定工具按钮事件
function bindToolEvents() {
  // 工具按钮点击事件
  document.querySelectorAll('[data-tool]').forEach(button => {
    button.addEventListener('click', function() {
      const tool = this.getAttribute('data-tool');
      // 如果点击的是当前已激活的工具，则取消选择并切回鼠标模式
      if (terrainEditor?.currentTool === tool) {
        selectTool('browse');
        return;
      }
      selectTool(tool, this);
    });
  });
}

// 绑定属性面板事件
function bindAttributeEvents() {
  const plotType = document.getElementById('plotType');
  const subTypeGroup = document.getElementById('subTypeGroup');
  const plotSubType = document.getElementById('plotSubType');

  if (plotType) {
    plotType.addEventListener('change', function(e) {
      const type = this.value;
      const isUserAction = e.isTrusted || (e.detail && e.detail.isUserTriggered);
      // --- 日志4：类型-子类别联动日志 ---
      console.log('[日志4：类型联动]');
      console.log('- plot_type 变化来源:', isUserAction ? '用户主动修改' : '代码初始化/回填');
      console.log('- 新的 plot_type:', type);
      
      // 所有大类都支持显示子类别下拉列表，实现全类型统一
      if (type) {
        if (subTypeGroup) subTypeGroup.style.display = 'block';
        if (terrainEditor) {
          // 只有用户主动改变时才清空子类别；代码触发时保持现状（或在 load 中回填）
          if (isUserAction) {
            console.log('- 触发原因：用户主动修改，正在清空 subtype');
            terrainEditor.selectSubCategory('');
            terrainEditor.loadSubCategories('');
          }
        }
      } else {
        if (subTypeGroup) subTypeGroup.style.display = 'none';
        if (terrainEditor) {
          if (isUserAction) {
            terrainEditor.selectSubCategory('');
          }
        }
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

// 选择工具 (button 可选，不传表示进入鼠标模式但没有按钮高亮)
function selectTool(tool, button) {
  // 移除所有工具按钮的激活状态
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // 如果提供了按钮，则激活该工具按钮
  if (button) {
    button.classList.add('active');
  }
  
  // 设置当前工具并执行工具切换逻辑
  if (terrainEditor) {
    terrainEditor.currentTool = tool;
    
    switch (tool) {
      case 'browse':
        terrainEditor.enableBrowseMode();
        break;
      case 'move-layer':
        terrainEditor.enableMoveLayer();
        break;
      case 'marquee-select':
        terrainEditor.enableMarqueeSelect();
        break;
      case 'brush':
        terrainEditor.enableBrush();
        break;
      case 'eraser':
        terrainEditor.enableEraser();
        break;
    }
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
    terrainEditor.confirmAction('确定要取消编辑吗？未保存的更改将会丢失。', function() {
      window.location.href = '/terrain/';
    }, null, 'warning');
  });
  
  // 保存按钮
  document.querySelector('[data-action="save"]').addEventListener('click', async function() {
    // 保存前检查不相连区域
    if (terrainEditor && terrainEditor.activePlotId) {
      await terrainEditor.checkAndSplitDisjointPartsLocally(terrainEditor.activePlotId);
    }
    terrainEditor.save();
  });

  // 删除地形按钮
  document.getElementById('deleteTerrainBtn')?.addEventListener('click', function() {
    if (terrainEditor) {
      terrainEditor.deleteTerrain();
    }
  });

  // 图层面板操作按钮
  document.getElementById('toggleMultiSelectBtn')?.addEventListener('click', () => terrainEditor.toggleMultiSelectMode());
  document.getElementById('mergeZonesBtn')?.addEventListener('click', () => terrainEditor.handleMergeZones());
  document.getElementById('booleanSubtractBtn')?.addEventListener('click', () => terrainEditor.handleBooleanSubtract());
  document.getElementById('splitZoneBtn')?.addEventListener('click', () => terrainEditor.handleSplitZone());
  document.getElementById('createNewZoneBtn')?.addEventListener('click', () => terrainEditor.handleCreateNewZone());

  // 子类别管理按钮
  document.getElementById('addNewSubCatBtn')?.addEventListener('click', () => terrainEditor.handleAddSubCategory());
  
  // 底图模式下拉菜单 (侧边栏)
  document.querySelectorAll('#basemapDropdownSidebarContainer [data-basemap]').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const basemap = this.getAttribute('data-basemap');
      if (terrainEditor) {
        terrainEditor.switchBasemap(basemap);
      }
    });
  });
}

function syncTopographicAssistOpacityUI(percent) {
  const topographicAssistOpacity = document.getElementById('topographicAssistOpacity');
  const topographicAssistOpacityValue = document.getElementById('topographicAssistOpacityValue');
  const parsedPercent = Number(percent);
  const normalizedPercent = Number.isFinite(parsedPercent)
    ? Math.max(0, Math.min(100, Math.round(parsedPercent)))
    : 50;

  if (topographicAssistOpacity) {
    topographicAssistOpacity.value = String(normalizedPercent);
  }

  if (topographicAssistOpacityValue) {
    topographicAssistOpacityValue.textContent = `${normalizedPercent}%`;
  }

  if (terrainEditor) {
    terrainEditor.setTopographicAssistOpacity(normalizedPercent / 100);
  }

  return normalizedPercent;
}

// 绑定辅助图层事件
function bindAssistLayerEvents() {
  // 卫星底图上的等高线参考层
  const topographicAssistToggle = document.getElementById('topographicAssistToggle');
  const topographicAssistOpacity = document.getElementById('topographicAssistOpacity');

  if (topographicAssistToggle) {
    topographicAssistToggle.addEventListener('change', function() {
      if (!terrainEditor) return;
      terrainEditor.toggleTopographicAssist(this.checked);
      terrainEditor.updateTopographicAssistAvailability(terrainEditor.currentBasemap);
    });
  }

  if (topographicAssistOpacity) {
    topographicAssistOpacity.addEventListener('input', function() {
      syncTopographicAssistOpacityUI(this.value);
    });

    syncTopographicAssistOpacityUI(topographicAssistOpacity.value);
  } else {
    syncTopographicAssistOpacityUI(50);
  }

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
}

// 绑定自定义地块类型下拉菜单事件
function bindCustomPlotTypeDropdown() {
  const dropdownItems = document.querySelectorAll('#plotTypeDropdownMenu .dropdown-item');
  const plotTypeInput = document.getElementById('plotType');
  const btnContent = document.getElementById('selectedPlotTypeName');

  if (!dropdownItems.length || !plotTypeInput || !btnContent) return;

  dropdownItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      
      // 移除所有项的 active 状态
      dropdownItems.forEach(i => i.classList.remove('active'));
      // 添加当前项的 active 状态
      this.classList.add('active');
      
      // 更新按钮显示内容 (仅包含色块和文本)
      btnContent.innerHTML = this.innerHTML;
      
      // 更新隐藏输入框的值
      const value = this.getAttribute('data-value');
      plotTypeInput.value = value;
      
      // 触发 change 事件，以便触发 bindAttributeEvents 中的联动逻辑
      const event = new CustomEvent('change', { detail: { isUserTriggered: true }, bubbles: true });
      plotTypeInput.dispatchEvent(event);
    });
  });
}

function bindToolbarDropdownState() {
  const toolbarCenter = document.querySelector('.editor-header-center');
  const toolbarGroup = document.querySelector('.editor-header-center-inner > .tool-group:not(.actions)');
  const toolbarDropdowns = document.querySelectorAll('.editor-header-center .dropdown');

  if (!toolbarCenter || !toolbarGroup || !toolbarDropdowns.length) return;

  const syncToolbarDropdownState = () => {
    const hasOpenDropdown = Array.from(toolbarDropdowns).some(dropdown => {
      const menu = dropdown.querySelector('.dropdown-menu');
      return dropdown.classList.contains('show') || (menu && menu.classList.contains('show'));
    });

    toolbarCenter.classList.toggle('is-dropdown-open', hasOpenDropdown);
    toolbarGroup.classList.toggle('is-dropdown-open', hasOpenDropdown);
  };

  toolbarDropdowns.forEach(dropdown => {
    dropdown.addEventListener('shown.bs.dropdown', syncToolbarDropdownState);
    dropdown.addEventListener('hidden.bs.dropdown', syncToolbarDropdownState);
  });

  syncToolbarDropdownState();
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initEditor);
