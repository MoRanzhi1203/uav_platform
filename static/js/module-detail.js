document.addEventListener("DOMContentLoaded", async () => {
    const endpoint = App.getQueryParam("endpoint");
    const id = App.getQueryParam("id");
    const output = document.getElementById("detail-json");
    const meta = document.getElementById("detail-meta");
    if (!output) {
        return;
    }
    if (!endpoint || !id) {
        output.textContent = "Please provide endpoint and id in the query string.";
        return;
    }
    if (meta) {
        meta.textContent = `Request URL: ${endpoint}${id}/`;
    }
    try {
        const response = await App.request(`${endpoint}${id}/`);
        output.textContent = JSON.stringify(response.data, null, 2);
    } catch (error) {
        output.textContent = `Load failed: ${error.message}`;
        App.toast(error.message, "error");
    }
});
