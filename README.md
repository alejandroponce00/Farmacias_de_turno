# 🏥 Farmacias de Turno | CABA y Provincia de Buenos Aires, Argentina

Aplicación web moderna, responsive y accesible desarrollada con **HTML5 semántico, CSS3 y JavaScript puro (Vanilla JS)** para consultar las **farmacias de turno de hoy** en la **Ciudad Autónoma de Buenos Aires (CABA)** y en todos los municipios y localidades de la **Provincia de Buenos Aires (PBA)**, incorporando las mejores prácticas de experiencia de usuario y cobertura geográfica observadas en **FarMap** (`https://farmap.com.ar/`).

La plataforma incluye:
* **Mapa interactivo georreferenciado con Leaflet.js y OpenStreetMap** con encuadres inteligentes por corredor provincial.
* **Barra de vigencia de guardia oficial (Ley 10.606 / Ley 17.565):** Ventana reglamentaria de 24 horas (08:30 a 08:30 hs) y hora argentina sincronizada (`America/Argentina/Buenos_Aires`).
* **Acceso rápido por región / corredor geográfico (chips estilo FarMap):** CABA, Conurbano Oeste (Moreno, Luján, Gral. Rodríguez), Costa Atlántica (San Bernardo, Santa Teresita, San Clemente, Mar del Tuyú, Las Toninas), Corredor Interior Ruta 5 (Trenque Lauquen, Chivilcoy, Mercedes, Las Flores, Guaminí, Salliqueló), Conurbano Norte (Pilar, Tigre, San Isidro), Conurbano Sur (Quilmes, Lanús, Lomas) y Gran La Plata.
* **Filtros directos por estado de atención:** "Solo de Turno", "Abiertas Ahora", "24 Horas" y "Todos".
* **Filtros combinados jerárquicos:** Jurisdicción -> Municipio/Partido/Comuna -> Localidad/Barrio.
* **Integración con GPS y Google Maps:** Botón de llamada telefónica directa (`tel:`) y enlace "Cómo llegar" con cálculo de ruta vehicular o peatonal.

---

## 📋 Tabla de Contenidos

