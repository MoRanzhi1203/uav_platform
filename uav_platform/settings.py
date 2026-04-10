from pathlib import Path

import pymysql

pymysql.install_as_MySQLdb()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "django-insecure-^@n0f4@_m8te&58691^qq(w9%$1=+y1=&eti=ytt3cu7gncul5"

DEBUG = True

ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "common",
    "system",
    "fleet",
    "forest",
    "agri",
    "tasking",
    "federation",
    "telemetry",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "uav_platform.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "uav_platform.wsgi.application"
ASGI_APPLICATION = "uav_platform.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": "central_db",
        "USER": "root",
        "PASSWORD": "123456",
        "HOST": "127.0.0.1",
        "PORT": "3306",
        "OPTIONS": {
            "charset": "utf8",
            "init_command": "SET NAMES utf8 COLLATE utf8_general_ci",
        },
        "TEST": {
            "CHARSET": "utf8",
            "COLLATION": "utf8_general_ci",
        },
    },
    "forest": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": "forest_db",
        "USER": "root",
        "PASSWORD": "123456",
        "HOST": "127.0.0.1",
        "PORT": "3306",
        "OPTIONS": {
            "charset": "utf8",
            "init_command": "SET NAMES utf8 COLLATE utf8_general_ci",
        },
        "TEST": {
            "CHARSET": "utf8",
            "COLLATION": "utf8_general_ci",
        },
    },
    "agri": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": "agri_db",
        "USER": "root",
        "PASSWORD": "123456",
        "HOST": "127.0.0.1",
        "PORT": "3306",
        "OPTIONS": {
            "charset": "utf8",
            "init_command": "SET NAMES utf8 COLLATE utf8_general_ci",
        },
        "TEST": {
            "CHARSET": "utf8",
            "COLLATION": "utf8_general_ci",
        },
    },
}

DATABASE_ROUTERS = ["uav_platform.db_router.MultiDBRouter"]

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_I18N = True
USE_TZ = False

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "system.SystemUser"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}

SESSION_COOKIE_AGE = 60 * 60 * 12
CSRF_TRUSTED_ORIGINS = []
