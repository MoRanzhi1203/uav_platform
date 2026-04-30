from django.urls import path
from . import views

urlpatterns = [
    path('', views.terrain_index, name='terrain_index'),
    path('editor/', views.terrain_editor, name='terrain_editor'),
    
    # TerrainArea API
    path('api/areas/', views.list_areas, name='list_areas'),
    path('api/dashboard/risk-areas/', views.terrain_risk_area_list, name='terrain_risk_area_list'),
    path('api/dashboard/survey-records/', views.terrain_survey_record_list, name='terrain_survey_record_list'),
    path('api/dashboard/risk-analysis/', views.terrain_risk_analysis, name='terrain_risk_analysis'),
    path('api/areas/import/', views.import_areas, name='import_areas'),
    path('api/areas/import-template/', views.import_template, name='import_template'),
    path('api/areas/<int:area_id>/plots/', views.area_plots, name='area_plots'),
    path('api/areas/<int:area_id>/edit/', views.area_edit_detail, name='area_edit_detail'),
    path('api/areas/<int:pk>/delete/', views.delete_terrain, name='delete_terrain'),
    path('api/terrain/save/', views.unified_save_terrain, name='unified_save_terrain'),
    path('api/terrain/execute-task/', views.execute_survey_task, name='execute_survey_task'),
    path('api/drones/available/', views.get_available_drones, name='get_available_drones'),
    path('api/drones/bind/', views.bind_drone, name='bind_drone'),
    path('api/drones/unbind/', views.unbind_drone, name='unbind_drone'),
    
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

]
