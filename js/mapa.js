/**
 * ============================================================================
 * MÓDULO DE MAPA: mapa.js
 * ============================================================================
 * Responsabilidad:
 * - Visor cartográfico con Leaflet.js y OpenStreetMap con cobertura para
 *   toda la Provincia de Buenos Aires y la Ciudad Autónoma de Buenos Aires.
 * - Marcadores categorizados (Turno 24hs, Guardia, 24h Permanente, Padrón General).
 * - Ventanas emergentes (popups) con información de partido, localidad, dirección,
 *   horario de guardia, botón de llamada (`tel:`) y botón para navegar con Google Maps.
 * - Encuadre dinámico que abarca desde el AMBA hasta las ciudades del interior bonaerense.
 * - Sincronización con las tarjetas de farmacias y geolocalización del usuario.
 */

const ModuloMapa = (() => {
  'use strict';

  // Centros cartográficos según jurisdicción
  const CENTRO_PROVINCIA = [-36.5, -60.0]; // Centro geográfico de PBA
  const ZOOM_PROVINCIA = 7;

  const CENTRO_CABA = [-34.6037, -58.3816]; // Obelisco CABA
  const ZOOM_CABA = 12;

  const CENTRO_REGIONAL = [-35.5, -59.0]; // Encuadre CABA + PBA
  const ZOOM_REGIONAL = 8;

  let mapa = null;
  let grupoMarcadores = null;
  let marcadorUsuario = null;
  const mapaDeMarcadoresPorId = new Map();

  /**
   * Genera el HTML de un icono SVG de cruz de farmacia para los marcadores de Leaflet.
   */
  function crearIconoMarcador(tipoClase) {
    const html = `
      <div class="custom-map-marker ${tipoClase}" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/>
        </svg>
      </div>
    `;

    return L.divIcon({
      className: 'leaflet-custom-div-icon',
      html: html,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20]
    });
  }

  /**
   * Genera el icono para la posición del usuario actual.
   */
  function crearIconoUsuario() {
    const html = `
      <div class="custom-map-marker marker-user" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6"/>
        </svg>
      </div>
    `;

    return L.divIcon({
      className: 'leaflet-user-div-icon',
      html: html,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });
  }

  /**
   * Construye el contenido HTML accesible del popup informativo de cada farmacia.
   */
  function generarHtmlPopup(farmacia) {
    let badgeHtml = '';
    if (farmacia.tipoServicio === '24h') {
      badgeHtml = '<span class="badge bg-primary text-white mb-2"><i class="bi bi-clock-history me-1"></i>24 Horas Permanente</span>';
    } else if (farmacia.deTurnoHoy) {
      badgeHtml = '<span class="badge bg-success text-white mb-2"><i class="bi bi-shield-check me-1"></i>De Turno Hoy</span>';
    } else {
      badgeHtml = '<span class="badge bg-secondary text-white mb-2">Padrón General</span>';
    }

    const badgeJur = farmacia.jurisdiccion === 'caba'
      ? '<span class="badge bg-light text-dark border ms-1">CABA</span>'
      : '<span class="badge bg-light text-dark border ms-1">PBA</span>';

    const telLimpio = (farmacia.telefono || '').replace(/[^\d+]/g, '');
    const botonLlamar = telLimpio
      ? `<a href="tel:${telLimpio}" class="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center gap-1 w-100 mb-2">
           <i class="bi bi-telephone-fill"></i> Llamar: ${farmacia.telefono}
         </a>`
      : '';

    const localidadTexto = farmacia.localidad || farmacia.barrio;
    const partidoTexto = farmacia.partido ? ` (${farmacia.partido})` : '';

    return `
      <div class="popup-custom">
        <div class="d-flex align-items-center justify-content-between mb-1">
          ${badgeHtml}
          ${badgeJur}
        </div>
        <h3 class="popup-title">${farmacia.nombre}</h3>
        <div class="popup-body">
          <p class="mb-1 text-secondary">
            <i class="bi bi-geo-alt-fill text-danger me-1"></i>
            <strong>${farmacia.direccion}</strong>, ${localidadTexto}${partidoTexto}
          </p>
          <p class="mb-2 text-muted small">
            <i class="bi bi-clock me-1 text-warning"></i>${farmacia.horarioTurno}
          </p>
          ${botonLlamar}
          <a href="${farmacia.enlaceMaps}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-success d-inline-flex align-items-center justify-content-center gap-1 w-100 text-white">
            <i class="bi bi-cursor-fill"></i> Cómo llegar en Google Maps
          </a>
        </div>
      </div>
    `;
  }

  /**
   * Inicializa el visor cartográfico de Leaflet.
   */
  function inicializar(contenedorId = 'mapa-leaflet') {
    if (mapa) return;

    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) {
      console.error(`Contenedor #${contenedorId} no encontrado en el DOM.`);
      return;
    }

    mapa = L.map(contenedorId, {
      center: CENTRO_REGIONAL,
      zoom: ZOOM_REGIONAL,
      zoomControl: true,
      scrollWheelZoom: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(mapa);

    grupoMarcadores = L.featureGroup().addTo(mapa);
  }

  /**
   * Renderiza el conjunto de farmacias en el mapa con marcadores y popups.
   */
  function renderizarMarcadores(farmacias = [], onSelectFarmacia = null, jurisdiccionActual = 'todas') {
    if (!mapa || !grupoMarcadores) return;

    grupoMarcadores.clearLayers();
    mapaDeMarcadoresPorId.clear();

    if (farmacias.length === 0) {
      ajustarEncuadre(jurisdiccionActual);
      actualizarContadorMarcadores(0);
      return;
    }

    const iconos = {
      duty: crearIconoMarcador('marker-duty'),
      '24h': crearIconoMarcador('marker-24h'),
      regular: crearIconoMarcador('marker-regular')
    };

    farmacias.forEach(farmacia => {
      if (typeof farmacia.lat !== 'number' || typeof farmacia.lng !== 'number') return;

      const icono = iconos[farmacia.badgeTipo] || iconos.regular;
      const marker = L.marker([farmacia.lat, farmacia.lng], {
        icon: icono,
        title: farmacia.nombre,
        alt: `Marcador de ${farmacia.nombre}`
      });

      marker.bindPopup(generarHtmlPopup(farmacia));

      marker.on('click', () => {
        if (typeof onSelectFarmacia === 'function') {
          onSelectFarmacia(farmacia.id);
        }
      });

      marker.addTo(grupoMarcadores);
      mapaDeMarcadoresPorId.set(farmacia.id, marker);
    });

    actualizarContadorMarcadores(mapaDeMarcadoresPorId.size);

    ajustarEncuadre(jurisdiccionActual);
  }

  /**
   * Centra la vista del mapa en una farmacia específica y abre su popup informativo.
   */
  function centrarEnFarmacia(idFarmacia) {
    if (!mapa) return;

    const marker = mapaDeMarcadoresPorId.get(idFarmacia);
    if (marker) {
      const latLng = marker.getLatLng();
      mapa.flyTo(latLng, 16, { animate: true, duration: 0.8 });
      marker.openPopup();
    }
  }

  /**
   * Ajusta el zoom y límites del mapa de forma inteligente:
   * si hay marcadores visibles, se encuadran todos; si no hay ninguno,
   * se centra según la jurisdicción seleccionada.
   */
  function ajustarEncuadre(jurisdiccion = 'todas') {
    if (!mapa || !grupoMarcadores) return;

    if (grupoMarcadores.getLayers().length > 0) {
      mapa.fitBounds(grupoMarcadores.getBounds(), {
        padding: [30, 30],
        maxZoom: 15
      });
    } else {
      if (jurisdiccion === 'pba') {
        mapa.setView(CENTRO_PROVINCIA, ZOOM_PROVINCIA);
      } else if (jurisdiccion === 'caba') {
        mapa.setView(CENTRO_CABA, ZOOM_CABA);
      } else {
        mapa.setView(CENTRO_REGIONAL, ZOOM_REGIONAL);
      }
    }
  }

  /**
   * Actualiza el contador de marcadores visual en el encabezado del mapa.
   */
  function actualizarContadorMarcadores(total) {
    const el = document.getElementById('contador-marcadores-mapa');
    if (el) {
      el.textContent = `${total} marcador${total === 1 ? '' : 'es'}`;
    }
  }

  /**
   * Posiciona un marcador en la ubicación del usuario y centra el mapa.
   */
  function marcarUbicacionUsuario(lat, lng) {
    if (!mapa) return;

    if (marcadorUsuario) {
      mapa.removeLayer(marcadorUsuario);
    }

    marcadorUsuario = L.marker([lat, lng], {
      icon: crearIconoUsuario(),
      title: 'Tu ubicación actual',
      zIndexOffset: 1500
    }).bindPopup(`
      <div class="popup-custom text-center">
        <h3 class="popup-title text-primary"><i class="bi bi-geo-alt-fill"></i> Tu ubicación actual</h3>
        <p class="small text-muted mb-0">Buscando farmacias de turno cercanas</p>
      </div>
    `);

    marcadorUsuario.addTo(mapa);
    mapa.flyTo([lat, lng], 13, { animate: true, duration: 1 });
    marcadorUsuario.openPopup();
  }

  /**
   * Fuerza el recalculo del tamaño del visor del mapa.
   */
  function refrescarTamano() {
    if (mapa) {
      setTimeout(() => {
        mapa.invalidateSize();
      }, 150);
    }
  }

  return {
    inicializar,
    renderizarMarcadores,
    centrarEnFarmacia,
    ajustarEncuadre,
    marcarUbicacionUsuario,
    refrescarTamano
  };
})();
