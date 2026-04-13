from django.urls import path
from . import views

urlpatterns = [
    path('', views.terrain_index, name='terrain_index'),
    path('editor/', views.terrain_editor, name='terrain_editor'),
    
    # TerrainPlot API Endpoints
    path('api/plots/create/', views.create_plot, name='create_plot'),
    path('api/plots/list/', views.list_plots, name='list_plots'),
    path('api/plots/<int:pk>/', views.plot_detail, name='plot_detail'),
    path('api/plots/<int:pk>/update/', views.update_plot, name='update_plot'),
    path('api/plots/<int:pk>/delete/', views.delete_plot, name='delete_plot'),
    
    # 原有接口保留
    path('api/save-plot/', views.save_plot, name='save_plot'),
    path('api/get-terrain-data/', views.get_terrain_data, name='get_terrain_data'),
]