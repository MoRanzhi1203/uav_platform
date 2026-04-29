from django.core.management.base import BaseCommand

from terrain.models import TerrainArea
from terrain.services import sync_terrain_risk_fields
from terrain.views import get_area_active_plots


class Command(BaseCommand):
    help = "重新计算所有地形区域的风险等级与风险分值"

    def handle(self, *args, **options):
        queryset = TerrainArea.objects.filter(is_deleted=False).order_by("id")
        total = queryset.count()
        counts = {"high": 0, "medium": 0, "low": 0, "none": 0}

        for terrain in queryset.iterator():
            active_plots = get_area_active_plots(terrain)
            risk = sync_terrain_risk_fields(terrain, save=True, plots=active_plots)
            counts[risk["risk_level"]] = counts.get(risk["risk_level"], 0) + 1
            self.stdout.write(
                f"[{terrain.name}] {risk['risk_level_display']}，分值 {risk['risk_score']}，"
                f"高风险地块 {risk['high_count']} 个，中风险地块 {risk['medium_count']} 个，"
                f"低风险地块 {risk['low_count']} 个，未标记 {risk['unknown_count']} 个"
            )

        self.stdout.write(
            self.style.SUCCESS(
                "完成：共 {total} 个地形，高风险 {high} 个，中风险 {medium} 个，低风险 {low} 个，未评估 {none} 个".format(
                    total=total,
                    high=counts.get("high", 0),
                    medium=counts.get("medium", 0),
                    low=counts.get("low", 0),
                    none=counts.get("none", 0),
                )
            )
        )
