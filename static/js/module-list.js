document.addEventListener("DOMContentLoaded", async () => {
    const buttons = Array.from(document.querySelectorAll(".tab-button"));
    if (!buttons.length) {
        return;
    }

    async function loadEndpoint(endpoint, button) {
        buttons.forEach((item) => item.classList.remove("active"));
        if (button) {
            button.classList.add("active");
        }
        try {
            const response = await App.request(endpoint);
            const rows = Array.isArray(response.data) ? response.data : [response.data];
            const name = endpoint.split("/").filter(Boolean).slice(-1)[0];
            const summary = document.getElementById("module-summary");
            if (summary) {
                summary.textContent = `Source: ${name}, rows: ${rows.length}`;
            }
            App.renderTable("data-table", rows);
        } catch (error) {
            App.toast(`List load failed: ${error.message}`, "error");
        }
    }

    buttons.forEach((button) => {
        button.addEventListener("click", () => loadEndpoint(button.dataset.endpoint, button));
    });

    await loadEndpoint(buttons[0].dataset.endpoint, buttons[0]);
});
