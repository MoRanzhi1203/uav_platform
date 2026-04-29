from django.urls import path

from common.views import health_view, index_view

urlpatterns = [
    path("index/", index_view, name="common-index"),
    path("health/", health_view, name="common-health"),
]