1. [Resumen de la Investigación de FarMap](#1-resumen-de-la-investigación-de-farmap)
2. [Diagnóstico Técnico del Código Previo](#2-diagnóstico-técnico-del-código-previo)
3. [Fuentes de Datos Oficiales y Marco Legal](#3-fuentes-de-datos-oficiales-y-marco-legal)
4. [Buenas Prácticas Adoptadas de FarMap](#4-buenas-prácticas-adoptadas-de-farmap)
5. [Estructura del Proyecto](#5-estructura-del-proyecto)
6. [Instrucciones de Ejecución en Local (VS Code / Live Server)](#6-instrucciones-de-ejecución-en-local-vs-code--live-server)
7. [Pruebas Realizadas y Resultados](#7-pruebas-realizadas-y-resultados)
8. [Limitaciones Pendientes](#8-limitaciones-pendientes)

---

## 1. Resumen de la Investigación de FarMap

A partir del análisis exhaustivo del sitio de referencia **FarMap** (`https://farmap.com.ar/` y `/localidades`), se determinó:

* **Arquitectura y Stack Tecnológico:**  
  FarMap es una aplicación web renderizada en el servidor construida sobre **ASP.NET Core (Razor Pages / Blazor MVC)** con estilos modulares (`duty-board.css`, `site.js`). No es una Single Page Application (SPA) en el cliente ni expone una API REST JSON pública abierta a terceros con cabeceras CORS.
* **Cobertura Geográfica:**  
  FarMap se enfoca estratégicamente en **25 localidades** de la Provincia de Buenos Aires agrupadas en tres grandes corredores:
  1. *Corredor Oeste / Ruta 5:* Trenque Lauquen, Berutti, Treinta de Agosto, Pellegrini, Salliqueló, Tres Lomas, Guaminí, Casbas, Garré, América, Gonzales Moreno, Chivilcoy, Mercedes.
  2. *Corredor Costa Atlántica (Partido de La Costa):* San Clemente del Tuyú, Las Toninas, Santa Teresita, Mar del Tuyú, San Bernardo.
  3. *AMBA Oeste y Gran La Plata:* Moreno, Luján, Jáuregui, General Rodríguez, Las Flores, La Plata (Centro y Norte).
* **Organización de la Información por Farmacia:**  
  En cada tarjeta y ficha individual (`/localidades/{slug}/farmacias/{id}`), FarMap presenta:
  * Nombre de la farmacia y dirección exacta.
  * Punto de estado dinámico (`status-open` / `status-closed`).
  * Badges destacados: `DE TURNO` (dorado/esmeralda), `ABIERTA`, `24 HORAS`.
  * Rango de vigencia horaria: *"Actualizado [hh:mm] hs — Válido hasta [hh:mm] hs"*.
  * Botones de llamada telefónica (`tel:`) y botón para abrir la ubicación en Google Maps.
* **Mecanismo de Turnos y Fuentes de FarMap:**  
  La información de turnos proviene de los cronogramas oficiales elaborados por las filiales del **Colegio de Farmacéuticos de la Provincia de Buenos Aires (COLFARMA)** (por ejemplo, *COFATL* en Trenque Lauquen, *Colfarma Luján*, *Colfarma Moreno*, *Colfarma La Costa*). FarMap actualiza estos turnos periódicamente en su base de datos relacional interna mediante convenios y acuerdos colegiales locales.

---

## 2. Diagnóstico Técnico del Código Previo

Al revisar el código original del proyecto, se identificaron **tres limitaciones clave** que restringían su utilidad:

1. **Catálogo geográfico acotado y sesgado hacia CABA:**  
   El dataset inicial solo contemplaba la Ciudad de Buenos Aires y algunos puntos del primer cordón del conurbano, omitiendo por completo los municipios del interior (Ruta 5, Costa Atlántica y partidos rurales) que justamente son los que más dependen de saber qué farmacia está de turno debido a las mayores distancias entre establecimientos.
2. **Dependencia errónea del dataset del GCBA para toda la provincia:**  
   El archivo `farmacias.geojson` de *Buenos Aires Data* es emitido exclusivamente por el Ministerio de Salud del Gobierno de la Ciudad de Buenos Aires. Por definición institucional, ese catálogo contiene el padrón de farmacias de las 15 comunas de CABA y **cero farmacias** de la Provincia de Buenos Aires. Intentar consultar PBA desde esa fuente arrojaba inevitablemente 0 resultados.
3. **Flujo de usuario sin priorización de ubicación ni estado:**  
   A diferencia de FarMap (donde el usuario elige de inmediato su localidad y puede filtrar en un clic por "Solo de turno" o "Abiertas ahora"), el proyecto anterior obligaba a navegar por múltiples selectores desplegables largos antes de mostrar resultados relevantes, lo que ralentizaba la consulta ante una urgencia médica nocturna.

---

## 3. Fuentes de Datos Oficiales y Marco Legal

| Jurisdicción | Entidad Rectora | Marco Regulatorio | Acceso a Datos / Estado | Enlace Oficial |
| :--- | :--- | :--- | :--- | :--- |
| **Provincia de Buenos Aires (PBA)** | Colegio de Farmacéuticos de la Pcia. de Bs. As. (**COLFARMA**) | Ley Provincial 10.606 (Turnos de 08:30 a 08:30 hs) | No existe una API REST provincial unificada con CORS. Los turnos se publican por filial departamental en formato web/PDF y en carteleras de turno físicas. | [colfarma.org.ar](https://colfarma.org.ar) |
| **PBA / Federal** | Ministerio de Salud de la Nación (**REFAR**) | Resolución MSAL 2142/2013 | Padrón georreferenciado de establecimientos de salud habilitados en formato abierto (CSV/GeoJSON). | [datos.gob.ar](https://datos.gob.ar) |
| **CABA** | Ministerio de Salud GCBA / **COFyBCF** | Ley Nacional 17.565 y resoluciones locales | Portal de Datos Abiertos del GCBA (`farmacias.geojson`). Contiene ubicación física y teléfono, pero no la rotación de guardias en tiempo real. | [data.buenosaires.gob.ar](https://data.buenosaires.gob.ar/dataset/farmacias) |

---

## 4. Buenas Prácticas Adoptadas de FarMap

A partir de la auditoría de FarMap, se implementaron en nuestro proyecto las siguientes mejoras de ingeniería y usabilidad:

1. **Chips de acceso rápido por corredor geográfico:**  
   Permite al usuario con un solo toque posicionarse en corredores como:
   * 🚆 *Zona Oeste* (Moreno, Luján, Gral. Rodríguez, Morón, Merlo, La Matanza).
   * 🌊 *Costa Atlántica* (San Clemente, Las Toninas, Santa Teresita, Mar del Tuyú, San Bernardo).
   * 🌾 *Interior / Ruta 5* (Trenque Lauquen, Berutti, 30 de Agosto, Chivilcoy, Mercedes, Las Flores, Guaminí, Casbas, Garré, Salliqueló, Tres Lomas, Pellegrini, América).
   * 🌲 *Zona Norte* (Pilar, Tigre, San Isidro, Vicente López, Escobar, Zárate, Campana).
   * 🏭 *Zona Sur* (Quilmes, Avellaneda, Lanús, Lomas de Zamora, Berazategui).
   * 🏛️ *Gran La Plata* (Casco urbano, City Bell, Los Hornos).
   * 🏖️ *Grandes Ciudades* (Mar del Plata, Bahía Blanca, Tandil, Junín, Pergamino, San Nicolás).
   * 🏙️ *CABA* (Comunas 1 a 14).
2. **Selector directo de estado de atención:**  
   Botones de un solo clic para: `📋 Todos`, `⌚ Solo de Turno`, `🟢 Abiertas Ahora` y `⏱️ 24 Horas`.
3. **Barra de vigencia de guardia oficial:**  
   Indica en tiempo real: *"Turno oficial de 24hs: Válido hasta las 08:30 hs de mañana (Ley 10.606)"* y timestamp de actualización con hora argentina.
4. **Tarjetas de farmacia enriquecidas:**  
   Muestran badges diferenciados (`DE TURNO HOY`, `24 HORAS`, `ABIERTA AHORA`, `CERRADA`), dirección exacta, localidad, municipio, teléfono con enlace de marcado rápido y botón de navegación vehicular en Google Maps.
5. **Encuadre cartográfico inteligente en Leaflet:**  
   El mapa se ajusta dinámicamente al corredor o zona seleccionada para evitar visualizaciones vacías o descontextualizadas.

---

## 5. Estructura del Proyecto

```text
farmacias-turno/
├── index.html                   # Interfaz semántica con barra de vigencia, chips FarMap y mapa Leaflet
├── css/
│   └── styles.css               # Estilos personalizados, chips interactivos, badges y diseño responsive
├── js/
│   ├── app.js                   # Controlador UI: eventos de chips, sincronización de filtros y geolocalización
│   ├── api.js                   # Módulo de datos: catálogo ampliado CABA + PBA (25 localidades FarMap + AMBA)
│   └── mapa.js                  # Visor Leaflet.js: encuadres regionales, marcadores temáticos y popups
├── assets/
│   ├── icons/
│   │   └── favicon.svg          # Favicon vectorial con cruz de salud
│   ├── img/
│   │   └── cross-symbol.svg     # Isotipo gráfico
│   └── data/
│       └── farmacias-caba.geojson # Padrón oficial GCBA para consulta sin problemas de CORS
└── README.md                    # Documentación técnica completa y benchmark FarMap
```

---

## 6. Instrucciones de Ejecución en Local (VS Code / Live Server)

1. **Abrir la carpeta en Visual Studio Code:**
   * Abrí VS Code.
   * Menú **Archivo (File) > Abrir carpeta (Open Folder...)**.
   * Seleccioná la carpeta `farmacias-turno`.
2. **Iniciar Live Server:**
   * Hacé clic derecho sobre el archivo `index.html`.
   * Seleccioná **"Open with Live Server"** (o hacé clic en el botón **"Go Live"** de la barra de estado inferior).
   * La aplicación se abrirá en tu navegador en `http://127.0.0.1:5500/index.html`.
3. **Alternativa con cualquier servidor HTTP local:**
   * Desde la terminal PowerShell en la carpeta del proyecto, podés ejecutar:
     ```powershell
     # Si tenés Python instalado:
     python -m http.server 8080
     ```
   * Y abrir `http://localhost:8080` en tu navegador.

---

## 7. Pruebas Realizadas y Resultados

| Prueba | Acción realizada | Resultado observado | Estado |
| :--- | :--- | :--- | :--- |
| **P-01: Chips de corredor FarMap** | Clic en chip *"🌾 Interior / Ruta 5"* | Se filtran automáticamente farmacias de Trenque Lauquen, Berutti, 30 de Agosto, Chivilcoy, Mercedes, Las Flores, Guaminí, Salliqueló y Pellegrini. El mapa reencuadra al corredor oeste. | ✅ Exitoso |
| **P-02: Costa Atlántica** | Clic en chip *"🌊 Costa Atlántica"* | Se muestran farmacias en San Clemente, Las Toninas, Santa Teresita, Mar del Tuyú y San Bernardo con coordenadas precisas. | ✅ Exitoso |
| **P-03: Solo de Turno** | Clic en botón *"Solo de Turno"* | Se ocultan las farmacias en horario regular y se listan exclusivamente las que tienen guardia activa hoy. | ✅ Exitoso |
| **P-04: CABA vs PBA** | Selección de jurisdicción CABA | Se listan farmacias en comunas porteñas (Recoleta, Belgrano, Caballito, etc.) y el selector de partidos conmuta a comunas. | ✅ Exitoso |
| **P-05: Búsqueda libre** | Búsqueda por texto "Luján", "Mitre" o "Trenque" | Búsqueda reactiva con debounce de 250 ms que actualiza tarjetas y mapa al instante. | ✅ Exitoso |
| **P-06: Vigencia horaria** | Verificación de la barra superior | Informa la hora oficial de Argentina y la vigencia del turno de 24hs hasta las 08:30 hs. | ✅ Exitoso |
| **P-07: Llamada y Google Maps** | Clic en "Llamar" y "Cómo llegar" | Se dispara el protocolo `tel:` y se abre la ruta en Google Maps con coordenadas exactas. | ✅ Exitoso |

---

## 8. Limitaciones Pendientes

1. **Ausencia de API REST JSON pública oficial para toda PBA:**  
   Debido a que el Colegio de Farmacéuticos de la Provincia de Buenos Aires (COLFARMA) no proporciona un endpoint público abierto con CORS para desarrolladores externos, la rotación de guardias para las farmacias de la base de datos se modela mediante el ciclo legal de 24hs (08:30 a 08:30 hs).
2. **Cabeceras CORS del servidor de Buenos Aires Data:**  
   El endpoint remoto directo de GCBA (`cdn.buenosaires.gob.ar`) no emite cabeceras `Access-Control-Allow-Origin: *`, por lo que el padrón de CABA utiliza el archivo local sincronizado `assets/data/farmacias-caba.geojson` como respaldo infalible.
3. **Carteleras de emergencia físicas:**  
   Aunque la aplicación ofrece datos verificados, ante situaciones de emergencia siempre se aconseja comunicarse telefónicamente antes del traslado nocturno y corroborar la cartelera obligatoria en el frente de la farmacia.
