// 地形地图逻辑

const TerrainSpatialUtils = window.TerrainSpatialUtils || (() => {
  function signedRingArea(ring) {
    if (!Array.isArray(ring) || ring.length < 3) {
      return 0;
    }

    const earthRadius = 6378137;
    let area = 0;
    for (let index = 0; index < ring.length; index += 1) {
      const current = ring[index];
      const next = ring[(index + 1) % ring.length];
      if (!Array.isArray(current) || !Array.isArray(next)) {
        continue;
      }

      const lng1 = (Number(current[0]) * Math.PI) / 180;
      const lat1 = (Number(current[1]) * Math.PI) / 180;
      const lng2 = (Number(next[0]) * Math.PI) / 180;
      const lat2 = (Number(next[1]) * Math.PI) / 180;
      if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) {
        continue;
      }

      area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }

    return (area * earthRadius * earthRadius) / 2;
  }

  function geometryAreaSquareMeters(geojson) {
    if (!geojson || typeof geojson !== 'object') {
      return 0;
    }

    if (geojson.type === 'Feature') {
      return geometryAreaSquareMeters(geojson.geometry);
    }

    if (geojson.type === 'FeatureCollection') {
      return Array.isArray(geojson.features)
        ? geojson.features.reduce((sum, feature) => sum + geometryAreaSquareMeters(feature), 0)
        : 0;
    }

    if (geojson.type === 'Polygon') {
      const rings = Array.isArray(geojson.coordinates) ? geojson.coordinates : [];
      if (!rings.length) {
        return 0;
      }
      const outerArea = Math.abs(signedRingArea(rings[0]));
      const holeArea = rings.slice(1).reduce((sum, ring) => sum + Math.abs(signedRingArea(ring)), 0);
      return Math.max(outerArea - holeArea, 0);
    }

    if (geojson.type === 'MultiPolygon') {
      return Array.isArray(geojson.coordinates)
        ? geojson.coordinates.reduce((sum, polygonCoords) => sum + geometryAreaSquareMeters({
          type: 'Polygon',
          coordinates: polygonCoords
        }), 0)
        : 0;
    }

    return 0;
  }

  function parseJson(value) {
    let current = value;
    for (let index = 0; index < 3 && typeof current === 'string'; index += 1) {
      const trimmed = current.trim();
      if (!trimmed || trimmed === 'null' || trimmed === 'None' || trimmed === '{}' || trimmed === '[]') {
        return null;
      }
      try {
        current = JSON.parse(trimmed);
      } catch (_) {
        return null;
      }
    }
    return current;
  }

  function mercatorToLngLat(x, y) {
    const lng = (x / 20037508.34) * 180;
    let lat = (y / 20037508.34) * 180;
    lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
    return [lng, lat];
  }

  function convertCoordinates(coordinates) {
    if (!Array.isArray(coordinates)) {
      return coordinates;
    }

    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      const x = Number(coordinates[0]);
      const y = Number(coordinates[1]);
      if (Number.isFinite(x) && Number.isFinite(y) && (Math.abs(x) > 180 || Math.abs(y) > 90)) {
        const [lng, lat] = mercatorToLngLat(x, y);
        return [lng, lat, ...coordinates.slice(2)];
      }
      return [x, y, ...coordinates.slice(2)];
    }

    return coordinates.map(item => convertCoordinates(item));
  }

  function normalizeGeoJSON(value) {
    const parsed = parseJson(value);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (parsed.type === 'FeatureCollection') {
      const features = Array.isArray(parsed.features)
        ? parsed.features.map(feature => normalizeGeoJSON(feature)).filter(Boolean)
        : [];
      if (!features.length) {
        return null;
      }
      return {
        ...parsed,
        features
      };
    }

    if (parsed.type === 'Feature') {
      if (!parsed.geometry) {
        return null;
      }
      return {
        ...parsed,
        geometry: normalizeGeoJSON(parsed.geometry)
      };
    }

    if (parsed.type && Array.isArray(parsed.coordinates)) {
      return {
        ...parsed,
        coordinates: convertCoordinates(parsed.coordinates)
      };
    }

    if (parsed.geometry) {
      return normalizeGeoJSON(parsed.geometry);
    }

    return null;
  }

  function coerceNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function isValidLatLng(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return false;
    }
    if (Math.abs(lat) < 1e-9 && Math.abs(lng) < 1e-9) {
      return false;
    }
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  function getBoundsFromGeoJSON(value) {
    const normalized = normalizeGeoJSON(value);
    if (!normalized) {
      return null;
    }
    try {
      const layer = L.geoJSON(normalized);
      const bounds = layer.getBounds();
      return bounds?.isValid?.() ? bounds : null;
    } catch (_) {
      return null;
    }
  }

  function getBoundsFromBBox(bbox) {
    if (!bbox) {
      return null;
    }

    let minLng, minLat, maxLng, maxLat;

    if (bbox.south_west && bbox.north_east) {
      minLng = coerceNumber(bbox.south_west[0]);
      minLat = coerceNumber(bbox.south_west[1]);
      maxLng = coerceNumber(bbox.north_east[0]);
      maxLat = coerceNumber(bbox.north_east[1]);
    } else if (bbox.southWest && bbox.northEast) {
      minLng = coerceNumber(bbox.southWest[0]);
      minLat = coerceNumber(bbox.southWest[1]);
      maxLng = coerceNumber(bbox.northEast[0]);
      maxLat = coerceNumber(bbox.northEast[1]);
    } else {
      minLng = coerceNumber(bbox.minLng ?? bbox.bbox_min_lng ?? bbox[0]);
      minLat = coerceNumber(bbox.minLat ?? bbox.bbox_min_lat ?? bbox[1]);
      maxLng = coerceNumber(bbox.maxLng ?? bbox.bbox_max_lng ?? bbox[2]);
      maxLat = coerceNumber(bbox.maxLat ?? bbox.bbox_max_lat ?? bbox[3]);
    }

    if (!isValidLatLng(minLat, minLng) || !isValidLatLng(maxLat, maxLng)) {
      return null;
    }
    if (minLng === maxLng || minLat === maxLat) {
      return null;
    }

    const bounds = L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
    return bounds?.isValid?.() ? bounds : null;
  }

  function getBBoxFromGeoJSON(value) {
    const bounds = getBoundsFromGeoJSON(value);
    if (!bounds) {
      return null;
    }
    return {
      minLng: bounds.getWest(),
      minLat: bounds.getSouth(),
      maxLng: bounds.getEast(),
      maxLat: bounds.getNorth()
    };
  }

  function getAreaHaFromGeoJSON(value) {
    const normalized = normalizeGeoJSON(value);
    if (!normalized) {
      return null;
    }

    const areaSqMeters = geometryAreaSquareMeters(normalized);
    if (!Number.isFinite(areaSqMeters) || areaSqMeters <= 0) {
      return null;
    }

    return areaSqMeters / 10000;
  }

  return {
    parseJson,
    mercatorToLngLat,
    convertCoordinates,
    normalizeGeoJSON,
    coerceNumber,
    isValidLatLng,
    getBoundsFromGeoJSON,
    getBoundsFromBBox,
    getBBoxFromGeoJSON,
    getAreaHaFromGeoJSON
  };
})();

