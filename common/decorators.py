from functools import wraps

from common.responses import api_error


def is_admin_user(user):
    if not user or not user.is_authenticated:
        return False
    roles = set(getattr(user, "roles", []) or [])
    return user.is_staff or user.is_superuser or "super_admin" in roles


def role_required(*roles):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            user = request.user
            if not user or not user.is_authenticated:
                return api_error(msg="unauthorized", code=401, status=401)
            user_roles = set(getattr(user, "roles", []) or [])
            if roles and not user_roles.intersection(set(roles)) and not is_admin_user(user):
                return api_error(msg="forbidden", code=403, status=403)
            return view_func(request, *args, **kwargs)

        return wrapped

    return decorator


def admin_required(view_func):
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        user = request.user
        if not user or not user.is_authenticated:
            return api_error(msg="unauthorized", code=401, status=401)
        if not is_admin_user(user):
            return api_error(msg="admin_required", code=403, status=403)
        return view_func(request, *args, **kwargs)

    return wrapped
