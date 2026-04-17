import json

from django.test import TestCase

from .models import TerrainArea, TerrainZone


def build_feature(coordinates):
    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [coordinates],
        },
        "properties": {},
    }


class TerrainAreaListApiTests(TestCase):
    databases = {"default", "terrain"}

    def setUp(self):
        self.area = TerrainArea.objects.create(
            name="测试地形区域",
            type="farm",
            risk_level="medium",
            area=12.5,
            center_lat=29.56,
            center_lng=106.55,
            boundary_json=build_feature([
                [106.50, 29.50],
                [106.60, 29.50],
                [106.60, 29.60],
                [106.50, 29.60],
                [106.50, 29.50],
            ]),
        )
        TerrainZone.objects.create(
            area_obj=self.area,
            name="1号林地区块",
            category="forest",
            type="针叶林",
            risk_level="low",
            area=5.1,
            geom_json=build_feature([
                [106.50, 29.50],
                [106.55, 29.50],
                [106.55, 29.55],
                [106.50, 29.55],
                [106.50, 29.50],
            ]),
        )
        TerrainZone.objects.create(
            area_obj=self.area,
            name="2号农田区块",
            category="farmland",
            type="梯田",
            risk_level="medium",
            area=7.4,
            geom_json=build_feature([
                [106.55, 29.55],
                [106.60, 29.55],
                [106.60, 29.60],
                [106.55, 29.60],
                [106.55, 29.55],
            ]),
        )

    def test_list_api_returns_region_level_fields_without_type_column_data(self):
        response = self.client.get("/terrain/api/areas/")
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertEqual(payload["code"], 0)
        self.assertEqual(len(payload["data"]), 1)

        record = payload["data"][0]
        self.assertNotIn("type", record)
        self.assertEqual(record["plot_count"], 2)
        self.assertEqual(record["composition_summary"], "包含2类地块")
        self.assertEqual(record["center_lat"], 29.56)
        self.assertEqual(record["center_lng"], 106.55)
        self.assertEqual(record["bbox"], [106.5, 29.5, 106.6, 29.6])
        self.assertEqual(record["geojson"]["type"], "Feature")
        self.assertEqual(record["boundary_geojson"]["type"], "Feature")
        self.assertEqual({item["label"] for item in record["plot_category_counts"]}, {"林区", "农田"})

    def test_unified_save_terrain_uses_region_default_type_instead_of_farm(self):
        response = self.client.post(
            "/terrain/api/terrain/save/",
            data=json.dumps({
                "terrain": {
                    "name": "新建区域",
                    "risk_level": "low",
                    "description": "测试保存",
                },
                "plots": [],
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertEqual(payload["code"], 0)
        created_area = TerrainArea.objects.get(name="新建区域")
        self.assertEqual(created_area.type, "mountain")
