from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from common.request_utils import parse_request_data
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
def login_view(request):
    import logging
    import json
    logger = logging.getLogger(__name__)
    
    if request.method == 'POST':
        payload = parse_request_data(request)
        username = payload.get("username", "")
        password = payload.get("password", "")
        
        logger.info(f"Login attempt: username={username}, password_length={len(password)}")
        
        user = authenticate(request, username=username, password=password)
        if not user:
            logger.info(f"Login failed: username={username}")
            return HttpResponse(
                json.dumps({"code": 1001, "msg": "invalid_credentials", "data": None}),
                content_type="application/json",
                status=400
            )
        
        logger.info(f"Login success: username={username}")
        login(request, user)
        logger.info(f"After login - user authenticated: {request.user.is_authenticated}")
        logger.info(f"After login - username: {request.user.username}")
        user.last_login_ip = request.META.get("REMOTE_ADDR", "")
        user.save(update_fields=["last_login_ip", "last_login"])
        _write_log(request, module="system", action="login")
        
        # 确保 session 被保存
        if hasattr(request, 'session'):
            if not request.session.session_key:
                request.session.save()
            logger.info(f"Session ID: {request.session.session_key}")
            # 手动将用户 ID 存储在会话中
            request.session['user_id'] = user.id
            request.session.save()
            logger.info(f"Session user_id: {request.session.get('user_id')}")
        
        # 创建响应
        response_data = {
            "code": 0, 
            "msg": "success", 
            "data": {
                "id": user.id,
                "username": user.username,
                "real_name": user.real_name,
                "user_type": user.user_type,
                "roles": user.roles,
            }
        }
        
        response = HttpResponse(
            json.dumps(response_data),
            content_type="application/json"
        )
        
        # 确保 session cookie 被设置
        if hasattr(request, 'session') and request.session.session_key:
            from django.conf import settings
            response.set_cookie(
                'sessionid', 
                request.session.session_key, 
                max_age=request.session.get_expiry_age(),
                path=settings.SESSION_COOKIE_PATH,
                domain=settings.SESSION_COOKIE_DOMAIN,
                secure=settings.SESSION_COOKIE_SECURE,
                httponly=settings.SESSION_COOKIE_HTTPONLY,
                samesite=settings.SESSION_COOKIE_SAMESITE,
            )
            logger.info(f"Set sessionid cookie: {request.session.session_key}")
        
        return response
    else:
        return HttpResponse(
            json.dumps({"code": 405, "msg": "Method not allowed", "data": None}),
            content_type="application/json",
            status=405
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


@csrf_exempt
def test_session(request):
    import logging
    import json
    logger = logging.getLogger(__name__)
    
    if request.method == 'GET':
        # 记录请求头中的 cookie
        logger.info(f"Test session - cookies: {request.COOKIES}")
        # 记录会话信息
        if hasattr(request, 'session'):
            logger.info(f"Test session - session key: {request.session.session_key}")
            logger.info(f"Test session - session user_id: {request.session.get('user_id')}")
            logger.info(f"Test session - session items: {dict(request.session.items())}")
        else:
            logger.info("Test session - No session")
        # 记录用户认证状态
        logger.info(f"Test session - user authenticated: {request.user.is_authenticated}")
        logger.info(f"Test session - username: {request.user.username if request.user.is_authenticated else 'anonymous'}")
        
        return HttpResponse(
            json.dumps({
                "code": 0, 
                "msg": "success", 
                "data": {
                    "authenticated": request.user.is_authenticated,
                    "username": request.user.username if request.user.is_authenticated else "anonymous",
                    "session_key": request.session.session_key if hasattr(request, 'session') else "No session",
                    "session_user_id": request.session.get('user_id') if hasattr(request, 'session') else None,
                    "cookies": dict(request.COOKIES)
                }
            }),
            content_type="application/json"
        )
    else:
        return HttpResponse(
            json.dumps({"code": 405, "msg": "Method not allowed", "data": None}),
            content_type="application/json",
            status=405
        )
