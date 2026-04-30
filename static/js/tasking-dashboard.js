(function () {
    const TASK_API_URL = "/tasking/api/tasks/";
    const state = {
        page: 1,
        pageSize: 10,
        filters: {
            keyword: "",
            status: "",
            type: "",
            region: "",
            drone: "",
            pilot: "",
            start_date: "",
            end_date: "",
        },
    };

    function init() {
        setDefaultDates();
        bindEvents();
        loadTasks();
        window.setInterval(function () {
            loadTasks(true);
        }, 60000);
    }

    function setDefaultDates() {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 29);
        setValue("tasking-start-date", formatInputDate(start));
        setValue("tasking-end-date", formatInputDate(end));
        state.filters.start_date = getValue("tasking-start-date");
        state.filters.end_date = getValue("tasking-end-date");
    }

    function bindEvents() {
        bindIfExists("tasking-query-btn", "click", function () {
            syncFiltersFromForm();
            state.page = 1;
            loadTasks();
        });
        bindIfExists("tasking-reset-btn", "click", function () {
            const form = document.getElementById("tasking-filter-form");
            if (form) {
                form.reset();
            }
            setDefaultDates();
            state.page = 1;
            state.pageSize = Number(getValue("tasking-task-page-size") || 10);
            state.filters = {
                keyword: "",
                status: "",
                type: "",
                region: "",
                drone: "",
                pilot: "",
                start_date: getValue("tasking-start-date"),
                end_date: getValue("tasking-end-date"),
            };
            loadTasks();
        });
        bindIfExists("tasking-export-task-btn", "click", function () {
            exportData(TASK_API_URL, buildQuery(true));
        });
        bindIfExists("tasking-prev-page", "click", function () {
            if (state.page > 1) {
                state.page -= 1;
                loadTasks();
            }
        });
        bindIfExists("tasking-next-page", "click", function () {
            const nextButton = document.getElementById("tasking-next-page");
            const totalPages = Number(nextButton ? nextButton.dataset.totalPages || 1 : 1);
            if (state.page < totalPages) {
                state.page += 1;
                loadTasks();
            }
        });

        ["tasking-status", "tasking-type", "tasking-region", "tasking-drone", "tasking-pilot", "tasking-start-date", "tasking-end-date"].forEach(function (id) {
            bindIfExists(id, "change", function () {
                syncFiltersFromForm();
                state.page = 1;
                loadTasks();
            });
        });

        bindIfExists("tasking-task-page-size", "change", function () {
            state.pageSize = Number(getValue("tasking-task-page-size") || 10);
            state.page = 1;
            loadTasks();
        });
        bindIfExists("tasking-keyword", "input", debounce(function () {
            syncFiltersFromForm();
            state.page = 1;
            loadTasks();
        }, 400));
        bindIfExists("tasking-card-refresh-btn", "click", function () {
            loadTasks();
        });
    }

    function syncFiltersFromForm() {
        state.filters.keyword = getValue("tasking-keyword");
        state.filters.status = getValue("tasking-status");
        state.filters.type = getValue("tasking-type");
        state.filters.region = getValue("tasking-region");
        state.filters.drone = getValue("tasking-drone");
        state.filters.pilot = getValue("tasking-pilot");
        state.filters.start_date = getValue("tasking-start-date");
        state.filters.end_date = getValue("tasking-end-date");
    }

    function loadTasks(silent) {
        syncFiltersFromForm();
        return fetchJson(TASK_API_URL, buildQuery(false)).then(function (data) {
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
            type: state.filters.type,
            region: state.filters.region,
            drone: state.filters.drone,
            pilot: state.filters.pilot,
            start_date: state.filters.start_date,
            end_date: state.filters.end_date,
        };
        if (isExport) {
            params.export = "csv";
        }
        return params;
    }

    function renderFilters(filters) {
        fillSelect("tasking-status", (filters.statuses || []).map(mapStringOption), "value", "label", true);
        fillSelect("tasking-type", (filters.types || []).map(mapStringOption), "value", "label", true);
        fillSelect("tasking-region", (filters.regions || []).map(mapStringOption), "value", "label", true);
        fillSelect("tasking-drone", filters.drones || [], "id", "name", true);
        fillSelect("tasking-pilot", filters.pilots || [], "id", "name", true);
        setValue("tasking-status", state.filters.status);
        setValue("tasking-type", state.filters.type);
        setValue("tasking-region", state.filters.region);
        setValue("tasking-drone", state.filters.drone);
        setValue("tasking-pilot", state.filters.pilot);
    }

    function renderStats(summary) {
        setText("tasking-stat-total", summary.task_total || 0);
        setText("tasking-stat-running", summary.running_total || 0);
        setText("tasking-stat-completed", summary.completed_total || 0);
        setText("tasking-stat-abnormal", summary.abnormal_total || 0);
    }

    function renderTable(items) {
        const tbody = document.getElementById("tasking-task-tbody");
        if (!tbody) {
            return;
        }
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">暂无任务数据</td></tr>';
            return;
        }
        tbody.innerHTML = items.map(function (item) {
            return '' +
                '<tr>' +
                    '<td>' + escapeHtml(item.name || "-") + '</td>' +
                    '<td>' + escapeHtml(item.type || "-") + '</td>' +
                    '<td><span class="ops-badge status-' + normalizeStatusClass(item.status) + '"><span class="status-dot"></span>' + escapeHtml(formatStatus(item.status)) + '</span></td>' +
                    '<td>' + escapeHtml(item.assigned_drone_name || "-") + '</td>' +
                    '<td>' + escapeHtml(item.assigned_pilot_name || "-") + '</td>' +
                    '<td>' + escapeHtml(formatDateTime(item.start_time)) + '</td>' +
                    '<td>' + escapeHtml(formatDateTime(item.end_time)) + '</td>' +
                    '<td><a class="btn btn-sm btn-primary" href="/tasking/detail/?endpoint=/api/tasking/global-tasks/&id=' + encodeURIComponent(item.id) + '">详情</a></td>' +
                '</tr>';
        }).join("");
    }

    function renderPagination(pagination) {
        const totalPages = pagination.total_pages || 1;
        const pageInfo = document.getElementById("tasking-page-info");
        const prevButton = document.getElementById("tasking-prev-page");
        const nextButton = document.getElementById("tasking-next-page");
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
        if (value === "completed") return "completed";
        if (value === "running") return "running";
        if (value === "abnormal" || value === "failed") return "abnormal";
        return "pending";
    }

    function formatStatus(status) {
        const value = normalizeStatusClass(status);
        return {
            completed: "已完成",
            running: "执行中",
            pending: "待执行",
            abnormal: "异常",
        }[value] || "待执行";
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

    function mapStringOption(item) {
        return { value: item, label: item };
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

    function formatInputDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
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
