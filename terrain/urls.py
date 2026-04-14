from django.urls import path
from . import views

urlpatterns = [
    path('', views.terrain_index, name='terrain_index'),
    path('editor/', views.terrain_editor, name='terrain_editor'),
    
    # TerrainArea API
    path('api/areas/', views.list_areas, name='list_areas'),
    path('api/areas/<int:area_id>/edit/', views.area_edit_detail, name='area_edit_detail'),
    path('api/areas/<int:pk>/delete/', views.delete_terrain, name='delete_terrain'),
    path('api/terrain/save/', views.unified_save_terrain, name='unified_save_terrain'),
    
    # TerrainZone API
    path('api/zones/create/', views.create_or_update_zone, name='create_zone'),
    path('api/zones/<int:pk>/update/', views.create_or_update_zone, name='update_zone_legacy'),
    path('api/zones/<int:pk>/delete/', views.delete_zone, name='delete_zone'),
    path('api/zones/<int:pk>/split/', views.split_zone, name='split_zone'),
    path('api/zones/merge/', views.merge_zones, name='merge_zones'),
    path('api/zones/boolean/', views.boolean_subtract, name='boolean_subtract'),
    path('api/zones/subcategories/', views.subcategory_list, name='subcategory_list'),
    
    # TerrainElement API
    path('api/elements/create/', views.create_or_update_element, name='create_element'),
    path('api/elements/<int:pk>/delete/', views.delete_element, name='delete_element'),

    # SubCategory API
    path('api/subcategories/add/', views.add_subcategory, name='add_subcategory'),
    path('api/subcategories/delete/', views.delete_subcategory, name='delete_subcategory'),

    # 兼容旧地块接口 (TerrainPlot 映射到 TerrainZone)
    path('api/plots/create/', views.create_plot, name='create_plot'),
    path('api/plots/list/', views.list_plots, name='list_plots'),
    path('api/plots/<int:pk>/', views.plot_detail, name='plot_detail'),
    path('api/plots/<int:pk>/update/', views.update_plot, name='update_plot'),
    path('api/plots/<int:pk>/delete/', views.delete_zone, name='delete_plot'),
]
