# SHP 文件清理报告

**日期**: 2026-04-13

## 检查说明
遍历了项目中 `/shp/` 目录（位于 `data/shp/` 和 `static/shp/` 下）的 `.shp` 文件及其关联文件，通过搜索项目代码及指令配置文件确定了其使用情况。

## 保留的文件（使用中）
这些文件在系统代码（如数据转换脚本、行政区划加载配置等）中被显式调用，**已保留**在原有目录下：
- `gis_osm_adminareas_a_free_1.*`
- `gis_osm_buildings_a_free_1.*`
- `gis_osm_landuse_a_free_1.*`
- `gis_osm_natural_a_free_1.*`
- `gis_osm_roads_free_1.*`
- `gis_osm_water_a_free_1.*`
- `gis_osm_waterways_free_1.*`

## 已彻底删除的文件（未被使用）
这些文件在项目中未被直接引用，**已彻底删除**以释放存储空间（包括 `.shp`, `.shx`, `.dbf`, `.prj`, `.cpg`）：
- `gis_osm_natural_free_1.*`
- `gis_osm_places_a_free_1.*`
- `gis_osm_places_free_1.*`
- `gis_osm_pofw_a_free_1.*`
- `gis_osm_pofw_free_1.*`
- `gis_osm_pois_a_free_1.*`
- `gis_osm_pois_free_1.*`
- `gis_osm_protected_areas_a_free_1.*`
- `gis_osm_railways_free_1.*`
- `gis_osm_traffic_a_free_1.*`
- `gis_osm_traffic_free_1.*`
- `gis_osm_transport_a_free_1.*`
- `gis_osm_transport_free_1.*`


