from django.urls import path
from . import views

urlpatterns = [
    path('', views.terrain_index, name='terrain_index'),
    path('editor/', views.terrain_editor, name='terrain_editor'),
    path('api/save-plot/', views.save_plot, name='save_plot'),
    path('api/get-terrain-data/', views.get_terrain_data, name='get_terrain_data'),
]