import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from agri.models import FarmPlot, AgriTask, PestMonitor
from terrain.models import TerrainArea, TerrainZone

class Command(BaseCommand):
    help = 'Seed agri data for areas, plots, pest warnings, and tasks'

    def handle(self, *args, **options):
        self.stdout.write('Seeding agri data...')

        # 1. Seed TerrainAreas (if missing)
        regions = ["重庆农业示范区", "江北现代农业园", "九龙坡农耕地", "渝北智慧农场", "巴南生态农业带"]
        for i in range(21):
            name = f"示范区 {chr(65 + (i % 26))}{i // 26 + 1}"
            TerrainArea.objects.using('terrain').update_or_create(
                name=name,
                defaults={
                    'type': 'farm',
                    'risk_level': random.choice(['low', 'medium', 'high']),
                    'area': random.randint(50, 500),
                    'description': random.choice(regions),
                    'center_lat': 29.5 + random.uniform(-0.1, 0.1),
                    'center_lng': 106.5 + random.uniform(-0.1, 0.1),
                    'is_deleted': False
                }
            )

        # 2. Seed TerrainZones (Plots)
        areas = list(TerrainArea.objects.using('terrain').filter(type='farm', is_deleted=False))
        current_zone_count = TerrainZone.objects.using('terrain').filter(category='farmland', is_deleted=False).count()
        for i in range(max(0, 35 - current_zone_count)):
            area = random.choice(areas)
            TerrainZone.objects.using('terrain').create(
                area_obj=area,
                name=f"地块 {current_zone_count + i + 1}",
                category='farmland',
                risk_level=random.choice(['low', 'medium', 'high']),
                area=random.randint(5, 20),
                is_deleted=False
            )

        # 3. Seed PestMonitor
        pests = ["稻飞虱", "小麦条锈病", "玉米螟", "粘虫", "红蜘蛛"]
        current_pest_count = PestMonitor.objects.using('agri').count()
        for i in range(max(0, 10 - current_pest_count)):
            area = random.choice(areas)
            PestMonitor.objects.using('agri').create(
                farm_plot_id=area.id,
                pest_type=random.choice(pests),
                severity=random.choice(['红色预警', '橙色预警', '黄色预警']),
                coverage_ratio=random.uniform(5, 40),
                detected_at=timezone.now() - timedelta(minutes=random.randint(10, 500))
            )

        # 4. Seed AgriTask
        statuses = ["pending", "running", "completed", "failed"]
        task_types = ["spray", "monitor", "survey"]
        current_task_count = AgriTask.objects.using('agri').count()
        for i in range(max(0, 6 - current_task_count)):
            area = random.choice(areas)
            AgriTask.objects.using('agri').create(
                task_code=f"AGRI-TASK-20260501-{100 + current_task_count + i}",
                farm_plot_id=area.id,
                task_type=random.choice(task_types),
                status=random.choice(statuses),
                planned_start=timezone.now() - timedelta(hours=random.randint(1, 24)),
                planned_end=timezone.now() + timedelta(hours=random.randint(1, 24))
            )

        self.stdout.write(self.style.SUCCESS('Successfully seeded agri data'))
