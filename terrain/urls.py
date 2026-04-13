from django.urls import path
from . import views

urlpatterns = [
    path('', views.terrain_index, name='terrain_index'),
    path('editor/', views.terrain_editor, name='terrain_editor'),
    
    # TerrainArea API
    path('api/areas/', views.list_areas, name='list_areas'),
    path('api/areas/<int:area_id>/edit/', views.area_edit_detail, name='area_edit_detail'),
    
    # TerrainZone API
    path('api/zones/create/', views.create_or_update_zone, name='create_zone'),
    path('api/zones/<int:pk>/update/', views.create_or_update_zone, name='update_zone_legacy'),
    path('api/zones/<int:pk>/delete/', views.delete_zone, name='delete_zone'),
    
    # TerrainElement API
    path('api/elements/create/', views.create_or_update_element, name='create_element'),
    path('api/elements/<int:pk>/delete/', views.delete_element, name='delete_element'),

    # 兼容旧地块接口 (TerrainPlot 映射到 TerrainZone)
    path('api/plots/create/', views.create_plot, name='create_plot'),
    path('api/plots/list/', views.list_plots, name='list_plots'),
    path('api/plots/<int:pk>/', views.plot_detail, name='plot_detail'),
    path('api/plots/<int:pk>/update/', views.update_plot, name='update_plot'),
    path('api/plots/<int:pk>/delete/', views.delete_zone, name='delete_plot'),
]
