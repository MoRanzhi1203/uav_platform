(function() {
  const state = {
    logs: [],
    allLogs: [],
    modules: [],
    actions: [],
    selectedLog: null,
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    filters: {
      keyword: '',
      module: '',
      action: '',
      operator: '',
      startDate: '',
      endDate: ''
    }
  };

  const logDetailModalEl = document.getElementById('logDetailModal');
  const logDetailModal = logDetailModalEl ? new bootstrap.Modal(logDetailModalEl) : null;

  document.addEventListener('DOMContentLoaded', initPage);

  function initPage() {
    bindEvents();
    loadLogs();
    loadStats();
  }

  function loadStats() {
    Http.get('/api/system/logs/stats/', {}, function(data) {
      setText('statTodayCount', data.today_count || 0);
      setText('statTotalCount', data.total_count || 0);
      setText('statActiveUsers', data.active_user_count || 0);
      setText('statModuleCount', data.module_count || 0);
    });
  }

  function bindEvents() {
    const filterForm = document.getElementById('logFilterForm');
    if (filterForm) {
      filterForm.addEventListener('submit', function(event) {
        event.preventDefault();
        collectFilters();
        state.page = 1;
        loadLogs();
      });
    }

    const resetBtn = document.getElementById('btnResetFilters');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetFilters);
    }

    const refreshBtn = document.getElementById('btnRefreshLogs');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadLogs);
    }

    const exportBtn = document.getElementById('btnExportLogs');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportLogs);
    }

    const prevBtn = document.getElementById('btnPrevPage');
    const nextBtn = document.getElementById('btnNextPage');
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        if (state.page > 1) {
          state.page -= 1;
          loadLogs();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        if (state.page < state.totalPages) {
          state.page += 1;
          loadLogs();
        }
      });
    }
  }

  function loadLogs() {
    Common.showLoading('.log-table-card .card-body');
    const params = {
      page: state.page,
      page_size: state.pageSize,
      keyword: state.filters.keyword,
      module: state.filters.module,
      action: state.filters.action,
      operator: state.filters.operator,
      start_date: state.filters.startDate,
      end_date: state.filters.endDate
    };
    
    Http.get('/api/system/logs/', params, function(response) {
      state.logs = response.logs || [];
      state.modules = response.filters?.modules || [];
      state.actions = response.filters?.actions || [];
      state.total = response.pagination?.total || 0;
      state.totalPages = response.pagination?.total_pages || 1;
      
      if (!document.getElementById('filterModule').dataset.initialized) {
        populateModuleFilter();
        document.getElementById('filterModule').dataset.initialized = 'true';
      }
      if (!document.getElementById('filterAction').dataset.initialized) {
        populateActionFilter();
        document.getElementById('filterAction').dataset.initialized = 'true';
      }

      renderLogTable();
      updatePaginationButtons();
      Common.hideLoading('.log-table-card .card-body');
    }).fail(function(xhr) {
      Common.hideLoading('.log-table-card .card-body');
      const tbody = document.getElementById('logTableBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-5">操作日志加载失败，请稍后重试</td></tr>';
      }
      Http.showFriendlyError(xhr.responseJSON?.message || xhr.responseJSON?.msg || '加载日志失败', xhr.responseText);
    });
  }

  function collectFilters() {
    state.filters.keyword = getValue('filterKeyword');
    state.filters.module = getValue('filterModule');
    state.filters.action = getValue('filterAction');
    state.filters.operator = getValue('filterOperator');
    state.filters.startDate = getValue('filterStartDate');
    state.filters.endDate = getValue('filterEndDate');
  }

  function resetFilters() {
    ['filterKeyword', 'filterModule', 'filterAction', 'filterOperator', 'filterStartDate', 'filterEndDate'].forEach(function(id) {
      const node = document.getElementById(id);
      if (node) {
        node.value = '';
      }
    });
    collectFilters();
    state.page = 1;
    loadLogs();
  }

  function renderLogTable() {
    const tbody = document.getElementById('logTableBody');
    if (!tbody) {
      return;
    }

    setText('logListCount', state.total + ' 条');
    setText('logPaginationInfo', '第 ' + state.page + ' / ' + state.totalPages + ' 页');

    if (!state.logs.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-5">暂无符合条件的日志数据</td></tr>';
      return;
    }

    tbody.innerHTML = state.logs.map(function(log) {
      const methodBadge = getMethodBadge(log.request_method);
      const moduleLabel = log.module || '-';
      const actionLabel = log.action || '-';
      const hasExtraData = log.extra_data && Object.keys(log.extra_data).length > 0;
      
      return `
        <tr class="log-row" data-log-id="${log.id}">
          <td class="log-time">${escapeHtml(log.created_at || '-')}</td>
          <td class="log-operator">
            <div class="operator-cell">
              <span class="operator-avatar">${getInitial(log.operator_name)}</span>
              <span>${escapeHtml(log.operator_name || '-')}</span>
            </div>
          </td>
          <td><span class="log-module-badge">${escapeHtml(moduleLabel)}</span></td>
          <td><span class="log-action-badge">${escapeHtml(actionLabel)}</span></td>
          <td>${methodBadge}</td>
          <td class="log-path">
            <span class="path-text" title="${escapeHtml(log.request_path || '')}">${escapeHtml(log.request_path || '-')}</span>
          </td>
          <td class="log-ip">${escapeHtml(log.request_ip || '-')}</td>
          <td class="text-center">
            <button type="button" class="btn btn-sm btn-outline-primary btn-view-detail" data-log-id="${log.id}" ${hasExtraData ? '' : 'disabled'}>
              <i class="bi bi-eye"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    bindTableEvents();
  }

  function bindTableEvents() {
    const tbody = document.getElementById('logTableBody');
    if (!tbody) {
      return;
    }
    
    tbody.querySelectorAll('.btn-view-detail:not([disabled])').forEach(function(btn) {
      btn.addEventListener('click', function(event) {
        event.stopPropagation();
        const logId = parseInt(btn.getAttribute('data-log-id'));
        const log = state.logs.find(l => l.id === logId);
        if (log) {
          showLogDetail(log);
        }
      });
    });
  }

  function showLogDetail(log) {
    state.selectedLog = log;
    const content = document.getElementById('logDetailContent');
    if (!content) {
      return;
    }
    
    const extraDataItems = Object.entries(log.extra_data || {}).map(function([key, value]) {
      const valueStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      return `
        <div class="col-12">
          <div class="log-detail-item">
            <label>${escapeHtml(key)}</label>
            <pre class="mb-0">${escapeHtml(valueStr)}</pre>
          </div>
        </div>
      `;
    }).join('');
    
    content.innerHTML = `
      <div class="col-md-6">
        <div class="log-detail-item">
          <label>操作时间</label>
          <div>${escapeHtml(log.created_at || '-')}</div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="log-detail-item">
          <label>操作人</label>
          <div>${escapeHtml(log.operator_name || '-')} (ID: ${log.operator_id || '-'})</div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="log-detail-item">
          <label>模块</label>
          <div>${escapeHtml(log.module || '-')}</div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="log-detail-item">
          <label>操作</label>
          <div>${escapeHtml(log.action || '-')}</div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="log-detail-item">
          <label>请求方法</label>
          <div>${getMethodBadge(log.request_method)}</div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="log-detail-item">
          <label>IP地址</label>
          <div>${escapeHtml(log.request_ip || '-')}</div>
        </div>
      </div>
      <div class="col-12">
        <div class="log-detail-item">
          <label>请求路径</label>
          <div class="text-break">${escapeHtml(log.request_path || '-')}</div>
        </div>
      </div>
      ${extraDataItems || `
        <div class="col-12">
          <div class="log-detail-item">
            <label>额外数据</label>
            <div class="text-muted">无额外数据</div>
          </div>
        </div>
      `}
    `;
    
    if (logDetailModal) {
      logDetailModal.show();
    }
  }

  function populateModuleFilter() {
    const select = document.getElementById('filterModule');
    if (!select || !state.modules.length) {
      return;
    }
    const currentValue = select.value;
    const options = ['<option value="">全部模块</option>'].concat(
      state.modules.filter(Boolean).map(function(module) {
        return `<option value="${escapeHtml(module)}">${escapeHtml(module)}</option>`;
      })
    );
    select.innerHTML = options.join('');
    select.value = currentValue;
  }

  function populateActionFilter() {
    const select = document.getElementById('filterAction');
    if (!select || !state.actions.length) {
      return;
    }
    const currentValue = select.value;
    const options = ['<option value="">全部操作</option>'].concat(
      state.actions.filter(Boolean).map(function(action) {
        return `<option value="${escapeHtml(action)}">${escapeHtml(action)}</option>`;
      })
    );
    select.innerHTML = options.join('');
    select.value = currentValue;
  }

  function updatePaginationButtons() {
    const prevBtn = document.getElementById('btnPrevPage');
    const nextBtn = document.getElementById('btnNextPage');
    if (prevBtn) {
      prevBtn.disabled = state.page <= 1;
    }
    if (nextBtn) {
      nextBtn.disabled = state.page >= state.totalPages;
    }
  }

  function exportLogs() {
    if (!state.logs.length) {
      showAlert('当前没有可导出的日志数据', '提示', 'warning');
      return;
    }
    
    const header = ['时间', '操作人', '模块', '操作', '方法', '路径', 'IP地址'];
    const rows = state.logs.map(function(log) {
      return [
        log.created_at || '',
        log.operator_name || '',
        log.module || '',
        log.action || '',
        log.request_method || '',
        log.request_path || '',
        log.request_ip || ''
      ];
    });
    
    const csv = [header].concat(rows).map(function(row) {
      return row.map(function(cell) {
        return '"' + String(cell).replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\n');
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'operation_logs_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function getMethodBadge(method) {
    const m = (method || '').toUpperCase();
    let badgeClass = 'bg-secondary';
    if (m === 'GET') badgeClass = 'bg-info text-dark';
    else if (m === 'POST') badgeClass = 'bg-success';
    else if (m === 'PUT' || m === 'PATCH') badgeClass = 'bg-warning text-dark';
    else if (m === 'DELETE') badgeClass = 'bg-danger';
    return `<span class="badge ${badgeClass}">${escapeHtml(m || '-')}</span>`;
  }

  function getInitial(value) {
    const text = String(value || '').trim();
    return text ? text.charAt(0).toUpperCase() : 'U';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  }

  function getValue(id) {
    const node = document.getElementById(id);
    return node ? node.value : '';
  }
})();
