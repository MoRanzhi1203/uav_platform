document.addEventListener("DOMContentLoaded", async () => {
    try {
        const [summaryResponse, pairResponse] = await Promise.all([
            App.request("/api/federation/aggregate-summary/"),
            App.request("/api/federation/cross-db-stats/")
        ]);

        const summary = summaryResponse.data.summary.summary;
        App.renderCards("federation-cards", [
            { label: "Total tasks", value: summary.total_uav_tasks },
            { label: "Risk events", value: summary.total_risk_events },
            { label: "Forest risk ratio", value: summary.forest_risk_ratio },
            { label: "Agri risk ratio", value: summary.agri_risk_ratio }
        ]);

        App.renderTable("region-table", summaryResponse.data.regions);
        App.renderTable("pair-table", pairResponse.data.slice(0, 20));
    } catch (error) {
        App.toast(`Federation load failed: ${error.message}`, "error");
    }
});
