from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from common.db_health import check_ops_database_health


def _ops_page_context():
    health = check_ops_database_health()
    return {
        "ops_health_ok": health["ok"],
        "ops_health_error": "；".join(health["errors"]) if health["errors"] else "",
        "ops_database_info": health["database_info"],
    }


def login_page(request):
    return render(request, "login.html", {"hide_nav": True})


@login_required(login_url="/login/")
def dashboard_page(request):
    return render(request, "dashboard.html")


@login_required(login_url="/login/")
def fleet_list_page(request):
    return render(request, "fleet_list.html", _ops_page_context())


@login_required(login_url="/login/")
def fleet_detail_page(request):
    return render(request, "fleet_detail.html")


@login_required(login_url="/login/")
def forest_list_page(request):
    return render(request, "forest_list.html")


@login_required(login_url="/login/")
def forest_detail_page(request):
    return render(request, "forest_detail.html")


@login_required(login_url="/login/")
def agri_list_page(request):
    return render(request, "agri_list.html")


@login_required(login_url="/login/")
def agri_detail_page(request):
    return render(request, "agri_detail.html")


@login_required(login_url="/login/")
def tasking_list_page(request):
    return render(request, "tasking_list.html", _ops_page_context())


@login_required(login_url="/login/")
def tasking_detail_page(request):
    return render(request, "tasking_detail.html")


@login_required(login_url="/login/")
def federation_dashboard_page(request):
    return render(request, "federation_dashboard.html")


@login_required(login_url="/login/")
def telemetry_dashboard_page(request):
    return render(request, "telemetry_dashboard.html")


@login_required(login_url="/login/")
def terrain_list_page(request):
    return render(request, "terrain_list.html")


@login_required(login_url="/login/")
def terrain_detail_page(request):
    return render(request, "terrain_detail.html")
