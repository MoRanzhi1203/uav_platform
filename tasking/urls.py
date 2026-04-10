from django.urls import path

from tasking.views import (
    global_task_detail,
    global_task_list_create,
    overview,
    task_dispatch_detail,
    task_dispatch_list_create,
)

urlpatterns = [
    path("overview/", overview, name="tasking-overview"),
    path("global-tasks/", global_task_list_create, name="tasking-global-task-list-create"),
    path("global-tasks/<int:pk>/", global_task_detail, name="tasking-global-task-detail"),
    path("dispatches/", task_dispatch_list_create, name="tasking-dispatch-list-create"),
    path("dispatches/<int:pk>/", task_dispatch_detail, name="tasking-dispatch-detail"),
]