window.TerrainSpatialUtils = TerrainSpatialUtils;

class TerrainMap {
  constructor(mapId) {
    const initMap = window.initMap;
    const LayerManager = window.LayerManager;

    this.map = initMap(mapId);
    this.layerManager = new LayerManager(this.map);
    this.currentTerrain = null;
    this.currentTerrainLayerKey = null;
    this.currentTerrainLayer = null;
    this.currentTerrainHasGeometry = false;
    this.currentPlotLayerKeys = [];
    this.currentPlotLayers = [];
    this.currentRenderableTerrainPlots = [];
    this.topicBounds = null;
    this.terrainSources = new Map();
    this.activeSelectionToken = 0;
    this.layerVisibility = {
      boundary: false,
      plots: true
    };

    this.plotTypeMeta = {
      forest: { label: '林区', color: '#2ecc71' },
      farmland: { label: '农田', color: '#f39c12' },
      building: { label: '建筑', color: '#475569' },
      water: { label: '水域', color: '#3498db' },
      road: { label: '道路', color: '#9CA3AF' },
      bare_land: { label: '裸地', color: '#D97706' }
    };
  }

  init() {
    this.disableDefaultInteractions();
    this.addLayerGroups();
    this.bindEvents();
  }

  disableDefaultInteractions() {
    this.map.scrollWheelZoom.disable();
    this.map.keyboard.disable();
    this.map.doubleClickZoom.disable();
    this.map.boxZoom.disable();
  }

