from django.urls import path

from forest.views import (
    fire_detection_detail,
    fire_detection_list_create,
    forest_area_detail,
    forest_area_list_create,
    forest_patrol_task_detail,
    forest_patrol_task_list_create,
    overview,
)

urlpatterns = [
    path("overview/", overview, name="forest-overview"),
    path("areas/", forest_area_list_create, name="forest-area-list-create"),
    path("areas/<int:pk>/", forest_area_detail, name="forest-area-detail"),
    path("patrol-tasks/", forest_patrol_task_list_create, name="forest-patrol-task-list-create"),
    path("patrol-tasks/<int:pk>/", forest_patrol_task_detail, name="forest-patrol-task-detail"),
    path("fire-detections/", fire_detection_list_create, name="forest-fire-detection-list-create"),
    path("fire-detections/<int:pk>/", fire_detection_detail, name="forest-fire-detection-detail"),
]
