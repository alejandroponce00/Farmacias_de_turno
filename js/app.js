/**
 * ============================================================================
 * CONTROLADOR PRINCIPAL: app.js
 * ============================================================================
 * Responsabilidad:
 * - Orquestación de la interfaz de usuario, eventos del DOM, llamadas a la API y sincronización del mapa.
 * - Cobertura completa: Ciudad Autónoma de Buenos Aires (CABA) y Provincia de Buenos Aires (PBA).
 * - Filtros jerárquicos y combinados: Jurisdicción -> Partido / Comuna -> Localidad / Barrio.
 * - Sincronización en tiempo real con fecha oficial de Argentina (America/Argentina/Buenos_Aires).
 * - Distinción rigurosa entre error de conexión y ausencia de resultados para los filtros aplicados.
 * - Geolocalización y ordenamiento por cercanía para cualquier punto de la provincia o CABA.
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. REFERENCIAS A ELEMENTOS DEL DOM
  // --------------------------------------------------------------------------
  const elementos = {
    // Encabezado y fecha
    fechaActual: document.getElementById('fecha-actual'),
    horaActual: document.getElementById('hora-actual'),
    badgeModoActivo: document.getElementById('badge-modo-activo'),
    textoExplicativoModo: document.getElementById('texto-explicativo-modo'),
    switchFuenteOficial: document.getElementById('switch-fuente-oficial'),

    // Filtros
    formFiltros: document.getElementById('form-filtros'),
    inputBusqueda: document.getElementById('input-busqueda'),
    btnLimpiarBusqueda: document.getElementById('btn-limpiar-busqueda'),
    selectJurisdiccion: document.getElementById('select-jurisdiccion'),
    selectPartido: document.getElementById('select-partido'),
    selectLocalidad: document.getElementById('select-localidad'),
    checkSoloAbiertas: document.getElementById('check-solo-abiertas'),
    btnLimpiarFiltros: document.getElementById('btn-limpiar-filtros'),
    btnActualizar: document.getElementById('btn-actualizar'),
    btnMiUbicacion: document.getElementById('btn-mi-ubicacion'),

    // Estados y contenedores
    resumenResultados: document.getElementById('resumen-resultados'),
    badgeJurisdiccionActiva: document.getElementById('badge-jurisdiccion-activa'),
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

    // Vista en móviles
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
    // 1. Iniciar mapa interactivo Leaflet
    ModuloMapa.inicializar('mapa-leaflet');

    // 2. Configurar fecha y reloj de Argentina
    actualizarFechaHoraArgentina();
    setInterval(actualizarFechaHoraArgentina, 30000);

    // 3. Poblar selectores de Partidos y Localidades
    const jurInicial = elementos.selectJurisdiccion ? elementos.selectJurisdiccion.value : 'todas';
    poblarSelectorPartidos(jurInicial);
    poblarSelectorLocalidades(jurInicial, 'todos');

    // 4. Registrar eventos de la interfaz
    configurarEventos();

    // 5. Cargar datos iniciales
    cargarDatos();
  }

  // --------------------------------------------------------------------------
  // 4. FECHA Y HORA OFICIAL DE ARGENTINA
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

  // --------------------------------------------------------------------------
  // 5. CARGA Y SINCRONIZACIÓN DE DATOS
  // --------------------------------------------------------------------------
  async function cargarDatos() {
    mostrarEstado('cargando');

    try {
      const filtros = obtenerValoresFiltros();

      if (estadoApp.modoFuente === 'turnos_hoy') {
        estadoApp.farmaciasCargadas = await ApiFarmacias.obtenerFarmaciasTurnoHoy(filtros);
      } else {
        estadoApp.farmaciasCargadas = await ApiFarmacias.obtenerPadronOficialGCBA(filtros);
      }

      // Si el usuario compartió ubicación, calcular distancias y ordenar
      if (estadoApp.posicionUsuario) {
        calcularDistanciasYOrdenar(estadoApp.posicionUsuario.lat, estadoApp.posicionUsuario.lng);
      } else {
        estadoApp.farmaciasFiltradas = [...estadoApp.farmaciasCargadas];
      }

      renderizarResultados();
    } catch (error) {
      console.error('Error al cargar farmacias:', error);
      mostrarEstado('error', error.message);
    }
  }

  // --------------------------------------------------------------------------
  // 6. GESTIÓN DE FILTROS Y SELECTORES
  // --------------------------------------------------------------------------
  function obtenerValoresFiltros() {
    return {
      jurisdiccion: elementos.selectJurisdiccion.value,
      partido: elementos.selectPartido.value,
      localidad: elementos.selectLocalidad.value,
      query: elementos.inputBusqueda.value,
      soloAbiertas: elementos.checkSoloAbiertas.checked
    };
  }

  /**
   * Puebla el selector de Partidos / Municipios / Comunas según la jurisdicción.
   */
  function poblarSelectorPartidos(jurisdiccion) {
    const partidos = ApiFarmacias.obtenerPartidosDisponibles(jurisdiccion);
    const valorPrevio = elementos.selectPartido.value;

    let textoDefault = 'Todos los partidos / comunas';
    if (jurisdiccion === 'caba') textoDefault = 'Todas las comunas de CABA';
    if (jurisdiccion === 'pba') textoDefault = 'Todos los municipios de PBA';

    elementos.selectPartido.innerHTML = `<option value="todos">${textoDefault}</option>`;

    partidos.forEach(p => {
      const option = document.createElement('option');
      option.value = p;
      option.textContent = p;
      if (p === valorPrevio) option.selected = true;
      elementos.selectPartido.appendChild(option);
    });
  }

  /**
   * Puebla el selector de Localidades según la jurisdicción y el partido seleccionado.
   */
  function poblarSelectorLocalidades(jurisdiccion, partido = 'todos') {
    const localidades = ApiFarmacias.obtenerLocalidadesDisponibles(jurisdiccion, partido);
    const valorPrevio = elementos.selectLocalidad.value;

    let textoDefault = 'Todas las localidades';
    if (partido !== 'todos') textoDefault = `Todas las localidades de ${partido}`;

    elementos.selectLocalidad.innerHTML = `<option value="todas">${textoDefault}</option>`;

    localidades.forEach(loc => {
      const option = document.createElement('option');
      option.value = loc;
      option.textContent = loc;
      if (loc === valorPrevio) option.selected = true;
      elementos.selectLocalidad.appendChild(option);
    });
  }

  /**
   * Restablece todos los filtros al estado inicial abarcativo (toda la provincia y CABA).
   */
  function limpiarTodosLosFiltros() {
    elementos.inputBusqueda.value = '';
    elementos.btnLimpiarBusqueda.classList.add('d-none');
    elementos.selectJurisdiccion.value = 'todas';
    poblarSelectorPartidos('todas');
    elementos.selectPartido.value = 'todos';
    poblarSelectorLocalidades('todas', 'todos');
    elementos.selectLocalidad.value = 'todas';
    elementos.checkSoloAbiertas.checked = false;

    actualizarBadgeJurisdiccion();
    cargarDatos();
  }

  function actualizarBadgeJurisdiccion() {
    const jur = elementos.selectJurisdiccion.value;
    const partido = elementos.selectPartido.value;

    if (!elementos.badgeJurisdiccionActiva) return;

    if (partido !== 'todos') {
      elementos.badgeJurisdiccionActiva.textContent = `Partido: ${partido}`;
    } else if (jur === 'caba') {
      elementos.badgeJurisdiccionActiva.textContent = 'Ciudad Autónoma de Buenos Aires';
    } else if (jur === 'pba') {
      elementos.badgeJurisdiccionActiva.textContent = 'Provincia de Buenos Aires (Todos los municipios)';
    } else {
      elementos.badgeJurisdiccionActiva.textContent = 'CABA y toda la Provincia de Buenos Aires';
    }
  }

  // --------------------------------------------------------------------------
  // 7. RENDERIZADO DE RESULTADOS (TARJETAS + MAPA)
  // --------------------------------------------------------------------------
  function renderizarResultados() {
    const total = estadoApp.farmaciasFiltradas.length;

    if (elementos.contadorMovilLista) {
      elementos.contadorMovilLista.textContent = total;
    }

    actualizarBadgeJurisdiccion();

    if (total === 0) {
      mostrarEstado('vacio');
      elementos.resumenResultados.textContent = '0 farmacias encontradas para el criterio de búsqueda.';
      ModuloMapa.renderizarMarcadores([], null, elementos.selectJurisdiccion.value);
      return;
    }

    // Construcción del texto de resumen
    const jur = elementos.selectJurisdiccion.value;
    const partido = elementos.selectPartido.value;
    const loc = elementos.selectLocalidad.value;

    let lugarTexto = 'en Buenos Aires';
    if (loc !== 'todas') {
      lugarTexto = `en ${loc} (${partido !== 'todos' ? partido : ''})`;
    } else if (partido !== 'todos') {
      lugarTexto = `en el partido de ${partido}`;
    } else if (jur === 'caba') {
      lugarTexto = 'en CABA';
    } else if (jur === 'pba') {
      lugarTexto = 'en la Provincia de Buenos Aires';
    }

    const textoAbiertas = elementos.checkSoloAbiertas.checked ? ' (abiertas en este momento)' : '';
    elementos.resumenResultados.innerHTML = `Mostrando <strong>${total}</strong> farmacia${total === 1 ? '' : 's'} ${lugarTexto}${textoAbiertas}`;

    // Renderizar tarjetas en la lista
    elementos.contenedorTarjetas.innerHTML = '';
    const fragment = document.createDocumentFragment();

    estadoApp.farmaciasFiltradas.forEach(farmacia => {
      const tarjeta = crearElementoTarjeta(farmacia);
      fragment.appendChild(tarjeta);
    });

    elementos.contenedorTarjetas.appendChild(fragment);

    // Renderizar marcadores en el mapa Leaflet con la jurisdicción activa
    ModuloMapa.renderizarMarcadores(
      estadoApp.farmaciasFiltradas,
      (idSeleccionado) => {
        resaltarTarjeta(idSeleccionado, true);
      },
      elementos.selectJurisdiccion.value
    );

    mostrarEstado('exito');
  }

  /**
   * Crea el elemento HTML de la tarjeta de una farmacia con accesibilidad completa.
   */
  function crearElementoTarjeta(farmacia) {
    const card = document.createElement('article');
    card.className = `pharmacy-card ${farmacia.tipoServicio === '24h' ? 'card-24h' : farmacia.deTurnoHoy ? 'card-on-duty' : ''}`;
    card.id = `card-${farmacia.id}`;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', `Farmacia ${farmacia.nombre}`);

    // Badges según tipo de guardia
    let badgeTurno = '';
    if (farmacia.tipoServicio === '24h') {
      badgeTurno = `
        <span class="badge-24h">
          <i class="bi bi-clock-history" aria-hidden="true"></i> 24 Horas
        </span>
      `;
    } else if (farmacia.deTurnoHoy) {
      badgeTurno = `
        <span class="badge-duty">
          <i class="bi bi-shield-fill-check" aria-hidden="true"></i> De Turno Hoy
        </span>
      `;
    } else {
      badgeTurno = `
        <span class="badge-regular">
          <i class="bi bi-hospital" aria-hidden="true"></i> Padrón
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

      <!-- Acciones de la tarjeta -->
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

    // Clic en la tarjeta
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
    document.querySelectorAll('.pharmacy-card').forEach(c => c.classList.remove('active-card'));
    const tarjeta = document.getElementById(`card-${idFarmacia}`);
    if (tarjeta) {
      tarjeta.classList.add('active-card');
      if (hacerScroll) {
        tarjeta.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 8. CONTROL DE ESTADOS DE LA INTERFAZ (CARGA, ERROR, VACÍO)
  // --------------------------------------------------------------------------
  function mostrarEstado(estado, detalleError = '') {
    elementos.estadoCargando.classList.add('d-none');
    elementos.estadoError.classList.add('d-none');
    elementos.estadoVacio.classList.add('d-none');

    if (estado === 'cargando') {
      elementos.estadoCargando.classList.remove('d-none');
      elementos.contenedorTarjetas.innerHTML = '';
    } else if (estado === 'error') {
      elementos.estadoError.classList.remove('d-none');
      if (elementos.mensajeErrorDetalle) {
        elementos.mensajeErrorDetalle.textContent = detalleError || 'Ocurrió un error al consultar la fuente de datos.';
      }
    } else if (estado === 'vacio') {
      elementos.estadoVacio.classList.remove('d-none');
      elementos.contenedorTarjetas.innerHTML = '';

      if (elementos.textoEstadoVacio) {
        const jur = elementos.selectJurisdiccion.value;
        const part = elementos.selectPartido.value;
        let zona = 'el criterio de búsqueda';
        if (part !== 'todos') zona = `el partido de ${part}`;
        else if (jur === 'pba') zona = 'la Provincia de Buenos Aires';
        else if (jur === 'caba') zona = 'CABA';

        elementos.textoEstadoVacio.textContent = `No se encontraron farmacias para ${zona} con los filtros seleccionados. Probá seleccionando otro municipio o restableciendo los filtros.`;
      }
    } else if (estado === 'exito') {
      // Resultados visibles en contenedorTarjetas
    }
  }

  // --------------------------------------------------------------------------
  // 9. GEOLOCALIZACIÓN DEL USUARIO ("Cerca de mí")
  // --------------------------------------------------------------------------
  function obtenerUbicacionUsuario() {
    if (!navigator.geolocation) {
      alert('Tu navegador no admite geolocalización.');
      return;
    }

    const btn = elementos.btnMiUbicacion;
    const textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Localizando...';

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        const { latitude, longitude } = posicion.coords;
        estadoApp.posicionUsuario = { lat: latitude, lng: longitude };

        ModuloMapa.marcarUbicacionUsuario(latitude, longitude);
        calcularDistanciasYOrdenar(latitude, longitude);
        renderizarResultados();

        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-geo-alt-fill text-success"></i> Ubicado';
      },
      (error) => {
        console.warn('Error en geolocalización:', error);
        btn.disabled = false;
        btn.innerHTML = textoOriginal;
        alert('No se pudo acceder a tu ubicación. Asegurate de otorgar permisos en tu navegador.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }

  function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function calcularDistanciasYOrdenar(userLat, userLng) {
    estadoApp.farmaciasFiltradas = estadoApp.farmaciasCargadas.map(f => {
      const dist = calcularDistanciaKm(userLat, userLng, f.lat, f.lng);
      return { ...f, distanciaKm: dist };
    }).sort((a, b) => a.distanciaKm - b.distanciaKm);
  }

  // --------------------------------------------------------------------------
  // 10. ADAPTACIÓN PARA MÓVILES (PESTAÑAS LISTA / MAPA)
  // --------------------------------------------------------------------------
  function cambiarPestanaMovil(vista) {
    estadoApp.vistaMovilActiva = vista;

    if (vista === 'lista') {
      elementos.tabBtnLista.classList.add('active', 'btn-success');
      elementos.tabBtnLista.classList.remove('btn-outline-secondary');
      elementos.tabBtnMapa.classList.remove('active', 'btn-success');
      elementos.tabBtnMapa.classList.add('btn-outline-secondary');

      elementos.columnaLista.classList.remove('view-hidden-mobile');
      elementos.columnaMapa.classList.add('view-hidden-mobile');
    } else {
      elementos.tabBtnMapa.classList.add('active', 'btn-success');
      elementos.tabBtnMapa.classList.remove('btn-outline-secondary');
      elementos.tabBtnLista.classList.remove('active', 'btn-success');
      elementos.tabBtnLista.classList.add('btn-outline-secondary');

      elementos.columnaMapa.classList.remove('view-hidden-mobile');
      elementos.columnaLista.classList.add('view-hidden-mobile');

      ModuloMapa.refrescarTamano();
    }
  }

  // --------------------------------------------------------------------------
  // 11. CONFIGURACIÓN DE EVENTOS
  // --------------------------------------------------------------------------
  function configurarEventos() {
    // Búsqueda de texto con debounce
    elementos.inputBusqueda.addEventListener('input', () => {
      const valor = elementos.inputBusqueda.value.trim();
      if (valor.length > 0) {
        elementos.btnLimpiarBusqueda.classList.remove('d-none');
      } else {
        elementos.btnLimpiarBusqueda.classList.add('d-none');
      }

      clearTimeout(estadoApp.debounceBusquedaTimeout);
      estadoApp.debounceBusquedaTimeout = setTimeout(() => {
        cargarDatos();
      }, 300);
    });

    elementos.btnLimpiarBusqueda.addEventListener('click', () => {
      elementos.inputBusqueda.value = '';
      elementos.btnLimpiarBusqueda.classList.add('d-none');
      cargarDatos();
      elementos.inputBusqueda.focus();
    });

    // Cambio de jurisdicción: actualiza selectores dependientes
    elementos.selectJurisdiccion.addEventListener('change', () => {
      const jur = elementos.selectJurisdiccion.value;
      poblarSelectorPartidos(jur);
      poblarSelectorLocalidades(jur, 'todos');
      actualizarBadgeJurisdiccion();
      cargarDatos();
    });

    // Cambio de partido: actualiza localidades pertenecientes a ese partido
    elementos.selectPartido.addEventListener('change', () => {
      const jur = elementos.selectJurisdiccion.value;
      const partido = elementos.selectPartido.value;
      poblarSelectorLocalidades(jur, partido);
      actualizarBadgeJurisdiccion();
      cargarDatos();
    });

    // Cambio de localidad
    elementos.selectLocalidad.addEventListener('change', () => {
      cargarDatos();
    });

    // Switch solo abiertas
    elementos.checkSoloAbiertas.addEventListener('change', () => {
      cargarDatos();
    });

    // Botones de acción
    elementos.btnLimpiarFiltros.addEventListener('click', limpiarTodosLosFiltros);
    elementos.btnVaciarFiltrosAccion.addEventListener('click', limpiarTodosLosFiltros);
    elementos.btnActualizar.addEventListener('click', cargarDatos);
    elementos.btnReintentar.addEventListener('click', cargarDatos);
    elementos.btnMiUbicacion.addEventListener('click', obtenerUbicacionUsuario);

    // Botón reencuadrar mapa
    elementos.btnMapaRestablecer.addEventListener('click', () => {
      ModuloMapa.ajustarEncuadre(elementos.selectJurisdiccion.value);
    });

    // Conmutador del padrón oficial GCBA (solo CABA)
    elementos.switchFuenteOficial.addEventListener('change', (e) => {
      if (e.target.checked) {
        estadoApp.modoFuente = 'padron_gcba';
        elementos.badgeModoActivo.textContent = 'Modo: Padrón Oficial GCBA';
        elementos.badgeModoActivo.className = 'badge bg-secondary text-white';
        elementos.textoExplicativoModo.innerHTML = 'Mostrando catálogo de farmacias habilitadas de <strong>Buenos Aires Data</strong> (Ministerio de Salud GCBA). La fuente oficial gubernamental abarca CABA y no incluye turnos en tiempo real.';
        elementos.selectJurisdiccion.value = 'caba';
        poblarSelectorPartidos('caba');
        poblarSelectorLocalidades('caba', 'todos');
      } else {
        estadoApp.modoFuente = 'turnos_hoy';
        elementos.badgeModoActivo.textContent = 'Modo: Turnos del Día';
        elementos.badgeModoActivo.className = 'badge bg-primary text-white';
        elementos.textoExplicativoModo.innerHTML = 'Cobertura ampliada: CABA y municipios de la Provincia de Buenos Aires. Farmacias verificadas con guardia de hoy calculada. <strong>Recomendamos llamar antes de salir</strong>.';
        elementos.selectJurisdiccion.value = 'todas';
        poblarSelectorPartidos('todas');
        poblarSelectorLocalidades('todas', 'todos');
      }
      actualizarBadgeJurisdiccion();
      cargarDatos();
    });

    // Pestañas móviles
    elementos.tabBtnLista.addEventListener('click', () => cambiarPestanaMovil('lista'));
    elementos.tabBtnMapa.addEventListener('click', () => cambiarPestanaMovil('mapa'));

    window.addEventListener('resize', () => {
      ModuloMapa.refrescarTamano();
    });
  }

  iniciar();
});
