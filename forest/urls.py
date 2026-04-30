from django.urls import path

from forest.views import (
    dashboard_fire_alerts,
    dashboard_patrol_tasks,
    dashboard_risk_analysis,
    fire_detection_detail,
    fire_detection_list_create,
    forest_area_detail,
    forest_area_list_create,
    forest_index,
    forest_patrol_task_detail,
    forest_patrol_task_list_create,
    overview,
)

urlpatterns = [
    path("", forest_index, name="forest-index"),
    path("overview/", overview, name="forest-overview"),
    path("areas/", forest_area_list_create, name="forest-area-list-create"),
    path("areas/<int:pk>/", forest_area_detail, name="forest-area-detail"),
    path("patrol-tasks/", forest_patrol_task_list_create, name="forest-patrol-task-list-create"),
    path("patrol-tasks/<int:pk>/", forest_patrol_task_detail, name="forest-patrol-task-detail"),
    path("fire-detections/", fire_detection_list_create, name="forest-fire-detection-list-create"),
    path("fire-detections/<int:pk>/", fire_detection_detail, name="forest-fire-detection-detail"),
    # Dashboard APIs
    path("api/dashboard/fire-alerts/", dashboard_fire_alerts, name="forest-dashboard-fire-alerts"),
    path("api/dashboard/patrol-tasks/", dashboard_patrol_tasks, name="forest-dashboard-patrol-tasks"),
    path("api/dashboard/risk-analysis/", dashboard_risk_analysis, name="forest-dashboard-risk-analysis"),
]
