(function () {
    const state = {
        page: 1,
        pageSize: 10,
        selectedDroneId: null,
        replayDate: "",
        replayTimer: null,
        filters: {
            keyword: "",
            status: "",
            region: "",
            pilot: "",
            grain: "day",
            start_date: "",
            end_date: "",
        },
    };

    let map = null;
    let chart = null;
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
        document.getElementById("fleet-start-date").value = state.filters.start_date;
        document.getElementById("fleet-end-date").value = state.filters.end_date;
    }

    function bindEvents() {
        document.getElementById("fleet-query-btn").addEventListener("click", function () {
            syncFiltersFromForm();
            state.page = 1;
            loadDashboard();
        });
        document.getElementById("fleet-reset-btn").addEventListener("click", function () {
            document.getElementById("fleet-filter-form").reset();
            setDefaultDates();
            state.filters.keyword = "";
            state.filters.status = "";
            state.filters.region = "";
            state.filters.pilot = "";
            state.filters.grain = "day";
            state.page = 1;
            state.selectedDroneId = null;
            state.replayDate = "";
            loadDashboard();
        });
        document.getElementById("fleet-export-list-btn").addEventListener("click", function () {
            exportData("/fleet/api/drones/", buildDroneQuery(true));
        });
        document.getElementById("fleet-export-history-btn").addEventListener("click", function () {
            exportData("/fleet/api/drone-history/", buildHistoryQuery(true));
        });
        document.getElementById("fleet-page-size").addEventListener("change", function (event) {
            state.pageSize = Number(event.target.value);
            state.page = 1;
            loadDrones();
        });
        document.getElementById("fleet-prev-page").addEventListener("click", function () {
            if (state.page > 1) {
                state.page -= 1;
                loadDrones();
            }
        });
        document.getElementById("fleet-next-page").addEventListener("click", function () {
            const totalPages = Number(document.getElementById("fleet-next-page").dataset.totalPages || 1);
            if (state.page < totalPages) {
                state.page += 1;
                loadDrones();
            }
        });
        document.getElementById("fleet-replay-date").addEventListener("change", function (event) {
            state.replayDate = event.target.value;
            renderMap(window.__fleetHistoryDetail || null);
        });
        document.getElementById("fleet-replay-play").addEventListener("click", playReplay);
    }

    function syncFiltersFromForm() {
        state.filters.keyword = document.getElementById("fleet-keyword").value.trim();
        state.filters.status = document.getElementById("fleet-status").value;
        state.filters.region = document.getElementById("fleet-region").value;
        state.filters.pilot = document.getElementById("fleet-pilot").value;
        state.filters.grain = document.getElementById("fleet-grain").value || "day";
        state.filters.start_date = document.getElementById("fleet-start-date").value;
        state.filters.end_date = document.getElementById("fleet-end-date").value;
    }

    function initMap() {
        map = L.map("fleet-map", { zoomControl: true }).setView([29.56301, 106.55156], 10);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);
        trackLayer = L.layerGroup().addTo(map);
        heatLayer = L.layerGroup().addTo(map);
    }

    function buildDroneQuery(isExport) {
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

    function buildHistoryQuery(isExport) {
        const params = {
            grain: state.filters.grain,
            start_date: state.filters.start_date,
            end_date: state.filters.end_date,
            status: state.filters.status,
            region: state.filters.region,
            pilot: state.filters.pilot,
        };
        if (state.selectedDroneId) {
            params.drone_id = state.selectedDroneId;
        }
        if (isExport) {
            params.export = "csv";
        }
        return params;
    }

    function fetchJson(url, params) {
        const search = new URLSearchParams();
        Object.keys(params || {}).forEach(function (key) {
            if (params[key] !== "" && params[key] !== null && params[key] !== undefined) {
                search.append(key, params[key]);
            }
        });
        const requestUrl = search.toString() ? url + "?" + search.toString() : url;
        return fetch(requestUrl, { credentials: "same-origin" }).then(function (response) {
            return response.json().then(function (payload) {
                if (!response.ok || payload.code !== 0) {
                    throw new Error(payload.msg || "请求失败");
                }
                return payload.data;
            });
        });
    }

    function loadDashboard() {
        return Promise.all([loadDrones(), loadHistory()]).catch(handleError);
    }

    function refreshRealtime() {
        Promise.all([loadDrones(true), loadHistory(true)]).catch(function () {});
    }

    function loadDrones(silent) {
        return fetchJson("/fleet/api/drones/", buildDroneQuery(false)).then(function (data) {
            renderFilters(data.filters || {});
            renderDroneStats(data.summary || {});
            renderDroneTable(data.items || []);
            renderPagination(data.pagination || {});
            if (!silent && !state.selectedDroneId && data.items && data.items.length) {
                state.selectedDroneId = data.items[0].id;
                return loadHistory();
            }
            return data;
        }).catch(function (error) {
            if (!silent) {
                handleError(error);
            }
        });
    }

    function loadHistory(silent) {
        return fetchJson("/fleet/api/drone-history/", buildHistoryQuery(false)).then(function (data) {
            window.__fleetHistoryDetail = data.detail || null;
            if (data.detail && data.detail.selected_drone) {
                state.selectedDroneId = data.detail.selected_drone.id;
            }
            renderDroneStats(data.summary || {});
            renderChart(data.chart || {});
            renderDroneDetail(data.detail || {});
            renderReplayDates(data.detail || {});
            renderMap(data.detail || {});
            highlightSelectedRow();
            return data;
        }).catch(function (error) {
            if (!silent) {
                handleError(error);
            }
        });
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
        document.getElementById("fleet-status").value = state.filters.status;
        document.getElementById("fleet-pilot").value = state.filters.pilot;
        document.getElementById("fleet-region").value = state.filters.region;
        document.getElementById("fleet-grain").value = state.filters.grain;
    }

    function renderDroneStats(summary) {
        setText("fleet-stat-total", summary.drone_total || 0);
        setText("fleet-stat-online", formatPercent(summary.online_rate || 0));
        setText("fleet-stat-pilot", summary.pilot_total || 0);
        setText("fleet-stat-active", summary.active_tasks || 0);
    }

    function renderDroneTable(items) {
        const tbody = document.getElementById("fleet-drone-tbody");
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">暂无无人机数据</td></tr>';
            return;
        }
        tbody.innerHTML = items.map(function (item) {
            return '' +
                '<tr data-drone-id="' + item.id + '">' +
                '<td>' + escapeHtml(item.name) + '</td>' +
                '<td><span class="ops-badge status-' + normalizeStatusClass(item.status) + '">' + formatStatus(item.status) + '</span></td>' +
                '<td>' + escapeHtml(String(item.battery)) + '%</td>' +
                '<td>' + escapeHtml(item.region || "-") + '</td>' +
                '<td>' + escapeHtml(formatDateTime(item.last_active)) + '</td>' +
                '<td>' + escapeHtml(String(item.task_count || 0)) + '</td>' +
                '<td><button class="btn btn-sm btn-primary fleet-detail-btn" data-drone-id="' + item.id + '">详情</button></td>' +
                '</tr>';
        }).join("");

        Array.from(tbody.querySelectorAll("tr")).forEach(function (row) {
            row.addEventListener("click", function () {
                state.selectedDroneId = row.dataset.droneId;
                loadHistory();
            });
        });
        Array.from(document.querySelectorAll(".fleet-detail-btn")).forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.stopPropagation();
                state.selectedDroneId = button.dataset.droneId;
                loadHistory();
            });
        });
        highlightSelectedRow();
    }

    function renderPagination(pagination) {
        const totalPages = pagination.total_pages || 1;
        document.getElementById("fleet-page-info").textContent =
            "第 " + (pagination.page || 1) + " / " + totalPages + " 页，共 " + (pagination.total || 0) + " 条";
        document.getElementById("fleet-prev-page").disabled = !pagination.has_previous;
        document.getElementById("fleet-next-page").disabled = !pagination.has_next;
        document.getElementById("fleet-next-page").dataset.totalPages = totalPages;
    }

    function renderChart(chartData) {
        const chartDom = document.getElementById("fleet-history-chart");
        chart = chart || echarts.init(chartDom);
        chart.setOption({
            tooltip: { trigger: "axis" },
            legend: { data: ["已完成", "执行中", "待执行"] },
            grid: { left: 40, right: 20, top: 40, bottom: 30 },
            xAxis: { type: "category", data: chartData.labels || [] },
            yAxis: { type: "value" },
            series: [
                {
                    name: "已完成",
                    type: "line",
                    smooth: true,
                    data: (chartData.series || {}).completed || [],
                    lineStyle: { color: "#0d6efd" },
                    itemStyle: { color: "#0d6efd" },
                },
                {
                    name: "执行中",
                    type: "line",
                    smooth: true,
                    data: (chartData.series || {}).running || [],
                    lineStyle: { color: "#198754" },
                    itemStyle: { color: "#198754" },
                },
                {
                    name: "待执行",
                    type: "line",
                    smooth: true,
                    data: (chartData.series || {}).pending || [],
                    lineStyle: { color: "#fd7e14" },
                    itemStyle: { color: "#fd7e14" },
                },
            ],
        });
    }

    function renderDroneDetail(detail) {
        const target = document.getElementById("fleet-detail-panel");
        const historyBody = document.getElementById("fleet-history-tbody");
        const drone = detail.selected_drone;
        if (!drone) {
            target.innerHTML = '<div class="text-muted">请选择无人机查看历史详情</div>';
            historyBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">暂无历史数据</td></tr>';
            return;
        }
        target.innerHTML = '' +
            '<div class="ops-detail-grid">' +
            detailItem("无人机名称", drone.name) +
            detailItem("当前状态", '<span class="ops-badge status-' + normalizeStatusClass(drone.status) + '">' + formatStatus(drone.status) + '</span>') +
            detailItem("电量", drone.battery + "%") +
            detailItem("所属区域", drone.region || "-") +
            detailItem("飞手", drone.pilot_name || "-") +
            detailItem("最近活动", formatDateTime(drone.last_active)) +
            detailItem("任务总数", drone.task_count || 0) +
            detailItem("完成率", formatPercent(drone.completion_rate || 0)) +
            detailItem("飞行时长", (drone.flight_duration || 0) + " h") +
            detailItem("起降点", drone.launch_site_name || "-") +
            '</div>' +
            renderStatusChanges(drone.status_changes || []);

        const historyRows = detail.history || [];
        historyBody.innerHTML = historyRows.length ? historyRows.map(function (item) {
            return '' +
                '<tr>' +
                '<td>' + escapeHtml(item.period) + '</td>' +
                '<td>' + escapeHtml(String(item.battery)) + '%</td>' +
                '<td>' + escapeHtml(String(item.task_completed)) + '/' + escapeHtml(String(item.task_total)) + '</td>' +
                '<td>' + escapeHtml(String(item.flight_duration)) + '</td>' +
                '<td>' + escapeHtml(String(item.battery_consumption)) + '%</td>' +
                '<td><span class="ops-badge status-' + normalizeStatusClass(item.status) + '">' + formatStatus(item.status) + '</span></td>' +
                '</tr>';
        }).join("") : '<tr><td colspan="6" class="text-center text-muted py-3">暂无历史数据</td></tr>';
    }

    function renderReplayDates(detail) {
        const replayDates = detail.replay_dates || [];
        const select = document.getElementById("fleet-replay-date");
        fillSelect(
            "fleet-replay-date",
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
        select.value = state.replayDate;
    }

    function renderMap(detail) {
        if (!map) {
            return;
        }
        trackLayer.clearLayers();
        heatLayer.clearLayers();
        const trajectories = (detail.trajectories || []).filter(function (item) {
            return !state.replayDate || item.date === state.replayDate;
        });
        const heatPoints = detail.heat_points || [];
        const bounds = [];

        trajectories.forEach(function (segment) {
            const latLngs = segment.points.map(function (point) {
                const latLng = [point.lat, point.lng];
                bounds.push(latLng);
                return latLng;
            });
            if (!latLngs.length) {
                return;
            }
            L.polyline(latLngs, {
                color: segment.color,
                weight: 4,
                opacity: 0.85,
            }).bindPopup(segment.task_name + " | " + formatStatus(segment.status) + " | " + segment.date).addTo(trackLayer);
            const lastPoint = segment.points[segment.points.length - 1];
            L.circleMarker([lastPoint.lat, lastPoint.lng], {
                radius: 6,
                color: segment.color,
                fillColor: segment.color,
                fillOpacity: 0.9,
            }).bindPopup(segment.task_name).addTo(trackLayer);
        });

        heatPoints.forEach(function (item) {
            const radius = 8 + Math.round((item.intensity || 0.3) * 18);
            L.circleMarker([item.lat, item.lng], {
                radius: radius,
                color: "rgba(220, 53, 69, 0.35)",
                fillColor: "rgba(220, 53, 69, 0.35)",
                fillOpacity: 0.28,
                weight: 1,
            }).addTo(heatLayer);
            bounds.push([item.lat, item.lng]);
        });

        if (bounds.length) {
            map.fitBounds(bounds, { padding: [24, 24] });
        } else {
            map.setView([29.56301, 106.55156], 10);
        }
    }

    function playReplay() {
        const detail = window.__fleetHistoryDetail || {};
        const replayDates = detail.replay_dates || [];
        if (!replayDates.length) {
            return;
        }
        if (state.replayTimer) {
            window.clearInterval(state.replayTimer);
            state.replayTimer = null;
            document.getElementById("fleet-replay-play").textContent = "轨迹回放";
            return;
        }
        let index = Math.max(0, replayDates.indexOf(state.replayDate));
        document.getElementById("fleet-replay-play").textContent = "停止回放";
        state.replayTimer = window.setInterval(function () {
            state.replayDate = replayDates[index];
            document.getElementById("fleet-replay-date").value = state.replayDate;
            renderMap(detail);
            index += 1;
            if (index >= replayDates.length) {
                window.clearInterval(state.replayTimer);
                state.replayTimer = null;
                document.getElementById("fleet-replay-play").textContent = "轨迹回放";
            }
        }, 1200);
    }

    function detailItem(label, value) {
        return '' +
            '<div>' +
            '<label class="form-label mb-1">' + escapeHtml(label) + '</label>' +
            '<p class="ops-detail-value">' + value + '</p>' +
            '</div>';
    }

    function renderStatusChanges(changes) {
        if (!changes.length) {
            return '<div class="mt-3 text-muted">所选周期内无状态切换记录</div>';
        }
        return '' +
            '<div class="mt-3">' +
            '<div class="fw-semibold mb-2">状态变化</div>' +
            '<div class="small text-muted">' +
            changes.map(function (item) {
                return escapeHtml(item.date + " | " + formatStatus(item.from) + " -> " + formatStatus(item.to));
            }).join("<br>") +
            '</div>' +
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
        Array.from(document.querySelectorAll("#fleet-drone-tbody tr")).forEach(function (row) {
            row.classList.toggle("table-active", String(row.dataset.droneId) === String(state.selectedDroneId));
        });
    }

    function normalizeStatusClass(status) {
        const value = String(status || "").toLowerCase();
        if (value === "completed" || value === "done" || value === "finished" || value === "success") {
            return "completed";
        }
        if (value === "running" || value === "executing" || value === "in_progress" || value === "online" || value === "active") {
            return "running";
        }
        if (value === "failed" || value === "error" || value === "abnormal" || value === "timeout") {
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

    function formatPercent(value) {
        return Number(value || 0).toFixed(2) + "%";
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