  addLayerGroups() {
    this.layerManager.addLayerGroup('terrains');
    this.layerManager.addLayerGroup('terrainPlots');
  }

  bindEvents() {
    const layerButtons = Array.from(document.querySelectorAll('[data-layer]'));
    const syncLayerButtons = (activeLayer) => {
      layerButtons.forEach(button => {
        const layerName = button.getAttribute('data-layer');
        const isActive = layerName === activeLayer;
        button.classList.toggle('active', isActive);
        this.toggleLayer(layerName, isActive);
      });
    };

    const initialActiveLayer = layerButtons.find(button => this.layerVisibility[button.getAttribute('data-layer')] !== false)
      ?.getAttribute('data-layer') || 'plots';
    syncLayerButtons(initialActiveLayer);

    layerButtons.forEach(button => {
      const layerName = button.getAttribute('data-layer');
      button.addEventListener('click', () => {
        if (button.classList.contains('active')) {
          return;
        }
        syncLayerButtons(layerName);
      });
    });

    document.getElementById('resetMapBtn').addEventListener('click', () => {
      this.resetView();
    });

    document.getElementById('fullscreenBtn').addEventListener('click', () => {
      this.toggleFullscreen();
    });
  }

  parseJson(value) {
    return TerrainSpatialUtils.parseJson(value);
  }

  mercatorToLngLat(x, y) {
    return TerrainSpatialUtils.mercatorToLngLat(x, y);
  }

  convertCoordinates(coordinates) {
    return TerrainSpatialUtils.convertCoordinates(coordinates);
  }

  normalizeGeoJSON(value) {
    return TerrainSpatialUtils.normalizeGeoJSON(value);
  }

  normalizePlotTypeKey(typeKey) {
    const rawType = String(typeKey || '').trim();
    const normalized = {
      forest: 'forest',
      '林区': 'forest',
      farmland: 'farmland',
      '农田': 'farmland',
      building: 'building',
      '建筑': 'building',
      water: 'water',
      '水域': 'water',
      road: 'road',
      '道路': 'road',
      bare: 'bare_land',
      bare_land: 'bare_land',
      '裸地': 'bare_land',
      open: 'bare_land',
      open_land: 'bare_land',
      empty_land: 'bare_land',
      unused_land: 'bare_land',
      '空地': 'bare_land',
      '开敞地': 'bare_land'
    }[rawType] || {
      forest: 'forest',
      farmland: 'farmland',
      building: 'building',
      water: 'water',
      road: 'road',
      bare: 'bare_land',
      bare_land: 'bare_land',
      open: 'bare_land',
      open_land: 'bare_land',
      empty_land: 'bare_land',
      unused_land: 'bare_land'
    }[rawType.toLowerCase()];
    return normalized || 'bare_land';
  }

