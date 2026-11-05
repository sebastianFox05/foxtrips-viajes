# FoxTrips — Resumen de la sesión de trabajo

> Documento de traspaso, del 3 al 5 de noviembre de 2026. Sirve para retomar el proyecto sin perder contexto.
> El registro detallado por agente está en `PLAN.md`, la rúbrica en `SKILLS.md` y la guía de instalación en `README.md`.

---

## 1. Qué es el proyecto

**FoxTrips** es una app web responsive para planear viajes en grupo. Se llamó "Rumbo" hasta que el usuario pidió renombrarla.
Está hecha con **HTML + CSS + JavaScript vanilla** (módulos ES, sin compilación), con datos en la nube.

- **App publicada:** https://foxtrips-viajes.netlify.app (el nombre `foxtrips` estaba ocupado en Netlify).
- **Carpeta:** `C:\Users\Sebas\Documents\Proyectos Claude\viajes\`
- **Uso en local:** configuración `viajes` de `.claude/launch.json` (equivale a `npx -y serve viajes -l 5173`), en http://localhost:5173.
- **Usuario:** sebasfox0510@gmail.com. Nombre visible en la app: "sebastian fox".

---

## 2. Instrucciones y preferencias que hay que respetar

### Del usuario
- **Responder en español.** Es desarrollador junior y prefiere explicaciones claras, con los pasos concretos.
- **Nada de diseño genérico.** Envía capturas o videos de referencia y quiere que el resultado se parezca mucho:
  - fotos a sangre,
  - tarjetas con el texto encima de la foto,
  - chips en píldora,
  - tarjetas de cristal,
  - barra inferior en móvil,
  - carrete de tarjetas tipo póster,
  - acceso en oscuro con imagen animada.
- Cuando pide variantes, las quiere **juntas y con un selector**. Ejemplo: itinerario en **Carrete** o en **Lista**.
- Debe poder usarse **sin pantalla táctil**: flechas en todos los carretes y tiras deslizables.
- **Probar antes de publicar** y explicar qué se probó.
- **No modificar archivos existentes innecesariamente.**
- "Sin derecho de autor" en las fotos se resolvió con Wikimedia Commons: solo licencias libres y el crédito siempre visible.

### Agentes del usuario
Las definiciones están en `Documents\Codex\2026-06-04\files-mentioned-by-the-user-2\outputs\plantilla-agentes-front\agents\`.
- **Timmy (HTML/CSS):**
  - HTML semántico (`header`, `nav`, `main`, `section`, `article`, `figure`, `footer`).
  - `picture` + `source` en las imágenes.
  - BEM, CSS comentado por bloques y mobile first.
  - Sin scroll horizontal.
- **Javascript:**
  - Nada de JS intrusivo (ningún `on*`): delegación por `data-action`, `data-form` y `data-input`.
  - En cada módulo, orden: constantes → variables → funciones → asignación de eventos.
  - Handlers con sufijo `Handler` y booleanos con `is` o `has`.
  - Lightbox con Escape, flechas y devolución del foco.
- **Review:** revisa contra `SKILLS.md` y deja los hallazgos en `PLAN.md`.
- Todo cambio se registra en `PLAN.md`: hora, agente, archivos y estado.

### Reglas de seguridad y operación
- No crear cuentas ni escribir contraseñas en nombre del usuario: inicia sesión él en el panel del navegador.
- Nunca pedir ni usar la `service_role` o Secret key de Supabase, ni el API Secret de Cloudinary.
- Publicar (Netlify) o hacer cambios visibles hacia fuera: confirmarlo antes con el usuario.
- No borrar datos del usuario por cuenta propia; los datos de prueba se le indican para que los borre él.

---

## 3. Arquitectura y servicios

| Pieza | Servicio | Identificador / nota |
|---|---|---|
| Datos, cuentas, tiempo real, documentos | **Supabase** | Proyecto `mbldzwyzzzizowjgzdso` (us-west-2). Clave pública *publishable* en `config.js`. "Confirm email" desactivado. |
| Fotos subidas por el grupo | **Cloudinary** | Cloud `dlxcei9u`, preset sin firmar `foxtrips` (solo `jpg, png, webp, heic`). |
| Publicación | **Netlify** | Sitio `foxtrips-viajes`, id `58664967-0ab6-48ae-bcfd-26a93d622b09`. Insignia "Powered by Netlify" desactivada por el usuario. |
| Librería Supabase | jsDelivr | `@supabase/supabase-js@2.117.3` (la 2.45.4 no admite claves `sb_publishable_`). |
| Mapa | Leaflet 1.9.4 + OpenStreetMap | — |
| Buscar ciudades | Lista propia con códigos + **Open-Meteo Geocoding** | Ordena por población: "Cartagena" devuelve primero Cartagena de Indias. |
| Buscar lugares | **Photon** (komoot) | Busca primero en un recuadro de unos 60 km alrededor del destino. |
| Geocodificación puntual al guardar | Nominatim | **Nunca para autocompletar**: sus normas lo prohíben. |
| Clima | Open-Meteo `forecast` + `archive-api` | Pronóstico hasta 15 días; después, promedio de los últimos 3 años. |
| Divisas | open.er-api.com | Incluye COP, MXN, ARS. |
| Recomendaciones | Wikipedia (es) + Wikidata | Top propio de 32 ciudades y búsqueda automática para el resto. |
| Fotos del ejemplo y de los planes | Wikimedia Commons | Solo licencias libres, con crédito. |

**Modo local:** si `config.js` está vacío, la app funciona solo en el navegador (localStorage + IndexedDB). Ahora mismo está en **modo nube**.

---

## 4. Funcionalidades hechas

1. **Varios viajes** con portada, destino (con sugerencias), fechas y moneda.
2. **Itinerario** en dos vistas, **Carrete** (tarjetas póster) y **Lista**, con hora, lugar, notas, foto del sitio y exportación a PDF.
3. **Mapa** con un pin por actividad, ruta por día y filtro por día.
4. **Álbum:**
   - subida múltiple con compresión (WebP, máximo 2048 px);
   - rejilla tipo "Explore";
   - lightbox accesible con comentarios y crédito de la foto.
5. **Recomendaciones:**
   - top 5 de lo más visitado según el destino del viaje, **"Donde estoy"** (geolocalización) o una ciudad buscada;
   - desde cada plan: añadir al plan, proponerlo al grupo, cómo llegar y saber más.
6. **Frases útiles en inglés de EE. UU.:** 12 situaciones, unas 100 frases, pronunciación, voz (en-US), favoritas y consejos.
7. **Votaciones:** proponer, votar y pasar al plan.
8. **Diario** por día y **resumen final** del viaje.
9. **Equipaje:** lista común (con quién lleva cada cosa) y lista personal privada.
10. **Documentos** privados (Supabase Storage con URL firmada).
11. **Grupo:** invitaciones de editor o lector que caducan a los 14 días y se pueden revocar; roles; página pública solo para el organizador.
12. **Historial** de cambios.
13. **Inicio del viaje:**
    - cuenta atrás;
    - **clima por día en la ciudad de ese día** (pronóstico real o clima típico);
    - **conversor de moneda con botón ⇄ para intercambiar**;
    - próximos planes y accesos rápidos.
14. **Comentarios** en actividades y fotos.
15. **Tiempo real** entre miembros, comprobado al añadir y al borrar.
16. **PWA instalable** con consulta sin conexión (service worker en `foxtrips-v9`).
17. **Página pública** de solo lectura.
18. **Bienvenida** antes de iniciar sesión: 4 fotos con frases, puntos, "Saltar", flechas y teclado.
19. **Acceso y registro** en oscuro, como el video de referencia:
    - imagen con zoom lento y halo de color;
    - confirmar contraseña;
    - botón de Google (requiere configuración);
    - "¿Olvidaste tu contraseña?" con su pantalla de contraseña nueva;
    - errores traducidos al español.
20. **Sugerencias en TODOS los buscadores**, con un menú accesible (↑ ↓ Enter Esc), coincidencia en negrita y botón ✕:
    - **destino** (ciudades, con códigos CTG, BOG, MDE, NYC, CDMX…);
    - **lugar de una actividad** (primero los cercanos al destino);
    - **recomendaciones** (al elegir, busca al momento);
    - **buscar viaje** (por nombre, destino o código; al elegir, abre el viaje);
    - **frases** (categorías y frases).
21. **Cabecera compacta en móvil:** logo, píldoras Viajes/Planes y avatar.
22. **Viaje de ejemplo "Nueva York"**, con botón en el inicio y fotos de Commons.

---

## 5. Decisiones importantes y su porqué

- **Supabase + Cloudinary**, en lugar de solo Supabase: el usuario pensaba que 1 GB de fotos era poco. Cloudinary da unos 25 GB y las fotos se comprimen antes de subirse.
- **Documentos en Supabase privado** y no en Cloudinary: son datos sensibles, así que van con URL firmada.
- **Seguridad en el SQL** (`supabase/schema.sql`, que se puede ejecutar varias veces):
  - RLS por viaje con `is_member`, `can_edit` e `is_owner`;
  - un trigger que solo deja al organizador tocar `public_token` y `created_by`;
  - clave foránea compuesta en los votos;
  - `target_in_trip` en los comentarios;
  - bucket `photos` sin política de lectura (no se puede listar).
- **Recomendaciones con lista propia por ciudad:** las consultas de Wikidata por radio no responden a tiempo en ciudades densas como París. Las peticiones a Wikipedia van agrupadas para evitar el error 429.
- **Clima por día:** la ciudad de cada día es aquella donde ocurren **la mayoría** de sus actividades. Usar la primera fallaba en los días de carretera, porque la primera actividad es la salida.
- **Autocompletado:** Open-Meteo para ciudades y Photon para lugares, nunca Nominatim (sus normas lo prohíben y además ponía Cartagena de España antes que la de Colombia).
- **Arreglo del ancho en iPhone:** las tiras deslizables llevan `position: relative`. Sin eso, un `.visually-hidden` absoluto se salía de la tira y Safari reducía el zoom, dejando una franja negra.
- **Netlify publica solo la app:** `netlify.toml` copia `index.html`, `sw.js`, `manifest.webmanifest` y `assets/` a `dist/`. `PLAN.md`, `README.md`, `SKILLS.md` y el SQL no son accesibles.
- **Miniaturas de Wikimedia:** solo admiten anchos estándar (500, 960, 1280…). El 480 devuelve error 400.

---

## 6. Archivos creados en `viajes/`

Durante la sesión se creó todo el proyecto. Este documento es el único archivo nuevo añadido al final, sin modificar los demás.

| Archivo | Qué contiene |
|---|---|
| `index.html` | Estructura semántica, cabecera, barra inferior, modal, lightbox y avisos |
| `manifest.webmanifest`, `sw.js` | PWA. El service worker usa red primero para los archivos propios y caché primero para las librerías. |
| `netlify.toml` | Build hacia `dist/` y cabeceras (sin caché para `sw.js`, seguridad básica) |
| `assets/css/styles.css` | Estilos BEM comentados por bloques (secciones 1–36 y añadidos) |
| `assets/img/icono.svg`, `icono-192.png`, `icono-512.png` | Logo del zorro |
| `assets/js/app.js` | Enrutador por hash, contexto del viaje, tiempo real, delegación de eventos, foco y repintado numerado |
| `assets/js/config.js` | URL y clave pública de Supabase, cloud y preset de Cloudinary |
| `assets/js/store/index.js`, `local.js`, `supabase.js` | Almacén con la misma API en modo local y en la nube |
| `assets/js/media.js` | Compresión, subida (Cloudinary, Supabase o local) y `pictureHtml` |
| `assets/js/services.js` | Geocodificación, clima (`forecast`, `tripWeather`), divisas, geolocalización |
| `assets/js/places.js` | Ciudades con códigos (`CITY_CODES`), `suggestCities`, `suggestPlaces`, `bestCity`, `nearestCityName` |
| `assets/js/autocomplete.js` | Menú de sugerencias genérico (`registerSuggestions`) |
| `assets/js/recommendations.js` | Top propio de 32 ciudades y búsqueda por zona |
| `assets/js/phrases.js` | Banco de frases en inglés |
| `assets/js/demo.js` | Viaje de ejemplo de Nueva York |
| `assets/js/scroller.js` | Flechas en las tiras deslizables |
| `assets/js/ui.js`, `utils.js`, `icons.js`, `comments.js`, `lightbox.js` | Modal, avisos, utilidades (`esc`, `safeUrl`…), iconos SVG, comentarios, visor |
| `assets/js/views/*.js` | Una vista por sección: `trips`, `auth`, `welcome`, `shell`, `summary`, `itinerary`, `map`, `album`, `recommendations`, `phrases`, `proposals`, `diary`, `packing`, `documents`, `members`, `history`, `public` |
| `supabase/schema.sql` | Tablas, RLS, funciones (`create_trip`, `join_trip`, `get_public_trip`), triggers, tiempo real y buckets |
| `PLAN.md`, `SKILLS.md`, `README.md` | Registro por agentes, rúbrica, instrucciones de instalación y publicación |
| `RESUMEN-SESION.md` | Este documento |

Fuera de `viajes/`:
- `.claude/launch.json`: se añadió la configuración `viajes`.
- Memoria de Claude (`~/.claude/projects/.../memory/`): `foxtrips-project.md` y `design-from-references.md`.

---

## 7. Datos en la cuenta del usuario (Supabase)

- **"Viaje Estados Unidos (NY)"** es el **viaje oficial**: id `3a46aca9-6239-4ebc-b346-c1cd11337e18`, del 20 de noviembre al 4 de diciembre de 2026, en USD.
  - **79 actividades:** 59 del itinerario del usuario (23–29 de noviembre: Nueva York, Jim Thorpe, Blue Mountain, Filadelfia, Washington DC y Baltimore) y 20 marcadas **"💡 Sugerencia de Claude"** para los días libres (20–22 de noviembre y 30 de noviembre–4 de diciembre).
  - Cada actividad tiene foto de Commons con crédito. El álbum tiene 77 fotos.
  - 77 lugares con coordenadas. "Glacé + Soda Candy" y "Traslado al aeropuerto" no tienen.
  - Equipaje común: 3 reservas pendientes (tren Lehigh Gorge, Blue Mountain Night Tubing, hoteles con cancelación gratis).
  - Mi maleta: 5 prendas.
  - Descripción con el clima típico real: Nueva York 1–9 °C, Blue Mountain 1–11 °C, Filadelfia 2–9 °C, Washington 0–7 °C y Baltimore −3–5 °C.
- **"Nueva York en Familia"**: es el viaje **de prueba** (el ejemplo de Nueva York, renombrado por el usuario). Contiene elementos "Prueba:" y un enlace de invitación de editor generado en las pruebas.

---

## 8. Cómo publicar cambios en Netlify

1. Subir la versión de caché en `sw.js` (`const CACHE = 'foxtrips-vN'`) para que los móviles descarguen lo nuevo.
2. Usar el conector Netlify (MCP), operación `deploy-site` con `siteId` `58664967-0ab6-48ae-bcfd-26a93d622b09`.
3. Ejecutar desde `viajes/` el comando `npx -y @netlify/mcp@latest --site-id … --proxy-path "…"` que devuelve la herramienta. El enlace caduca: si da error 400, pedir uno nuevo.
4. Comprobar con `curl` que el archivo cambiado está en línea y que `PLAN.md` sigue dando 404.

Si el conector rechaza las credenciales, el usuario debe reconectar Netlify en *Ajustes → Conectores*.

---

## 9. Tareas pendientes

### Las tiene que hacer el usuario
- [ ] En Supabase, **Authentication → URL Configuration**:
  - Site URL: `https://foxtrips-viajes.netlify.app`
  - Redirect URLs: `https://foxtrips-viajes.netlify.app/**` y `http://localhost:5173/**`

  Sin esto, el correo de "¿Olvidaste tu contraseña?" lleva a una dirección equivocada.
- [ ] Opcional: activar **Google** en Supabase (*Providers → Google*) con credenciales de Google Cloud, para que funcione "Continuar con Google".
- [ ] Borrar, si quiere, los datos de prueba de "Nueva York en Familia" y revocar su enlace de invitación (*Grupo → Revocar todos los enlaces*).
- [ ] Borrar la imagen de prueba `foxtrips/prueba-conexion` de la Media Library de Cloudinary.
- [ ] Añadir la dirección de "Glacé + Soda Candy" y la hora del vuelo de vuelta en el viaje oficial.
- [ ] Revisar o eliminar las 20 sugerencias "💡" del viaje oficial.
- [ ] Reservar ya el tren Lehigh Gorge (26 de noviembre, 11:00), el Night Tubing y los hoteles. Están en el equipaje común.

### Mejoras técnicas posibles
- [ ] Los eventos DELETE de Supabase Realtime no se pueden filtrar por viaje: provocan algún repintado de más. Es inofensivo, pero se podría optimizar.
- [ ] Borrar una foto de Cloudinary desde la app solo la quita del álbum. Borrar el archivo exigiría una función de servidor con firma.
- [ ] Sin conexión no se pueden guardar cambios para sincronizarlos después: no hay cola de cambios pendientes.
- [ ] El conector GitHub falla ("Authorization header is badly formatted") y el proyecto no está en un repositorio git. Convendría versionarlo.
- [ ] Opcional: dominio propio y cambiar el nombre del sitio de Netlify.

---

## 10. Estado actual

- **En producción** en https://foxtrips-viajes.netlify.app, conectada a Supabase y a Cloudinary.
- Última publicación: clima por días, sugerencias en todos los buscadores, intercambio de monedas y arreglo del ancho en iPhone. Service worker en `foxtrips-v9`.
- Probado de principio a fin con la cuenta real del usuario:
  - crear viaje, fotos (Cloudinary), documentos privados;
  - votos, comentarios, equipaje, diario;
  - invitación, página pública, tiempo real (añadir y borrar);
  - recomendaciones, frases y buscadores;
  - todas las pantallas a 375 px y 320 px sin desbordes.
- Los 26 hallazgos del agente Review están aplicados (ver `PLAN.md`), salvo el filtro de los DELETE de Realtime.
