document.addEventListener("DOMContentLoaded", async () => {
    const modules = [
        ["系统", "/api/system/overview/"],
        ["机群", "/api/fleet/overview/"],
        ["森林", "/api/forest/overview/"],
        ["农业", "/api/agri/overview/"],
        ["调度", "/api/tasking/overview/"],
        ["联邦", "/api/federation/overview/"],
        ["遥测", "/api/telemetry/overview/"]
    ];

    try {
        const results = await Promise.all(
            modules.map(async ([label, url]) => {
                const response = await App.request(url);
                return { label, data: response.data };
            })
        );
        const cards = results.flatMap((item) =>
            Object.entries(item.data).slice(0, 3).map(([key, value]) => ({
                label: `${item.label} · ${key}`,
                value: value
            }))
        );
        App.renderCards("overview-cards", cards);
    } catch (error) {
        App.toast(`Dashboard load failed: ${error.message}`, "error");
    }
});
