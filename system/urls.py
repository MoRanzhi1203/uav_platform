from django.urls import path

from system.views import (
    login_view,
    logout_view,
    me_view,
    operation_log_list,
    overview,
    role_list,
    user_list,
)

urlpatterns = [
    path("overview/", overview, name="system-overview"),
    path("login/", login_view, name="system-login"),
    path("logout/", logout_view, name="system-logout"),
    path("me/", me_view, name="system-me"),
    path("users/", user_list, name="system-user-list"),
    path("roles/", role_list, name="system-role-list"),
    path("logs/", operation_log_list, name="system-log-list"),
]
