import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uav_platform.settings")
django.setup()

from system.models import RolePermission, SystemUser  # noqa: E402


def main():
    user, created = SystemUser.objects.using("default").get_or_create(
        username="admin",
        defaults={
            "real_name": "系统管理员",
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
            "user_type": "super_admin",
            "roles": ["super_admin", "dispatcher", "forest_officer", "agri_officer"],
            "department": "平台管理中心",
            "region": "重庆市",
        },
    )
    user.set_password("Admin@123456")
    user.save(using="default")

    default_roles = [
        {
            "role_code": "super_admin",
            "role_name": "超级管理员",
            "permissions": ["system:*", "fleet:*", "forest:*", "agri:*", "tasking:*", "federation:*"],
            "description": "平台最高权限角色",
        },
        {
            "role_code": "dispatcher",
            "role_name": "统一调度员",
            "permissions": ["tasking:view", "tasking:dispatch", "fleet:view", "federation:view"],
            "description": "负责跨库任务协同调度",
        },
        {
            "role_code": "forest_officer",
            "role_name": "林业专员",
            "permissions": ["forest:view", "forest:task", "federation:view"],
            "description": "负责森林巡检与火情监管",
        },
        {
            "role_code": "agri_officer",
            "role_name": "农业专员",
            "permissions": ["agri:view", "agri:task", "federation:view"],
            "description": "负责农业植保与病虫害监管",
        },
    ]
    for role in default_roles:
        RolePermission.objects.using("default").update_or_create(role_code=role["role_code"], defaults=role)

    print(f"admin initialized: created={created}, username=admin, password=Admin@123456")


if __name__ == "__main__":
    main()
