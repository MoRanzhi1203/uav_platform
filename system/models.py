from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models


class SystemUserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, username, password, **extra_fields):
        if not username:
            raise ValueError("The username must be set")
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, password, **extra_fields)

    def create_superuser(self, username, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("user_type", "super_admin")
        extra_fields.setdefault("roles", ["super_admin", "dispatcher"])
        return self._create_user(username, password, **extra_fields)


class SystemUser(AbstractUser):
    USER_TYPE_CHOICES = (
        ("super_admin", "super_admin"),
        ("dispatcher", "dispatcher"),
        ("pilot", "pilot"),
        ("forest_officer", "forest_officer"),
        ("agri_officer", "agri_officer"),
    )

    real_name = models.CharField(max_length=64, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    user_type = models.CharField(max_length=32, choices=USER_TYPE_CHOICES, default="dispatcher")
    roles = models.JSONField(default=list)
    department = models.CharField(max_length=128, blank=True)
    region = models.CharField(max_length=128, blank=True)
    last_login_ip = models.CharField(max_length=64, blank=True)
    remark = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = SystemUserManager()

    class Meta:
        db_table = "system_user"
        verbose_name = "system_user"
        verbose_name_plural = "system_user"

    def __str__(self):
        return self.username


class RolePermission(models.Model):
    role_code = models.CharField(max_length=64, unique=True)
    role_name = models.CharField(max_length=64)
    permissions = models.JSONField(default=list)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "system_role_permission"
        ordering = ["id"]

    def __str__(self):
        return self.role_name


class OperationLog(models.Model):
    operator_id = models.BigIntegerField(default=0)
    operator_name = models.CharField(max_length=64)
    module = models.CharField(max_length=64)
    action = models.CharField(max_length=64)
    request_method = models.CharField(max_length=16, blank=True)
    request_path = models.CharField(max_length=255, blank=True)
    request_ip = models.CharField(max_length=64, blank=True)
    extra_data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "system_operation_log"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.module}:{self.action}"


class SystemSetting(models.Model):
    VALUE_TYPE_CHOICES = (
        ("string", "string"),
        ("int", "int"),
        ("float", "float"),
        ("bool", "bool"),
        ("select", "select"),
    )

    config_key = models.CharField(max_length=64, unique=True)
    config_group = models.CharField(max_length=64)
    config_name = models.CharField(max_length=128)
    value_type = models.CharField(max_length=16, choices=VALUE_TYPE_CHOICES, default="string")
    config_value = models.JSONField(default=dict)
    options = models.JSONField(default=list, blank=True)
    description = models.CharField(max_length=255, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    updated_by = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "system_setting"
        ordering = ["config_group", "sort_order", "id"]

    def __str__(self):
        return f"{self.config_group}:{self.config_key}"
