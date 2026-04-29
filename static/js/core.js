window.App = (() => {
    const config = window.APP_CONFIG || {};

    function toast(message, type = "info") {
        const container = document.getElementById("toast-container");
        if (!container) {
            return;
        }
        const el = document.createElement("div");
        el.className = `toast ${type === "error" ? "error" : ""}`.trim();
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => el.remove(), 2800);
    }

    async function request(url, options = {}) {
        const finalOptions = {
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": config.csrfToken || "",
                ...(options.headers || {})
            },
            ...options
        };
        const response = await fetch(url, finalOptions);
        const data = await response.json().catch(() => ({
            code: response.status,
            msg: "invalid_json_response",
            data: null
        }));
        if (!response.ok || data.code !== 0) {
            throw new Error(data.msg || "request_failed");
        }
        return data;
    }

    function renderTable(targetId, rows) {
        const target = document.getElementById(targetId);
        if (!target) {
            return;
        }
        if (!rows || !rows.length) {
            target.innerHTML = `<div class="empty-state">No data</div>`;
            return;
        }
        const columns = Object.keys(rows[0]);
        const thead = columns.map((column) => `<th>${column}</th>`).join("");
        const tbody = rows.map((row) => {
            const cells = columns.map((column) => `<td>${formatValue(row[column])}</td>`).join("");
            return `<tr>${cells}</tr>`;
        }).join("");
        target.innerHTML = `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
    }

    function renderCards(targetId, items) {
        const target = document.getElementById(targetId);
        if (!target) {
            return;
        }
        target.innerHTML = items.map((item) => `
            <article class="stat-card">
                <div class="label">${item.label}</div>
                <div class="value">${item.value}</div>
            </article>
        `).join("");
    }

    function formatValue(value) {
        if (value === null || value === undefined) {
            return "-";
        }
        if (typeof value === "object") {
            return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
        }
        return escapeHtml(String(value));
    }

    function escapeHtml(text) {
        return text
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
    }

    function getQueryParam(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    async function logout() {
        try {
            await request("/api/system/logout/", { method: "POST", body: "{}" });
            toast("Logout success");
            window.location.href = "/login/";
        } catch (error) {
            toast(error.message, "error");
        }
    }

    return {
        toast,
        request,
        renderTable,
        renderCards,
        getQueryParam,
        logout
    };
})();
