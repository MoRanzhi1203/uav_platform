import json
import time
from pathlib import Path

import geopandas as gpd
import pandas as pd
from django.core.management.base import BaseCommand, CommandError
from shapely.geometry import GeometryCollection
from shapely.ops import unary_union

try:
    from shapely.validation import make_valid
except ImportError:  # pragma: no cover
    make_valid = None


class Command(BaseCommand):
    help = "Build derived Chongqing admin boundary GeoJSON files from township shapefile"

    def add_arguments(self, parser):
        project_root = Path(__file__).resolve().parents[3]
        default_source = project_root / "static" / "shp" / "chongqing" / "chongqing_township_street" / "chongqing_township_street.shp"
        default_output_dir = project_root / "static" / "shp" / "chongqing" / "derived"

        parser.add_argument(
            "--source",
            default=str(default_source),
            help="Path to the source township/street shapefile",
        )
        parser.add_argument(
            "--output-dir",
            default=str(default_output_dir),
            help="Directory where derived GeoJSON files will be written",
        )

    def handle(self, *args, **options):
        source_path = Path(options["source"]).resolve()
        output_dir = Path(options["output_dir"]).resolve()

        if not source_path.exists():
            raise CommandError(f"Source shapefile not found: {source_path}")

        output_dir.mkdir(parents=True, exist_ok=True)

        self.stdout.write(f"Reading source shapefile: {source_path}")
        township_gdf = gpd.read_file(source_path)
        township_gdf = self.prepare_source_gdf(township_gdf)

        if township_gdf.empty:
          raise CommandError("No valid township features found after geometry cleaning.")

        city_gdf = self.build_city_gdf(township_gdf)
        district_gdf = self.build_district_gdf(township_gdf)
        township_geojson_gdf = self.build_township_gdf(township_gdf)

        output_files = {
            "city": output_dir / "chongqing_city_from_township.geojson",
            "district": output_dir / "chongqing_district_from_township.geojson",
            "township": output_dir / "chongqing_township_from_source.geojson",
        }
        version_file = output_dir / "version.json"
        version = int(time.time() * 1000)

        self.write_geojson(city_gdf, output_files["city"])
        self.write_geojson(district_gdf, output_files["district"])
        self.write_geojson(township_geojson_gdf, output_files["township"])
        self.write_version_file(version_file, version)

        self.stdout.write(
            self.style.SUCCESS(
                "Derived admin boundaries generated successfully:\n"
                f"  city: {output_files['city']}\n"
                f"  district: {output_files['district']}\n"
                f"  township: {output_files['township']}\n"
                f"  version: {version_file} ({version})"
            )
        )

    def prepare_source_gdf(self, gdf):
        required_columns = ["市", "县", "乡", "geometry"]
        missing_columns = [column for column in required_columns if column not in gdf.columns]
        if missing_columns:
            raise CommandError(f"Missing required shapefile fields: {', '.join(missing_columns)}")

        working_gdf = gdf[required_columns].copy()

        if working_gdf.crs is None:
            raise CommandError("Source shapefile CRS is missing; cannot safely convert to EPSG:4326.")

        if working_gdf.crs.to_epsg() != 4326:
            working_gdf = working_gdf.to_crs(epsg=4326)

        working_gdf["geometry"] = working_gdf["geometry"].apply(self.clean_geometry)
        working_gdf = working_gdf[working_gdf.geometry.notnull()].copy()
        working_gdf = working_gdf[~working_gdf.geometry.is_empty].copy()

        working_gdf["市"] = working_gdf["市"].fillna("").astype(str).str.strip()
        working_gdf["县"] = working_gdf["县"].fillna("").astype(str).str.strip()
        working_gdf["乡"] = working_gdf["乡"].fillna("").astype(str).str.strip()

        working_gdf = working_gdf[(working_gdf["县"] != "") & (working_gdf["乡"] != "")].copy()
        working_gdf = working_gdf.reset_index(drop=True)

        return working_gdf

    def clean_geometry(self, geometry):
        if geometry is None or geometry.is_empty:
            return None

        cleaned = geometry
        if not cleaned.is_valid:
            if make_valid is not None:
                cleaned = make_valid(cleaned)
            else:  # pragma: no cover
                cleaned = cleaned.buffer(0)

        if cleaned is None or cleaned.is_empty:
            return None

        if not cleaned.is_valid:
            cleaned = cleaned.buffer(0)

        if cleaned is None or cleaned.is_empty:
            return None

        if isinstance(cleaned, GeometryCollection):
            polygon_geometries = [
                geom for geom in cleaned.geoms
                if geom.geom_type in {"Polygon", "MultiPolygon"} and not geom.is_empty
            ]
            if not polygon_geometries:
                return None
            cleaned = unary_union(polygon_geometries)

        if cleaned.is_empty:
            return None

        return cleaned

    def build_city_gdf(self, township_gdf):
        self.stdout.write("Building city GeoJSON...")

        city_geometry = unary_union(township_gdf.geometry.tolist())
        city_geometry = self.clean_geometry(city_geometry)
        if city_geometry is None:
            raise CommandError("Failed to build city boundary geometry.")

        city_gdf = gpd.GeoDataFrame(
            [{"name": "重庆市", "level": "city", "geometry": city_geometry}],
            geometry="geometry",
            crs="EPSG:4326",
        )
        return city_gdf

    def build_district_gdf(self, township_gdf):
        self.stdout.write("Building district GeoJSON...")

        grouped = (
            township_gdf.groupby("县", dropna=False)["geometry"]
            .agg(lambda geometries: unary_union([geom for geom in geometries if geom is not None and not geom.is_empty]))
            .reset_index()
        )
        grouped["geometry"] = grouped["geometry"].apply(self.clean_geometry)
        grouped = grouped[grouped["geometry"].notnull()].copy()
        grouped = grouped[grouped["县"] != ""].copy()
        grouped["name"] = grouped["县"]
        grouped["level"] = "district"
        grouped["city"] = "重庆市"

        district_gdf = gpd.GeoDataFrame(
            grouped[["name", "level", "city", "geometry"]],
            geometry="geometry",
            crs="EPSG:4326",
        ).sort_values("name", kind="stable").reset_index(drop=True)

        return district_gdf

    def build_township_gdf(self, township_gdf):
        self.stdout.write("Building township GeoJSON...")

        township_output = pd.DataFrame({
            "name": township_gdf["乡"],
            "level": "township",
            "city": township_gdf["市"].replace("", "重庆市"),
            "district": township_gdf["县"],
        })

        township_geojson_gdf = gpd.GeoDataFrame(
            township_output,
            geometry=township_gdf.geometry.copy(),
            crs="EPSG:4326",
        ).reset_index(drop=True)

        return township_geojson_gdf

    def write_geojson(self, gdf, output_path):
        gdf = gdf.copy()
        if gdf.crs is None or gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)

        gdf.to_file(output_path, driver="GeoJSON", encoding="utf-8")

        # Reformat the output for stable UTF-8 text and cleaner diffs.
        with output_path.open("r", encoding="utf-8") as file_obj:
            payload = json.load(file_obj)

        with output_path.open("w", encoding="utf-8") as file_obj:
            json.dump(payload, file_obj, ensure_ascii=False, indent=2)
            file_obj.write("\n")

    def write_version_file(self, output_path, version):
        payload = {
            "version": version,
        }
        with output_path.open("w", encoding="utf-8") as file_obj:
            json.dump(payload, file_obj, ensure_ascii=False, indent=2)
            file_obj.write("\n")
