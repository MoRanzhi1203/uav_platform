from django.contrib.auth import authenticate, login, logout
from django.db import models
from django.http import JsonResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from common.request_utils import parse_request_data
from common.responses import api_error, api_response
from system.models import OperationLog, RolePermission, SystemSetting, SystemUser


SYSTEM_SETTING_GROUPS = {
    "platform": {
        "title": "平台基础配置",
        "description": "维护平台名称、部署区域、时区与地图初始化参数。",
    },
    "security": {
        "title": "安全策略",
        "description": "统一维护登录会话、密码强度和账号安全策略。",
    },
    "notification": {
        "title": "通知告警",
        "description": "控制风险预警、短信邮件通知和处置时效。",
    },
    "dispatch": {
        "title": "调度与地图",
        "description": "配置任务调度限制、返航阈值和默认底图显示。",
    },
    "data": {
        "title": "数据与日志",
        "description": "定义日志保留、遥测保留、备份与导出策略。",
    },
}


SYSTEM_SETTING_DEFAULTS = [
    {
        "config_key": "platform_name",
        "config_group": "platform",
        "config_name": "平台名称",
        "value_type": "string",
        "default_value": "无人机群林农协同系统",
        "description": "显示在登录页、导航栏和系统页签中的平台名称。",
        "sort_order": 10,
    },
    {
        "config_key": "deployment_region",
        "config_group": "platform",
        "config_name": "部署区域",
        "value_type": "string",
        "default_value": "重庆山地示范区",
        "description": "用于标识当前平台服务的主要区域。",
        "sort_order": 20,
    },
    {
        "config_key": "timezone",
        "config_group": "platform",
        "config_name": "系统时区",
        "value_type": "select",
        "default_value": "Asia/Shanghai",
        "options": ["Asia/Shanghai", "UTC", "Asia/Chongqing"],
        "description": "影响页面时间显示与日志换算。",
        "sort_order": 30,
    },
    {
        "config_key": "data_refresh_interval",
        "config_group": "platform",
        "config_name": "数据刷新间隔(秒)",
        "value_type": "int",
        "default_value": 30,
        "description": "页面自动刷新关键业务数据的周期。",
        "sort_order": 40,
    },
    {
        "config_key": "default_map_zoom",
        "config_group": "platform",
        "config_name": "默认地图缩放级别",
        "value_type": "int",
        "default_value": 12,
        "description": "进入地图页面时的初始缩放等级。",
        "sort_order": 50,
    },
    {
        "config_key": "session_timeout_hours",
        "config_group": "security",
        "config_name": "会话过期时长(小时)",
        "value_type": "int",
        "default_value": 8,
        "description": "用户登录后的会话有效时长。",
        "sort_order": 60,
    },
    {
        "config_key": "password_min_length",
        "config_group": "security",
        "config_name": "密码最小长度",
        "value_type": "int",
        "default_value": 8,
        "description": "新增和重置密码时的最小长度要求。",
        "sort_order": 70,
    },
    {
        "config_key": "require_strong_password",
        "config_group": "security",
        "config_name": "启用强密码策略",
        "value_type": "bool",
        "default_value": True,
        "description": "要求密码包含数字、字母等更强规则。",
        "sort_order": 80,
    },
    {
        "config_key": "enable_login_captcha",
        "config_group": "security",
        "config_name": "启用登录验证码",
        "value_type": "bool",
        "default_value": False,
        "description": "登录时增加验证码校验。",
        "sort_order": 90,
    },
    {
        "config_key": "allow_multi_login",
        "config_group": "security",
        "config_name": "允许多端同时登录",
        "value_type": "bool",
        "default_value": True,
        "description": "关闭后同一账号新登录会挤掉旧会话。",
        "sort_order": 100,
    },
    {
        "config_key": "enable_risk_alert",
        "config_group": "notification",
        "config_name": "启用风险告警",
        "value_type": "bool",
        "default_value": True,
        "description": "控制高风险区域和异常飞行告警总开关。",
        "sort_order": 110,
    },
    {
        "config_key": "enable_sms_notice",
        "config_group": "notification",
        "config_name": "启用短信通知",
        "value_type": "bool",
        "default_value": False,
        "description": "高优先级事件通过短信发送通知。",
        "sort_order": 120,
    },
    {
        "config_key": "enable_email_notice",
        "config_group": "notification",
        "config_name": "启用邮件通知",
        "value_type": "bool",
        "default_value": True,
        "description": "任务、日志和风险信息支持邮件通知。",
        "sort_order": 130,
    },
    {
        "config_key": "alert_response_minutes",
        "config_group": "notification",
        "config_name": "告警响应时限(分钟)",
        "value_type": "int",
        "default_value": 15,
        "description": "用于页面展示和业务提醒的建议响应时限。",
        "sort_order": 140,
    },
    {
        "config_key": "enable_auto_dispatch",
        "config_group": "dispatch",
        "config_name": "启用自动调度",
        "value_type": "bool",
        "default_value": True,
        "description": "允许系统根据规则自动派发任务。",
        "sort_order": 150,
    },
    {
        "config_key": "task_concurrency_limit",
        "config_group": "dispatch",
        "config_name": "并发任务上限",
        "value_type": "int",
        "default_value": 12,
        "description": "系统允许同时运行的任务数量上限。",
        "sort_order": 160,
    },
    {
        "config_key": "return_home_battery",
        "config_group": "dispatch",
        "config_name": "返航电量阈值(%)",
        "value_type": "int",
        "default_value": 25,
        "description": "低于该值时建议执行返航策略。",
        "sort_order": 170,
    },
    {
        "config_key": "default_map_layer",
        "config_group": "dispatch",
        "config_name": "默认地图底图",
        "value_type": "select",
        "default_value": "satellite",
        "options": ["satellite", "vector", "terrain"],
        "description": "地图页面默认显示的底图类型。",
        "sort_order": 180,
    },
    {
        "config_key": "log_retention_days",
        "config_group": "data",
        "config_name": "操作日志保留天数",
        "value_type": "int",
        "default_value": 180,
        "description": "系统操作日志建议保留的时间长度。",
        "sort_order": 190,
    },
    {
        "config_key": "telemetry_retention_days",
        "config_group": "data",
        "config_name": "遥测数据保留天数",
        "value_type": "int",
        "default_value": 90,
        "description": "飞行轨迹和实时遥测数据保留周期。",
        "sort_order": 200,
    },
    {
        "config_key": "enable_auto_backup",
        "config_group": "data",
        "config_name": "启用自动备份",
        "value_type": "bool",
        "default_value": True,
        "description": "定期执行系统备份任务。",
        "sort_order": 210,
    },
    {
        "config_key": "backup_cycle",
        "config_group": "data",
        "config_name": "备份周期",
        "value_type": "select",
        "default_value": "daily",
        "options": ["daily", "weekly", "monthly"],
        "description": "自动备份任务的执行频率。",
        "sort_order": 220,
    },
]


