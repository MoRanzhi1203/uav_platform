from django.core.management.base import BaseCommand
from terrain.models import TerrainSubCategory

class Command(BaseCommand):
    help = 'Initialize default terrain subcategories'

    def handle(self, *args, **options):
        default_config = {
            "plot_categories": [
                {
                    "key": "forest",
                    "name": "林区",
                    "default_subcategories": [
                        "针叶林", "阔叶林", "混交林", "竹林", "灌木林", "经济林", 
                        "果林", "人工林", "天然林", "防护林", "次生林", "疏林地"
                    ]
                },
                {
                    "key": "farmland",
                    "name": "农田",
                    "default_subcategories": [
                        "普通农田", "水田", "旱地", "梯田", "坡耕地", "菜地", 
                        "果园", "茶园", "大棚种植地", "水浇地", "玉米地", 
                        "水稻田", "小麦地", "油菜地", "药材地", "休耕地"
                    ]
                },
                {
                    "key": "building",
                    "name": "建筑",
                    "default_subcategories": [
                        "民房", "村居建筑", "公共建筑", "仓库", "厂房", 
                        "农业设施建筑", "光伏设施", "临时建筑", "废弃建筑", "学校", 
                        "医疗点", "办公建筑", "旅游服务建筑"
                    ]
                },
                {
                    "key": "water",
                    "name": "水域",
                    "default_subcategories": [
                        "河流", "溪流", "水库", "湖泊", "池塘", "水渠", 
                        "鱼塘", "湿地", "蓄水池", "山塘", "灌溉渠", "排水沟"
                    ]
                },
                {
                    "key": "road",
                    "name": "道路",
                    "default_subcategories": [
                        "主干道", "次干道", "村道", "乡道", "机耕道", 
                        "田间道路", "山路", "土路", "硬化道路", "步道", 
                        "支路", "生产便道"
                    ]
                },
                {
                    "key": "bare",
                    "name": "裸地",
                    "default_subcategories": [
                        "草地", "荒地", "沙地", "沙滩", "滩涂", "裸土", 
                        "裸岩地", "碎石地", "鹅卵石地", "空场地", 
                        "施工空地", "河滩地"
                    ]
                }
            ]
        }

        created_count = 0
        for cat_config in default_config["plot_categories"]:
            category = cat_config["key"]
            for sub_name in cat_config["default_subcategories"]:
                obj, created = TerrainSubCategory.objects.get_or_create(
                    category=category,
                    name=sub_name
                )
                if created:
                    created_count += 1

        self.stdout.write(self.style.SUCCESS(f'Successfully initialized {created_count} subcategories'))
