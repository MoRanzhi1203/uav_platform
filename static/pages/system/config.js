(function() {
  const FIELD_KEYS = [
    "platform_name",
    "deployment_region",
    "timezone",
    "data_refresh_interval",
    "default_map_zoom",
    "session_timeout_hours",
    "password_min_length",
    "require_strong_password",
    "enable_login_captcha",
    "allow_multi_login",
    "enable_risk_alert",
    "enable_sms_notice",
    "enable_email_notice",
    "alert_response_minutes",
    "enable_auto_dispatch",
    "task_concurrency_limit",
    "return_home_battery",
    "default_map_layer",
    "log_retention_days",
    "telemetry_retention_days",
    "enable_auto_backup",
    "backup_cycle"
  ];

  const GROUP_SECTION_MAP = {
    platform: "section-platform",
    security: "section-security",
    notification: "section-notification",
    dispatch: "section-dispatch",
    data: "section-data"
  };

  const state = {
    bundle: null,
    originalValues: {},
    dirtyValues: {}
  };

  document.addEventListener("DOMContentLoaded", initPage);

  function initPage() {
    bindEvents();
    loadSettings();
  }

  function bindEvents() {
    const saveBtn = document.getElementById("btnSaveSettings");
    const refreshBtn = document.getElementById("btnRefreshSettings");
    const resetAllBtn = document.getElementById("btnResetAllSettings");

    if (saveBtn) {
      saveBtn.addEventListener("click", saveSettings);
    }
    if (refreshBtn) {
      refreshBtn.addEventListener("click", loadSettings);
    }
    if (resetAllBtn) {
      resetAllBtn.addEventListener("click", function() {
        resetSettings("");
      });
    }

    document.querySelectorAll(".btn-reset-group").forEach(function(button) {
      button.addEventListener("click", function() {
        resetSettings(button.getAttribute("data-group") || "");
      });
    });

    FIELD_KEYS.forEach(function(key) {
      const node = document.getElementById(key);
      if (!node) {
        return;
      }
      const eventName = node.type === "checkbox" ? "change" : "input";
      node.addEventListener(eventName, updateDirtyState);
      if (node.tagName === "SELECT") {
        node.addEventListener("change", updateDirtyState);
      }
    });
  }

  function loadSettings() {
    Common.showLoading("body");
    Http.get("/api/system/settings/", {}, function(data) {
      state.bundle = data || {};
      state.originalValues = Object.assign({}, data?.values || {});
      fillForm(state.originalValues);
      updateDirtyState();
      renderOverview();
      Common.hideLoading("body");
    }).fail(function(xhr) {
      Common.hideLoading("body");
      const message = xhr.responseJSON?.msg || "系统配置加载失败";
      showAlert(message, "加载失败", "danger");
    });
  }

  function fillForm(values) {
    FIELD_KEYS.forEach(function(key) {
      const node = document.getElementById(key);
      if (!node) {
        return;
      }
      const value = values[key];
      if (node.type === "checkbox") {
        node.checked = !!value;
      } else if (value !== undefined && value !== null) {
        node.value = value;
      } else {
        node.value = "";
      }
    });
  }

  function collectFormValues() {
    const values = {};
    FIELD_KEYS.forEach(function(key) {
      const node = document.getElementById(key);
      if (!node) {
        return;
      }
      if (node.type === "checkbox") {
        values[key] = !!node.checked;
      } else if (node.type === "number") {
        values[key] = node.value === "" ? "" : Number(node.value);
      } else {
        values[key] = node.value;
      }
    });
    return values;
  }

  function updateDirtyState() {
    const currentValues = collectFormValues();
    const dirtyValues = {};
    Object.keys(currentValues).forEach(function(key) {
      if (String(currentValues[key]) !== String(state.originalValues[key])) {
        dirtyValues[key] = currentValues[key];
      }
    });
    state.dirtyValues = dirtyValues;

    const dirtyCount = Object.keys(dirtyValues).length;
    const badge = document.getElementById("settingsDirtyBadge");
    if (badge) {
      badge.textContent = dirtyCount ? "待保存 " + dirtyCount + " 项" : "无变更";
      badge.className = dirtyCount
        ? "badge bg-warning text-dark border"
        : "badge bg-light text-primary border";
    }

    renderHighlights(currentValues);
    renderAdvice(currentValues);
  }

  function saveSettings() {
    const currentValues = collectFormValues();
    Http.post("/api/system/settings/save/", { values: currentValues }, function(data) {
      state.bundle = data || {};
      state.originalValues = Object.assign({}, data?.values || currentValues);
      fillForm(state.originalValues);
      updateDirtyState();
      renderOverview();
      Common.showMessage("系统配置已保存", "success");
    }).fail(function(xhr) {
      const message = xhr.responseJSON?.msg || "保存失败，请稍后重试";
      showAlert(message, "保存失败", "danger");
    });
  }

  function resetSettings(group) {
    const message = group ? "确认恢复该分组默认配置吗？" : "确认恢复全部系统默认配置吗？";
    showConfirm(
      message,
      function() {
        Http.post("/api/system/settings/reset/", { group: group }, function(data) {
          state.bundle = data || {};
          state.originalValues = Object.assign({}, data?.values || {});
          fillForm(state.originalValues);
          updateDirtyState();
          renderOverview();
          Common.showMessage("系统配置已恢复默认值", "success");
        }).fail(function(xhr) {
          const text = xhr.responseJSON?.msg || "恢复默认失败";
          showAlert(text, "操作失败", "danger");
        });
      },
      null,
      "恢复默认",
      "warning"
    );
  }

  function renderOverview() {
    const stats = state.bundle?.stats || {};
    setText("configGroupCount", stats.group_count || 0);
    setText("configItemCount", stats.item_count || 0);
    setText("configEnabledSwitchCount", stats.enabled_switch_count || 0);
    setText("configLastUpdated", stats.last_updated || "--");

    renderGroupSummary(state.bundle?.groups || []);
    renderHighlights(collectFormValues());
    renderAdvice(collectFormValues());
  }

  function renderGroupSummary(groups) {
    const container = document.getElementById("configGroupSummary");
    if (!container) {
      return;
    }
    if (!groups.length) {
      container.innerHTML = '<div class="text-muted small">暂无配置分组</div>';
      return;
    }

    container.innerHTML = groups.map(function(group) {
      const anchor = "#" + (GROUP_SECTION_MAP[group.key] || "");
      return `
        <a class="config-summary-item config-summary-anchor" href="${anchor}">
          <div>
            <strong>${escapeHtml(group.title)}</strong>
            <div><span>${escapeHtml(group.description || "")}</span></div>
          </div>
          <span>${group.item_count || 0} 项</span>
        </a>
      `;
    }).join("");
  }

  function renderHighlights(values) {
    const container = document.getElementById("configHighlights");
    if (!container) {
      return;
    }
    const items = [
      ["平台名称", values.platform_name || "--"],
      ["系统时区", values.timezone || "--"],
      ["会话时长", (values.session_timeout_hours || "--") + " 小时"],
      ["风险告警", values.enable_risk_alert ? "已启用" : "已关闭"],
      ["自动调度", values.enable_auto_dispatch ? "已启用" : "已关闭"],
      ["自动备份", values.enable_auto_backup ? "已启用" : "已关闭"],
      ["默认底图", formatMapLayer(values.default_map_layer)],
      ["备份周期", formatBackupCycle(values.backup_cycle)]
    ];

    container.innerHTML = items.map(function(item) {
      return `
        <div class="config-highlight-item">
          <strong>${escapeHtml(item[0])}</strong>
          <div><em>${escapeHtml(item[1])}</em></div>
        </div>
      `;
    }).join("");
  }

  function renderAdvice(values) {
    const container = document.getElementById("configAdviceList");
    if (!container) {
      return;
    }
    const advice = [];

    if ((values.password_min_length || 0) < 8) {
      advice.push("建议将密码最小长度设置为 8 位及以上，以提高账号安全性。");
    }
    if (!values.require_strong_password) {
      advice.push("当前未启用强密码策略，建议在正式环境中开启。");
    }
    if (!values.enable_risk_alert) {
      advice.push("风险告警已关闭，可能导致高风险区域变化无法及时提醒。");
    }
    if ((values.return_home_battery || 0) < 20) {
      advice.push("返航电量阈值偏低，建议设置在 20% 以上以降低飞行风险。");
    }
    if ((values.log_retention_days || 0) < 90) {
      advice.push("日志保留天数偏短，建议至少保留 90 天以便审计追踪。");
    }
    if (!values.enable_auto_backup) {
      advice.push("当前未启用自动备份，建议在生产环境开启该策略。");
    }
    if (!advice.length) {
      advice.push("当前系统配置整体较为合理，可继续结合实际运行情况微调。");
    }

    container.innerHTML = advice.map(function(text) {
      return `<div class="config-advice-item"><span>${escapeHtml(text)}</span></div>`;
    }).join("");
  }

  function formatMapLayer(value) {
    const labels = {
      satellite: "卫星图",
      vector: "矢量图",
      terrain: "地形图"
    };
    return labels[value] || value || "--";
  }

  function formatBackupCycle(value) {
    const labels = {
      daily: "每天",
      weekly: "每周",
      monthly: "每月"
    };
    return labels[value] || value || "--";
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
