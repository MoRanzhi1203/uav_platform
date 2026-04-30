(function() {
  const state = {
    users: [],
    filteredUsers: [],
    roles: [],
    selectedUserId: null,
    page: 1,
    pageSize: 8,
    filters: {
      keyword: '',
      role: '',
      status: '',
      department: ''
    }
  };

  const userModalEl = document.getElementById('userModal');
  const userModal = userModalEl ? new bootstrap.Modal(userModalEl) : null;

  const USER_TYPE_LABELS = {
    super_admin: '超级管理员',
    dispatcher: '调度员',
    pilot: '飞手',
    forest_officer: '林区专员',
    agri_officer: '农田专员'
  };

  document.addEventListener('DOMContentLoaded', initPage);

  function initPage() {
    bindEvents();
    loadBaseData();
  }

  function bindEvents() {
    const filterForm = document.getElementById('userFilterForm');
    if (filterForm) {
      filterForm.addEventListener('submit', function(event) {
        event.preventDefault();
        collectFilters();
        state.page = 1;
        applyFilters();
      });
    }

    const resetBtn = document.getElementById('btnResetFilters');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetFilters);
    }

    const addBtn = document.getElementById('btnAddUser');
    if (addBtn) {
      addBtn.addEventListener('click', openCreateModal);
    }

    const saveBtn = document.getElementById('btnSaveUser');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveUser);
    }

    const refreshBtn = document.getElementById('btnRefreshUsers');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadUsers);
    }

    const exportBtn = document.getElementById('btnExportUsers');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportUsers);
    }

    bindPagination();
    bindDetailActions();
  }

  function bindPagination() {
    const prevBtn = document.getElementById('btnPrevPage');
    const nextBtn = document.getElementById('btnNextPage');
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        if (state.page > 1) {
          state.page -= 1;
          renderUserTable();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        const totalPages = getTotalPages();
        if (state.page < totalPages) {
          state.page += 1;
          renderUserTable();
        }
      });
    }
  }

  function bindDetailActions() {
    const editBtn = document.getElementById('btnEditCurrentUser');
    const toggleBtn = document.getElementById('btnToggleCurrentUser');
    const resetPwdBtn = document.getElementById('btnResetCurrentPassword');
    const deleteBtn = document.getElementById('btnDeleteCurrentUser');

    if (editBtn) {
      editBtn.addEventListener('click', function() {
        const user = getSelectedUser();
        if (user) {
          openEditModal(user);
        }
      });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleCurrentUserStatus);
    }

    if (resetPwdBtn) {
      resetPwdBtn.addEventListener('click', resetCurrentUserPassword);
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', deleteCurrentUser);
    }
  }

  function loadBaseData() {
    renderRoleCheckboxes([]);
    Promise.all([loadRoles(), loadUsers()]).catch(function(error) {
      console.error('初始化用户管理模块失败:', error);
    });
  }

  function loadRoles() {
    return new Promise(function(resolve, reject) {
      Http.get('/api/system/roles/', {}, function(data) {
        state.roles = Array.isArray(data) ? data : [];
        populateRoleFilter();
        renderRoleCheckboxes(state.roles);
        resolve(state.roles);
      }).fail(function(xhr, status, error) {
        reject(error || status || xhr);
      });
    });
  }

  function loadUsers() {
    Common.showLoading('.user-table-card .card-body');
    const params = collectFilters();
    return new Promise(function(resolve, reject) {
      Http.get('/api/system/users/', params, function(data) {
        state.users = Array.isArray(data) ? data : [];
        applyFilters(false);
        Common.hideLoading('.user-table-card .card-body');
        resolve(state.users);
      }).fail(function(xhr, status, error) {
        Common.hideLoading('.user-table-card .card-body');
        reject(error || status || xhr);
      });
    });
  }

  function collectFilters() {
    state.filters.keyword = getValue('filterKeyword');
    state.filters.role = getValue('filterRole');
    state.filters.status = getValue('filterStatus');
    state.filters.department = getValue('filterDepartment');
    return {
      keyword: state.filters.keyword,
      role: state.filters.role,
      status: state.filters.status,
      department: state.filters.department
    };
  }

  function resetFilters() {
    ['filterKeyword', 'filterRole', 'filterStatus', 'filterDepartment'].forEach(function(id) {
      const node = document.getElementById(id);
      if (node) {
        node.value = '';
      }
    });
    collectFilters();
    state.page = 1;
    loadUsers();
  }

  function applyFilters(updateRemote) {
    if (updateRemote !== false) {
      collectFilters();
    }
    state.filteredUsers = state.users.slice();
    syncSelectedUser();
    renderStats();
    renderUserTable();
    renderSummaries();
    updateFilterSummary();
  }

  function renderStats() {
    const total = state.users.length;
    const active = state.users.filter(function(item) {
      return item.is_active;
    }).length;
    const admin = state.users.filter(function(item) {
      return item.user_type === 'super_admin' || (item.roles || []).indexOf('super_admin') !== -1;
    }).length;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = state.users.filter(function(item) {
      const time = item.last_login ? new Date(item.last_login).getTime() : 0;
      return time && !Number.isNaN(time) && time >= sevenDaysAgo;
    }).length;

    setText('statTotalUsers', total);
    setText('statActiveUsers', active);
    setText('statAdminUsers', admin);
    setText('statRecentUsers', recent);
  }

  function renderUserTable() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) {
      return;
    }

    const totalPages = getTotalPages();
    if (state.page > totalPages) {
      state.page = totalPages;
    }
    const pageUsers = getCurrentPageUsers();
    setText('userListCount', state.filteredUsers.length + ' 条');
    setText('userPaginationInfo', '第 ' + state.page + ' / ' + totalPages + ' 页');

    if (!pageUsers.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">暂无符合条件的用户数据</td></tr>';
      renderDetail(null);
      return;
    }

    tbody.innerHTML = pageUsers.map(function(user) {
      const roleChips = renderRoleTextChips(user.roles, 2);
      const statusClass = user.is_active ? 'user-status-active' : 'user-status-inactive';
      const statusText = user.is_active ? '启用' : '停用';
      const selectedClass = user.id === state.selectedUserId ? 'is-selected' : '';
      return `
        <tr class="${selectedClass}" data-user-id="${user.id}">
          <td>
            <div class="user-name-cell">
              <span class="user-avatar-sm">${getInitial(user.real_name || user.username)}</span>
              <div class="user-name-meta">
                <strong>${escapeHtml(user.username || '-')}</strong>
                <span class="text-muted">${escapeHtml(user.email || '未填写邮箱')}</span>
              </div>
            </div>
          </td>
          <td>${escapeHtml(user.real_name || '-')}</td>
          <td>${roleChips || '<span class="text-muted">未配置</span>'}</td>
          <td>${escapeHtml(user.department || '-')}</td>
          <td><span class="user-status-badge ${statusClass}">${statusText}</span></td>
          <td>${formatDateTime(user.last_login)}</td>
          <td class="text-end">
            <div class="user-table-action-group">
              <button type="button" class="btn btn-sm btn-outline-primary action-edit" data-user-id="${user.id}">编辑</button>
              <button type="button" class="btn btn-sm btn-outline-secondary action-toggle" data-user-id="${user.id}">${user.is_active ? '停用' : '启用'}</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    bindTableEvents();
    if (!getSelectedUser() && pageUsers.length) {
      selectUser(pageUsers[0].id);
    } else {
      renderDetail(getSelectedUser());
    }
  }

  function bindTableEvents() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) {
      return;
    }
    tbody.querySelectorAll('tr[data-user-id]').forEach(function(row) {
      row.addEventListener('click', function(event) {
        if (event.target.closest('button')) {
          return;
        }
        selectUser(Number(row.getAttribute('data-user-id')));
      });
    });

    tbody.querySelectorAll('.action-edit').forEach(function(btn) {
      btn.addEventListener('click', function(event) {
        event.stopPropagation();
        const user = findUserById(Number(btn.getAttribute('data-user-id')));
        if (user) {
          openEditModal(user);
        }
      });
    });

    tbody.querySelectorAll('.action-toggle').forEach(function(btn) {
      btn.addEventListener('click', function(event) {
        event.stopPropagation();
        const user = findUserById(Number(btn.getAttribute('data-user-id')));
        if (user) {
          toggleUserStatus(user);
        }
      });
    });
  }

  function selectUser(userId) {
    state.selectedUserId = userId;
    renderUserTable();
  }

  function renderDetail(user) {
    const emptyNode = document.getElementById('userDetailEmpty');
    const contentNode = document.getElementById('userDetailContent');
    if (!user) {
      if (emptyNode) {
        emptyNode.classList.remove('d-none');
      }
      if (contentNode) {
        contentNode.classList.add('d-none');
      }
      setText('detailStatusBadge', '未选择');
      return;
    }

    if (emptyNode) {
      emptyNode.classList.add('d-none');
    }
    if (contentNode) {
      contentNode.classList.remove('d-none');
    }

    setText('detailStatusBadge', user.is_active ? '启用中' : '已停用');
    setText('detailAvatar', getInitial(user.real_name || user.username));
    setText('detailRealName', user.real_name || '-');
    setText('detailUsername', '@' + (user.username || '-'));
    setText('detailPhone', user.phone || '-');
    setText('detailEmail', user.email || '-');
    setText('detailDepartment', user.department || '-');
    setText('detailRegion', user.region || '-');
    setText('detailUserType', USER_TYPE_LABELS[user.user_type] || user.user_type || '-');
    setText('detailLastLogin', formatDateTime(user.last_login));
    setText('detailRemark', user.remark || '暂无备注');
    setText('detailLoginIp', user.last_login_ip || '-');
    setText('detailCreatedAt', formatDateTime(user.created_at));

    const rolesNode = document.getElementById('detailRoles');
    if (rolesNode) {
      rolesNode.innerHTML = renderRoleTextChips(user.roles) || '<span class="text-muted small">未分配角色</span>';
    }

    const toggleBtn = document.getElementById('btnToggleCurrentUser');
    if (toggleBtn) {
      toggleBtn.innerHTML = user.is_active
        ? '<i class="bi bi-person-lock"></i> 停用账号'
        : '<i class="bi bi-person-check"></i> 启用账号';
    }
  }

  function renderSummaries() {
    renderRoleSummary();
    renderDepartmentSummary();
  }

  function renderRoleSummary() {
    const counts = {};
    state.users.forEach(function(user) {
      const roles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.user_type || '未分类'];
      roles.forEach(function(role) {
        counts[role] = (counts[role] || 0) + 1;
      });
    });
    renderSummaryList('roleSummaryList', 'roleSummaryMeta', counts, '类');
  }

  function renderDepartmentSummary() {
    const counts = {};
    state.users.forEach(function(user) {
      const department = user.department || '未分配部门';
      counts[department] = (counts[department] || 0) + 1;
    });
    renderSummaryList('departmentSummaryList', 'departmentSummaryMeta', counts, '个部门');
  }

  function renderSummaryList(containerId, metaId, counts, suffix) {
    const container = document.getElementById(containerId);
    const keys = Object.keys(counts).sort(function(a, b) {
      return counts[b] - counts[a];
    });
    setText(metaId, keys.length + ' ' + suffix);
    if (!container) {
      return;
    }
    if (!keys.length) {
      container.innerHTML = '<div class="text-muted small">暂无数据</div>';
      return;
    }
    container.innerHTML = keys.map(function(key) {
      return `
        <div class="summary-item">
          <strong>${escapeHtml(formatRoleLabel(key))}</strong>
          <span>${counts[key]} 人</span>
        </div>
      `;
    }).join('');
  }

  function updateFilterSummary() {
    setText('userFilterSummary', '共 ' + state.users.length + ' 条，当前显示 ' + state.filteredUsers.length + ' 条');
  }

  function populateRoleFilter() {
    const select = document.getElementById('filterRole');
    if (!select) {
      return;
    }
    const currentValue = select.value;
    const options = ['<option value="">全部角色</option>'].concat(
      state.roles.map(function(role) {
        return `<option value="${escapeHtml(role.role_code)}">${escapeHtml(role.role_name || role.role_code)}</option>`;
      })
    );
    select.innerHTML = options.join('');
    select.value = currentValue;
  }

  function renderRoleCheckboxes(roles) {
    const container = document.getElementById('roleCheckboxList');
    if (!container) {
      return;
    }
    if (!roles.length) {
      container.innerHTML = '<span class="text-muted small">暂无角色配置数据</span>';
      return;
    }
    container.innerHTML = roles.map(function(role) {
      return `
        <label class="role-checkbox-item">
          <input type="checkbox" name="roleCheckbox" value="${escapeHtml(role.role_code)}">
          <span>${escapeHtml(role.role_name || role.role_code)}</span>
        </label>
      `;
    }).join('');
  }

  function openCreateModal() {
    resetUserForm();
    setText('userModalLabel', '新增用户');
    if (userModal) {
      userModal.show();
    }
  }

  function openEditModal(user) {
    resetUserForm();
    setText('userModalLabel', '编辑用户');
    setValue('userId', user.id);
    setValue('formUsername', user.username);
    setValue('formRealName', user.real_name);
    setValue('formPhone', user.phone);
    setValue('formEmail', user.email);
    setValue('formUserType', user.user_type || 'dispatcher');
    setValue('formDepartment', user.department);
    setValue('formRegion', user.region);
    setValue('formRemark', user.remark);
    const isActiveNode = document.getElementById('formIsActive');
    if (isActiveNode) {
      isActiveNode.checked = !!user.is_active;
    }
    setCheckedRoles(user.roles || []);
    if (userModal) {
      userModal.show();
    }
  }

  function resetUserForm() {
    const form = document.getElementById('userForm');
    if (form) {
      form.reset();
    }
    setValue('userId', '');
    setValue('formUserType', 'dispatcher');
    const isActiveNode = document.getElementById('formIsActive');
    if (isActiveNode) {
      isActiveNode.checked = true;
    }
    setCheckedRoles([]);
  }

  function setCheckedRoles(roles) {
    document.querySelectorAll('input[name="roleCheckbox"]').forEach(function(node) {
      node.checked = roles.indexOf(node.value) !== -1;
    });
  }

  function getCheckedRoles() {
    return Array.prototype.slice.call(document.querySelectorAll('input[name="roleCheckbox"]:checked')).map(function(node) {
      return node.value;
    });
  }

  function saveUser() {
    const userId = getValue('userId');
    const payload = {
      username: getValue('formUsername').trim(),
      real_name: getValue('formRealName').trim(),
      phone: getValue('formPhone').trim(),
      email: getValue('formEmail').trim(),
      user_type: getValue('formUserType'),
      password: getValue('formPassword').trim(),
      department: getValue('formDepartment').trim(),
      region: getValue('formRegion').trim(),
      remark: getValue('formRemark').trim(),
      roles: getCheckedRoles(),
      is_active: !!document.getElementById('formIsActive')?.checked
    };

    if (!payload.username || !payload.real_name) {
      showAlert('请先填写用户名和姓名。', '提示', 'warning');
      return;
    }

    const request = userId
      ? Http.put('/api/system/users/' + userId + '/', payload, onUserSaved)
      : Http.post('/api/system/users/create/', payload, onUserSaved);

    request.fail(function(xhr) {
      const message = xhr.responseJSON?.msg || xhr.responseJSON?.message || '保存失败，请重试';
      showAlert(message, '保存失败', 'danger');
    });
  }

  function onUserSaved() {
    if (userModal) {
      userModal.hide();
    }
    Common.showMessage('用户信息已保存', 'success');
    loadUsers();
  }

  function toggleCurrentUserStatus() {
    const user = getSelectedUser();
    if (user) {
      toggleUserStatus(user);
    }
  }

  function toggleUserStatus(user) {
    const targetStatus = !user.is_active;
    showConfirm(
      '确认要' + (targetStatus ? '启用' : '停用') + '用户“' + user.username + '”吗？',
      function() {
        Http.post('/api/system/users/' + user.id + '/toggle-active/', { is_active: targetStatus }, function(data) {
          Common.showMessage('账号状态已更新', 'success');
          state.selectedUserId = data.id;
          loadUsers();
        }).fail(function(xhr) {
          const message = xhr.responseJSON?.msg || '状态更新失败';
          showAlert(message, '操作失败', 'danger');
        });
      },
      null,
      '确认操作',
      'warning'
    );
  }

  function resetCurrentUserPassword() {
    const user = getSelectedUser();
    if (!user) {
      return;
    }
    showPrompt('请输入新的登录密码', '123456', function(value) {
      if (value === null) {
        return;
      }
      const password = String(value || '').trim();
      if (!password) {
        showAlert('密码不能为空。', '提示', 'warning');
        return;
      }
      Http.post('/api/system/users/' + user.id + '/reset-password/', { password: password }, function() {
        Common.showMessage('密码已重置', 'success');
      }).fail(function(xhr) {
        const message = xhr.responseJSON?.msg || '密码重置失败';
        showAlert(message, '操作失败', 'danger');
      });
    }, '重置密码');
  }

  function deleteCurrentUser() {
    const user = getSelectedUser();
    if (!user) {
      return;
    }
    showConfirm(
      '删除后不可恢复，确认删除用户“' + user.username + '”吗？',
      function() {
        Http.delete('/api/system/users/' + user.id + '/delete/', function() {
          Common.showMessage('用户已删除', 'success');
          state.selectedUserId = null;
          loadUsers();
        }).fail(function(xhr) {
          const message = xhr.responseJSON?.msg || '删除失败';
          showAlert(message, '操作失败', 'danger');
        });
      },
      null,
      '删除用户',
      'danger'
    );
  }

  function exportUsers() {
    if (!state.filteredUsers.length) {
      showAlert('当前没有可导出的用户数据。', '提示', 'warning');
      return;
    }

    const header = ['用户名', '姓名', '手机号', '邮箱', '用户类型', '角色', '部门', '区域', '状态', '最近登录'];
    const rows = state.filteredUsers.map(function(user) {
      return [
        user.username || '',
        user.real_name || '',
        user.phone || '',
        user.email || '',
        USER_TYPE_LABELS[user.user_type] || user.user_type || '',
        (user.roles || []).map(formatRoleLabel).join('/'),
        user.department || '',
        user.region || '',
        user.is_active ? '启用' : '停用',
        user.last_login || ''
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
    link.download = 'user-management-export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function syncSelectedUser() {
    const current = getSelectedUser();
    if (!current && state.filteredUsers.length) {
      state.selectedUserId = state.filteredUsers[0].id;
    }
    if (!state.filteredUsers.length) {
      state.selectedUserId = null;
    }
  }

  function getSelectedUser() {
    return findUserById(state.selectedUserId);
  }

  function findUserById(userId) {
    return state.filteredUsers.find(function(item) {
      return item.id === userId;
    }) || state.users.find(function(item) {
      return item.id === userId;
    }) || null;
  }

  function getCurrentPageUsers() {
    const start = (state.page - 1) * state.pageSize;
    return state.filteredUsers.slice(start, start + state.pageSize);
  }

  function getTotalPages() {
    return Math.max(1, Math.ceil(state.filteredUsers.length / state.pageSize));
  }

  function renderRoleTextChips(roles, limit) {
    if (!Array.isArray(roles) || !roles.length) {
      return '';
    }
    const visible = typeof limit === 'number' ? roles.slice(0, limit) : roles;
    const chips = visible.map(function(role) {
      return '<span class="user-role-chip">' + escapeHtml(formatRoleLabel(role)) + '</span>';
    }).join('');
    if (typeof limit === 'number' && roles.length > limit) {
      return chips + '<span class="user-role-chip">+' + (roles.length - limit) + '</span>';
    }
    return chips;
  }

  function formatRoleLabel(roleCode) {
    const matchedRole = state.roles.find(function(role) {
      return role.role_code === roleCode;
    });
    if (matchedRole) {
      return matchedRole.role_name || matchedRole.role_code;
    }
    return USER_TYPE_LABELS[roleCode] || roleCode || '未配置';
  }

  function formatDateTime(value) {
    if (!value) {
      return '--';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getInitial(value) {
    const text = String(value || '').trim();
    return text ? text.charAt(0).toUpperCase() : 'U';
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

  function setValue(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.value = value == null ? '' : value;
    }
  }
})();
