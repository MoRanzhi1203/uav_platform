(function () {
    const TASKING_HISTORY_API_URL = "/tasking/api/history/";

    const state = {
        taskPage: 1,
        taskPageSize: 10,
        assignmentPage: 1,
        assignmentPageSize: 8,
        selectedTaskId: null,
        replayDate: "",
        mapDensity: "normal",
        chartSelection: {
            "已完成": true,
            "执行中": true,
            "待执行": true,
        },
        filters: {
            keyword: "",
            status: "",
            type: "",
            region: "",
            drone: "",
            pilot: "",
            grain: "day",
            start_date: "",
            end_date: "",
        },
    };

    let chart = null;
    let map = null;
    let trackLayer = null;
    let heatLayer = null;

    function init() {
        setDefaultDates();
        bindEvents();
        initMap();
        loadDashboard();
        window.setInterval(refreshRealtime, 60000);
    }

    function setDefaultDates() {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 29);
        state.filters.start_date = formatInputDate(start);
        state.filters.end_date = formatInputDate(end);
        document.getElementById("tasking-start-date").value = state.filters.start_date;
        document.getElementById("tasking-end-date").value = state.filters.end_date;
    }

    function bindEvents() {
        document.getElementById("tasking-query-btn").addEventListener("click", function () {
            syncFiltersFromForm();
            state.taskPage = 1;
            state.assignmentPage = 1;
            loadDashboard();
        });
        document.getElementById("tasking-reset-btn").addEventListener("click", function () {
            document.getElementById("tasking-filter-form").reset();
            setDefaultDates();
            state.filters.keyword = "";
            state.filters.status = "";
            state.filters.type = "";
            state.filters.region = "";
            state.filters.drone = "";
            state.filters.pilot = "";
            state.filters.grain = "day";
            state.selectedTaskId = null;
            state.taskPage = 1;
            state.assignmentPage = 1;
            state.replayDate = "";
            loadDashboard();
        });
        document.getElementById("tasking-export-task-btn").addEventListener("click", function () {
            exportData("/tasking/api/tasks/", buildTaskQuery(true));
        });
        document.getElementById("tasking-export-history-btn").addEventListener("click", function () {
            exportData("/tasking/api/task-history/", buildHistoryQuery(true));
        });
        document.getElementById("tasking-task-page-size").addEventListener("change", function (event) {
            state.taskPageSize = Number(event.target.value);
            state.taskPage = 1;
            loadTasks();
        });
        document.getElementById("tasking-assignment-page-size").addEventListener("change", function (event) {
            state.assignmentPageSize = Number(event.target.value);
            state.assignmentPage = 1;
            loadAssignments();
        });
        document.getElementById("tasking-prev-page").addEventListener("click", function () {
            if (state.taskPage > 1) {
                state.taskPage -= 1;
                loadTasks();
            }
        });
        document.getElementById("tasking-next-page").addEventListener("click", function () {
            const totalPages = Number(document.getElementById("tasking-next-page").dataset.totalPages || 1);
            if (state.taskPage < totalPages) {
                state.taskPage += 1;
                loadTasks();
            }
        });
        document.getElementById("tasking-assignment-prev-page").addEventListener("click", function () {
            if (state.assignmentPage > 1) {
                state.assignmentPage -= 1;
                loadAssignments();
            }
        });
        document.getElementById("tasking-assignment-next-page").addEventListener("click", function () {
            const totalPages = Number(document.getElementById("tasking-assignment-next-page").dataset.totalPages || 1);
            if (state.assignmentPage < totalPages) {
                state.assignmentPage += 1;
                loadAssignments();
            }
        });
        document.getElementById("tasking-replay-date").addEventListener("change", function (event) {
            state.replayDate = event.target.value;
            renderMap(window.__taskingHistoryDetail || null);
        });
        document.getElementById("tasking-map-density").addEventListener("change", function (event) {
            state.mapDensity = event.target.value || "normal";
            renderMap(window.__taskingHistoryDetail || null);
        });
        document.getElementById("tasking-card-refresh-btn").addEventListener("click", function () {
            loadDashboard();
        });
        document.getElementById("tasking-focus-alerts-btn").addEventListener("click", function () {
            state.filters.status = "abnormal";
            document.getElementById("tasking-status").value = "abnormal";
            state.taskPage = 1;
            state.assignmentPage = 1;
            loadDashboard();
        });
        bindLegendToggle();
    }

    function syncFiltersFromForm() {
        state.filters.keyword = document.getElementById("tasking-keyword").value.trim();
        state.filters.status = document.getElementById("tasking-status").value;
        state.filters.type = document.getElementById("tasking-type").value;
        state.filters.region = document.getElementById("tasking-region").value;
        state.filters.drone = document.getElementById("tasking-drone").value;
        state.filters.pilot = document.getElementById("tasking-pilot").value;
        state.filters.grain = document.getElementById("tasking-grain").value;
        state.filters.start_date = document.getElementById("tasking-start-date").value;
        state.filters.end_date = document.getElementById("tasking-end-date").value;
    }

    function initMap() {
        map = L.map("tasking-map", { zoomControl: true }).setView([29.56301, 106.55156], 10);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);
        trackLayer = L.layerGroup().addTo(map);
        heatLayer = L.layerGroup().addTo(map);
    }

    function fetchJson(url, params) {
        const search = new URLSearchParams();
        Object.keys(params || {}).forEach(function (key) {
            if (params[key] !== "" && params[key] !== null && params[key] !== undefined) {
                search.append(key, params[key]);
            }
        });
        const requestUrl = search.toString() ? url + "?" + search.toString() : url;
        return fetch(requestUrl, {
            credentials: "same-origin",
            headers: buildRequestHeaders(),
        }).then(function (response) {
            return response.text().then(function (text) {
                const contentType = response.headers.get("content-type") || "";
                if (contentType.indexOf("application/json") === -1) {
                    throw new Error("接口未返回 JSON，可能返回了 HTML：" + text.slice(0, 120));
                }
                let payload;
                try {
                    payload = JSON.parse(text);
                } catch (error) {
                    throw new Error("JSON 解析失败：" + error.message);
                }
                if (payload.success === true) {
                    return payload.data;
                }
                if (payload.code === 0) {
                    return payload.data;
                }
                throw new Error(payload.error || payload.msg || payload.message || "请求失败");
            });
        });
    }

    function buildTaskQuery(isExport) {
        const params = {
            page: state.taskPage,
            page_size: state.taskPageSize,
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

    function buildAssignmentQuery() {
        return {
            page: state.assignmentPage,
            page_size: state.assignmentPageSize,
            status: state.filters.status,
            region: state.filters.region,
            drone: state.filters.drone,
            pilot: state.filters.pilot,
        };
    }

    function buildHistoryQuery(isExport) {
        const params = {
            keyword: state.filters.keyword,
            status: state.filters.status,
            type: state.filters.type,
            region: state.filters.region,
            drone: state.filters.drone,
            pilot: state.filters.pilot,
            grain: state.filters.grain,
            start_date: state.filters.start_date,
            end_date: state.filters.end_date,
        };
        if (state.selectedTaskId) {
            params.task_id = state.selectedTaskId;
        }
        if (isExport) {
            params.export = "csv";
        }
        return params;
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(";");
            for (let i = 0; i < cookies.length; i += 1) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === name + "=") {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    function buildRequestHeaders() {
        const headers = {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
        };
        const csrfToken = getCookie("csrftoken");
        if (csrfToken) {
            headers["X-CSRFToken"] = csrfToken;
        }
        return headers;
    }

    function loadDashboard() {
        return Promise.all([loadTasks(), loadAssignments(), loadHistory()]).catch(handleError);
    }

    function refreshRealtime() {
        Promise.all([loadTasks(true), loadAssignments(true), loadHistory(true)]).catch(function () {});
    }

    function loadTasks(silent) {
        return fetchJson("/tasking/api/tasks/", buildTaskQuery(false)).then(function (data) {
            renderFilters(data.filters || {});
            renderTaskStats(data.summary || {});
            renderTaskTable(data.items || []);
            renderPagination("tasking", data.pagination || {});
            if (!silent && !state.selectedTaskId && data.items && data.items.length) {
                state.selectedTaskId = data.items[0].id;
                return loadHistory();
            }
            return data;
        }).catch(function (error) {
            if (!silent) {
                handleError(error);
            }
        });
    }

    function loadAssignments(silent) {
        return fetchJson("/tasking/api/assignments/", buildAssignmentQuery()).then(function (data) {
            renderAssignmentTable(data.items || []);
            renderPagination("tasking-assignment", data.pagination || {});
            return data;
        }).catch(function (error) {
            if (!silent) {
                handleError(error);
            }
        });
    }

    function loadHistory(silent) {
        return fetchJson(TASKING_HISTORY_API_URL, buildHistoryQuery(false)).then(function (data) {
            window.__taskingHistoryDetail = data.detail || null;
            if (data.detail && data.detail.selected_task) {
                state.selectedTaskId = data.detail.selected_task.id;
            }
            renderTaskStats(data.summary || {});
            renderChart(data.chart || {});
            renderTaskDetail(data.detail || {});
            renderReplayDates(data.detail || {});
            renderMap(data.detail || {});
            renderFilters(data.filters || {});
            highlightSelectedRow();
            return data;
        }).catch(function (error) {
            if (!silent) {
                handleError(error);
            }
        });
    }

    function renderFilters(filters) {
        fillSelect("tasking-status", (filters.statuses || []).map(mapStringOption), "value", "label", true);
        fillSelect("tasking-type", (filters.types || []).map(mapStringOption), "value", "label", true);
        fillSelect("tasking-region", (filters.regions || []).map(mapStringOption), "value", "label", true);
        fillSelect("tasking-drone", filters.drones || [], "id", "name", true);
        fillSelect("tasking-pilot", filters.pilots || [], "id", "name", true);
        document.getElementById("tasking-status").value = state.filters.status;
        document.getElementById("tasking-type").value = state.filters.type;
        document.getElementById("tasking-region").value = state.filters.region;
        document.getElementById("tasking-drone").value = state.filters.drone;
        document.getElementById("tasking-pilot").value = state.filters.pilot;
        document.getElementById("tasking-grain").value = state.filters.grain;
    }

    function renderTaskStats(summary) {
        setText("tasking-stat-total", summary.task_total || 0);
        setText("tasking-stat-running", summary.running_total || 0);
        setText("tasking-stat-completed", summary.completed_total || 0);
        setText("tasking-stat-abnormal", summary.abnormal_total || summary.delay_total || 0);
    }

    function renderTaskTable(items) {
        const tbody = document.getElementById("tasking-task-tbody");
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">暂无任务数据</td></tr>';
            return;
        }
        tbody.innerHTML = items.map(function (item) {
            return '' +
                '<tr data-task-id="' + item.id + '">' +
                '<td>' + escapeHtml(item.name) + '</td>' +
                '<td>' + escapeHtml(item.type) + '</td>' +
                '<td><span class="ops-badge status-' + normalizeStatusClass(item.status) + '">' + formatStatus(item.status) + '</span></td>' +
                '<td>' + escapeHtml(item.assigned_drone_name || "-") + '</td>' +
                '<td>' + escapeHtml(item.assigned_pilot_name || "-") + '</td>' +
                '<td>' + escapeHtml(formatDateTime(item.start_time)) + '</td>' +
                '<td>' + escapeHtml(formatDateTime(item.end_time)) + '</td>' +
                '<td><button class="btn btn-sm btn-primary tasking-detail-btn" data-task-id="' + item.id + '">详情</button></td>' +
                '</tr>';
        }).join("");

        Array.from(tbody.querySelectorAll("tr")).forEach(function (row) {
            row.addEventListener("click", function () {
                state.selectedTaskId = row.dataset.taskId;
                loadHistory();
            });
        });
        Array.from(document.querySelectorAll(".tasking-detail-btn")).forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.stopPropagation();
                state.selectedTaskId = button.dataset.taskId;
                loadHistory();
            });
        });
        highlightSelectedRow();
    }

    function renderAssignmentTable(items) {
        const tbody = document.getElementById("tasking-assignment-tbody");
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">暂无分派记录</td></tr>';
            return;
        }
        tbody.innerHTML = items.map(function (item) {
            return '' +
                '<tr>' +
                '<td>' + escapeHtml(item.task_name || "-") + '</td>' +
                '<td>' + escapeHtml(item.drone_name || "-") + '</td>' +
                '<td>' + escapeHtml(item.pilot_name || "-") + '</td>' +
                '<td><span class="ops-badge status-' + normalizeStatusClass(item.status) + '">' + formatStatus(item.status) + '</span></td>' +
                '<td>' + escapeHtml(formatDateTime(item.timestamp)) + '</td>' +
                '<td>' + escapeHtml(item.region || "-") + '</td>' +
                '</tr>';
        }).join("");
    }

    function renderPagination(prefix, pagination) {
        const totalPages = pagination.total_pages || 1;
        const pageInfo = document.getElementById(prefix + "-page-info");
        const prevButton = document.getElementById(prefix + "-prev-page");
        const nextButton = document.getElementById(prefix + "-next-page");
        if (pageInfo) {
            pageInfo.textContent =
                "第 " + (pagination.page || 1) + " / " + totalPages + " 页，共 " + (pagination.total || 0) + " 条";
        }
        if (prevButton) {
            prevButton.disabled = !pagination.has_previous;
        }
        if (nextButton) {
            nextButton.disabled = !pagination.has_next;
            nextButton.dataset.totalPages = totalPages;
        }
    }

    function renderChart(chartData) {
        const chartDom = document.getElementById("tasking-history-chart");
        chart = chart || echarts.init(chartDom);
        const colorMap = {
            "已完成": "#0d6efd",
            "执行中": "#198754",
            "待执行": "#fd7e14",
        };
        chart.setOption({
            color: [colorMap["已完成"], colorMap["执行中"], colorMap["待执行"]],
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "cross" },
                formatter: function (params) {
                    if (!params || !params.length) {
                        return "";
                    }
                    return params[0].axisValueLabel + "<br>" + params.map(function (item) {
                        return item.marker + item.seriesName + "：<strong>" + item.value + "</strong>";
                    }).join("<br>");
                },
            },
            legend: {
                data: ["已完成", "执行中", "待执行"],
                top: 0,
                selected: state.chartSelection,
                textStyle: { color: "#526376" },
            },
            grid: { left: 44, right: 20, top: 48, bottom: 32 },
            xAxis: {
                type: "category",
                boundaryGap: false,
                data: chartData.labels || [],
                axisLabel: { color: "#67788a" },
            },
            yAxis: {
                type: "value",
                axisLabel: { color: "#67788a" },
                splitLine: { lineStyle: { color: "rgba(15, 23, 42, 0.08)" } },
            },
            series: [
                {
                    name: "已完成",
                    type: "line",
                    smooth: true,
                    data: (chartData.series || {}).completed || [],
                    lineStyle: { color: "#0d6efd" },
                    itemStyle: { color: "#0d6efd" },
                    areaStyle: { color: "rgba(13, 110, 253, 0.08)" },
                },
                {
                    name: "执行中",
                    type: "line",
                    smooth: true,
                    data: (chartData.series || {}).running || [],
                    lineStyle: { color: "#198754" },
                    itemStyle: { color: "#198754" },
                    areaStyle: { color: "rgba(25, 135, 84, 0.08)" },
                },
                {
                    name: "待执行",
                    type: "line",
                    smooth: true,
                    data: (chartData.series || {}).pending || [],
                    lineStyle: { color: "#fd7e14" },
                    itemStyle: { color: "#fd7e14" },
                    areaStyle: { color: "rgba(253, 126, 20, 0.08)" },
                },
            ],
        });
        chart.off("legendselectchanged");
        chart.on("legendselectchanged", function (event) {
            state.chartSelection = Object.assign({}, event.selected || {});
            syncLegendState();
        });
        syncLegendState();
    }

    function renderTaskDetail(detail) {
        detail = detail || {};
        const target = document.getElementById("tasking-detail-panel");
        const assignmentTarget = document.getElementById("tasking-detail-assignments");
        const task = detail.selected_task;
        if (!task) {
            target.innerHTML = '<div class="text-muted">请选择任务查看详情</div>';
            assignmentTarget.innerHTML = '<div class="text-muted">暂无分派记录</div>';
            renderStatusAlert();
            return;
        }
        renderStatusAlert(task);
        target.innerHTML = '' +
            '<div class="ops-detail-grid">' +
            detailItem("任务名称", task.name) +
            detailItem("任务类型", task.type) +
            detailItem("当前状态", '<span class="ops-badge status-' + normalizeStatusClass(task.status) + '">' + formatStatus(task.status) + '</span>') +
            detailItem("分配无人机", task.assigned_drone_name || "-") +
            detailItem("分配飞手", task.assigned_pilot_name || "-") +
            detailItem("任务区域", task.region || "-") +
            detailItem("开始时间", formatDateTime(task.start_time)) +
            detailItem("结束时间", formatDateTime(task.end_time)) +
            detailItem("优先级", task.priority || "-") +
            detailItem("延误状态", task.delayed ? "已延误" : "正常") +
            '</div>' +
            '<div class="mt-3 small text-muted">' + escapeHtml(task.description || "暂无任务描述") + '</div>';

        const assignments = detail.assignments || [];
        assignmentTarget.innerHTML = assignments.length ? '' +
            '<div class="ops-mini-table">' +
            '<table class="table table-sm align-middle">' +
            '<thead><tr><th>无人机</th><th>飞手</th><th>状态</th><th>时间</th></tr></thead>' +
            '<tbody>' + assignments.map(function (item) {
                return '' +
                    '<tr>' +
                    '<td>' + escapeHtml(item.drone_name || "-") + '</td>' +
                    '<td>' + escapeHtml(item.pilot_name || "-") + '</td>' +
                    '<td><span class="ops-badge status-' + normalizeStatusClass(item.status) + '">' + formatStatus(item.status) + '</span></td>' +
                    '<td>' + escapeHtml(formatDateTime(item.timestamp)) + '</td>' +
                    '</tr>';
            }).join("") + '</tbody></table></div>' : '<div class="text-muted">暂无分派记录</div>';
    }

    function renderReplayDates(detail) {
        const replayDates = detail.replay_dates || [];
        fillSelect(
            "tasking-replay-date",
            replayDates.map(function (item) {
                return { value: item, label: item };
            }),
            "value",
            "label",
            true,
            "全部日期"
        );
        if (replayDates.indexOf(state.replayDate) === -1) {
            state.replayDate = "";
        }
        document.getElementById("tasking-replay-date").value = state.replayDate;
    }

    function renderMap(detail) {
        if (!map) {
            return;
        }
        detail = detail || {};
        trackLayer.clearLayers();
        heatLayer.clearLayers();
        const density = getDensityConfig();
        const trajectories = (detail.trajectories || []).filter(function (item) {
            return !state.replayDate || item.date === state.replayDate;
        });
        const heatPoints = detail.heat_points || [];
        const bounds = [];
        const selectedTask = detail.selected_task || {};

        trajectories.forEach(function (segment) {
            const points = samplePoints(segment.points || [], density.sampleStep);
            const latLngs = points.map(function (point) {
                const latLng = [point.lat, point.lng];
                bounds.push(latLng);
                return latLng;
            });
            if (!latLngs.length) {
                return;
            }
            L.polyline(latLngs, {
                color: segment.color,
                weight: density.lineWeight,
                opacity: 0.85,
            }).bindTooltip(buildTrackTooltip(segment, selectedTask), {
                sticky: true,
                direction: "top",
                className: "ops-track-tooltip",
            }).addTo(trackLayer);
            const lastPoint = (segment.points || [])[segment.points.length - 1];
            L.circleMarker([lastPoint.lat, lastPoint.lng], {
                radius: density.nodeRadius,
                color: segment.color,
                fillColor: segment.color,
                fillOpacity: 0.9,
            }).bindTooltip(buildTrackTooltip(segment, selectedTask), {
                sticky: true,
                direction: "top",
                className: "ops-track-tooltip",
            }).addTo(trackLayer);
        });

        heatPoints.forEach(function (item) {
            const radius = density.heatRadius + Math.round((item.intensity || 0.3) * density.heatBoost);
            L.circleMarker([item.lat, item.lng], {
                radius: radius,
                color: "rgba(220, 53, 69, 0.35)",
                fillColor: "rgba(220, 53, 69, 0.35)",
                fillOpacity: 0.28,
                weight: 1,
            }).bindTooltip(buildHeatTooltip(item, selectedTask), {
                sticky: true,
                direction: "top",
                className: "ops-track-tooltip",
            }).addTo(heatLayer);
            bounds.push([item.lat, item.lng]);
        });

        if (bounds.length) {
            map.fitBounds(bounds, { padding: [24, 24] });
        } else {
            map.setView([29.56301, 106.55156], 10);
        }
    }

    function bindLegendToggle() {
        Array.from(document.querySelectorAll("#tasking-chart-legend [data-series]")).forEach(function (item) {
            item.addEventListener("click", function () {
                const seriesName = item.dataset.series;
                state.chartSelection[seriesName] = !state.chartSelection[seriesName];
                if (chart) {
                    chart.dispatchAction({
                        type: state.chartSelection[seriesName] ? "legendSelect" : "legendUnSelect",
                        name: seriesName,
                    });
                }
                syncLegendState();
            });
        });
    }

    function syncLegendState() {
        Array.from(document.querySelectorAll("#tasking-chart-legend [data-series]")).forEach(function (item) {
            const seriesName = item.dataset.series;
            item.classList.toggle("is-disabled", state.chartSelection[seriesName] === false);
        });
    }

    function getDensityConfig() {
        if (state.mapDensity === "coarse") {
            return { lineWeight: 3, nodeRadius: 5, heatRadius: 6, heatBoost: 10, sampleStep: 3 };
        }
        if (state.mapDensity === "dense") {
            return { lineWeight: 5, nodeRadius: 7, heatRadius: 10, heatBoost: 20, sampleStep: 1 };
        }
        return { lineWeight: 4, nodeRadius: 6, heatRadius: 8, heatBoost: 16, sampleStep: 2 };
    }

    function samplePoints(points, step) {
        if (!Array.isArray(points) || !points.length || step <= 1) {
            return points || [];
        }
        return points.filter(function (_, index) {
            return index === 0 || index === points.length - 1 || index % step === 0;
        });
    }

    function buildTrackTooltip(segment, task) {
        const duration = segment.flight_duration || segment.duration || "-";
        return '' +
            '<div class="ops-track-tooltip">' +
            '<div><strong>' + escapeHtml(segment.task_name || task.name || "任务轨迹") + '</strong></div>' +
            '<div>无人机：' + escapeHtml(segment.drone_name || task.assigned_drone_name || "-") + '</div>' +
            '<div>飞行时间：' + escapeHtml(String(duration)) + '</div>' +
            '<div>状态：' + escapeHtml(formatStatus(segment.status)) + '</div>' +
            '<div>日期：' + escapeHtml(segment.date || "-") + '</div>' +
            '</div>';
    }

    function buildHeatTooltip(point, task) {
        return '' +
            '<div class="ops-track-tooltip">' +
            '<div><strong>热区节点</strong></div>' +
            '<div>任务：' + escapeHtml(task.name || "-") + '</div>' +
            '<div>无人机 ID：' + escapeHtml(String(point.drone_id || task.assigned_drone_id || "-")) + '</div>' +
            '<div>飞行时间：' + escapeHtml(String(point.flight_duration || point.duration || "-")) + '</div>' +
            '<div>强度：' + escapeHtml(String(point.intensity || "-")) + '</div>' +
            '</div>';
    }

    function renderStatusAlert(task) {
        const target = document.getElementById("tasking-status-alert");
        if (!target) {
            return;
        }
        if (!task) {
            target.className = "ops-inline-alert";
            target.innerHTML = "";
            return;
        }
        const normalizedStatus = normalizeStatusClass(task.status);
        if (normalizedStatus === "abnormal" || task.delayed) {
            const message = normalizedStatus === "abnormal"
                ? "当前任务存在异常状态，请优先检查无人机链路与执行记录。"
                : "当前任务已经延误，建议检查资源分配和执行路径。";
            const levelClass = normalizedStatus === "abnormal" ? "is-danger" : "is-warning";
            const icon = normalizedStatus === "abnormal" ? "bi-exclamation-octagon" : "bi-clock-history";
            target.className = "ops-inline-alert is-visible " + levelClass;
            target.innerHTML = '<i class="bi ' + icon + '"></i><div><strong>状态提示</strong><div>' + escapeHtml(message) + '</div></div>';
            return;
        }
        target.className = "ops-inline-alert";
        target.innerHTML = "";
    }

    function detailItem(label, value) {
        return '' +
            '<div>' +
            '<label class="form-label mb-1">' + escapeHtml(label) + '</label>' +
            '<p class="ops-detail-value">' + value + '</p>' +
            '</div>';
    }

    function fillSelect(id, items, valueKey, labelKey, keepEmpty, emptyLabel) {
        const target = document.getElementById(id);
        const currentValue = target.value;
        const options = [];
        if (keepEmpty) {
            options.push('<option value="">' + (emptyLabel || "全部") + "</option>");
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

    function exportData(url, params) {
        const search = new URLSearchParams();
        Object.keys(params).forEach(function (key) {
            if (params[key] !== "" && params[key] !== null && params[key] !== undefined) {
                search.append(key, params[key]);
            }
        });
        window.open(url + "?" + search.toString(), "_blank");
    }

    function highlightSelectedRow() {
        Array.from(document.querySelectorAll("#tasking-task-tbody tr")).forEach(function (row) {
            row.classList.toggle("table-active", String(row.dataset.taskId) === String(state.selectedTaskId));
        });
    }

    function normalizeStatusClass(status) {
        const value = String(status || "").toLowerCase();
        if (value === "completed" || value === "done" || value === "finished" || value === "success") {
            return "completed";
        }
        if (value === "running" || value === "executing" || value === "in_progress" || value === "online" || value === "active" || value === "created") {
            return "running";
        }
        if (value === "failed" || value === "error" || value === "abnormal" || value === "timeout" || value === "delayed") {
            return "abnormal";
        }
        return "pending";
    }

    function formatStatus(status) {
        const value = normalizeStatusClass(status);
        return {
            completed: "已完成",
            running: "执行中",
            pending: "待执行",
            abnormal: "异常",
        }[value];
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
            return value;
        }
        return date.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function setText(id, value) {
        document.getElementById(id).textContent = value;
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
