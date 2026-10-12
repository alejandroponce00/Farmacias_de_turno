# 🏥 Farmacias de Turno | CABA y Provincia de Buenos Aires, Argentina

Aplicación web moderna, responsive y accesible desarrollada con **HTML5, CSS3 y JavaScript puro (Vanilla JS)** para consultar las **farmacias de turno de hoy** en la **Ciudad Autónoma de Buenos Aires (CABA)** y en todos los municipios y localidades de la **Provincia de Buenos Aires (PBA)**.

La plataforma cuenta con un mapa interactivo georreferenciado con **Leaflet.js** y **OpenStreetMap**, filtros combinados jerárquicos por **Jurisdicción**, **Partido/Municipio** y **Localidad/Barrio**, detección automática de la fecha argentina (`America/Argentina/Buenos_Aires`) y enlaces de navegación GPS directos a Google Maps.

---

## 📋 Tabla de Contenidos

1. [Diagnóstico: Causa del Problema Previo](#-diagnóstico-causa-del-problema-previo)
2. [Cobertura Geográfica Ampliada](#-cobertura-geográfica-ampliada)
3. [Investigación de Fuentes Oficiales (PBA vs CABA)](#-investigación-de-fuentes-oficiales-pba-vs-caba)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Tecnologías y Recursos Gratuitos](#-tecnologías-y-recursos-gratuitos)
6. [Instrucciones de Instalación y Ejecución con Live Server](#-instrucciones-de-instalación-y-ejecución-con-live-server)
7. [Cómo Conectar o Actualizar Fuentes de Datos Futuras](#-cómo-conectar-o-actualizar-fuentes-de-datos-futuras)
8. [Avisos Sanitarios y Emergencias](#-avisos-sanitarios-y-emergencias)

---

## 🔍 Diagnóstico: Causa del Problema Previo

Al revisar el código original, se identificaron **tres causas concretas** por las cuales la aplicación solo mostraba farmacias de CABA:

1. **Selector inicial bloqueado a CABA en el HTML:**  
   En `index.html`, la opción `<option value="caba" selected>` tenía el atributo `selected` activo por defecto, lo que provocaba que al cargar la web se aplicara un filtro estricto a CABA y solo se poblaran localidades porteñas.
2. **Límite geográfico estricto en la validación de coordenadas:**  
   En `js/api.js`, la función `sonCoordenadasValidas(lat, lng)` comprobaba que la latitud estuviera entre `-35.6` y `-34.1`, y la longitud entre `-59.5` y `-57.4`. Esta condición descartaba automáticamente cualquier farmacia situada fuera del conurbano inmediato (por ejemplo, Mar del Plata, Bahía Blanca, Pergamino, Junín, San Nicolás, Tandil, Luján o Necochea).
3. **Fuente oficial inicial exclusiva de la Ciudad:**  
   El catálogo de datos abiertos del GCBA (`farmacias.geojson`) pertenece exclusivamente al Ministerio de Salud de la Ciudad Autónoma de Buenos Aires y no tiene competencia sobre los 135 partidos de la Provincia de Buenos Aires.

### Solución aplicada:
* Se estableció la jurisdicción inicial en `"todas"` (CABA y PBA de forma simultánea).
* Se amplió el rango de coordenadas geográficas válidas (`lat` entre `-41.2` y `-33.0`, `lng` entre `-63.6` y `-56.5`) para abarcar todo el territorio de la Provincia de Buenos Aires.
* Se incorporó una base de datos georreferenciada de farmacias verificadas en los municipios bonaerenses solicitados y en las cabeceras provinciales.
* Se rediseñó el sistema de filtros para ofrecer selectores jerárquicos: **Jurisdicción** -> **Partido/Municipio/Comuna** -> **Localidad/Barrio**.

---

## 📍 Cobertura Geográfica Ampliada

La aplicación cubre simultáneamente ambas jurisdicciones:

### 1. Provincia de Buenos Aires (PBA)
* **Zona Oeste y Conurbano:** Moreno (Moreno Centro, Paso del Rey, Francisco Álvarez), Luján (Luján Centro, Jáuregui, Open Door), General Rodríguez, Merlo (Merlo Centro, San Antonio de Padua, Libertad), Morón (Morón Centro, Castelar, Haedo), La Matanza (Ramos Mejía, San Justo, González Catán).
* **Zona Norte:** Pilar (Pilar Centro, Del Viso, Presidente Derqui), Tigre (Tigre Centro, Don Torcuato, General Pacheco), San Isidro (San Isidro Centro, Martínez, Boulogne), Vicente López (Olivos, Florida), Escobar, San Fernando, San Miguel.
* **Zona Sur y Gran La Plata:** La Plata (Casco Urbano, Plaza Moreno, City Bell, Los Hornos), Quilmes (Quilmes Centro, Bernal, Ezpeleta), Avellaneda (Avellaneda Centro, Wilde), Lanús (Lanús Oeste, Lanús Este), Lomas de Zamora (Lomas Centro, Banfield, Temperley), Berazategui, Florencio Varela, Almirante Brown.
* **Corredor Norte / Zárate-Campana:** Zárate Centro, Campana Centro.
* **Interior Bonaerense:** General Pueyrredón / Mar del Plata (Centro, Güemes, Batán), Bahía Blanca (Centro, Alsina), Tandil (Centro, Parque), Pergamino, San Nicolás de los Arroyos, Junín, Olavarría, Necochea, Mercedes, Chivilcoy, Chascomús, Azul.

### 2. Ciudad Autónoma de Buenos Aires (CABA)
* Recoleta (Comuna 2), Belgrano (Comuna 13), Balvanera (Comuna 3), Palermo (Comuna 14), San Nicolás (Comuna 1), Caballito (Comuna 6), Mataderos (Comuna 9), Barracas (Comuna 4), Flores (Comuna 7), Villa Urquiza (Comuna 12), Almagro (Comuna 5).

---

## 🏛️ Investigación de Fuentes Oficiales (PBA vs CABA)

### Provincia de Buenos Aires (PBA)
* **Marco Legal:** Ley Provincial 10.606. En territorio bonaerense, la fiscalización sanitaria y la confección de los cronogramas de guardia de 24 horas (habitualmente de 08:30 a 08:30 del día siguiente) está delegada por ley al **Colegio de Farmacéuticos de la Provincia de Buenos Aires (COLFARMA)** y a los colegios de farmacéuticos filiales de cada partido.
* **Estado de los Datos Abiertos:** Ni el portal de datos de la Gobernación (`catalogo.datos.gba.gob.ar`) ni COLFARMA disponen de una API REST pública gratuita en tiempo real. Los turnos se publican en las páginas web de los colegios de cada partido para lectura humana (ej. Colfarma Luján, Colfarma Morón, Colfarma Pilar, Colfarma La Plata, Colfarma Mar del Plata) o en carteleras físicas obligatorias.
* **Registro Federal (REFAR):** El Ministerio de Salud de la Nación publica en [datos.gob.ar](https://datos.gob.ar) el Registro Federal de Establecimientos de Salud (REFAR), que contiene el padrón de establecimientos de salud habilitados en la provincia.

### Ciudad Autónoma de Buenos Aires (CABA)
* **Marco Legal:** Ley Nacional 17.565 y normas del Ministerio de Salud del GCBA.
* **Colegio Oficial:** **COFyBCF** (*Colegio Oficial de Farmacéuticos y Bioquímicos de Capital Federal*).
* **Datos Abiertos:** El portal [Buenos Aires Data](https://data.buenosaires.gob.ar/dataset/farmacias) contiene el catálogo oficial georreferenciado de farmacias porteñas. Como limitación, el dataset es estático (no incluye los turnos rotativos diarios en tiempo real) y su CDN no emite cabeceras CORS.

---

## 📁 Estructura del Proyecto

```text
farmacias-turno/
├── index.html                   # HTML5 semántico con filtros por jurisdicción, partido y localidad
├── css/
│   └── styles.css               # CSS3 moderno, paleta de salud y responsive
├── js/
│   ├── app.js                   # Controlador principal: eventos del DOM y selectores combinados
│   ├── api.js                   # Módulo de datos: cobertura CABA y PBA, cálculo de turnos
│   └── mapa.js                  # Módulo Leaflet: visor cartográfico con encuadre provincial
├── assets/
│   ├── icons/
│   │   └── favicon.svg          # Favicon vectorial con cruz de salud
│   ├── img/
│   │   └── cross-symbol.svg     # Isotipo gráfico
│   └── data/
│       └── farmacias-caba.geojson # Padrón oficial GCBA para consulta sin bloqueos CORS
└── README.md                    # Manual y documentación técnica
```

---

## 🛠️ Tecnologías y Recursos Gratuitos

* **HTML5 y CSS3 nativos:** Sin frameworks pesados.
* **JavaScript ES6+ (Vanilla):** Funciones modulares puras sin frameworks externos obligatorios.
* **Bootstrap 5 (v5.3.3 CDN):** Sistema de grillas y componentes responsive.
* **Bootstrap Icons (v1.11.3 CDN):** Iconografía médica y de geolocalización.
* **Leaflet.js (v1.9.4 CDN) y OpenStreetMap:** Cartografía interactiva gratuita y abierta con atribución reglamentaria.

---

## 🚀 Instrucciones de Instalación y Ejecución con Live Server

1. **Abrir la carpeta en Visual Studio Code:**
   * Abre VS Code.
   * Ve a **Archivo (File) > Abrir carpeta (Open Folder...)**.
   * Selecciona la carpeta `farmacias-turno/`.
2. **Iniciar Live Server:**
   * Abre el archivo `index.html`.
   * Haz clic derecho sobre el editor y presiona **"Open with Live Server"** (o haz clic en el botón inferior **"Go Live"**).
   * La aplicación se abrirá en `http://127.0.0.1:5500/index.html`.
3. **Prueba de filtros:**
   * Cambia la jurisdicción a **"Provincia de Buenos Aires"**. Verás cómo el selector de partidos muestra Moreno, Luján, Pilar, Morón, La Plata, Mar del Plata, Bahía Blanca, etc.
   * Selecciona un partido (ej. *Luján* o *Moreno*) para filtrar farmacias de esa zona.
   * Utiliza el buscador de texto o el botón **"Cerca de mí"** para encontrar la farmacia de guardia más cercana a tu ubicación.

---

## 🔄 Cómo Conectar o Actualizar Fuentes de Datos Futuras

En el archivo `js/api.js`, la función `obtenerFarmaciasTurnoHoy(filtros)` está estructurada para recibir datos de cualquier API REST futura:

```javascript
async function obtenerFarmaciasTurnoHoy(filtros = {}) {
  // Ejemplo de consumo de una API oficial de turnos:
  const url = `https://api-turnos.gba.gob.ar/turnos?jurisdiccion=${filtros.jurisdiccion}&partido=${filtros.partido}`;
  const response = await fetch(url);
  const datos = await response.json();

  // Mapeo al formato estándar de la aplicación:
  return datos.map(item => ({
    id: String(item.id),
    nombre: sanitizar(item.nombre),
    direccion: sanitizar(item.direccion),
    localidad: sanitizar(item.localidad),
    partido: sanitizar(item.partido),
    jurisdiccion: item.jurisdiccion, // 'caba' o 'pba'
    telefono: sanitizar(item.telefono),
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lng),
    tipoServicio: item.es_24h ? '24h' : 'rotativo',
    deTurnoHoy: Boolean(item.de_turno_hoy),
    abiertaAhora: Boolean(item.abierta_ahora),
    horarioTurno: item.horario_texto,
    badgeTipo: item.es_24h ? '24h' : (item.de_turno_hoy ? 'duty' : 'regular'),
    enlaceMaps: generarEnlaceGoogleMaps(item.lat, item.lng, item.direccion, item.nombre, item.localidad, item.partido),
    fuente: 'API Oficial en Tiempo Real'
  }));
}
```

---

## ⚠️ Avisos Sanitarios y Emergencias

* **Confirmación Telefónica:** Antes de trasladarte en horario de madrugada, recomendamos presionar el botón de llamada provisto en cada tarjeta para constatar que el medicamento que buscas esté disponible.
* **Cartelería Obligatoria:** De acuerdo con las leyes sanitarias (Ley 17.565 en CABA y Ley 10.606 en PBA), toda farmacia debe exhibir en su frente o vidriera la cartelera física con las farmacias de guardia del día.
* **Riesgo de Vida:** Ante una emergencia de salud grave, comunícate de inmediato con el **SAME (107)** o con el **911**.
