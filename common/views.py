from django.shortcuts import redirect

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from common.responses import api_response


def index_view(request):
    return redirect("page-login")


@api_view(["GET"])
@permission_classes([AllowAny])
def health_view(request):
    return api_response(data={"status": "ok"})
