import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from terrain.models import TerrainSubCategory, TerrainZone


PLOT_CATEGORIES = {
    "forest": "林区",
    "farmland": "农田",
    "building": "建筑",
    "water": "水域",
    "road": "道路",
    "bare": "裸地",
}

SUBCATEGORY_CONFIG_PATH = (
    Path(__file__).resolve().parents[2] / "config" / "terrain_subcategories.json"
)


class Command(BaseCommand):
    help = 'Initialize default terrain subcategories'

    def load_subcategory_config(self):
        if not SUBCATEGORY_CONFIG_PATH.exists():
            raise CommandError(f'Config file not found: {SUBCATEGORY_CONFIG_PATH}')

        try:
            with SUBCATEGORY_CONFIG_PATH.open('r', encoding='utf-8') as fp:
                config = json.load(fp)
        except json.JSONDecodeError as exc:
            raise CommandError(
                f'Invalid JSON in config file: {SUBCATEGORY_CONFIG_PATH}'
            ) from exc

        if not isinstance(config, dict):
            raise CommandError('Subcategory config must be a JSON object.')

        missing_categories = [key for key in PLOT_CATEGORIES if key not in config]
        if missing_categories:
            raise CommandError(
                f'Missing categories in config: {", ".join(missing_categories)}'
            )

        invalid_categories = [key for key in config if key not in PLOT_CATEGORIES]
        if invalid_categories:
            raise CommandError(
                f'Unknown categories in config: {", ".join(invalid_categories)}'
            )

        normalized_config = {}
        for category in PLOT_CATEGORIES:
            subcategories = config[category]
            if not isinstance(subcategories, list):
                raise CommandError(
                    f'Category "{category}" must map to a list of subcategory items.'
                )

            normalized_names = []
            seen_names = set()
            for raw_item in subcategories:
                if isinstance(raw_item, str):
                    clean_name = raw_item.strip()
                elif isinstance(raw_item, dict):
                    raw_name = raw_item.get("name", "")
                    if not isinstance(raw_name, str):
                        raise CommandError(
                            f'Category "{category}" contains an invalid subcategory item.'
                        )
                    clean_name = raw_name.strip()
                else:
                    raise CommandError(
                        f'Category "{category}" contains an invalid subcategory item.'
                    )

                if not clean_name:
                    raise CommandError(
                        f'Category "{category}" contains an invalid subcategory name.'
                    )

                if clean_name in seen_names:
                    continue

                seen_names.add(clean_name)
                normalized_names.append(clean_name)

            normalized_config[category] = normalized_names

        return normalized_config

    def handle(self, *args, **options):
        subcategory_config = self.load_subcategory_config()

        created_count = 0
        updated_count = 0
        deleted_count = 0
        demoted_count = 0

        for category in PLOT_CATEGORIES:
            sub_names = subcategory_config[category]

            for sub_name in sub_names:
                obj, created = TerrainSubCategory.objects.get_or_create(
                    category=category,
                    name=sub_name,
                    defaults={'is_default': True}
                )
                if not created and not obj.is_default:
                    obj.is_default = True
                    obj.save(update_fields=['is_default'])
                    updated_count += 1
                if created:
                    created_count += 1

            obsolete_defaults = TerrainSubCategory.objects.filter(
                category=category,
                is_default=True,
            ).exclude(name__in=sub_names)

            for subcategory in obsolete_defaults:
                usage_count = TerrainZone.objects.filter(
                    category=category,
                    type=subcategory.name,
                    is_deleted=False,
                ).count()

                if usage_count > 0:
                    subcategory.is_default = False
                    subcategory.save(update_fields=['is_default'])
                    demoted_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f'Subcategory "{subcategory.name}" is still in use, '
                            'demoted from default instead of being deleted.'
                        )
                    )
                    continue

                subcategory.delete()
                deleted_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                'Subcategory sync complete: '
                f'created={created_count}, '
                f'updated={updated_count}, '
                f'deleted={deleted_count}, '
                f'demoted={demoted_count}'
            )
        )
