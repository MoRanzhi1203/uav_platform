from django.urls import include, path

from common.page_views import (
    agri_detail_page,
    agri_list_page,
    dashboard_page,
    federation_dashboard_page,
    fleet_detail_page,
    fleet_list_page,
    forest_detail_page,
    forest_list_page,
    login_page,
    tasking_detail_page,
    tasking_list_page,
    telemetry_dashboard_page,
)
from common.views import health_view, index_view

urlpatterns = [
    path("", index_view, name="index"),
    path("login/", login_page, name="page-login"),
    path("dashboard/", dashboard_page, name="page-dashboard"),
    path("fleet/", fleet_list_page, name="page-fleet-list"),
    path("fleet/detail/", fleet_detail_page, name="page-fleet-detail"),
    path("forest/", forest_list_page, name="page-forest-list"),
    path("forest/detail/", forest_detail_page, name="page-forest-detail"),
    path("agri/", agri_list_page, name="page-agri-list"),
    path("agri/detail/", agri_detail_page, name="page-agri-detail"),
    path("tasking/", tasking_list_page, name="page-tasking-list"),
    path("tasking/detail/", tasking_detail_page, name="page-tasking-detail"),
    path("federation/", federation_dashboard_page, name="page-federation-dashboard"),
    path("telemetry/", telemetry_dashboard_page, name="page-telemetry-dashboard"),
    path("api/health/", health_view, name="health"),
    path("api/common/", include("common.urls")),
    path("api/system/", include("system.urls")),
    path("api/fleet/", include("fleet.urls")),
    path("api/forest/", include("forest.urls")),
    path("api/agri/", include("agri.urls")),
    path("api/tasking/", include("tasking.urls")),
    path("api/federation/", include("federation.urls")),
    path("api/telemetry/", include("telemetry.urls")),
]
