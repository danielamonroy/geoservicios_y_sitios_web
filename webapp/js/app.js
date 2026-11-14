const map = L.map('map').setView([4.5709, -74.2973], 6);

// -----------------------------------------------------
// URLs de servicios
// -----------------------------------------------------
// GeoServer local (capítulo 8): espacio de trabajo "taller"
const geoserverWMS = 'http://localhost:8080/geoserver/taller/wms';
const geoserverWFS = 'http://localhost:8080/geoserver/taller/wfs';

// Servicio WMS del DANE (MGN 2024) - visto en clase
const daneWMS = 'https://geoportal.dane.gov.co/mparcgis/services/MGN2024/Serv_CapasMGN_2024/MapServer/WMSServer';

// -----------------------------------------------------
// Capas base (11.4 - Control de capas)
// -----------------------------------------------------
const baseMaps = {
    "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }),
    "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    })
};

// -----------------------------------------------------
// Capas WMS (11.4)
// -----------------------------------------------------
// Departamentos desde MI GeoServer (con el estilo SLD)
const departamentosWMS = L.tileLayer.wms(geoserverWMS, {
    layers: 'taller:departamentos',
    format: 'image/png',
    transparent: true,
    attribution: 'IGAC - Instituto Geográfico Agustín Codazzi'
}).addTo(map);

// Departamentos y municipios desde el WMS del DANE
const departamentosDANE = L.tileLayer.wms(daneWMS, {
    layers: '8',
    format: 'image/png',
    transparent: true,
    attribution: 'DANE - MGN 2024'
});

const municipiosWMS = L.tileLayer.wms(daneWMS, {
    layers: '7',
    format: 'image/png',
    transparent: true,
    attribution: 'DANE - MGN 2024'
});

// Capas superpuestas
const overlayMaps = {
    "Departamentos (WMS GeoServer)": departamentosWMS,
    "Departamentos (WMS DANE)": departamentosDANE,
    "Municipios (WMS DANE)": municipiosWMS
};

// Control de capas
const controlLayer = L.control.layers(baseMaps, overlayMaps, {
    collapsed: false
}).addTo(map);

// Capa base por defecto
baseMaps["OpenStreetMap"].addTo(map);

// -----------------------------------------------------
// WFS de GeoServer como GeoJSON (11.5)
// -----------------------------------------------------
const departamentosWFSUrl = geoserverWFS +
    '?service=WFS&version=2.0.0&request=GetFeature' +
    '&typeName=taller:departamentos&outputFormat=application/json';

let departamentosGeoJSON; // Capa GeoJSON (se usa también en la búsqueda)

fetch(departamentosWFSUrl)
    .then(response => response.json())
    .then(data => {
        departamentosGeoJSON = L.geoJSON(data, {
            style: {
                color: '#232323',
                weight: 2,
                fillColor: '#e8f881',
                fillOpacity: 0.5
            },
            onEachFeature: onEachFeature
        });

        departamentosGeoJSON.addTo(map);
        controlLayer.addOverlay(departamentosGeoJSON, "Departamentos (WFS GeoServer)");

        // Ajustar vista al extent de los datos
        map.fitBounds(departamentosGeoJSON.getBounds());
    })
    .catch(error => console.error('Error cargando WFS:', error));

// -----------------------------------------------------
// Interactividad: popups, highlight y zoom (11.5)
// -----------------------------------------------------
function onEachFeature(feature, layer) {
    if (feature.properties) {
        const popupContent = `
            <div style="text-align: center;">
                <h3>${feature.properties.dpto_cnmbr}</h3>
                <p><strong>Código:</strong> ${feature.properties.dpto_ccdgo}</p>
            </div>
        `;
        layer.bindPopup(popupContent);
    }

    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
}

function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
        weight: 5,
        color: '#666',
        fillOpacity: 0.7
    });
    layer.bringToFront();
    info.update(layer.feature.properties); // actualiza el panel (11.6)
}

function resetHighlight(e) {
    const layer = e.target;
    layer.setStyle({
        weight: 2,
        color: '#232323',
        fillOpacity: 0.5
    });
    info.update();
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

// -----------------------------------------------------
// Controles personalizados (11.6)
// -----------------------------------------------------
// Escala
L.control.scale({
    position: 'bottomleft',
    metric: true,
    imperial: false
}).addTo(map);

// Panel de información (se actualiza al pasar el mouse)
const info = L.control({position: 'topleft'});

info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info');
    this.update();
    return this._div;
};

info.update = function (props) {
    this._div.innerHTML = `
        <h4>Colombia - Servicios Geográficos</h4>
        <p>Visualización de departamentos y municipios</p>
        <p><small>Datos: IGAC / DANE | Servidor: GeoServer</small></p>
        <hr>
        ${props
            ? '<b>' + props.dpto_cnmbr + '</b><br>Código: ' + props.dpto_ccdgo
            : 'Pasa el cursor sobre un departamento'}
    `;
};

info.addTo(map);

// Leyenda: se pide a GeoServer con GetLegendGraphic (usa el estilo SLD)
const legend = L.control({position: 'bottomright'});

legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    const legendUrl = geoserverWMS +
        '?service=WMS&version=1.1.0&request=GetLegendGraphic' +
        '&format=image/png&layer=taller:departamentos';
    div.innerHTML = `
        <h4>Leyenda</h4>
        <b>Departamentos</b><br><img src="${legendUrl}" alt="Leyenda departamentos"><br>
        <img src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"
             style="height: 18px; margin-right: 8px;"> Capital
    `;
    return div;
};

legend.addTo(map);

// -----------------------------------------------------
// Búsqueda por nombre (11.7)
// -----------------------------------------------------
const searchControl = L.control({position: 'topright'});

searchControl.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'search-control');
    div.innerHTML = `
        <input type="text" id="search-input" placeholder="Buscar departamento...">
        <button id="search-button">Buscar</button>
    `;
    L.DomEvent.disableClickPropagation(div);
    return div;
};

searchControl.addTo(map);

document.addEventListener('DOMContentLoaded', function() {
    const searchButton = document.getElementById('search-button');
    const searchInput = document.getElementById('search-input');

    function buscar() {
        const searchText = searchInput.value.trim().toLowerCase();
        if (!searchText || !departamentosGeoJSON) return;

        let encontrado = null;
        departamentosGeoJSON.eachLayer(function(layer) {
            const nombre = layer.feature.properties.dpto_cnmbr.toLowerCase();
            if (!encontrado && nombre.includes(searchText)) {
                encontrado = layer;
            }
        });

        if (encontrado) {
            map.fitBounds(encontrado.getBounds());
            encontrado.openPopup();
        } else {
            alert('No se encontró el departamento: ' + searchInput.value);
        }
    }

    searchButton.addEventListener('click', buscar);
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') buscar();
    });
});

// -----------------------------------------------------
// Marcador (11.8)
// -----------------------------------------------------
const bogotaMarker = L.marker([4.7110, -74.0721])
    .addTo(map)
    .bindPopup('<b>Bogotá D.C.</b><br>Capital de Colombia');