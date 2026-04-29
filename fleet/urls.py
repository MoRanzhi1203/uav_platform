from django.urls import path

from fleet.views import (
    drone_detail,
    drone_history,
    drone_group_detail,
    drone_group_list_create,
    drone_group_member_detail,
    drone_group_member_list_create,
    drone_list_create,
    launch_site_detail,
    launch_site_list_create,
    overview,
    pilot_detail,
    pilot_list_create,
)

urlpatterns = [
    path("overview/", overview, name="fleet-overview"),
    path("pilots/", pilot_list_create, name="fleet-pilot-list-create"),
    path("pilots/<int:pk>/", pilot_detail, name="fleet-pilot-detail"),
    path("drone-history/", drone_history, name="fleet-drone-history"),
    path("launch-sites/", launch_site_list_create, name="fleet-launch-site-list-create"),
    path("launch-sites/<int:pk>/", launch_site_detail, name="fleet-launch-site-detail"),
    path("drones/", drone_list_create, name="fleet-drone-list-create"),
    path("drones/<int:pk>/", drone_detail, name="fleet-drone-detail"),
    path("drone-groups/", drone_group_list_create, name="fleet-drone-group-list-create"),
    path("drone-groups/<int:pk>/", drone_group_detail, name="fleet-drone-group-detail"),
    path("drone-group-members/", drone_group_member_list_create, name="fleet-drone-group-member-list-create"),
    path("drone-group-members/<int:pk>/", drone_group_member_detail, name="fleet-drone-group-member-detail"),
]