def _write_log(request, module, action, extra_data=None):
    user = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
    try:
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
    except Exception:
        # Logging failures must never break business APIs.
        return None


def _serialize_user(item):
    return {
        "id": item.id,
        "username": item.username,
        "real_name": item.real_name,
        "email": item.email,
        "phone": item.phone,
        "user_type": item.user_type,
        "roles": item.roles,
        "department": item.department,
        "region": item.region,
        "remark": item.remark,
        "is_active": item.is_active,
        "last_login": timezone.localtime(item.last_login).strftime("%Y-%m-%d %H:%M:%S") if item.last_login else "",
        "last_login_ip": item.last_login_ip,
        "created_at": timezone.localtime(item.created_at).strftime("%Y-%m-%d %H:%M:%S") if item.created_at else "",
        "updated_at": timezone.localtime(item.updated_at).strftime("%Y-%m-%d %H:%M:%S") if item.updated_at else "",
    }


def _normalize_roles(raw_roles):
    if isinstance(raw_roles, list):
        roles = raw_roles
    elif isinstance(raw_roles, str):
        roles = [item.strip() for item in raw_roles.split(",") if item.strip()]
    else:
        roles = []
    return list(dict.fromkeys(roles))


def _get_setting_definition_map():
    return {item["config_key"]: item for item in SYSTEM_SETTING_DEFAULTS}


