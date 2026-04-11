from rest_framework.views import APIView
from rest_framework.response import Response
from terrain.models import TerrainType, TerrainFeature, Terrain


class TerrainTypeList(APIView):
    def get(self, request):
        types = TerrainType.objects.all()
        data = [{
            "id": t.id,
            "type_code": t.type_code,
            "type_name": t.type_name,
            "description": t.description,
            "created_at": t.created_at
        } for t in types]
        return Response({"code": 0, "msg": "success", "data": data})

    def post(self, request):
        data = request.data
        terrain_type = TerrainType.objects.create(
            type_code=data.get("type_code"),
            type_name=data.get("type_name"),
            description=data.get("description", "")
        )
        return Response({"code": 0, "msg": "success", "data": {
            "id": terrain_type.id,
            "type_code": terrain_type.type_code,
            "type_name": terrain_type.type_name
        }})


class TerrainTypeDetail(APIView):
    def get(self, request, pk):
        try:
            terrain_type = TerrainType.objects.get(id=pk)
            return Response({"code": 0, "msg": "success", "data": {
                "id": terrain_type.id,
                "type_code": terrain_type.type_code,
                "type_name": terrain_type.type_name,
                "description": terrain_type.description,
                "created_at": terrain_type.created_at
            }})
        except TerrainType.DoesNotExist:
            return Response({"code": 404, "msg": "not found", "data": None})

    def put(self, request, pk):
        try:
            terrain_type = TerrainType.objects.get(id=pk)
            data = request.data
            terrain_type.type_code = data.get("type_code", terrain_type.type_code)
            terrain_type.type_name = data.get("type_name", terrain_type.type_name)
            terrain_type.description = data.get("description", terrain_type.description)
            terrain_type.save()
            return Response({"code": 0, "msg": "success", "data": {
                "id": terrain_type.id,
                "type_code": terrain_type.type_code,
                "type_name": terrain_type.type_name
            }})
        except TerrainType.DoesNotExist:
            return Response({"code": 404, "msg": "not found", "data": None})

    def delete(self, request, pk):
        try:
            terrain_type = TerrainType.objects.get(id=pk)
            terrain_type.delete()
            return Response({"code": 0, "msg": "success", "data": None})
        except TerrainType.DoesNotExist:
            return Response({"code": 404, "msg": "not found", "data": None})


class TerrainFeatureList(APIView):
    def get(self, request):
        features = TerrainFeature.objects.all()
        data = [{
            "id": f.id,
            "terrain_id": f.terrain_id,
            "slope": f.slope,
            "elevation": f.elevation,
            "soil_type": f.soil_type,
            "vegetation_coverage": f.vegetation_coverage,
            "created_at": f.created_at
        } for f in features]
        return Response({"code": 0, "msg": "success", "data": data})

    def post(self, request):
        data = request.data
        feature = TerrainFeature.objects.create(
            terrain_id=data.get("terrain_id"),
            slope=data.get("slope", 0),
            elevation=data.get("elevation", 0),
            soil_type=data.get("soil_type", ""),
            vegetation_coverage=data.get("vegetation_coverage", 0)
        )
        return Response({"code": 0, "msg": "success", "data": {
            "id": feature.id,
            "terrain_id": feature.terrain_id
        }})


class TerrainFeatureDetail(APIView):
    def get(self, request, pk):
        try:
            feature = TerrainFeature.objects.get(id=pk)
            return Response({"code": 0, "msg": "success", "data": {
                "id": feature.id,
                "terrain_id": feature.terrain_id,
                "slope": feature.slope,
                "elevation": feature.elevation,
                "soil_type": feature.soil_type,
                "vegetation_coverage": feature.vegetation_coverage,
                "created_at": feature.created_at
            }})
        except TerrainFeature.DoesNotExist:
            return Response({"code": 404, "msg": "not found", "data": None})

    def put(self, request, pk):
        try:
            feature = TerrainFeature.objects.get(id=pk)
            data = request.data
            feature.terrain_id = data.get("terrain_id", feature.terrain_id)
            feature.slope = data.get("slope", feature.slope)
            feature.elevation = data.get("elevation", feature.elevation)
            feature.soil_type = data.get("soil_type", feature.soil_type)
            feature.vegetation_coverage = data.get("vegetation_coverage", feature.vegetation_coverage)
            feature.save()
            return Response({"code": 0, "msg": "success", "data": {
                "id": feature.id,
                "terrain_id": feature.terrain_id
            }})
        except TerrainFeature.DoesNotExist:
            return Response({"code": 404, "msg": "not found", "data": None})

    def delete(self, request, pk):
        try:
            feature = TerrainFeature.objects.get(id=pk)
            feature.delete()
            return Response({"code": 0, "msg": "success", "data": None})
        except TerrainFeature.DoesNotExist:
            return Response({"code": 404, "msg": "not found", "data": None})


