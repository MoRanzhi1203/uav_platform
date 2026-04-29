from django.urls import path

from system.views import (
    login_view,
    logout_view,
    me_view,
    operation_log_list,
    overview,
    role_list,
    setting_list,
    setting_reset,
    setting_save,
    user_create,
    user_delete,
    user_detail,
    user_list,
    user_reset_password,
    user_toggle_active,
)

urlpatterns = [
    path("overview/", overview, name="system-overview"),
    path("login/", login_view, name="system-login"),
    path("logout/", logout_view, name="system-logout"),
    path("me/", me_view, name="system-me"),
    path("users/", user_list, name="system-user-list"),
    path("users/create/", user_create, name="system-user-create"),
    path("users/<int:user_id>/", user_detail, name="system-user-detail"),
    path("users/<int:user_id>/delete/", user_delete, name="system-user-delete"),
    path("users/<int:user_id>/toggle-active/", user_toggle_active, name="system-user-toggle-active"),
    path("users/<int:user_id>/reset-password/", user_reset_password, name="system-user-reset-password"),
    path("settings/", setting_list, name="system-setting-list"),
    path("settings/save/", setting_save, name="system-setting-save"),
    path("settings/reset/", setting_reset, name="system-setting-reset"),
    path("roles/", role_list, name="system-role-list"),
    path("logs/", operation_log_list, name="system-log-list"),
]
