import json
import os
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from terrain.models import TerrainArea, TerrainZone
from terrain.views import normalize_plots_payload

GEOMETRY_DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "geojson"

PLOT_TYPE_MAPPING = {
    "forest": "forest",
    "farmland": "farmland",
    "building": "building",
    "buildings": "building",
    "water": "water",
    "water1": "water",
    "water2": "water",
    "roads": "road",
    "road": "road",
}


class Command(BaseCommand):
    help = 'Import sample terrain data from GeoJSON files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='Overwrite existing data',
        )

    def handle(self, *args, **options):
        overwrite = options.get('overwrite', False)

        if not GEOMETRY_DATA_DIR.exists():
            raise CommandError(f'Data directory not found: {GEOMETRY_DATA_DIR}')

        if not overwrite and TerrainArea.objects.exists():
            self.stdout.write(
                self.style.WARNING(
                    'Terrain data already exists. Use --overwrite flag to replace existing data.'
                )
            )
            return

        if overwrite:
            self.stdout.write(self.style.WARNING('Deleting existing terrain data...'))
            TerrainZone.objects.all().delete()
            TerrainArea.objects.all().delete()

        total_created = 0
        total_zones = 0

        for geojson_file in GEOMETRY_DATA_DIR.glob('*.json'):
            plot_type = geojson_file.stem.lower()
            normalized_type = PLOT_TYPE_MAPPING.get(plot_type)
            if not normalized_type:
                self.stdout.write(f"Skipping unknown file type: {geojson_file}")
                continue

            self.stdout.write(f"Processing {geojson_file} ({plot_type} -> {normalized_type})")

            try:
                with open(geojson_file, 'r', encoding='utf-8') as fp:
                    data = json.load(fp)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed to read {geojson_file}: {e}"))
                continue

            features = data.get('features', [])
            if not features:
                self.stdout.write(f"No features found in {geojson_file}")
                continue

            valid_features = []
            for feature in features:
                geometry = feature.get('geometry')
                if geometry and geometry.get('coordinates'):
                    props = feature.get('properties', {})
                    name = props.get('name') or props.get('fclass') or f"{plot_type}_{len(valid_features)}"
                    valid_features.append({
                        'name': name,
                        'geometry': feature,
                        'type': normalized_type,
                    })

            if not valid_features:
                self.stdout.write(f"No valid features with geometry in {geojson_file}")
                continue

            area_name = f"示例{PLOT_TYPE_MAPPING.get(plot_type, plot_type)}区域"
            area = TerrainArea.objects.create(
                name=area_name,
                type="farm" if normalized_type == "farmland" else "forest" if normalized_type == "forest" else "other",
                risk_level="low",
                description=f"自动导入的{area_name}",
                area=0,
                boundary_json={},
            )
            total_created += 1

            plots = []
            for idx, feat in enumerate(valid_features[:50]):
                plots.append({
                    'name': f"{feat['name']}_{idx}",
                    'type': feat['type'],
                    'geometry': feat['geometry'],
                })

            normalized_plots = normalize_plots_payload(plots)
            
            from terrain.views import sync_area_plots
            try:
                saved_zones = sync_area_plots(area, normalized_plots)
                total_zones += len(saved_zones)
                self.stdout.write(
                    self.style.SUCCESS(f"  Created {len(saved_zones)} zones for {area_name}")
                )
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  Failed to create zones: {e}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"\nImport complete! Created {total_created} terrain areas with {total_zones} zones."
            )
        )
