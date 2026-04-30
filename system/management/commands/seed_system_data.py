import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from system.models import SystemUser, RolePermission, OperationLog, SystemSetting
from django.contrib.auth.hashers import make_password

class Command(BaseCommand):
    help = 'Seed system data for users, configs, and logs'

    def handle(self, *args, **options):
        self.stdout.write('Seeding system data...')

        # 1. Seed Roles
        roles_data = [
            {'role_code': 'super_admin', 'role_name': '超级管理员', 'permissions': ['*']},
            {'role_code': 'dispatcher', 'role_name': '调度员', 'permissions': ['tasking:*', 'fleet:view']},
            {'role_code': 'pilot', 'role_name': '飞手', 'permissions': ['fleet:*']},
            {'role_code': 'forest_officer', 'role_name': '林区专员', 'permissions': ['forest:*']},
            {'role_code': 'agri_officer', 'role_name': '农田专员', 'permissions': ['agri:*']},
        ]
        for rd in roles_data:
            RolePermission.objects.using('default').update_or_create(
                role_code=rd['role_code'],
                defaults={'role_name': rd['role_name'], 'permissions': rd['permissions']}
            )

        # 2. Seed Users
        users_to_create = [
            ('admin', '系统管理员', 'super_admin', '平台管理中心'),
            ('zhangsan', '张三', 'dispatcher', '指挥调度组'),
            ('lisi', '李四', 'pilot', '飞行作业组'),
            ('wangwu', '王五', 'forest_officer', '林业资源中心'),
            ('zhaoliu', '赵六', 'agri_officer', '农业技术组'),
            ('sunqi', '孙七', 'pilot', '飞行作业组'),
            ('zhouba', '周八', 'dispatcher', '指挥调度组'),
            ('wujiu', '吴九', 'agri_officer', '农业技术组'),
        ]
        
        password = make_password('Admin@123456')
        for username, real_name, u_type, dept in users_to_create:
            SystemUser.objects.using('default').update_or_create(
                username=username,
                defaults={
                    'real_name': real_name,
                    'user_type': u_type,
                    'roles': [u_type],
                    'department': dept,
                    'is_active': True,
                    'password': password,
                    'region': '重庆市',
                    'last_login': timezone.now() - timedelta(days=random.randint(0, 10))
                }
            )

        # 3. Seed Configs
        from system.views import SYSTEM_SETTING_DEFAULTS
        for item in SYSTEM_SETTING_DEFAULTS:
            SystemSetting.objects.using('default').update_or_create(
                config_key=item['config_key'],
                defaults={
                    'config_group': item['config_group'],
                    'config_name': item['config_name'],
                    'value_type': item['value_type'],
                    'config_value': item['default_value'],
                    'options': item.get('options', []),
                    'description': item.get('description', ""),
                    'sort_order': item.get('sort_order', 0),
                }
            )

        # 4. Seed Logs
        modules = ['system', 'fleet', 'forest', 'agri', 'tasking']
        actions = ['login', 'create', 'update', 'delete', 'export', 'query']
        current_log_count = OperationLog.objects.using('default').count()
        missing_logs = max(0, 35 - current_log_count)
        users = list(SystemUser.objects.using('default').all())
        for i in range(missing_logs):
            user = random.choice(users)
            OperationLog.objects.using('default').create(
                operator_id=user.id,
                operator_name=user.username,
                module=random.choice(modules),
                action=random.choice(actions),
                request_method=random.choice(['GET', 'POST', 'PUT', 'DELETE']),
                request_path=f'/api/{random.choice(modules)}/test/',
                request_ip='127.0.0.1',
                extra_data={'seeded': True},
            )

        self.stdout.write(self.style.SUCCESS('Successfully seeded system data'))
