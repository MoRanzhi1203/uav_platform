(function () {
    const DRONE_API_URL = "/fleet/api/drones/";
    const state = {
        page: 1,
        pageSize: 10,
        filters: {
            keyword: "",
            status: "",
            region: "",
            pilot: "",
        },
    };

    function init() {
        bindEvents();
        loadDrones();
        window.setInterval(function () {
            loadDrones(true);
        }, 60000);
    }

    function bindEvents() {
        const keywordInput = document.getElementById("fleet-keyword");
        const pageSizeSelect = document.getElementById("fleet-page-size");

        bindIfExists("fleet-query-btn", "click", function () {
            syncFiltersFromForm();
            state.page = 1;
            loadDrones();
        });
        bindIfExists("fleet-reset-btn", "click", function () {
            const form = document.getElementById("fleet-filter-form");
            if (form) {
                form.reset();
            }
            state.page = 1;
            state.pageSize = Number(pageSizeSelect ? pageSizeSelect.value : 10) || 10;
            state.filters = { keyword: "", status: "", region: "", pilot: "" };
            loadDrones();
        });
        bindIfExists("fleet-export-list-btn", "click", function () {
            exportData(DRONE_API_URL, buildQuery(true));
        });
        bindIfExists("fleet-prev-page", "click", function () {
            if (state.page > 1) {
                state.page -= 1;
                loadDrones();
            }
        });
        bindIfExists("fleet-next-page", "click", function () {
            const nextButton = document.getElementById("fleet-next-page");
            const totalPages = Number(nextButton ? nextButton.dataset.totalPages || 1 : 1);
            if (state.page < totalPages) {
                state.page += 1;
                loadDrones();
            }
        });

        ["fleet-status", "fleet-region", "fleet-pilot"].forEach(function (id) {
            bindIfExists(id, "change", function () {
                syncFiltersFromForm();
                state.page = 1;
                loadDrones();
            });
        });

        if (pageSizeSelect) {
            pageSizeSelect.addEventListener("change", function () {
                state.pageSize = Number(pageSizeSelect.value) || 10;
                state.page = 1;
                loadDrones();
            });
        }
        if (keywordInput) {
            keywordInput.addEventListener("input", debounce(function () {
                syncFiltersFromForm();
                state.page = 1;
                loadDrones();
            }, 400));
        }

        document.querySelectorAll(".fleet-refresh-btn").forEach(function (button) {
            button.addEventListener("click", function () {
                loadDrones();
            });
        });
    }

    function syncFiltersFromForm() {
        state.filters.keyword = getValue("fleet-keyword");
        state.filters.status = getValue("fleet-status");
        state.filters.region = getValue("fleet-region");
        state.filters.pilot = getValue("fleet-pilot");
    }

    function loadDrones(silent) {
        syncFiltersFromForm();
        return fetchJson(DRONE_API_URL, buildQuery(false)).then(function (data) {
            renderFilters(data.filters || {});
            renderStats(data.summary || {});
            renderTable(data.items || []);
            renderPagination(data.pagination || {});
            return data;
        }).catch(function (error) {
            if (!silent) {
                handleError(error);
            }
        });
    }

    function buildQuery(isExport) {
        const params = {
            page: state.page,
            page_size: state.pageSize,
            keyword: state.filters.keyword,
            status: state.filters.status,
            region: state.filters.region,
            pilot: state.filters.pilot,
        };
        if (isExport) {
            params.export = "csv";
        }
        return params;
    }

    function renderFilters(filters) {
        fillSelect("fleet-status", filters.statuses || [], "value", "label", true);
        fillSelect("fleet-pilot", filters.pilots || [], "id", "name", true);
        fillSelect(
            "fleet-region",
            (filters.regions || []).map(function (item) {
                return { value: item, label: item };
            }),
            "value",
            "label",
            true
        );
        setValue("fleet-status", state.filters.status);
        setValue("fleet-pilot", state.filters.pilot);
        setValue("fleet-region", state.filters.region);
    }

    function renderStats(summary) {
        setText("fleet-stat-total", summary.drone_total || 0);
        setText("fleet-stat-online", formatPercent(summary.online_rate || 0));
        setText("fleet-stat-pilot", summary.pilot_total || 0);
        setText("fleet-stat-active", summary.active_tasks || 0);
    }

    function renderTable(items) {
        const tbody = document.getElementById("fleet-drone-tbody");
        if (!tbody) {
            return;
        }
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">暂无无人机数据</td></tr>';
            return;
        }
        tbody.innerHTML = items.map(function (item) {
            return '' +
                '<tr>' +
                    '<td><div class="ops-entity-title">' + escapeHtml(item.name || "-") + '</div><div class="ops-entity-meta">' + escapeHtml(item.drone_code || "-") + ' · ' + escapeHtml(item.model_name || item.model || "-") + '</div></td>' +
                    '<td>' + buildStatusBadge(item.status) + buildBatteryCell(item.battery_percentage || item.battery) + '</td>' +
                    '<td><div class="ops-cell-primary">' + escapeHtml(item.terrain_name || "-") + '</div><div class="ops-cell-subtle">' + escapeHtml(item.region || "-") + '</div></td>' +
                    '<td><div class="ops-cell-primary">' + escapeHtml(item.pilot_name || "-") + '</div><div class="ops-cell-subtle">' + escapeHtml(item.launch_site_name || "-") + '</div></td>' +
                    '<td><div class="ops-cell-primary">' + escapeHtml(String(item.task_count || 0)) + ' 个任务</div><div class="ops-cell-subtle">完成率 ' + escapeHtml(formatPercent(item.completion_rate || 0)) + ' · 飞行 ' + escapeHtml(String(item.flight_duration || 0)) + ' h</div></td>' +
                    '<td><div class="ops-cell-primary">' + escapeHtml(formatDateTime(item.last_active)) + '</div></td>' +
                    '<td><a class="btn btn-sm btn-primary" href="/fleet/detail/?endpoint=/api/fleet/drones/&id=' + encodeURIComponent(item.id) + '">详情</a></td>' +
                '</tr>';
        }).join("");
    }

    function renderPagination(pagination) {
        const totalPages = pagination.total_pages || 1;
        const prevButton = document.getElementById("fleet-prev-page");
        const nextButton = document.getElementById("fleet-next-page");
        const pageInfo = document.getElementById("fleet-page-info");
        if (pageInfo) {
            pageInfo.textContent = "第 " + (pagination.page || 1) + " / " + totalPages + " 页，共 " + (pagination.total || 0) + " 条";
        }
        if (prevButton) {
            prevButton.disabled = !pagination.has_previous;
        }
        if (nextButton) {
            nextButton.disabled = !pagination.has_next;
            nextButton.dataset.totalPages = totalPages;
        }
    }

    function normalizeStatusClass(status) {
        const value = String(status || "").trim().toLowerCase();
        if (value === "running") return "running";
        if (value === "online") return "online";
        if (value === "offline") return "offline";
        if (value === "abnormal" || value === "failed") return "abnormal";
        return "idle";
    }

    function formatStatus(status) {
        return {
            running: "执行中",
            online: "在线",
            offline: "离线",
            abnormal: "异常",
            idle: "待命",
        }[normalizeStatusClass(status)] || "待命";
    }

    function buildStatusBadge(status) {
        const className = normalizeStatusClass(status);
        return '<span class="ops-badge status-' + className + '"><span class="status-dot"></span>' + escapeHtml(formatStatus(status)) + '</span>';
    }

    function buildBatteryCell(value) {
        const percent = Math.max(0, Math.min(100, Number(value || 0)));
        const color = percent < 20 ? "#dc3545" : percent < 50 ? "#fd7e14" : "#198754";
        return '<div class="ops-battery-wrap"><div class="ops-battery-bar" style="width:' + percent + '%; background-color:' + color + ';"></div><span class="ops-battery-text">' + percent + '%</span></div>';
    }

    function fillSelect(id, items, valueKey, labelKey, keepEmpty) {
        const target = document.getElementById(id);
        if (!target) {
            return;
        }
        const currentValue = target.value;
        const options = [];
        if (keepEmpty) {
            options.push('<option value="">全部</option>');
        }
        items.forEach(function (item) {
            options.push('<option value="' + escapeHtml(String(item[valueKey])) + '">' + escapeHtml(String(item[labelKey])) + "</option>");
        });
        target.innerHTML = options.join("");
        if (Array.from(target.options).some(function (option) { return option.value === currentValue; })) {
            target.value = currentValue;
        }
    }

    function fetchJson(url, params) {
        const search = new URLSearchParams();
        Object.keys(params || {}).forEach(function (key) {
            if (params[key] !== "" && params[key] !== null && params[key] !== undefined) {
                search.append(key, params[key]);
            }
        });
        return fetch((search.toString() ? url + "?" + search.toString() : url), {
            credentials: "same-origin",
            headers: buildRequestHeaders(),
        }).then(function (response) {
            return response.text().then(function (text) {
                const contentType = response.headers.get("content-type") || "";
                if (contentType.indexOf("application/json") === -1) {
                    throw new Error("接口未返回 JSON，可能返回了 HTML：" + text.slice(0, 120));
                }
                const payload = JSON.parse(text);
                if (payload.code === 0 || payload.success === true) {
                    return payload.data;
                }
                throw new Error(payload.error || payload.msg || payload.message || "请求失败");
            });
        });
    }

    function exportData(url, params) {
        const search = new URLSearchParams();
        Object.keys(params).forEach(function (key) {
            if (params[key] !== "" && params[key] !== null && params[key] !== undefined) {
                search.append(key, params[key]);
            }
        });
        window.open(url + "?" + search.toString(), "_blank");
    }

    function buildRequestHeaders() {
        const headers = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };
        const csrfToken = getCookie("csrftoken");
        if (csrfToken) {
            headers["X-CSRFToken"] = csrfToken;
        }
        return headers;
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            document.cookie.split(";").forEach(function (part) {
                const cookie = part.trim();
                if (cookie.substring(0, name.length + 1) === name + "=") {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                }
            });
        }
        return cookieValue;
    }

    function bindIfExists(id, eventName, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(eventName, handler);
        }
    }

    function getValue(id) {
        const element = document.getElementById(id);
        return element ? element.value.trim() : "";
    }

    function setValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value || "";
        }
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    function debounce(fn, delay) {
        let timer = null;
        return function () {
            const args = arguments;
            clearTimeout(timer);
            timer = window.setTimeout(function () {
                fn.apply(null, args);
            }, delay);
        };
    }

    function formatPercent(value) {
        return Number(value || 0).toFixed(0) + "%";
    }

    function formatDateTime(value) {
        if (!value) {
            return "-";
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        return date.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function escapeHtml(text) {
        return String(text)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }

    function handleError(error) {
        const message = error && error.message ? error.message : "加载失败";
        if (window.Common && Common.showMessage) {
            Common.showMessage(message, "error");
        }
        window.console.error(error);
    }

    document.addEventListener("DOMContentLoaded", init);
})();
