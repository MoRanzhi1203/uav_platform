from django.urls import path

from agri.views import (
    agri_task_detail,
    agri_task_list_create,
    farm_plot_detail,
    farm_plot_list_create,
    overview,
    pest_monitor_detail,
    pest_monitor_list_create,
)

urlpatterns = [
    path("overview/", overview, name="agri-overview"),
    path("farm-plots/", farm_plot_list_create, name="agri-farm-plot-list-create"),
    path("farm-plots/<int:pk>/", farm_plot_detail, name="agri-farm-plot-detail"),
    path("tasks/", agri_task_list_create, name="agri-task-list-create"),
    path("tasks/<int:pk>/", agri_task_detail, name="agri-task-detail"),
    path("pest-monitors/", pest_monitor_list_create, name="agri-pest-monitor-list-create"),
    path("pest-monitors/<int:pk>/", pest_monitor_detail, name="agri-pest-monitor-detail"),
]