  getTerrainPlotCandidates(terrain) {
    if (!terrain || typeof terrain !== 'object') {
      return [];
    }
    const candidates = [
      terrain.plots,
      terrain.blocks,
      terrain.layers,
      terrain.features,
      terrain.plot_data
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length) {
        return candidate;
      }
    }
    return [];
  }

  buildTerrainGeoJSONFromPlots(plots = null) {
    const sourcePlots = Array.isArray(plots) ? plots : this.currentRenderableTerrainPlots;
    if (!Array.isArray(sourcePlots) || !sourcePlots.length) {
      return null;
    }

    const features = sourcePlots
      .map(plot => plot?.__normalizedGeoJSON || this.normalizeGeoJSON(this.getTerrainPlotGeoValue(plot)))
      .filter(Boolean)
      .map(geojson => {
        if (geojson.type === 'Feature') {
          return geojson;
        }
        return {
          type: 'Feature',
          geometry: geojson,
          properties: {}
        };
      });

    if (!features.length) {
      return null;
    }

    return features.length === 1
      ? features[0]
      : {
        type: 'FeatureCollection',
        features
      };
  }

  getTerrainGeoJSON(terrain, plots = null) {
    let geojson = this.buildTerrainGeoJSONFromPlots(plots);

    if (!geojson) {
      geojson = terrain?.boundary || terrain?.geojson || terrain?.boundary_geojson || terrain?.boundary_json || null;
    }

    if (!geojson && terrain?.bounds) {
      const bounds = TerrainSpatialUtils.getBoundsFromBBox(terrain.bounds);
      if (bounds) {
        geojson = {
          type: "Polygon",
          coordinates: [[
            [bounds.getWest(), bounds.getSouth()],
            [bounds.getEast(), bounds.getSouth()],
            [bounds.getEast(), bounds.getNorth()],
            [bounds.getWest(), bounds.getNorth()],
            [bounds.getWest(), bounds.getSouth()]
          ]]
        };
      }
    }

    const normalizedTerrainGeoJSON = this.normalizeGeoJSON(geojson);
    if (normalizedTerrainGeoJSON) {
      return normalizedTerrainGeoJSON;
    }
    return null;
  }

  getTerrainBounds(terrain, layer = null, plots = null) {
    const plotGeoJSON = this.buildTerrainGeoJSONFromPlots(plots);
    const plotBounds = TerrainSpatialUtils.getBoundsFromGeoJSON(plotGeoJSON);
    if (plotBounds) {
      return plotBounds;
    }

    const bboxBounds = TerrainSpatialUtils.getBoundsFromBBox(terrain?.bbox);
    if (bboxBounds) {
      return bboxBounds;
    }

    const geoBounds = TerrainSpatialUtils.getBoundsFromGeoJSON(
      terrain?.boundary || terrain?.geojson || terrain?.boundary_geojson || terrain?.boundary_json || null
    );
    if (geoBounds) {
      return geoBounds;
    }

    if (layer && typeof layer.getBounds === 'function') {
      const bounds = layer.getBounds();
      if (bounds?.isValid?.()) {
        return bounds;
      }
    }

    return null;
  }

  getTerrainCenter(terrain, layer = null) {
    const lat = TerrainSpatialUtils.coerceNumber(terrain?.center?.[0] ?? terrain?.center_lat);
    const lng = TerrainSpatialUtils.coerceNumber(terrain?.center?.[1] ?? terrain?.center_lng);
    if (TerrainSpatialUtils.isValidLatLng(lat, lng)) {
      return [lat, lng];
    }

    const terrainBounds = this.getTerrainBounds(terrain, layer, this.currentRenderableTerrainPlots);
    if (terrainBounds) {
      const center = terrainBounds.getCenter();
      return [center.lat, center.lng];
    }

    if (layer && typeof layer.getBounds === 'function') {
      const bounds = layer.getBounds();
      if (bounds?.isValid?.()) {
        const center = bounds.getCenter();
        return [center.lat, center.lng];
      }
    }

    if (layer && typeof layer.getLatLng === 'function') {
      const latLng = layer.getLatLng();
      if (latLng) {
        return [latLng.lat, latLng.lng];
      }
    }

    return null;
  }

  getTerrainBoundaryStyle() {
    return {
      color: '#2563eb',
      weight: 4,
      opacity: 0.95,
      fillColor: '#60a5fa',
      fillOpacity: 0,
      className: 'terrain-current-boundary'
    };
  }

  getTerrainPopupHtml(terrain) {
    const areaValue = terrain?.area ?? terrain?.area_ha ?? null;
    const areaLabel = Number.isFinite(Number(areaValue))
      ? `${Number(areaValue).toFixed(2)} 公顷`
      : (terrain?.areaLabel || '-');
    const riskLabel = terrain?.risk_label || terrain?.riskLabel || terrain?.risk_level || '-';
    const plotCount = Array.isArray(terrain?.plots)
      ? terrain.plots.length
      : (terrain?.plot_count ?? terrain?.plotCountLabel ?? '-');
    return `
      <div class="terrain-map-popup">
        <strong>${terrain.name}</strong><br>
        面积：${areaLabel}<br>
        风险：${riskLabel}<br>
        地块数量：${plotCount}
      </div>
    `;
  }

  getPlotTypeKey(plot) {
    return this.normalizePlotTypeKey(
      plot?.plot_type
      || plot?.category
      || plot?.type
      || plot?.properties?.type
      || plot?.type_label
    );
  }

  getPlotTypeLabel(plot) {
    if (plot?.type_label) {
      return this.normalizePlotTypeKey(plot.type_label) === 'bare_land'
        ? '裸地'
        : (plot.type_label || '未分类');
    }
    const typeKey = this.getPlotTypeKey(plot);
    return this.plotTypeMeta[typeKey]?.label || '未分类';
  }

  getPlotStyle(plot) {
    const typeKey = this.getPlotTypeKey(plot);
    const color = this.plotTypeMeta[typeKey]?.color || '#64748b';
    return {
      color,
      weight: 2,
      opacity: 0.88,
      fillColor: color,
      fillOpacity: 0.28,
      className: 'terrain-plot-layer'
    };
  }

  getPlotPopupHtml(plot) {
    return `
      <div class="terrain-map-popup">
        <strong>${plot.name || '未命名地块'}</strong><br>
        地块类型：${this.getPlotTypeLabel(plot)}<br>
        子类：${plot.subtype_label || plot.subtype || plot.sub_type || '-'}<br>
        面积：${plot.area || '-'} 公顷<br>
        风险：${plot.risk_level || '-'}
      </div>
    `;
  }

  getTerrainPlotGeoValue(plot) {
    return plot?.boundary_geojson || plot?.boundary_json || plot?.geom_json || plot?.geometry || null;
  }

  getTerrainPlotPayloads(plot) {
    const candidates = [
      this.parseJson(plot?.meta_json),
      this.parseJson(plot?.meta),
      this.parseJson(plot?.metadata),
      this.parseJson(plot?.style_json),
      this.parseJson(plot?.style),
      plot
    ];

    return candidates.filter(item => item && typeof item === 'object' && !Array.isArray(item));
  }

  getTerrainPlotExcludeReason(plot, normalizedGeoJSON = null) {
    const normalized = normalizedGeoJSON || this.normalizeGeoJSON(this.getTerrainPlotGeoValue(plot));
    if (!normalized) {
      return 'missing_geometry';
    }

    const payloads = this.getTerrainPlotPayloads(plot);
    const hiddenFlagKeys = [
      'hidden',
      'is_hidden',
      'archived',
      'is_archived',
      'history',
      'is_history',
      'historical',
      'is_historical',
      'invalid',
      'is_invalid',
      'disabled',
      'is_disabled',
      'draft',
      'is_draft'
    ];

    for (const key of hiddenFlagKeys) {
      if (payloads.some(payload => payload[key] === true)) {
        return `flag:${key}`;
      }
    }

    if (payloads.some(payload => payload.visible === false)) {
      return 'style_hidden';
    }

    const inactiveFlagKeys = ['active', 'is_active', 'current', 'is_current', 'latest', 'is_latest', 'enabled', 'is_enabled'];
    for (const key of inactiveFlagKeys) {
      if (payloads.some(payload => Object.prototype.hasOwnProperty.call(payload, key) && payload[key] === false)) {
        return `flag:${key}=false`;
      }
    }

    const excludedStatuses = new Set([
      'deleted',
      'inactive',
      'archived',
      'history',
      'historical',
      'invalid',
      'discarded',
      'disabled',
      'hidden',
      'draft'
    ]);

    for (const statusKey of ['status', 'zone_status', 'record_status', 'state']) {
      const matchedPayload = payloads.find(payload => payload[statusKey] !== undefined && payload[statusKey] !== null);
      if (!matchedPayload) {
        continue;
      }
      const normalizedStatus = String(matchedPayload[statusKey]).trim().toLowerCase();
      if (excludedStatuses.has(normalizedStatus)) {
        return `status:${normalizedStatus}`;
      }
    }

    return null;
  }

  buildTerrainPlotDedupeKey(plot, normalizedGeoJSON = null) {
    const normalized = normalizedGeoJSON || this.normalizeGeoJSON(this.getTerrainPlotGeoValue(plot));
    if (!normalized) {
      return null;
    }

    const geometry = normalized.type === 'Feature' ? (normalized.geometry || {}) : normalized;
    return JSON.stringify({
      areaId: plot?.area_obj_id || plot?.area_id || this.currentTerrain?.id || '',
      plotType: plot?.plot_type || plot?.category || '',
      subType: plot?.sub_type || plot?.type || '',
      geometry
    });
  }

  filterRenderableTerrainPlots(plots) {
    const sourcePlots = Array.isArray(plots) ? plots : [];
    if (!sourcePlots.length) {
      return [];
    }

    const filteredPlots = [];
    const skippedPlots = [];
    const seenKeys = new Set();

    sourcePlots.forEach(plot => {
      const normalizedGeoJSON = this.normalizeGeoJSON(this.getTerrainPlotGeoValue(plot));
      const excludeReason = this.getTerrainPlotExcludeReason(plot, normalizedGeoJSON);
      if (excludeReason) {
        skippedPlots.push({ id: plot?.id, reason: excludeReason });
        return;
      }

      const dedupeKey = this.buildTerrainPlotDedupeKey(plot, normalizedGeoJSON);
      if (dedupeKey && seenKeys.has(dedupeKey)) {
        skippedPlots.push({ id: plot?.id, reason: 'duplicate_geometry' });
        return;
      }

      if (dedupeKey) {
        seenKeys.add(dedupeKey);
      }

      filteredPlots.push({
        ...plot,
        __normalizedGeoJSON: normalizedGeoJSON,
        __terrainPlotFiltered: true
      });
    });

    if (skippedPlots.length) {
      console.warn('管理页地块过滤后跳过部分历史/无效地块:', skippedPlots);
    }

    return filteredPlots;
  }

  registerTopicBounds(layer) {
    if (!layer) {
      return;
    }

    if (!this.topicBounds) {
      this.topicBounds = L.latLngBounds();
    }

    if (typeof layer.getBounds === 'function') {
      const bounds = layer.getBounds();
      if (bounds?.isValid?.()) {
        this.topicBounds.extend(bounds);
      }
      return;
    }

    if (typeof layer.getLatLng === 'function') {
      const latLng = layer.getLatLng();
      if (latLng) {
        this.topicBounds.extend(latLng);
      }
    }
  }

  loadTerrains(terrains) {
    this.terrainSources.clear();
    terrains.forEach(terrain => {
      this.terrainSources.set(String(terrain.id), terrain);
    });
  }

  clearSelectionMarker() {
  }

  renderCurrentTerrainBoundary(terrain, plots = null) {
    this.clearCurrentTerrainBoundary();
    this.currentTerrainLayerKey = null;
    this.currentTerrainLayer = null;
    this.currentTerrainHasGeometry = false;
    return null;
  }

  async fetchTerrainPlots(areaId) {
    const response = await fetch(`/terrain/api/areas/${areaId}/plots/`);
    const result = await response.json();
    if (result.code !== 0) {
      throw new Error(result.message || '加载地块失败');
    }
    return Array.isArray(result.data) ? result.data : [];
  }

  async loadTerrainPlots(areaId, selectionToken = null) {
    this.clearTerrainPlots();
    try {
      let plots = this.getTerrainPlotCandidates(this.currentTerrain);
      if (!plots.length) {
        plots = await this.fetchTerrainPlots(areaId);
      }
      if (selectionToken !== null && selectionToken !== this.activeSelectionToken) {
        return [];
      }
      const renderablePlots = this.filterRenderableTerrainPlots(plots);
      this.currentRenderableTerrainPlots = renderablePlots;
      this.topicBounds = null;
      this.renderTerrainPlots(renderablePlots);
      return renderablePlots;
    } catch (error) {
      console.error('加载地形地块专题失败:', error);
      return [];
    }
  }

  renderTerrainPlots(plots) {
    const renderablePlots = Array.isArray(plots) && plots.every(plot => plot?.__terrainPlotFiltered)
      ? plots
      : this.filterRenderableTerrainPlots(plots);

    renderablePlots.forEach(plot => {
      const normalizedGeoJSON = plot.__normalizedGeoJSON || this.normalizeGeoJSON(this.getTerrainPlotGeoValue(plot));
      if (!normalizedGeoJSON) {
        return;
      }

      const plotStyle = this.getPlotStyle(plot);
      const plotLayer = L.geoJSON(normalizedGeoJSON, {
        style: () => plotStyle,
        onEachFeature: (_feature, featureLayer) => {
          featureLayer.bindPopup(this.getPlotPopupHtml(plot), {
            className: 'terrain-map-popup'
          });
          featureLayer.on('mouseover', () => {
            featureLayer.setStyle({
              weight: plotStyle.weight + 1,
              fillOpacity: Math.min(0.42, plotStyle.fillOpacity + 0.08)
            });
          });
          featureLayer.on('mouseout', () => {
            featureLayer.setStyle(plotStyle);
          });
        }
      });

      const layerKey = `terrain-plot-${plot.id}`;
      this.currentPlotLayerKeys.push(layerKey);
      this.currentPlotLayers.push(plotLayer);
      this.layerManager.addLayer(layerKey, plotLayer, 'terrainPlots');
      this.registerTopicBounds(plotLayer);
    });
  }

  clearCurrentTerrainBoundary() {
    if (this.currentTerrainLayerKey) {
      this.layerManager.removeLayer(this.currentTerrainLayerKey);
    }
    this.currentTerrainLayerKey = null;
    this.currentTerrainLayer = null;
    this.currentTerrainHasGeometry = false;
  }

  clearTerrainPlots() {
    this.currentPlotLayerKeys.forEach(key => {
      this.layerManager.removeLayer(key);
    });
    this.currentPlotLayerKeys = [];
    this.currentPlotLayers = [];
    this.currentRenderableTerrainPlots = [];
  }

  clearCurrentTopic() {
    this.clearSelectionMarker();
    this.clearCurrentTerrainBoundary();
    this.clearTerrainPlots();
    this.topicBounds = null;
    this.currentTerrain = null;
  }

  focusTerrainTopic(terrain) {
    if (this.topicBounds?.isValid?.()) {
      this.map.fitBounds(this.topicBounds, {
        padding: [30, 30],
        maxZoom: 16
      });
      return;
    }

    const terrainBounds = this.getTerrainBounds(terrain, this.currentTerrainLayer, this.currentRenderableTerrainPlots);
    if (terrainBounds) {
      this.map.fitBounds(terrainBounds, {
        padding: [30, 30],
        maxZoom: 16
      });
      return;
    }

    const center = this.getTerrainCenter(terrain, this.currentTerrainLayer);
    if (center) {
      this.map.flyTo(center, 15, {
        animate: true,
        duration: 0.6
      });
      return;
    }

    console.warn('缺少有效空间数据，地图保持当前视图', terrain?.id);
    if (typeof window.showToast === 'function') {
      window.showToast('缺少有效空间数据，地图保持当前视图', 'warning');
    }
  }

  async selectTerrain(terrain, options = {}) {
    const { emitEvent = true, fit = true, openPopup = false } = options;
    const sourceTerrain = this.terrainSources.get(String(terrain.id)) || terrain;
    const selectionToken = Date.now() + Math.random();

    this.activeSelectionToken = selectionToken;
    this.clearSelectionMarker();
    this.clearCurrentTerrainBoundary();
    this.clearTerrainPlots();
    this.topicBounds = null;
    this.currentTerrain = sourceTerrain;

    // 管理页预览仅绘制地块，TerrainArea 边界数据仍保留给导入导出和校验逻辑使用。
    await this.loadTerrainPlots(sourceTerrain.id, selectionToken);

    if (selectionToken !== this.activeSelectionToken) {
      return;
    }

    // 自动缩放优先跟随可渲染地块。
    if (fit) {
      this.focusTerrainTopic(sourceTerrain);
    }

    if (openPopup && this.currentTerrainLayer && typeof this.currentTerrainLayer.openPopup === 'function') {
      this.currentTerrainLayer.openPopup();
    }

    if (emitEvent) {
      document.dispatchEvent(new CustomEvent('terrainSelected', { detail: sourceTerrain }));
    }
  }

  toggleLayer(layer, visible) {
    this.layerVisibility[layer] = visible;
    if (layer === 'plots') {
      this.layerManager.toggleLayerGroup('terrainPlots', visible);
    }
  }

  resetView() {
    if (this.currentTerrain) {
      this.focusTerrainTopic(this.currentTerrain);
    }
  }

  toggleFullscreen() {
    const mapContainer = document.getElementById('terrainMap');
    if (!document.fullscreenElement) {
      mapContainer.requestFullscreen().catch(error => {
        console.error(`Error attempting to enable fullscreen: ${error.message}`);
      });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

try {
  window.TerrainMap = TerrainMap;
} catch (error) {
  console.error('无法设置全局变量:', error);
}