def _coerce_setting_value(raw_value, value_type):
    if value_type == "bool":
        if isinstance(raw_value, bool):
            return raw_value
        if isinstance(raw_value, (int, float)):
            return bool(raw_value)
        return str(raw_value).strip().lower() in {"1", "true", "yes", "on"}
    if value_type == "int":
        return int(raw_value)
    if value_type == "float":
        return float(raw_value)
    return "" if raw_value is None else str(raw_value).strip()


def _ensure_system_settings():
    existing_keys = set(SystemSetting.objects.using("default").values_list("config_key", flat=True))
    missing_items = []
    for item in SYSTEM_SETTING_DEFAULTS:
        if item["config_key"] in existing_keys:
            continue
        missing_items.append(
            SystemSetting(
                config_key=item["config_key"],
                config_group=item["config_group"],
                config_name=item["config_name"],
                value_type=item["value_type"],
                config_value=item["default_value"],
                options=item.get("options", []),
                description=item.get("description", ""),
                sort_order=item.get("sort_order", 0),
            )
        )
    if missing_items:
        SystemSetting.objects.using("default").bulk_create(missing_items)
    return list(SystemSetting.objects.using("default").all().order_by("config_group", "sort_order", "id"))


def _serialize_system_settings_bundle(items):
    groups = []
    values = {}
    updated_timestamps = []

    for group_key, group_meta in SYSTEM_SETTING_GROUPS.items():
        group_items = []
        for item in items:
            if item.config_group != group_key:
                continue
            values[item.config_key] = item.config_value
            group_items.append(
                {
                    "key": item.config_key,
                    "group": item.config_group,
                    "name": item.config_name,
                    "value_type": item.value_type,
                    "value": item.config_value,
                    "options": item.options,
                    "description": item.description,
                    "sort_order": item.sort_order,
                    "updated_by": item.updated_by,
                    "updated_at": timezone.localtime(item.updated_at).strftime("%Y-%m-%d %H:%M:%S") if item.updated_at else "",
                }
            )
            if item.updated_at:
                updated_timestamps.append(item.updated_at)

        groups.append(
            {
                "key": group_key,
                "title": group_meta["title"],
                "description": group_meta["description"],
                "item_count": len(group_items),
                "items": group_items,
            }
        )

    enabled_switch_count = sum(
        1 for item in items if item.value_type == "bool" and bool(item.config_value)
    )
    last_updated = timezone.localtime(max(updated_timestamps)).strftime("%Y-%m-%d %H:%M:%S") if updated_timestamps else ""
    values = values or {}
    suggestions = []
    if int(values.get("password_min_length") or 0) < 8:
        suggestions.append("建议将密码最小长度设置为 8 位及以上。")
    if not values.get("enable_auto_backup"):
        suggestions.append("建议启用自动备份，降低配置丢失风险。")
    if not suggestions:
        suggestions.append("当前系统配置状态良好。")
    return {
        "groups": groups,
        "values": values,
        "base_config": {
            "platform_name": values.get("platform_name", "无人机群林农协同系统"),
            "timezone": values.get("timezone", "Asia/Shanghai"),
            "default_map_zoom": values.get("default_map_zoom", 12),
        },
        "security_policy": {
            "session_timeout_hours": values.get("session_timeout_hours", 24),
            "password_min_length": values.get("password_min_length", 8),
            "require_strong_password": values.get("require_strong_password", True),
        },
        "summary": {
            "platform_name": values.get("platform_name", "无人机群林农协同系统"),
            "deployment_region": values.get("deployment_region", "重庆山地示范区"),
            "last_updated": last_updated,
        },
        "suggestions": suggestions,
        "stats": {
            "group_count": len(groups),
            "item_count": len(items),
            "enabled_switch_count": enabled_switch_count,
            "enabled_policy_count": enabled_switch_count,
            "last_updated": last_updated,
        },
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_stats(request):
    from datetime import timedelta
    
    total_users = SystemUser.objects.using("default").count()
    active_users = SystemUser.objects.using("default").filter(is_active=True).count()
    admin_users = sum(
        1
        for item in SystemUser.objects.using("default").all()
        if item.is_superuser or item.user_type == "super_admin" or "super_admin" in (item.roles or [])
    )
    
    seven_days_ago = timezone.now() - timedelta(days=7)
    recent_active_users = SystemUser.objects.using("default").filter(last_login__gte=seven_days_ago).count()
    
    return api_response(data={
        "total_users": total_users,
        "active_users": active_users,
        "admin_users": admin_users,
        "recent_active_users": recent_active_users
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def operation_log_stats(request):
    from datetime import timedelta
    
    local_now = timezone.localtime()
    start_of_day = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    today_count = OperationLog.objects.using("default").filter(
        created_at__gte=start_of_day,
        created_at__lt=end_of_day,
    ).count()
    total_count = OperationLog.objects.using("default").count()
    
    seven_days_ago = timezone.now() - timedelta(days=7)
    active_user_count = OperationLog.objects.using("default").filter(
        created_at__gte=seven_days_ago
    ).values("operator_id").distinct().count()
    
    module_count = OperationLog.objects.using("default").values("module").distinct().count()
    
    return api_response(data={
        "today_count": today_count,
        "total_count": total_count,
        "active_user_count": active_user_count,
        "module_count": module_count
    })


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
            return JsonResponse({"success": False, "code": 1001, "msg": "invalid_credentials", "message": "invalid_credentials", "data": None}, status=400)
        
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
            "success": True,
            "code": 0, 
            "msg": "success", 
            "message": "success",
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
        return JsonResponse({"success": False, "code": 405, "msg": "Method not allowed", "message": "Method not allowed", "data": None}, status=405)


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
    keyword = (request.GET.get("keyword") or "").strip()
    role = (request.GET.get("role") or "").strip()
    status = (request.GET.get("status") or "").strip()
    department = (request.GET.get("department") or "").strip()

    users = SystemUser.objects.using("default").all().order_by("-id")
    if keyword:
        lowered = keyword.lower()
        users = [
            item for item in users
            if lowered in (item.username or "").lower()
            or lowered in (item.real_name or "").lower()
            or lowered in (item.phone or "").lower()
            or lowered in (item.email or "").lower()
            or lowered in (item.region or "").lower()
        ]
    if role:
        users = [item for item in users if role in (item.roles or []) or item.user_type == role]
    if status in {"active", "inactive"}:
        expected = status == "active"
        users = [item for item in users if item.is_active == expected]
    if department:
        department_lower = department.lower()
        users = [item for item in users if department_lower in (item.department or "").lower()]

    data = [_serialize_user(item) for item in users]
    return api_response(data=data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def user_create(request):
    payload = parse_request_data(request)
    username = (payload.get("username") or "").strip()
    if not username:
        return api_error(msg="用户名不能为空")
    if SystemUser.objects.using("default").filter(username=username).exists():
        return api_error(msg="用户名已存在")

    password = payload.get("password") or "123456"
    user = SystemUser(
        username=username,
        real_name=(payload.get("real_name") or "").strip(),
        email=(payload.get("email") or "").strip(),
        phone=(payload.get("phone") or "").strip(),
        user_type=(payload.get("user_type") or "dispatcher").strip() or "dispatcher",
        roles=_normalize_roles(payload.get("roles")),
        department=(payload.get("department") or "").strip(),
        region=(payload.get("region") or "").strip(),
        remark=(payload.get("remark") or "").strip(),
        is_active=bool(payload.get("is_active", True)),
    )
    user.set_password(password)
    user.save(using="default")
    _write_log(
        request,
        module="system",
        action="create_user",
        extra_data={"target_user_id": user.id, "target_username": user.username},
    )
    return api_response(data=_serialize_user(user), msg="用户创建成功")


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def user_detail(request, user_id):
    user = get_object_or_404(SystemUser.objects.using("default"), pk=user_id)
    if request.method == "GET":
        return api_response(data=_serialize_user(user))
    payload = parse_request_data(request)
    username = (payload.get("username") or user.username).strip()

    if not username:
        return api_error(msg="用户名不能为空")
    if SystemUser.objects.using("default").exclude(pk=user.id).filter(username=username).exists():
        return api_error(msg="用户名已存在")

    user.username = username
    user.real_name = (payload.get("real_name") or "").strip()
    user.email = (payload.get("email") or "").strip()
    user.phone = (payload.get("phone") or "").strip()
    user.user_type = (payload.get("user_type") or "dispatcher").strip() or "dispatcher"
    user.roles = _normalize_roles(payload.get("roles"))
    user.department = (payload.get("department") or "").strip()
    user.region = (payload.get("region") or "").strip()
    user.remark = (payload.get("remark") or "").strip()
    if "is_active" in payload:
        if request.user.id == user.id and not payload.get("is_active"):
            return api_error(msg="当前登录用户不能停用自己")
        user.is_active = bool(payload.get("is_active"))

    password = (payload.get("password") or "").strip()
    if password:
        user.set_password(password)

    user.save(using="default")
    _write_log(
        request,
        module="system",
        action="update_user",
        extra_data={"target_user_id": user.id, "target_username": user.username},
    )
    return api_response(data=_serialize_user(user), msg="用户更新成功")


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def user_delete(request, user_id):
    user = get_object_or_404(SystemUser.objects.using("default"), pk=user_id)
    if request.user.id == user.id:
        return api_error(msg="当前登录用户不能删除自己")
    username = user.username
    user.delete()
    _write_log(
        request,
        module="system",
        action="delete_user",
        extra_data={"target_user_id": user_id, "target_username": username},
    )
    return api_response(data={"deleted": True}, msg="用户删除成功")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def user_toggle_active(request, user_id):
    user = get_object_or_404(SystemUser.objects.using("default"), pk=user_id)
    payload = parse_request_data(request)
    is_active = payload.get("is_active")
    if is_active is None:
        is_active = not user.is_active
    else:
        is_active = bool(is_active)

    if request.user.id == user.id and not is_active:
        return api_error(msg="当前登录用户不能停用自己")

    user.is_active = is_active
    user.save(using="default", update_fields=["is_active", "updated_at"])
    _write_log(
        request,
        module="system",
        action="toggle_user_status",
        extra_data={"target_user_id": user.id, "target_username": user.username, "is_active": is_active},
    )
    return api_response(data=_serialize_user(user), msg="账号状态已更新")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def user_reset_password(request, user_id):
    user = get_object_or_404(SystemUser.objects.using("default"), pk=user_id)
    payload = parse_request_data(request)
    new_password = (payload.get("password") or "123456").strip()
    if not new_password:
        return api_error(msg="新密码不能为空")

    user.set_password(new_password)
    user.save(using="default", update_fields=["password", "updated_at"])
    _write_log(
        request,
        module="system",
        action="reset_user_password",
        extra_data={"target_user_id": user.id, "target_username": user.username},
    )
    return api_response(data={"id": user.id}, msg="密码重置成功")


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
def setting_list(request):
    items = _ensure_system_settings()
    return api_response(data=_serialize_system_settings_bundle(items))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def setting_save(request):
    payload = parse_request_data(request)
    values = payload.get("values", payload)
    if not isinstance(values, dict):
        return api_error(msg="配置数据格式错误")

    definition_map = _get_setting_definition_map()
    items = _ensure_system_settings()
    setting_map = {item.config_key: item for item in items}
    changed_keys = []

    for config_key, raw_value in values.items():
        definition = definition_map.get(config_key)
        setting = setting_map.get(config_key)
        if not definition or not setting:
            continue
        try:
            normalized_value = _coerce_setting_value(raw_value, definition["value_type"])
        except (TypeError, ValueError):
            return api_error(msg=f"{definition['config_name']} 配置值无效")

        if normalized_value == setting.config_value:
            continue

        setting.config_value = normalized_value
        setting.updated_by = request.user.username
        setting.save(using="default", update_fields=["config_value", "updated_by", "updated_at"])
        changed_keys.append(config_key)

    if changed_keys:
        _write_log(
            request,
            module="system",
            action="save_settings",
            extra_data={"changed_keys": changed_keys},
        )

    items = list(SystemSetting.objects.using("default").all().order_by("config_group", "sort_order", "id"))
    bundle = _serialize_system_settings_bundle(items)
    return api_response(
        data={
            **bundle,
            "updated_at": bundle["stats"].get("last_updated", ""),
        },
        msg="系统配置已保存" if changed_keys else "未检测到配置变更",
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def setting_reset(request):
    payload = parse_request_data(request)
    group = (payload.get("group") or "").strip()
    definition_map = _get_setting_definition_map()
    items = _ensure_system_settings()
    reset_keys = []

    for item in items:
        definition = definition_map.get(item.config_key)
        if not definition:
            continue
        if group and item.config_group != group:
            continue
        item.config_value = definition["default_value"]
        item.updated_by = request.user.username
        item.save(using="default", update_fields=["config_value", "updated_by", "updated_at"])
        reset_keys.append(item.config_key)

    _write_log(
        request,
        module="system",
        action="reset_settings",
        extra_data={"group": group or "all", "reset_keys": reset_keys},
    )

    items = list(SystemSetting.objects.using("default").all().order_by("config_group", "sort_order", "id"))
    bundle = _serialize_system_settings_bundle(items)
    return api_response(
        data={
            **bundle,
            "updated_at": bundle["stats"].get("last_updated", ""),
        },
        msg="系统配置已恢复默认值",
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def operation_log_list(request):
    logs = OperationLog.objects.using("default").all()
    
    keyword = (request.GET.get("keyword") or "").strip()
    module = (request.GET.get("module") or "").strip()
    action = (request.GET.get("action") or "").strip()
    operator = (request.GET.get("operator") or "").strip()
    start_date = (request.GET.get("start_date") or "").strip()
    end_date = (request.GET.get("end_date") or "").strip()
    
    if keyword:
        logs = logs.filter(
            models.Q(operator_name__icontains=keyword) |
            models.Q(module__icontains=keyword) |
            models.Q(action__icontains=keyword) |
            models.Q(request_path__icontains=keyword)
        )
    if module:
        logs = logs.filter(module__icontains=module)
    if action:
        logs = logs.filter(action__icontains=action)
    if operator:
        logs = logs.filter(operator_name__icontains=operator)
    if start_date:
        logs = logs.filter(created_at__gte=f"{start_date} 00:00:00")
    if end_date:
        logs = logs.filter(created_at__lte=f"{end_date} 23:59:59")
    
    logs = logs.order_by("-created_at")
    
    page = int(request.GET.get("page", 1))
    page_size = int(request.GET.get("page_size", 20))
    total = logs.count()
    start = (page - 1) * page_size
    end = start + page_size
    logs_page = logs[start:end]
    
    data = [
        {
            "id": item.id,
            "time": timezone.localtime(item.created_at).strftime("%Y-%m-%d %H:%M:%S"),
            "operator": item.operator_name,
            "operator_id": item.operator_id,
            "operator_name": item.operator_name,
            "module": item.module,
            "action": item.action,
            "method": item.request_method,
            "request_method": item.request_method,
            "path": item.request_path,
            "request_path": item.request_path,
            "ip_address": item.request_ip,
            "request_ip": item.request_ip,
            "detail": item.extra_data,
            "extra_data": item.extra_data,
            "created_at": timezone.localtime(item.created_at).strftime("%Y-%m-%d %H:%M:%S"),
        }
        for item in logs_page
    ]
    
    modules = list(OperationLog.objects.using("default").values_list("module", flat=True).distinct())
    actions = list(OperationLog.objects.using("default").values_list("action", flat=True).distinct())
    
    return api_response(data={
        "logs": data,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size if total > 0 else 1
        },
        "filters": {
            "modules": modules,
            "actions": actions
        }
    })


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
