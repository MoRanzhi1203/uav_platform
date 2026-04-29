import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uav_platform.settings")
django.setup()

print("Django environment setup complete!")

from django.conf import settings
print("DATABASES configured:", list(settings.DATABASES.keys()))

from system.models import SystemUser, RolePermission, OperationLog, SystemSetting

print("\nChecking system models...")
try:
    user_count = SystemUser.objects.using("default").count()
    print(f"SystemUser count: {user_count}")
except Exception as e:
    print(f"Error checking SystemUser: {e}")

try:
    role_count = RolePermission.objects.using("default").count()
    print(f"RolePermission count: {role_count}")
except Exception as e:
    print(f"Error checking RolePermission: {e}")

try:
    log_count = OperationLog.objects.using("default").count()
    print(f"OperationLog count: {log_count}")
except Exception as e:
    print(f"Error checking OperationLog: {e}")

try:
    setting_count = SystemSetting.objects.using("default").count()
    print(f"SystemSetting count: {setting_count}")
except Exception as e:
    print(f"Error checking SystemSetting: {e}")

print("\nEnvironment test complete!")