class TerrainList(APIView):
    def get(self, request):
        terrains = Terrain.objects.all()
        data = [{
            "id": t.id,
            "terrain_code": t.terrain_code,
            "terrain_name": t.terrain_name,
            "terrain_type_id": t.terrain_type_id,
            "region": t.region,
            "area_mu": t.area_mu,
            "longitude": t.longitude,
            "latitude": t.latitude,
            "farm_plot_id": t.farm_plot_id,
            "forest_area_id": t.forest_area_id,
            "description": t.description,
            "created_at": t.created_at
        } for t in terrains]
        return Response({"code": 0, "msg": "success", "data": data})

    def post(self, request):
        data = request.data
        terrain = Terrain.objects.create(
            terrain_code=data.get("terrain_code"),
            terrain_name=data.get("terrain_name"),
            terrain_type_id=data.get("terrain_type_id", 0),
            region=data.get("region", ""),
            area_mu=data.get("area_mu", 0),
            longitude=data.get("longitude", 0),
            latitude=data.get("latitude", 0),
            farm_plot_id=data.get("farm_plot_id"),
            forest_area_id=data.get("forest_area_id"),
            description=data.get("description", "")
        )
        return Response({"code": 0, "msg": "success", "data": {
            "id": terrain.id,
            "terrain_code": terrain.terrain_code,
            "terrain_name": terrain.terrain_name
        }})


class TerrainDetail(APIView):
    def get(self, request, pk):
        try:
            terrain = Terrain.objects.get(id=pk)
            return Response({"code": 0, "msg": "success", "data": {
                "id": terrain.id,
                "terrain_code": terrain.terrain_code,
                "terrain_name": terrain.terrain_name,
                "terrain_type_id": terrain.terrain_type_id,
                "region": terrain.region,
                "area_mu": terrain.area_mu,
                "longitude": terrain.longitude,
                "latitude": terrain.latitude,
                "farm_plot_id": terrain.farm_plot_id,
                "forest_area_id": terrain.forest_area_id,
                "description": terrain.description,
                "created_at": terrain.created_at
            }})
        except Terrain.DoesNotExist:
            return Response({"code": 404, "msg": "not found", "data": None})

    def put(self, request, pk):
        try:
            terrain = Terrain.objects.get(id=pk)
            data = request.data
            terrain.terrain_code = data.get("terrain_code", terrain.terrain_code)
            terrain.terrain_name = data.get("terrain_name", terrain.terrain_name)
            terrain.terrain_type_id = data.get("terrain_type_id", terrain.terrain_type_id)
            terrain.region = data.get("region", terrain.region)
            terrain.area_mu = data.get("area_mu", terrain.area_mu)
            terrain.longitude = data.get("longitude", terrain.longitude)
            terrain.latitude = data.get("latitude", terrain.latitude)
            terrain.farm_plot_id = data.get("farm_plot_id", terrain.farm_plot_id)
            terrain.forest_area_id = data.get("forest_area_id", terrain.forest_area_id)
            terrain.description = data.get("description", terrain.description)
            terrain.save()
            return Response({"code": 0, "msg": "success", "data": {
                "id": terrain.id,
                "terrain_code": terrain.terrain_code,
                "terrain_name": terrain.terrain_name
            }})
        except Terrain.DoesNotExist:
            return Response({"code": 404, "msg": "not found", "data": None})

    def delete(self, request, pk):
        try:
            terrain = Terrain.objects.get(id=pk)
            terrain.delete()
            return Response({"code": 0, "msg": "success", "data": None})
        except Terrain.DoesNotExist:
            return Response({"code": 404, "msg": "not found", "data": None})
