from django.urls import path
from terrain import views

urlpatterns = [
    path("", views.terrain_index, name="terrain-index"),
    path("api/types/", views.TerrainTypeList.as_view(), name="terrain-type-list"),
    path("api/types/<int:pk>/", views.TerrainTypeDetail.as_view(), name="terrain-type-detail"),
    path("api/features/", views.TerrainFeatureList.as_view(), name="terrain-feature-list"),
    path("api/features/<int:pk>/", views.TerrainFeatureDetail.as_view(), name="terrain-feature-detail"),
    path("api/terrains/", views.TerrainList.as_view(), name="terrain-list"),
    path("api/terrains/<int:pk>/", views.TerrainDetail.as_view(), name="terrain-detail"),
]
