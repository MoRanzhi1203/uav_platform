from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from common.request_utils import parse_request_data
from common.responses import api_error, api_response
from system.models import OperationLog, RolePermission, SystemUser


def _write_log(request, module, action, extra_data=None):
    user = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
    OperationLog.objects.using("default").create(
        operator_id=user.id if user else 0,
        operator_name=user.username if user else "anonymous",
        module=module,
        action=action,
        request_method=request.method,
        request_path=request.path,
        request_ip=request.META.get("REMOTE_ADDR", ""),
        extra_data=extra_data or {},
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def overview(request):
    data = {
        "user_count": SystemUser.objects.using("default").count(),
        "role_count": RolePermission.objects.using("default").count(),
        "log_count": OperationLog.objects.using("default").count(),
        "online_hint": "django_session_auth",
    }
    return api_response(data=data)


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    payload = parse_request_data(request)
    username = payload.get("username", "")
    password = payload.get("password", "")
    user = authenticate(request, username=username, password=password)
    if not user:
        return api_error(msg="invalid_credentials", code=1001, status=400)
    login(request, user)
    user.last_login_ip = request.META.get("REMOTE_ADDR", "")
    user.save(update_fields=["last_login_ip", "last_login"])
    _write_log(request, module="system", action="login")
    return api_response(
        data={
            "id": user.id,
            "username": user.username,
            "real_name": user.real_name,
            "user_type": user.user_type,
            "roles": user.roles,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    _write_log(request, module="system", action="logout")
    logout(request)
    return api_response(data={"logged_out": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    user = request.user
    return api_response(
        data={
            "id": user.id,
            "username": user.username,
            "real_name": user.real_name,
            "phone": user.phone,
            "user_type": user.user_type,
            "roles": user.roles,
            "department": user.department,
            "region": user.region,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_list(request):
    users = SystemUser.objects.using("default").all().order_by("-id")
    data = [
        {
            "id": item.id,
            "username": item.username,
            "real_name": item.real_name,
            "phone": item.phone,
            "user_type": item.user_type,
            "roles": item.roles,
            "department": item.department,
            "region": item.region,
            "is_active": item.is_active,
        }
        for item in users
    ]
    return api_response(data=data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def role_list(request):
    roles = RolePermission.objects.using("default").all().order_by("id")
    data = [
        {
            "id": item.id,
            "role_code": item.role_code,
            "role_name": item.role_name,
            "permissions": item.permissions,
            "description": item.description,
        }
        for item in roles
    ]
    return api_response(data=data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def operation_log_list(request):
    logs = OperationLog.objects.using("default").all()[:100]
    data = [
        {
            "id": item.id,
            "operator_id": item.operator_id,
            "operator_name": item.operator_name,
            "module": item.module,
            "action": item.action,
            "request_method": item.request_method,
            "request_path": item.request_path,
            "request_ip": item.request_ip,
            "extra_data": item.extra_data,
            "created_at": item.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }
        for item in logs
    ]
    return api_response(data=data)
