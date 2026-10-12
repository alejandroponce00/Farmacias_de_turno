/**
 * ============================================================================
 * CONTROLADOR PRINCIPAL: app.js
 * ============================================================================
 * Responsabilidad:
 * - Orquestación de la interfaz de usuario, eventos del DOM, llamadas a la API y sincronización del mapa.
 * - Cobertura completa: CABA y municipios de la Provincia de Buenos Aires,
 *   incorporando las 25 localidades de FarMap (corredores Oeste, Interior Ruta 5 y Costa Atlántica).
 * - Filtros rápidos inspirados en FarMap:
 *   * Acceso inmediato por región / corredor geográfico (chips superiores).
 *   * Filtrado directo por estado de guardia: "Solo de turno", "Abiertas ahora", "24 Horas".
 *   * Barra de vigencia horaria de guardia (08:30 a 08:30 hs según Ley 10.606).
 * - Filtros jerárquicos combinados: Jurisdicción -> Partido / Comuna -> Localidad / Barrio.
 * - Sincronización en tiempo real con fecha oficial de Argentina (America/Argentina/Buenos_Aires).
 * - Geolocalización y ordenamiento por cercanía con Leaflet.js y Google Maps.
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. REFERENCIAS A ELEMENTOS DEL DOM
  // --------------------------------------------------------------------------
  const elementos = {
    // Encabezado y vigencia de guardia
    fechaActual: document.getElementById('fecha-actual'),
    horaActual: document.getElementById('hora-actual'),
    badgeVigenciaTurno: document.getElementById('badge-vigencia-turno'),
    textoVigenciaDetalle: document.getElementById('texto-vigencia-detalle'),
    textoActualizadoTimestamp: document.getElementById('texto-actualizado-timestamp'),
    switchFuenteOficial: document.getElementById('switch-fuente-oficial'),

    // Chips de acceso rápido por región y estado (FarMap)
    contenedorChipsRegion: document.getElementById('contenedor-chips-region'),
    contenedorChipsEstado: document.getElementById('contenedor-chips-estado'),

    // Filtros de formulario
    formFiltros: document.getElementById('form-filtros'),
    inputBusqueda: document.getElementById('input-busqueda'),
    btnLimpiarBusqueda: document.getElementById('btn-limpiar-busqueda'),
    selectJurisdiccion: document.getElementById('select-jurisdiccion'),
    selectPartido: document.getElementById('select-partido'),
    selectLocalidad: document.getElementById('select-localidad'),
    btnLimpiarFiltros: document.getElementById('btn-limpiar-filtros'),
    btnActualizar: document.getElementById('btn-actualizar'),
    btnMiUbicacion: document.getElementById('btn-mi-ubicacion'),

    // Estados y contenedores
    resumenResultados: document.getElementById('resumen-resultados'),
    badgeJurisdiccionActiva: document.getElementById('badge-jurisdiccion-activa'),
    badgeTurnoResumen: document.getElementById('badge-turno-resumen'),
    estadoCargando: document.getElementById('estado-cargando'),
    estadoError: document.getElementById('estado-error'),
    mensajeErrorDetalle: document.getElementById('mensaje-error-detalle'),
    btnReintentar: document.getElementById('btn-reintentar'),
    estadoVacio: document.getElementById('estado-vacio'),
    textoEstadoVacio: document.getElementById('texto-estado-vacio'),
    btnVaciarFiltrosAccion: document.getElementById('btn-vaciar-filtros-accion'),
    contenedorTarjetas: document.getElementById('contenedor-tarjetas'),

    // Mapa
    btnMapaRestablecer: document.getElementById('btn-mapa-restablecer'),

    // Vista en dispositivos móviles
    columnaLista: document.getElementById('columna-lista'),
    columnaMapa: document.getElementById('columna-mapa'),
    tabBtnLista: document.getElementById('tab-btn-lista'),
    tabBtnMapa: document.getElementById('tab-btn-mapa'),
    contadorMovilLista: document.getElementById('contador-movil-lista')
  };

  // --------------------------------------------------------------------------
  // 2. ESTADO GLOBAL DE LA APLICACIÓN
  // --------------------------------------------------------------------------
  const estadoApp = {
    modoFuente: 'turnos_hoy', // 'turnos_hoy' o 'padron_gcba'
    regionActiva: 'todas',
    estadoFiltroActivo: 'todos', // 'todos' | 'turno' | 'abiertas' | '24h'
    farmaciasCargadas: [],
    farmaciasFiltradas: [],
    farmaciaSeleccionadaId: null,
    posicionUsuario: null,
    vistaMovilActiva: 'lista', // 'lista' o 'mapa'
    debounceBusquedaTimeout: null
  };

  // --------------------------------------------------------------------------
  // 3. INICIALIZACIÓN
  // --------------------------------------------------------------------------
  function iniciar() {
    // 1. Iniciar visor cartográfico Leaflet
    ModuloMapa.inicializar('mapa-leaflet');

    // 2. Configurar reloj oficial de Argentina y barra de vigencia de turnos
    actualizarFechaHoraArgentina();
    actualizarBarraVigencia();
    setInterval(() => {
      actualizarFechaHoraArgentina();
      actualizarBarraVigencia();
    }, 30000);

    // 3. Poblar selectores jerárquicos de Partidos y Localidades
    const jurInicial = elementos.selectJurisdiccion ? elementos.selectJurisdiccion.value : 'todas';
    poblarSelectorPartidos(jurInicial);
    poblarSelectorLocalidades(jurInicial, 'todos', 'todas');

    // 4. Registrar todos los manejadores de eventos
    configurarEventos();

    // 5. Cargar catálogo de farmacias
    cargarDatos();
  }

  // --------------------------------------------------------------------------
  // 4. FECHA, HORA Y VIGENCIA REGLAMENTARIA (FARMAP)
  // --------------------------------------------------------------------------
  function actualizarFechaHoraArgentina() {
    const info = ApiFarmacias.obtenerFechaHoraArgentina();
    if (elementos.fechaActual) {
      elementos.fechaActual.textContent = info.fechaFormateada;
    }
    if (elementos.horaActual) {
      elementos.horaActual.textContent = `${info.horaFormateada} hs`;
    }
  }

  function actualizarBarraVigencia() {
    const vigencia = ApiFarmacias.obtenerInfoValidezTurno();
    if (elementos.badgeVigenciaTurno) {
      elementos.badgeVigenciaTurno.innerHTML = `<i class="bi bi-shield-fill-check me-1"></i> Guardia Reglamentaria (Ley 10.606)`;
    }
    if (elementos.textoVigenciaDetalle) {
      elementos.textoVigenciaDetalle.innerHTML = `Turno oficial de 24hs: <strong>${vigencia.validoHastaTexto}</strong>. Horario comercial activo hasta las 20:00 hs.`;
    }
    if (elementos.textoActualizadoTimestamp) {
      elementos.textoActualizadoTimestamp.innerHTML = `<i class="bi bi-clock-history me-1"></i> Actualizado a las ${vigencia.horaActualTexto}`;
    }
  }

  // --------------------------------------------------------------------------
  // 5. CARGA Y FILTRADO DE DATOS
  // --------------------------------------------------------------------------
  async function cargarDatos() {
    mostrarEstado('cargando');

    try {
      const filtros = obtenerValoresFiltros();

      let farmacias = [];
      if (estadoApp.modoFuente === 'padron_gcba') {
        farmacias = await ApiFarmacias.obtenerPadronOficialGCBA(filtros);
      } else {
        farmacias = await ApiFarmacias.obtenerFarmaciasTurnoHoy(filtros);
      }

      estadoApp.farmaciasCargadas = farmacias;

      // Si el usuario proporcionó su ubicación, calcular distancias y ordenar por cercanía
      if (estadoApp.posicionUsuario) {
        calcularDistanciasYOrdenar();
      } else {
        // Priorizar farmacias de turno o abiertas al principio
        estadoApp.farmaciasFiltradas = [...farmacias].sort((a, b) => {
          if (a.tipoServicio === '24h' && b.tipoServicio !== '24h') return -1;
          if (b.tipoServicio === '24h' && a.tipoServicio !== '24h') return 1;
          if (a.deTurnoHoy && !b.deTurnoHoy) return -1;
          if (!a.deTurnoHoy && b.deTurnoHoy) return 1;
          if (a.abiertaAhora && !b.abiertaAhora) return -1;
          if (!a.abiertaAhora && b.abiertaAhora) return 1;
          return a.nombre.localeCompare(b.nombre, 'es');
        });
      }

      renderizarResultados();
    } catch (error) {
      console.error('Error durante la carga de datos:', error);
      mostrarEstado('error', error.message || 'Error de comunicación con la base de datos.');
    }
  }

  /**
   * Recopila todos los criterios de filtrado seleccionados en la UI.
   */
  function obtenerValoresFiltros() {
    return {
      jurisdiccion: elementos.selectJurisdiccion ? elementos.selectJurisdiccion.value : 'todas',
      region: estadoApp.regionActiva,
      partido: elementos.selectPartido ? elementos.selectPartido.value : 'todos',
      localidad: elementos.selectLocalidad ? elementos.selectLocalidad.value : 'todas',
      query: elementos.inputBusqueda ? elementos.inputBusqueda.value.trim() : '',
      estadoFiltro: estadoApp.estadoFiltroActivo
    };
  }

  /**
   * Puebla el selector de Partidos / Municipios / Comunas según la jurisdicción.
   */
  function poblarSelectorPartidos(jurisdiccion) {
    const partidos = ApiFarmacias.obtenerPartidosDisponibles(jurisdiccion);
    const valorPrevio = elementos.selectPartido ? elementos.selectPartido.value : 'todos';

    let textoDefault = 'Todos los municipios / comunas';
    if (jurisdiccion === 'caba') textoDefault = 'Todas las comunas de CABA';
    if (jurisdiccion === 'pba') textoDefault = 'Todos los municipios de PBA';

    if (elementos.selectPartido) {
      elementos.selectPartido.innerHTML = `<option value="todos">${textoDefault}</option>`;
      partidos.forEach(p => {
        const option = document.createElement('option');
        option.value = p;
        option.textContent = p;
        if (p === valorPrevio) option.selected = true;
        elementos.selectPartido.appendChild(option);
      });
    }
  }

  /**
   * Puebla el selector de Localidades según jurisdicción, partido y región.
   */
  function poblarSelectorLocalidades(jurisdiccion, partido = 'todos', region = 'todas') {
    const localidades = ApiFarmacias.obtenerLocalidadesDisponibles(jurisdiccion, partido, region);
    const valorPrevio = elementos.selectLocalidad ? elementos.selectLocalidad.value : 'todas';

    let textoDefault = 'Todas las localidades';
    if (partido !== 'todos') textoDefault = `Todas las localidades de ${partido}`;

    if (elementos.selectLocalidad) {
      elementos.selectLocalidad.innerHTML = `<option value="todas">${textoDefault}</option>`;
      localidades.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc;
        option.textContent = loc;
        if (loc === valorPrevio) option.selected = true;
        elementos.selectLocalidad.appendChild(option);
      });
    }
  }

  /**
   * Restablece todos los filtros al estado inicial abarcativo (toda la provincia y CABA).
   */
  function limpiarTodosLosFiltros() {
    if (elementos.inputBusqueda) {
      elementos.inputBusqueda.value = '';
    }
    if (elementos.btnLimpiarBusqueda) {
      elementos.btnLimpiarBusqueda.classList.add('d-none');
    }

    estadoApp.regionActiva = 'todas';
    activarChipRegionVisual('todas');

    estadoApp.estadoFiltroActivo = 'todos';
    activarChipEstadoVisual('todos');

    if (elementos.selectJurisdiccion) {
      elementos.selectJurisdiccion.value = 'todas';
    }
    poblarSelectorPartidos('todas');
    if (elementos.selectPartido) {
      elementos.selectPartido.value = 'todos';
    }
    poblarSelectorLocalidades('todas', 'todos', 'todas');
    if (elementos.selectLocalidad) {
      elementos.selectLocalidad.value = 'todas';
    }

    actualizarBadgesEncabezado();
    cargarDatos();
  }

  function actualizarBadgesEncabezado() {
    const jur = elementos.selectJurisdiccion ? elementos.selectJurisdiccion.value : 'todas';
    const partido = elementos.selectPartido ? elementos.selectPartido.value : 'todos';

    if (elementos.badgeJurisdiccionActiva) {
      if (partido !== 'todos') {
        elementos.badgeJurisdiccionActiva.textContent = `Partido: ${partido}`;
      } else if (estadoApp.regionActiva !== 'todas') {
        const nombresRegiones = {
          caba: 'CABA (Capital Federal)',
          oeste: 'Corredor Oeste Bonaerense',
          costa: 'Costa Atlántica Bonaerense',
          interior: 'Interior Bonaerense (Ruta 5)',
          norte: 'Zona Norte Conurbano',
          sur: 'Zona Sur Conurbano',
          laplata: 'Gran La Plata',
          grandes: 'Grandes Ciudades del Interior'
        };
        elementos.badgeJurisdiccionActiva.textContent = nombresRegiones[estadoApp.regionActiva] || 'Región filtrada';
      } else if (jur === 'caba') {
        elementos.badgeJurisdiccionActiva.textContent = 'Ciudad Autónoma de Buenos Aires';
      } else if (jur === 'pba') {
        elementos.badgeJurisdiccionActiva.textContent = 'Provincia de Buenos Aires (Todos los municipios)';
      } else {
        elementos.badgeJurisdiccionActiva.textContent = 'CABA y toda la Provincia de Buenos Aires';
      }
    }

    if (elementos.badgeTurnoResumen) {
      if (estadoApp.estadoFiltroActivo === 'turno') {
        elementos.badgeTurnoResumen.textContent = 'Mostrando: Solo farmacias de turno';
      } else if (estadoApp.estadoFiltroActivo === 'abiertas') {
        elementos.badgeTurnoResumen.textContent = 'Mostrando: Abiertas en este momento';
      } else if (estadoApp.estadoFiltroActivo === '24h') {
        elementos.badgeTurnoResumen.textContent = 'Mostrando: Farmacias 24hs permanente';
      } else {
        elementos.badgeTurnoResumen.textContent = 'Guardia oficial 24hs activa';
      }
    }
  }

  function activarChipRegionVisual(regionSlug) {
    if (!elementos.contenedorChipsRegion) return;
    const chips = elementos.contenedorChipsRegion.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
      if (chip.getAttribute('data-region') === regionSlug) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  function activarChipEstadoVisual(estadoSlug) {
    if (!elementos.contenedorChipsEstado) return;
    const chips = elementos.contenedorChipsEstado.querySelectorAll('.duty-chip');
    chips.forEach(chip => {
      if (chip.getAttribute('data-estado') === estadoSlug) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 6. RENDERIZADO DE RESULTADOS (TARJETAS + MAPA)
  // --------------------------------------------------------------------------
  function renderizarResultados() {
    const total = estadoApp.farmaciasFiltradas.length;

    if (elementos.contadorMovilLista) {
      elementos.contadorMovilLista.textContent = total;
    }

    actualizarBadgesEncabezado();

    if (total === 0) {
      mostrarEstado('vacio');
      if (elementos.resumenResultados) {
        elementos.resumenResultados.textContent = '0 farmacias encontradas para el criterio de búsqueda.';
      }
      ModuloMapa.renderizarMarcadores([], null, estadoApp.regionActiva !== 'todas' ? estadoApp.regionActiva : (elementos.selectJurisdiccion ? elementos.selectJurisdiccion.value : 'todas'));
      return;
    }

    // Construcción del texto de resumen amigable
    const jur = elementos.selectJurisdiccion ? elementos.selectJurisdiccion.value : 'todas';
    const partido = elementos.selectPartido ? elementos.selectPartido.value : 'todos';
    const loc = elementos.selectLocalidad ? elementos.selectLocalidad.value : 'todas';

    let lugarTexto = 'en Buenos Aires';
    if (loc !== 'todas') {
      lugarTexto = `en ${loc}${partido !== 'todos' ? ` (${partido})` : ''}`;
    } else if (partido !== 'todos') {
      lugarTexto = `en el partido de ${partido}`;
    } else if (estadoApp.regionActiva !== 'todas') {
      lugarTexto = 'en la zona seleccionada';
    } else if (jur === 'caba') {
      lugarTexto = 'en CABA';
    } else if (jur === 'pba') {
      lugarTexto = 'en la Provincia de Buenos Aires';
    }

    let estadoTexto = '';
    if (estadoApp.estadoFiltroActivo === 'turno') estadoTexto = ' (de turno hoy)';
    if (estadoApp.estadoFiltroActivo === 'abiertas') estadoTexto = ' (abiertas ahora)';
    if (estadoApp.estadoFiltroActivo === '24h') estadoTexto = ' (24 horas)';

    if (elementos.resumenResultados) {
      elementos.resumenResultados.innerHTML = `Mostrando <strong>${total}</strong> farmacia${total === 1 ? '' : 's'} ${lugarTexto}${estadoTexto}`;
    }

    // Renderizar tarjetas en la lista
    if (elementos.contenedorTarjetas) {
      elementos.contenedorTarjetas.innerHTML = '';
      const fragment = document.createDocumentFragment();

      estadoApp.farmaciasFiltradas.forEach(farmacia => {
        const tarjeta = crearElementoTarjeta(farmacia);
        fragment.appendChild(tarjeta);
      });

      elementos.contenedorTarjetas.appendChild(fragment);
    }

    // Renderizar marcadores en el mapa Leaflet
    const claveRegionOJur = estadoApp.regionActiva !== 'todas'
      ? estadoApp.regionActiva
      : (elementos.selectJurisdiccion ? elementos.selectJurisdiccion.value : 'todas');

    ModuloMapa.renderizarMarcadores(
      estadoApp.farmaciasFiltradas,
      (idSeleccionado) => {
        resaltarTarjeta(idSeleccionado, true);
      },
      claveRegionOJur
    );

    mostrarEstado('exito');
  }

  /**
   * Crea el elemento HTML de la tarjeta de una farmacia con badges estilo FarMap.
   */
  function crearElementoTarjeta(farmacia) {
    const card = document.createElement('article');
    card.className = `pharmacy-card ${farmacia.tipoServicio === '24h' ? 'card-24h' : farmacia.deTurnoHoy ? 'card-on-duty' : ''}`;
    card.id = `card-${farmacia.id}`;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', `Farmacia ${farmacia.nombre}`);

    // Badges según tipo de guardia (FarMap)
    let badgeTurno = '';
    if (farmacia.tipoServicio === '24h') {
      badgeTurno = `
        <span class="badge-24h">
          <i class="bi bi-clock-history" aria-hidden="true"></i> 24 Horas Permanente
        </span>
      `;
    } else if (farmacia.deTurnoHoy) {
      badgeTurno = `
        <span class="badge-duty">
          <i class="bi bi-shield-fill-check" aria-hidden="true"></i> DE TURNO HOY
        </span>
      `;
    } else {
      badgeTurno = `
        <span class="badge-regular">
          <i class="bi bi-hospital" aria-hidden="true"></i> Horario Comercial
        </span>
      `;
    }

    // Badge de abierta en este momento
    const badgeAbierta = farmacia.abiertaAhora
      ? `<span class="badge bg-success-subtle text-success border border-success-subtle small fw-medium">
           <span class="pulse-dot me-1"></span> Abierta ahora
         </span>`
      : `<span class="badge bg-light text-muted border small fw-medium">Cerrada ahora</span>`;

    // Distancia si está geolocalizado
    const textoDistancia = farmacia.distanciaKm !== undefined
      ? `<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle small ms-auto">
           <i class="bi bi-cursor-fill me-1"></i>a ${farmacia.distanciaKm.toFixed(1)} km
         </span>`
      : '';

    // Teléfono
    const telLimpio = (farmacia.telefono || '').replace(/[^\d+]/g, '');
    const telefonoHtml = telLimpio
      ? `<a href="tel:${telLimpio}" class="text-primary fw-medium" title="Llamar a ${farmacia.nombre}">
           ${farmacia.telefono}
         </a>`
      : '<span class="text-muted">No informado</span>';

    // Badge de jurisdicción (CABA o PBA)
    const jurBadge = farmacia.jurisdiccion === 'caba'
      ? '<span class="badge bg-success-subtle text-success border border-success-subtle small">CABA</span>'
      : '<span class="badge bg-primary-subtle text-primary border border-primary-subtle small">Prov. Bs. As.</span>';

    const localidadTexto = farmacia.localidad || farmacia.barrio;
    const partidoTexto = farmacia.partido ? `Partido: ${farmacia.partido}` : '';

    card.innerHTML = `
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          ${badgeTurno}
          ${badgeAbierta}
        </div>
        <div class="d-flex align-items-center gap-2">
          ${jurBadge}
          ${textoDistancia}
        </div>
      </div>

      <h3 class="pharmacy-name mb-2">${farmacia.nombre}</h3>

      <div class="d-flex flex-column gap-2 mb-3">
        <!-- Dirección y Localidad -->
        <div class="info-row info-row-address">
          <i class="bi bi-geo-alt-fill" aria-hidden="true"></i>
          <div>
            <strong>${farmacia.direccion}</strong>, <span class="text-secondary">${localidadTexto}</span>
            <small class="text-muted d-block">${partidoTexto}</small>
          </div>
        </div>

        <!-- Teléfono -->
        <div class="info-row info-row-phone">
          <i class="bi bi-telephone-fill" aria-hidden="true"></i>
          <div>
            ${telefonoHtml}
          </div>
        </div>

        <!-- Horario / Turno -->
        <div class="info-row info-row-time">
          <i class="bi bi-clock-fill" aria-hidden="true"></i>
          <div class="small">
            <span class="fw-semibold">${farmacia.horarioTurno}</span>
          </div>
        </div>
      </div>

      <!-- Acciones de la tarjeta estilo FarMap -->
      <div class="card-actions d-flex align-items-center justify-content-between gap-2 pt-2 border-top">
        <button type="button" class="btn btn-outline-success btn-sm rounded-pill btn-ver-en-mapa" data-id="${farmacia.id}">
          <i class="bi bi-pin-map-fill me-1" aria-hidden="true"></i> Ver en mapa
        </button>
        
        <div class="d-flex align-items-center gap-2">
          ${telLimpio ? `
            <a href="tel:${telLimpio}" class="btn btn-outline-primary btn-sm rounded-pill d-none d-sm-inline-flex align-items-center" title="Llamar a la farmacia">
              <i class="bi bi-telephone-fill me-1"></i> Llamar
            </a>
          ` : ''}

          <a href="${farmacia.enlaceMaps}" target="_blank" rel="noopener noreferrer" class="btn btn-success btn-sm rounded-pill d-inline-flex align-items-center text-white" title="Abrir indicaciones en Google Maps">
            <i class="bi bi-cursor-fill me-1" aria-hidden="true"></i> Cómo llegar
          </a>
        </div>
      </div>
    `;

    // Clic en la tarjeta para resaltar y centrar mapa
    card.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('button')) return;
      seleccionarFarmacia(farmacia.id);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        seleccionarFarmacia(farmacia.id);
      }
    });

    const btnVerMapa = card.querySelector('.btn-ver-en-mapa');
    if (btnVerMapa) {
      btnVerMapa.addEventListener('click', (e) => {
        e.stopPropagation();
        seleccionarFarmacia(farmacia.id, true);
      });
    }

    return card;
  }

  function seleccionarFarmacia(idFarmacia, cambiarVistaMovilSiCorresponde = false) {
    estadoApp.farmaciaSeleccionadaId = idFarmacia;
    resaltarTarjeta(idFarmacia, false);
    ModuloMapa.centrarEnFarmacia(idFarmacia);

    if (cambiarVistaMovilSiCorresponde && window.innerWidth < 768) {
      cambiarPestanaMovil('mapa');
    }
  }

  function resaltarTarjeta(idFarmacia, hacerScroll = true) {
    if (!elementos.contenedorTarjetas) return;

    const tarjetasPrevias = elementos.contenedorTarjetas.querySelectorAll('.pharmacy-card.active-card');
    tarjetasPrevias.forEach(t => t.classList.remove('active-card'));

    const tarjeta = document.getElementById(`card-${idFarmacia}`);
    if (tarjeta) {
      tarjeta.classList.add('active-card');
      if (hacerScroll) {
        tarjeta.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 7. GESTIÓN DE ESTADOS DE LA INTERFAZ
  // --------------------------------------------------------------------------
  function mostrarEstado(tipo, mensajeDetalle = '') {
    if (elementos.estadoCargando) elementos.estadoCargando.classList.add('d-none');
    if (elementos.estadoError) elementos.estadoError.classList.add('d-none');
    if (elementos.estadoVacio) elementos.estadoVacio.classList.add('d-none');
    if (elementos.contenedorTarjetas) elementos.contenedorTarjetas.classList.remove('d-none');

    switch (tipo) {
      case 'cargando':
        if (elementos.estadoCargando) elementos.estadoCargando.classList.remove('d-none');
        if (elementos.contenedorTarjetas) elementos.contenedorTarjetas.classList.add('d-none');
        break;
      case 'error':
        if (elementos.estadoError) {
          elementos.estadoError.classList.remove('d-none');
          if (elementos.mensajeErrorDetalle && mensajeDetalle) {
            elementos.mensajeErrorDetalle.textContent = mensajeDetalle;
          }
        }
        if (elementos.contenedorTarjetas) elementos.contenedorTarjetas.classList.add('d-none');
        break;
      case 'vacio':
        if (elementos.estadoVacio) elementos.estadoVacio.classList.remove('d-none');
        if (elementos.contenedorTarjetas) elementos.contenedorTarjetas.classList.add('d-none');
        break;
      case 'exito':
      default:
        // Las tarjetas quedan visibles
        break;
    }
  }

  // --------------------------------------------------------------------------
  // 8. GEOLOCALIZACIÓN Y DISTANCIAS
  // --------------------------------------------------------------------------
  function solicitarUbicacionUsuario() {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return;
    }

    if (elementos.btnMiUbicacion) {
      elementos.btnMiUbicacion.disabled = true;
      elementos.btnMiUbicacion.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Localizando...';
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        const { latitude, longitude } = posicion.coords;
        estadoApp.posicionUsuario = { lat: latitude, lng: longitude };

        ModuloMapa.marcarUbicacionUsuario(latitude, longitude);
        calcularDistanciasYOrdenar();
        renderizarResultados();

        if (elementos.btnMiUbicacion) {
          elementos.btnMiUbicacion.disabled = false;
          elementos.btnMiUbicacion.classList.replace('btn-light', 'btn-primary');
          elementos.btnMiUbicacion.classList.replace('text-primary', 'text-white');
          elementos.btnMiUbicacion.innerHTML = '<i class="bi bi-geo-alt-fill me-1"></i> Mi Ubicación Activa';
        }
      },
      (error) => {
        console.warn('Geolocalización rechazada o no disponible:', error);
        if (elementos.btnMiUbicacion) {
          elementos.btnMiUbicacion.disabled = false;
          elementos.btnMiUbicacion.innerHTML = '<i class="bi bi-crosshair me-1"></i> Cerca de mí';
        }
        alert('No se pudo acceder a tu ubicación. Verificá los permisos de ubicación en tu navegador.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function calcularDistanciasYOrdenar() {
    if (!estadoApp.posicionUsuario) return;
    const { lat, lng } = estadoApp.posicionUsuario;

    estadoApp.farmaciasFiltradas.forEach(f => {
      if (typeof f.lat === 'number' && typeof f.lng === 'number') {
        f.distanciaKm = calcularDistanciaKm(lat, lng, f.lat, f.lng);
      } else {
        f.distanciaKm = 99999;
      }
    });

    estadoApp.farmaciasFiltradas.sort((a, b) => (a.distanciaKm || 99999) - (b.distanciaKm || 99999));
  }

  // --------------------------------------------------------------------------
  // 9. VISTA EN DISPOSITIVOS MÓVILES (PESTAÑAS LISTA / MAPA)
  // --------------------------------------------------------------------------
  function cambiarPestanaMovil(pestana) {
    estadoApp.vistaMovilActiva = pestana;

    if (pestana === 'lista') {
      if (elementos.tabBtnLista) elementos.tabBtnLista.classList.add('active');
      if (elementos.tabBtnMapa) elementos.tabBtnMapa.classList.remove('active');
      if (elementos.columnaLista) elementos.columnaLista.classList.remove('d-none');
      if (elementos.columnaMapa) elementos.columnaMapa.classList.add('view-hidden-mobile');
    } else {
      if (elementos.tabBtnMapa) elementos.tabBtnMapa.classList.add('active');
      if (elementos.tabBtnLista) elementos.tabBtnLista.classList.remove('active');
      if (elementos.columnaMapa) elementos.columnaMapa.classList.remove('view-hidden-mobile');
      if (elementos.columnaLista) elementos.columnaLista.classList.add('d-none');
      ModuloMapa.refrescarTamano();
    }
  }

  // --------------------------------------------------------------------------
  // 10. CONFIGURACIÓN DE EVENTOS
  // --------------------------------------------------------------------------
  function configurarEventos() {
    // 1. Chips de Región Rápida (Estilo FarMap)
    if (elementos.contenedorChipsRegion) {
      elementos.contenedorChipsRegion.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-chip');
        if (!btn) return;

        const region = btn.getAttribute('data-region') || 'todas';
        estadoApp.regionActiva = region;
        activarChipRegionVisual(region);

        // Ajustar select de jurisdicción automáticamente
        if (elementos.selectJurisdiccion) {
          if (region === 'caba') {
            elementos.selectJurisdiccion.value = 'caba';
          } else if (region !== 'todas') {
            elementos.selectJurisdiccion.value = 'pba';
          } else {
            elementos.selectJurisdiccion.value = 'todas';
          }
        }

        const jur = elementos.selectJurisdiccion ? elementos.selectJurisdiccion.value : 'todas';
        poblarSelectorPartidos(jur);
        if (elementos.selectPartido) elementos.selectPartido.value = 'todos';
        poblarSelectorLocalidades(jur, 'todos', region);
        if (elementos.selectLocalidad) elementos.selectLocalidad.value = 'todas';

        cargarDatos();
      });
    }

    // 2. Chips de Estado de Guardia (Estilo FarMap: turno | abiertas | 24h)
    if (elementos.contenedorChipsEstado) {
      elementos.contenedorChipsEstado.addEventListener('click', (e) => {
        const btn = e.target.closest('.duty-chip');
        if (!btn) return;

        const estadoSlug = btn.getAttribute('data-estado') || 'todos';
        estadoApp.estadoFiltroActivo = estadoSlug;
        activarChipEstadoVisual(estadoSlug);

        cargarDatos();
      });
    }

    // 3. Cambio de Jurisdicción (CABA vs PBA)
    if (elementos.selectJurisdiccion) {
      elementos.selectJurisdiccion.addEventListener('change', () => {
        const jur = elementos.selectJurisdiccion.value;
        estadoApp.regionActiva = jur === 'caba' ? 'caba' : 'todas';
        activarChipRegionVisual(estadoApp.regionActiva);

        poblarSelectorPartidos(jur);
        poblarSelectorLocalidades(jur, 'todos', estadoApp.regionActiva);

        actualizarBadgesEncabezado();
        cargarDatos();
      });
    }

    // 4. Cambio de Partido / Comuna
    if (elementos.selectPartido) {
      elementos.selectPartido.addEventListener('change', () => {
        const jur = elementos.selectJurisdiccion ? elementos.selectJurisdiccion.value : 'todas';
        const partido = elementos.selectPartido.value;
        poblarSelectorLocalidades(jur, partido, estadoApp.regionActiva);

        actualizarBadgesEncabezado();
        cargarDatos();
      });
    }

    // 5. Cambio de Localidad / Barrio
    if (elementos.selectLocalidad) {
      elementos.selectLocalidad.addEventListener('change', () => {
        actualizarBadgesEncabezado();
        cargarDatos();
      });
    }

    // 6. Búsqueda con debounce
    if (elementos.inputBusqueda) {
      elementos.inputBusqueda.addEventListener('input', () => {
        const val = elementos.inputBusqueda.value.trim();
        if (elementos.btnLimpiarBusqueda) {
          if (val.length > 0) {
            elementos.btnLimpiarBusqueda.classList.remove('d-none');
          } else {
            elementos.btnLimpiarBusqueda.classList.add('d-none');
          }
        }

        clearTimeout(estadoApp.debounceBusquedaTimeout);
        estadoApp.debounceBusquedaTimeout = setTimeout(() => {
          cargarDatos();
        }, 250);
      });
    }

    // 7. Botón limpiar búsqueda
    if (elementos.btnLimpiarBusqueda) {
      elementos.btnLimpiarBusqueda.addEventListener('click', () => {
        elementos.inputBusqueda.value = '';
        elementos.btnLimpiarBusqueda.classList.add('d-none');
        elementos.inputBusqueda.focus();
        cargarDatos();
      });
    }

    // 8. Botones de limpiar filtros
    if (elementos.btnLimpiarFiltros) {
      elementos.btnLimpiarFiltros.addEventListener('click', limpiarTodosLosFiltros);
    }
    if (elementos.btnVaciarFiltrosAccion) {
      elementos.btnVaciarFiltrosAccion.addEventListener('click', limpiarTodosLosFiltros);
    }

    // 9. Botón Actualizar
    if (elementos.btnActualizar) {
      elementos.btnActualizar.addEventListener('click', () => {
        actualizarFechaHoraArgentina();
        actualizarBarraVigencia();
        cargarDatos();
      });
    }

    // 10. Botón Reintentar en caso de error
    if (elementos.btnReintentar) {
      elementos.btnReintentar.addEventListener('click', cargarDatos);
    }

    // 11. Botón Mi Ubicación (Geolocalización)
    if (elementos.btnMiUbicacion) {
      elementos.btnMiUbicacion.addEventListener('click', solicitarUbicacionUsuario);
    }

    // 12. Switch Padrón Oficial GCBA
    if (elementos.switchFuenteOficial) {
      elementos.switchFuenteOficial.addEventListener('change', (e) => {
        if (e.target.checked) {
          estadoApp.modoFuente = 'padron_gcba';
          if (elementos.selectJurisdiccion) elementos.selectJurisdiccion.value = 'caba';
          estadoApp.regionActiva = 'caba';
          activarChipRegionVisual('caba');
          poblarSelectorPartidos('caba');
          poblarSelectorLocalidades('caba', 'todos', 'caba');
        } else {
          estadoApp.modoFuente = 'turnos_hoy';
        }
        cargarDatos();
      });
    }

    // 13. Botón Reencuadrar Mapa
    if (elementos.btnMapaRestablecer) {
      elementos.btnMapaRestablecer.addEventListener('click', () => {
        const clave = estadoApp.regionActiva !== 'todas'
          ? estadoApp.regionActiva
          : (elementos.selectJurisdiccion ? elementos.selectJurisdiccion.value : 'todas');
        ModuloMapa.ajustarEncuadre(clave);
      });
    }

    // 14. Pestañas en vista móvil
    if (elementos.tabBtnLista) {
      elementos.tabBtnLista.addEventListener('click', () => cambiarPestanaMovil('lista'));
    }
    if (elementos.tabBtnMapa) {
      elementos.tabBtnMapa.addEventListener('click', () => cambiarPestanaMovil('mapa'));
    }

    // 15. Adaptación al redimensionar ventana
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768) {
        if (elementos.columnaLista) elementos.columnaLista.classList.remove('d-none');
        if (elementos.columnaMapa) elementos.columnaMapa.classList.remove('view-hidden-mobile');
        ModuloMapa.refrescarTamano();
      } else {
        cambiarPestanaMovil(estadoApp.vistaMovilActiva);
      }
    });
  }

  // Ejecución inicial
  iniciar();
});
