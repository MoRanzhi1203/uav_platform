document.addEventListener("DOMContentLoaded", async () => {
    const button = document.getElementById("load-telemetry-button");
    const input = document.getElementById("drone-id-input");

    async function loadTelemetry() {
        const droneId = input ? input.value || "1" : "1";
        try {
            const [overviewResponse, statusResponse, trackResponse] = await Promise.all([
                App.request("/api/telemetry/overview/"),
                App.request(`/api/telemetry/drones/${droneId}/status/`),
                App.request(`/api/telemetry/drones/${droneId}/tracks/`)
            ]);

            App.renderCards("telemetry-cards", [
                { label: "遥测快照数", value: overviewResponse.data.telemetry_snapshot_count },
                { label: "轨迹点数", value: overviewResponse.data.trajectory_count },
                { label: "心跳记录数", value: overviewResponse.data.heartbeat_count }
            ]);

            const statusBox = document.getElementById("status-json");
            if (statusBox) {
                statusBox.textContent = JSON.stringify(statusResponse.data, null, 2);
            }
            App.renderTable("track-table", trackResponse.data.slice(0, 50));
        } catch (error) {
            App.toast(`Telemetry load failed: ${error.message}`, "error");
        }
    }

    if (button) {
        button.addEventListener("click", loadTelemetry);
    }

    loadTelemetry();
});
