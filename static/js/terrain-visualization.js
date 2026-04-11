window.TerrainVisualization = (() => {
    function initMap() {
        const map = L.map('map').setView([29.43, 106.91], 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        return map;
    }
    
    function renderTerrainOnMap(map, terrains) {
        terrains.forEach(terrain => {
            const marker = L.marker([terrain.latitude, terrain.longitude]).addTo(map);
            marker.bindPopup(`
                <b>${terrain.terrain_name}</b><br>
                地形类型: ${terrain.terrain_type_id}<br>
                面积: ${terrain.area_mu}亩<br>
                经度: ${terrain.longitude}<br>
                纬度: ${terrain.latitude}
            `);
        });
    }
    
    function fetchTerrains() {
        return App.request('/api/terrain/')
            .then(response => response.data);
    }
    
    function initTerrainVisualization() {
        const map = initMap();
        
        fetchTerrains()
            .then(terrains => {
                renderTerrainOnMap(map, terrains);
            })
            .catch(error => {
                App.toast('Failed to load terrain data: ' + error.message, 'error');
            });
    }
    
    return {
        init: initTerrainVisualization
    };
})();
