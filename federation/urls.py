from django.urls import path

from federation.views import (
    aggregate_summary,
    cross_db_stats,
    overview,
    query_record_detail,
    query_record_list_create,
    stat_snapshot_detail,
    stat_snapshot_list_create,
)

urlpatterns = [
    path("overview/", overview, name="federation-overview"),
    path("aggregate-summary/", aggregate_summary, name="federation-aggregate-summary"),
    path("query-records/", query_record_list_create, name="federation-query-record-list-create"),
    path("query-records/<int:pk>/", query_record_detail, name="federation-query-record-detail"),
    path("stat-snapshots/", stat_snapshot_list_create, name="federation-stat-snapshot-list-create"),
    path("stat-snapshots/<int:pk>/", stat_snapshot_detail, name="federation-stat-snapshot-detail"),
    path("cross-db-stats/", cross_db_stats, name="federation-cross-db-stats"),
]
