import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uav_platform.settings")
django.setup()

from system.views import _ensure_system_settings, _serialize_system_settings_bundle

print("Initializing system settings...")
settings = _ensure_system_settings()
print(f"System settings initialized, count: {len(settings)}")

bundle = _serialize_system_settings_bundle(settings)
print(f"Groups: {len(bundle['groups'])}")
print(f"Settings: {len(bundle['values'])}")
print(f"Stats: {bundle['stats']}")

print("\nSystem settings initialized successfully!")
