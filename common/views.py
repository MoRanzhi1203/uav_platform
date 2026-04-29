from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from common.responses import api_response


@api_view(["GET"])
@permission_classes([AllowAny])
def index_view(request):
    return api_response(
        data={
            "project": "重庆山地无人机群林农协同作业与风险管控系统",
            "version": "v1",
            "services": [
                "system",
                "fleet",
                "forest",
                "agri",
                "tasking",
                "federation",
                "telemetry",
            ],
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def health_view(request):
    return api_response(data={"status": "ok"})
