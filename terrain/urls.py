from django.urls import path
from terrain import views

urlpatterns = [
    path("types/", views.TerrainTypeList.as_view(), name="terrain-type-list"),
    path("types/<int:pk>/", views.TerrainTypeDetail.as_view(), name="terrain-type-detail"),
    path("features/", views.TerrainFeatureList.as_view(), name="terrain-feature-list"),
    path("features/<int:pk>/", views.TerrainFeatureDetail.as_view(), name="terrain-feature-detail"),
    path("", views.TerrainList.as_view(), name="terrain-list"),
    path("<int:pk>/", views.TerrainDetail.as_view(), name="terrain-detail"),
]
