document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("login-form");
    if (!form) {
        return;
    }
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(form).entries());
        try {
            await App.request("/api/system/login/", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            App.toast("Login success");
            window.location.href = "/dashboard/";
        } catch (error) {
            App.toast(`Login failed: ${error.message}`, "error");
        }
    });
});
