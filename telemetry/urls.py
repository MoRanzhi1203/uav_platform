from django.urls import path

from telemetry.views import (
    drone_realtime_status,
    drone_track_query,
    heartbeat_detail,
    heartbeat_list_create,
    overview,
    snapshot_detail,
    snapshot_list_create,
    trajectory_detail,
    trajectory_list_create,
)

urlpatterns = [
    path("overview/", overview, name="telemetry-overview"),
    path("snapshots/", snapshot_list_create, name="telemetry-snapshot-list-create"),
    path("snapshots/<int:pk>/", snapshot_detail, name="telemetry-snapshot-detail"),
    path("trajectories/", trajectory_list_create, name="telemetry-trajectory-list-create"),
    path("trajectories/<int:pk>/", trajectory_detail, name="telemetry-trajectory-detail"),
    path("heartbeats/", heartbeat_list_create, name="telemetry-heartbeat-list-create"),
    path("heartbeats/<int:pk>/", heartbeat_detail, name="telemetry-heartbeat-detail"),
    path("drones/<int:drone_id>/status/", drone_realtime_status, name="telemetry-drone-realtime-status"),
    path("drones/<int:drone_id>/tracks/", drone_track_query, name="telemetry-drone-track-query"),
]
