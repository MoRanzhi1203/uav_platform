import os
import django

# 设置 Django 环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uav_platform.settings')
django.setup()

from django.contrib.sessions.models import Session
from django.utils import timezone

# 查看所有会话
print("All sessions:")
sessions = Session.objects.all()
for session in sessions:
    print(f"Session key: {session.session_key}")
    print(f"Expire date: {session.expire_date}")
    print(f"Is expired: {session.expire_date < timezone.now()}")
    print("---")

print(f"Total sessions: {sessions.count()}")
