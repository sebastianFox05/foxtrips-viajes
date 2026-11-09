# PLAN.md — FoxTrips, app web de viajes colaborativa

## Objetivo

App web responsive (HTML + CSS + JS, sin compilacion) para organizar viajes en grupo. Cada viaje tiene su propio
itinerario, mapa, album, propuestas, diario, equipaje, documentos, miembros e historial.

## Arquitectura

| Pieza | Servicio | Motivo |
|---|---|---|
| Datos, login y tiempo real | Supabase (Postgres) | Gratis sin tarjeta, RLS por viaje, cambios en vivo |
| Fotos | Cloudinary | ~25 GB gratis, miniaturas y formatos automaticos |
| Documentos (billetes, reservas) | Supabase Storage privado | Son datos sensibles: URLs firmadas |
| Mapa | Leaflet + OpenStreetMap + Nominatim | Gratis, sin clave |
| Clima / moneda | Open-Meteo / ExchangeRate-API (open access) | Gratis, sin clave; incluye COP, MXN, ARS |
| Fotos del ejemplo | Wikimedia Commons | Banco libre; se guarda autor y licencia |

Sin claves en `assets/js/config.js` la app funciona en **modo local** (localStorage + IndexedDB) para probarla.
Si hay Supabase pero no Cloudinary, las fotos van a Supabase Storage.

## Funciones (ideas aprobadas: todas menos gastos compartidos)

Añadidas despues: frases utiles en ingles, recomendaciones top 5 por ciudad (con "Donde estoy") y flechas de navegacion.

1. Varios viajes separados.
2. Itinerario por dias, editable por varias personas, con imagen del sitio (tambien entra en el album).
3. Album de fotos con lightbox accesible.
4. Mapa con ubicacion de cada actividad y ruta por dia.
5. Propuestas con votaciones que pasan al itinerario.
6. Documentos del viaje.
7. Checklist de equipaje personal y compartida.
8. Invitar por enlace con rol editor o lector.
9. Comentarios en actividades y fotos.
10. Historial de cambios.
11. Cuenta atras, clima del destino y conversor de moneda.
12. PWA instalable con consulta sin conexion.
13. Exportar itinerario a PDF y pagina publica de solo lectura.
14. Diario por dia y resumen final del viaje.

## Registro de tareas

| Hora | Agente | Tarea | Archivos | Estado |
|---|---|---|---|---|
| 2026-11-03 | Orquestador | Plan, rubrica y arquitectura | `PLAN.md`, `SKILLS.md` | hecho |
| 2026-11-03 | Timmy | Maquetacion semantica y CSS responsive BEM estilo app de viajes (fotos a sangre, tarjetas con texto sobre foto, chips, cristal, barra inferior) | `index.html`, `assets/css/styles.css`, `assets/img/*` | hecho |
| 2026-11-03 | Timmy | Itinerario en dos versiones: carrete de tarjetas poster y lista por dias | `assets/css/styles.css` | hecho |
| 2026-11-03 | Javascript | Almacen local/Supabase, fotos (compresion, Cloudinary), enrutador, vistas, lightbox accesible, comentarios, tiempo real | `assets/js/**` | hecho |
| 2026-11-03 | Javascript | Viaje de ejemplo a Nueva York con fotos de Wikimedia Commons | `assets/js/demo.js` | hecho |
| 2026-11-03 | Orquestador | Esquema SQL con RLS, PWA (service worker y manifiesto), README, renombrado a FoxTrips | `supabase/schema.sql`, `sw.js`, `manifest.webmanifest`, `README.md` | hecho |
| 2026-11-03 | Orquestador | Pruebas en navegador (movil 375 px y escritorio 1280 px): crear viaje, carrete, lista, album, lightbox, mapa, votos, equipaje, comentarios, pagina publica | — | hecho |
| 2026-11-03 19:08 | Review | Revision contra `SKILLS.md` (estatica, sin ejecutar) | todo el proyecto | hecho |
| 2026-11-03 | Javascript | Frases utiles en ingles de EE. UU. (12 situaciones, voz, favoritas, consejos) | `assets/js/phrases.js`, `views/phrases.js` | hecho |
| 2026-11-03 | Orquestador | Correcciones del agente Review (ver abajo) | SQL, JS, CSS, `sw.js` | hecho |
| 2026-11-03 | Javascript | Recomendaciones: top 5 por ciudad (31 ciudades propias + cualquier zona via Wikidata/Wikipedia), "Donde estoy" con geolocalizacion, añadir al plan o proponer | `assets/js/recommendations.js`, `views/recommendations.js` | hecho |
| 2026-11-03 | Javascript | Flechas en carretes y tiras deslizables para usar sin tactil | `assets/js/scroller.js`, `styles.css` | hecho |
| 2026-11-03 | Orquestador | Pruebas en navegador de lo anterior (movil y escritorio) | — | hecho |
| 2026-11-03 | Timmy | Pantalla de bienvenida: carrusel de fotos a pantalla completa con frases, puntos, Saltar y flechas | `views/welcome.js`, `styles.css` | hecho |
| 2026-11-03 | Timmy | Acceso y registro rediseñados: tarjeta de cristal, campos en pildora, boton redondo, tarjetas "Nuevo en" y fecha con sol | `views/auth.js`, `styles.css` | hecho |
| 2026-11-03 | Timmy | Acceso y registro rehechos segun el video: pantalla oscura, imagen con zoom lento y halo de color, campos oscuros con icono, boton coral, Google, confirmar contraseña | `views/auth.js`, `styles.css` | hecho |
| 2026-11-03 | Javascript | Validacion en el formulario (campos, correo, contraseñas iguales), acceso con Google (Supabase OAuth), fotos que se funden cada 7 s | `views/auth.js`, `store/*.js` | hecho |
| 2026-11-03 | Timmy | Cabecera visible en movil: barra compacta con logo, pildoras Viajes/Planes (activa marcada) y avatar; texto largo y nombre a partir de 640 px | `index.html`, `styles.css`, `app.js` | hecho |
| 2026-11-03 | Javascript | Rutas sin sesion: bienvenida (una vez por sesion) → acceso; invitaciones directas al acceso; recuperar contraseña | `app.js`, `store/local.js`, `store/supabase.js` | hecho |

| 2026-11-04 | Orquestador | Modo nube conectado (Supabase + Cloudinary), prueba completa con cuenta real y publicacion en Netlify: https://foxtrips-viajes.netlify.app | `config.js`, `netlify.toml` | hecho |

| 2026-11-04 | Javascript | Sugerencias en todos los buscadores (destino, lugar, recomendaciones, viajes, frases) con codigos de ciudad (CTG, NYC, CDMX…), menu accesible y coordenadas exactas al elegir; boton para intercambiar monedas | `places.js`, `autocomplete.js`, vistas, `styles.css` | hecho |

## Revisión (agente Review)

Revision estatica del 2026-11-03 (19:08) leyendo el codigo; no se ejecuto servidor ni navegador. Cumple bien: sin atributos `on*`,
delegacion por `data-action`/`data-form`/`data-input`, `esc()` en todo texto de usuario insertado con `innerHTML`, `picture`+`source`,
labels en todos los formularios, `dialog` nativo (Escape), flechas en el lightbox, mobile first con `min-width`, modo oscuro,
`prefers-reduced-motion`, nombres de archivos y carpetas en minusculas y sin espacios, y columnas del SQL coherentes con todos los
`store.insert(...)`/`update()` (todas las tablas que se actualizan tienen `updated_at`).

### Bloqueantes

1. **`supabase/schema.sql:373`**: la politica `photos_read` (select sobre `storage.objects`, sin `to authenticated`) permite a cualquiera con la anon key (que es publica en `config.js`) **listar** el bucket `photos` (`storage.from('photos').list()`) y enumerar los ids de todos los viajes y sus fotos. Un bucket publico no necesita esa politica para servir `getPublicUrl`. **Arreglo:** borrarla, o limitarla a `to authenticated using (bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid))`.
2. **`supabase/schema.sql:374-375`**: `photos_upload` deja a cualquier usuario registrado subir cualquier archivo a cualquier ruta del bucket publico (abuso como hosting, o escribir en carpetas de viajes ajenos). Ademas `photos_delete_own` solo deja borrar al que subio el archivo, asi que si un editor borra la foto de otra persona el archivo queda huerfano sin avisar (`media.js:94` ignora el error). **Arreglo:** `with check (bucket_id = 'photos' and public.can_edit(((storage.foldername(name))[1])::uuid))`, borrado con `can_edit`, y que `trips.js:137` deje de subir las portadas nuevas a `portadas/` (subirlas despues de `create_trip`, ya con el id del viaje).
3. **`assets/js/lightbox.js:33-35`**: `href="${esc(photo.source_url || '#')}"` escapa el texto pero no comprueba el esquema. Un editor puede insertar por la API una foto con `source_url = 'javascript:...'`: es XSS guardado que tambien llega a la pagina publica (`public.js`, visitantes sin cuenta). **Arreglo:** aceptar solo `http:`/`https:` (`new URL(value).protocol`) y, si no, no pintar el enlace.
4. **`assets/js/views/auth.js:21-23`**: el unico `h1` de la vista de acceso esta dentro de `aria-hidden="true"`, asi que para los lectores de pantalla la vista no tiene `h1` (la rubrica pide uno por vista). **Arreglo:** quitar `aria-hidden` del bloque de texto (dejarlo solo en la parte decorativa) o pasar el `h1` al panel.
5. **`assets/js/ui.js:17` y `:48`**: `openModal()` sobrescribe `lastFocus` aunque el modal ya este abierto. `confirmDialog()` se abre desde dentro de otro modal ("Eliminar" en `album.js:124/137` y `trips.js:111/182`), asi que `lastFocus` pasa a ser un boton que se borra y al cerrar el foco no vuelve a nada (incumple "foco restaurado al cerrar"). **Arreglo:** guardar `lastFocus` solo si `!modal.open`, o usar una pila de aperturas.

### Importantes

6. **`supabase/schema.sql:59-65, 250-251`**: las invitaciones no caducan y no hay politica `delete`, asi que un enlace de editor filtrado da acceso para siempre y nadie puede revocarlo. **Arreglo:** columna `expires_at` (y/o `max_uses`), politica `invites_delete` para el `owner`, comprobarlo en `join_trip` y un boton "Revocar" en `members.js`.
7. **`supabase/schema.sql:240`**: `trips_update` deja a cualquier editor cambiar `public_token` (publicar el viaje) y `created_by`. La UI tambien muestra el interruptor a los editores (`members.js:105-128`, `summary.js:173`), pero el texto dice que lo desactiva "el organizador". **Arreglo:** trigger o RPC que solo permita al `owner` tocar `public_token`/`created_by`, y mostrar el interruptor solo con `ctx.isOwner`.
8. **`supabase/schema.sql:283-285` (y `:268-269`)**: `votes_insert` no comprueba que `proposal_id` sea del `trip_id`. `votes_update`/`votes_delete` solo miran `user_id`, asi que se puede mover un voto a una propuesta de otro viaje y alguien a quien quitaron del viaje puede seguir cambiando sus votos. Pasa lo mismo con `comments.target_id`. **Arreglo:** FK compuesta `(proposal_id, trip_id) → proposals(id, trip_id)` y `public.is_member(trip_id)` en `using`/`with check`.
9. **`assets/js/app.js:146-154`**: `renderPanel()` no tiene token propio. Cada accion llama a `ctx.refresh()` (pintado inmediato) y luego llega el eco (`notify()` local o Realtime) con `refreshNow`, que pinta otra vez con el mismo `renderToken`. Si los dos se solapan en los `await`, `mount()` se ejecuta dos veces sobre el mismo DOM: `map.js:94` lanza "Map container is already initialized" y `itinerary.js:404-405` duplica los listeners (una flecha avanza dos dias). Ademas cada accion pinta dos veces. **Arreglo:** `const paint = ++panelSeq` comprobado despues de cada `await` y antes de `mount`, y omitir el refresco con debounce si acaba de haber uno inmediato.
10. **`assets/js/views/album.js:60-61, 71`**: durante una subida multiple cada `store.insert('photos')` lanza un refresco que reemplaza `#uploadProgress` y `#uploadStatus`, y las variables quedan apuntando a nodos ya borrados: la barra de progreso desaparece a mitad de la subida. **Arreglo:** pausar los refrescos mientras `isUploading` es verdadero, o buscar los elementos por id en cada vuelta.
11. **`assets/js/views/album.js:137-149` + `assets/js/media.js:91-96`**: si se borra del album una foto que viene de una actividad, tambien se borra el archivo al que sigue apuntando `activities.image_url`, y la imagen de la actividad se rompe. **Arreglo:** si `photo.activity_id` existe y la actividad usa esa URL, limpiar `image_url`/`image_thumb` o no borrar el archivo.
12. **`assets/js/views/itinerary.js:177-179`** (igual en `album.js:110`): si el dia de una actividad queda fuera de las fechas del viaje (por ejemplo, tras acortarlas), no hay `<option>` para ese dia, el `select` se queda en "Sin dia" y al guardar se borra el dia sin avisar. **Arreglo:** añadir una opcion para el valor actual cuando no este en `reelDays`.
13. **`assets/js/views/members.js:8, 29, 113-118`**: `lastInvite` es estado del modulo y no se reinicia al cambiar de viaje, asi que la pestaña Grupo del viaje B ofrece "Copiar de nuevo" con la invitacion del viaje A. **Arreglo:** guardar `tripId` en `lastInvite` y pintarlo solo si coincide con `ctx.tripId`.
14. **`assets/js/views/members.js:42-50`**: tras cambiar un rol se llama a `ctx.refresh()`, pero `ctx.members` solo se recarga en `loadTrip()`. En modo local el `select` vuelve a mostrar el rol antiguo (en la nube se corrige cuando llega Realtime). **Arreglo:** usar `ctx.reloadTrip()`.
15. **`assets/js/views/summary.js:153`** + **`app.js:251-252`**: el conversor es un `<form>` sin `data-form` y tiene un solo campo que admite envio implicito, asi que Enter en "Cantidad" envia el formulario, `submitHandler` no llama a `preventDefault` y la pagina se recarga con `?amount=...`. **Arreglo:** usar `data-form="convert"` con un handler vacio, o llamar a `preventDefault()` en todos los `submit`.
16. **`assets/js/app.js:151`** (y `trips.js:152-156`, `album.js:49-54`, `map.js:66-70`): cada repintado sustituye el `innerHTML` y no devuelve el foco, asi que al votar, marcar equipaje o pulsar un filtro el foco del teclado o del lector de pantalla vuelve a `body`. **Arreglo:** antes de pintar, guardar `data-action` + `data-id` (o el `id`) del elemento activo y enfocarlo despues.
17. **`sw.js:7-41`**: `SHELL` no incluye `assets/js/store/supabase.js` (ni el ESM de supabase-js). En modo nube, si se pierde la conexion antes de una segunda visita, el `import()` de `store/index.js` falla y la app no arranca sin conexion (funcion 12 del plan). **Arreglo:** añadirlos a la precache, o hacer `cache.addAll` del modulo que corresponda segun `config.js`.

### Menores

18. **Orden del modulo**: en `app.js:204` y `:219` las constantes `refreshNow` y `scheduleReloadTrip` van despues de las funciones, y en `services.js:15-17` la variable `let lastGeocode` va antes de `const NEAR_DEGREES`. **Arreglo:** moverlas a su bloque.
19. **Nomenclatura**: hay listeners anonimos sin sufijo `Handler` en `store/local.js:307` (`storage`), `sw.js:44/48/56` y `app.js:44-47`. Hay booleanos sin `is`/`has`: `ctx.canEdit` (`app.js:118`) y `shouldScroll` (`itinerary.js:223`). **Arreglo:** `storageHandler`, `installHandler`... y `isEditor` (o `hasEditRights`) e `isScrollNeeded`.
20. **BEM y estilos en linea**: hay selectores de etiqueta (`styles.css:734, 837, 947, 1264, 1415, 1549, 1834, 1966, 2295, 2550, 2573`), clases de estado fuera de BEM (`.has-bottom-nav`, `.is-trip`, `:284/288`) y `form__inline` usado fuera de `.form` (`comments.js:25`, `packing.js:37`, que deberia ser `form--inline`). Tambien hay `style="..."` en las plantillas JS (`trips.js:56/223`, `ui.js:60`, `auth.js:167`, `summary.js:172/176`, `members.js:96/109/119/127`, `packing.js:26/37`, `diary.js:28/41/75`, `documents.js:104`, `map.js:62`). **Arreglo:** pasarlos a modificadores o elementos BEM en `styles.css`.
21. **`assets/js/ui.js:62`**: el ternario `isDanger ? 'btn--primary' : 'btn--primary'` no hace nada, asi que `isDanger` no tiene efecto. **Arreglo:** usar `btn--danger` cuando `isDanger` sea verdadero.
22. **Datos vacios**: un viaje sin fechas muestra un Diario vacio sin mensaje (`diary.js:15-16`). La pagina publica (`public.js:37`) solo pinta los dias del rango, asi que sin fechas el "Itinerario" sale vacio y las actividades sin dia nunca aparecen. **Arreglo:** estado vacio y seccion "Ideas sueltas" como en `itinerary.js`.
23. **Titulos y alt**: en el itinerario los `h3` de las actividades (`itinerary.js:75/88`) estan al mismo nivel que el `h3` del dia (`:113/132`) y deberian ser `h4`. Los comentarios del lightbox empiezan en `h3` sin un `h2` (`comments.js:38`). Las fotos del resumen final llevan `alt=""` si no tienen descripcion (`diary.js:55`). **Arreglo:** ajustar los niveles y usar un alt de respaldo ("Foto del dia N").
24. **`assets/css/styles.css:23` y `:136`**: el foco `#f08a3c` sobre `#f5f5f4` tiene un contraste de unos 2,3:1, por debajo del 3:1 que pide WCAG 1.4.11. Ademas `.search__input:focus { outline: none }` (`:642`) deja como unico indicador un cambio de borde de 1 px. **Arreglo:** un color de foco mas oscuro (por ejemplo `#b35400`) o un anillo doble.
25. **`assets/js/app.js:286-289`**: `hashchange` cierra el modal pero no el lightbox, asi que con "atras" en el movil el visor sigue abierto encima de la nueva vista. **Arreglo:** cerrar tambien `#lightbox`.
26. **SQL varios**: `trips.updated_at` nunca se actualiza (`store/supabase.js:133` no lo envia y no hay trigger; mejor un trigger `set_updated_at` comun en lugar de la hora del cliente que usa `supabase.js:155`). `get_public_trip` (`schema.sql:349-350`) exporta todas las columnas (`created_by`, `uploaded_by`, `storage_path`). Los DELETE de Realtime sin filtro (`supabase.js:205`) refrescan a todos los clientes con borrados de cualquier viaje. El script no se puede volver a ejecutar (`create policy` sin `drop policy if exists`, `alter publication ... add table`).

## Correcciones aplicadas tras la revision

| # | Estado | Que se hizo |
|---|---|---|
| 1-2 | corregido | Bucket `photos` sin politica de lectura (no se puede listar); subir y borrar solo con `can_edit` de la carpeta del viaje (`folder_trip`). Las portadas nuevas se suben despues de crear el viaje. |
| 3 | corregido | `safeUrl()` solo deja enlaces http(s) en el credito del lightbox y en Recomendaciones. |
| 4 | corregido | La vista de acceso ya no oculta su `h1` con `aria-hidden`. |
| 5 | corregido | `openModal()` conserva el foco original cuando se abre una confirmacion dentro de otro modal. |
| 6 | corregido | Invitaciones con `expires_at` (14 dias), `join_trip` lo comprueba, politica de borrado y boton "Revocar todos los enlaces". |
| 7 | corregido | Trigger `protect_trip_fields`: solo el organizador cambia `public_token`/`created_by`; la UI solo se lo muestra al organizador. |
| 8 | corregido | FK compuesta `votes(proposal_id, trip_id)`, `is_member` en votos y comentarios, `target_in_trip` para comentarios. |
| 9 | corregido | `renderPanel()` numera cada pintado y descarta los antiguos antes de `mount()`; el modo local ya no se notifica a si mismo. |
| 10 | corregido | El album pausa los refrescos mientras sube (`isBusy`) y busca la barra de progreso por id. |
| 11 | corregido | Borrar una foto de actividad limpia la imagen de esa actividad. |
| 12 | corregido | Dias fuera de las fechas del viaje se conservan como opcion en los formularios. |
| 13-14 | corregido | La invitacion recordada es por viaje; cambiar un rol recarga el viaje. |
| 15 | corregido | El conversor tiene `data-form` y Enter ya no recarga la pagina. |
| 16 | corregido | El foco se restaura tras repintar (por id o atributos `data-*`). |
| 17 | corregido | El service worker precarga `store/supabase.js`, supabase-js y Leaflet. |
| 18-19 | corregido | Orden constantes → variables → funciones → eventos en `app.js`/`services.js`; listeners con nombre `...Handler` (app, sw, local). |
| 20 | parcial | Estilos en linea estaticos cambiados por modificadores BEM; quedan solo valores dinamicos (`--avatar-hue`, ancho de barra). Los selectores de etiqueta dentro de bloques (`.photo-card__media img`) se mantienen a proposito. |
| 21 | corregido | Confirmaciones destructivas en rojo (`btn--destructive`). |
| 22 | corregido | Diario sin fechas muestra aviso; la pagina publica muestra "Ideas sueltas". |
| 23 | corregido | Actividades como `h4` bajo el dia `h3`; comentarios del lightbox con `h2`; `alt` en fotos del resumen. |
| 24 | corregido | Color de foco `#b4500f` (contraste mayor de 3:1) y anillo visible en el buscador. |
| 25 | corregido | Cambiar de ruta cierra tambien el lightbox. |
| 26 | corregido | `updated_at` de viajes por trigger; `get_public_trip` solo exporta columnas visibles; el script se puede ejecutar varias veces. Pendiente menor: los DELETE de Realtime siguen sin filtro por viaje (limitacion de Supabase). |

Encontrado al probar (fuera de la revision): al salir de un viaje al inicio quedaba la cabecera del viaje; las miniaturas de Wikimedia de 480 px daban error 400 (se usan 500 px).

## Tareas pendientes (5 nov 2026)

| Hora | Agente | Archivos | Estado | Detalle |
|---|---|---|---|---|
| 10:00 | Javascript | `store/supabase.js` | hecho | Los DELETE de Realtime se filtran por viaje: si la fila trae `trip_id` se compara; si no, se busca su `id` en la copia local del viaje (`isDeleteOfTrip`). Cierra el hallazgo 26. |
| 10:10 | Javascript | `netlify/functions/borrar-foto.mjs`, `media.js`, `views/album.js`, `netlify.toml` | hecho | Borrado real en Cloudinary con firma de servidor. La funcion comprueba la sesion de Supabase (RLS + `can_edit`) y que el archivo este en `foxtrips/<viaje>/`. Requiere `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` en Netlify (las pone el dueño). El album llama a la funcion antes de borrar la fila. |
| 10:20 | Review | — | hecho | Probado: 405/501/400/404 de la funcion en local; `can_edit` devuelve true en el viaje propio y false en otro; firma SHA-1 igual al ejemplo de la documentacion de Cloudinary. |
| 10:25 | — | Supabase | verificado | Site URL y Redirect URLs ya estaban configuradas. |
| 10:30 | — | datos | hecho | Viaje oficial: direccion y coordenadas de Glacé (30 Rockefeller Plaza). |
| 10:35 | — | `.gitignore`, git | hecho | Repositorio git local con el primer commit. |
| 11:30 | Javascript | `netlify/functions/borrar-foto.mjs`, `media.js` (`deleteTripFiles`), `views/trips.js`, `sw.js` (v11) | hecho | Eliminar un viaje borra su carpeta de Cloudinary (Admin API por prefijo, solo `is_owner`). Se llama antes de borrar el viaje. |
| 11:40 | Review | — | hecho | Probado en local (501/400/403/404) y en produccion con un viaje temporal (200 propio, 403 viaje inexistente). |
| 12:00 | Timmy | `assets/img/*`, `index.html`, `manifest.webmanifest`, `sw.js` (v12), `views/auth.js`, `views/welcome.js` | hecho | Logo nuevo del usuario (zorro de colores) sin fondo blanco: se quito solo el blanco conectado con el borde (el ojo y el hocico se conservan) y se eliminaron motas de JPEG. Archivos: `logo.png` (256), `favicon-48.png`, `icono-192/512.png` (transparentes), `apple-touch-icon.png` e `icono-maskable-512.png` (fondo blanco). Se retiro `icono.svg`. |
| 12:40 | Javascript | `assets/js/place-history.js` (nuevo), `views/itinerary.js`, `sw.js` (v13) | hecho | Boton "Historia" en cada plan: articulo de Wikipedia (es/en) elegido por cercania (1,5 km) y texto; debe compartir palabras con el titulo del plan, descarta numeros ajenos ("1501 Broadway") y articulos sin coordenadas salvo coincidencia exacta. Cache 30 dias; los errores no se guardan. |
| 12:45 | Timmy | `styles.css` (seccion 37) | hecho | Ventana `history` con bloques "Por que es famoso" y "Su historia", fuente y licencia. Revisado a 375 px sin desborde. |
| 12:50 | Review | — | hecho | Probado con los 81 planes del viaje oficial. Aciertos en lugares turisticos (Puente de Brooklyn, MET, Central Park, Independence Hall, JFK…). Limitaciones: restaurantes/hoteles a veces sin resultado o con el barrio cercano; "Musical de Broadway" muestra el Teatro Shubert. |
| 13:30 | Javascript | `utils.js` (`registerAvatars`, `avatarHtml` con foto), `media.js` (`uploadAvatar`, `cleanupAvatars`), `store/*` (`updateAvatar`, `avatar_url`), `views/auth.js`, `app.js`, `trips.js`, `shell.js`, `members.js`, `comments.js`, `history.js`, `borrar-foto.mjs` | hecho | Foto de perfil: recorte cuadrado 400 px → Cloudinary `foxtrips/avatars/<usuario>/` (local: imagen en linea). Se muestra en cabecera, perfil, grupo, tarjetas de viaje, comentarios e historial. Al cambiarla o quitarla, la funcion borra las anteriores (solo las de tu usuario). |
| 13:35 | Timmy | `styles.css` (seccion 38) | hecho | `avatar--photo`, `avatar--xl`, tarjeta `profile-photo` con foco visible del boton de archivo. |
| 13:40 | — | `supabase/schema.sql`, Supabase | hecho | Columna `profiles.avatar_url` (con check https) creada con la migracion `profiles_avatar_url` tras el OK del usuario. Probado: subir una imagen de prueba a Cloudinary, verla en cabecera y perfil y quitarla. |
| 16:55 | Supabase | `supabase/schema.sql`, Supabase | hecho | Migracion `harden_security_and_performance` tras el OK del usuario. Seguridad: `anon`/`public` ya no ejecutan `trip_role`, `is_member`, `can_edit`, `is_owner`, `target_in_trip`, `folder_trip`, `create_trip`, `join_trip` (siguen para `authenticated`); los triggers `handle_new_user`/`protect_trip_fields` sin EXECUTE para nadie; `get_public_trip` sigue abierta a `anon`; `folder_trip` con `search_path = public`; checks de longitud en textos libres (p. ej. notas 5000, comentarios 2000, diario 20000; datos actuales comprobados). Rendimiento: politicas con `(select auth.uid())`, 10 indices para FKs y `*_write for all` dividido en insert/update/delete (mismo acceso). Probado: curl con clave publica → 401 en `can_edit`/`is_owner`/`join_trip`, `get_public_trip` 200 `null`; como organizador del viaje oficial se ven y editan los 81 planes y 78 fotos (transaccion revertida). Asesor: solo quedan avisos esperados (`get_public_trip` publica, funciones para `authenticated`, indices aun sin uso) y la proteccion de contraseñas filtradas (se activa en el panel de Auth). |
| 18:00 | Javascript + Timmy | `src/**`, `vite.config.js`, `package.json`, `index.html`, `public/` | hecho | Migracion completa a React 18 + Vite (rama `react`, unida a `main`). Mismo CSS, textos, URLs y almacen; vistas como componentes. |
| 18:20 | Review | — | hecho | Probado con la cuenta real: 13 pestañas, modales, visor, mapa, autocompletado; sin errores ni violaciones de CSP. Corregido: CSP sin `*.wikimedia.org` y pagina precargada con CSP vieja en el service worker. |
| 18:30 | — | Netlify | hecho | Publicada la version React (deploy `6aed032de156fc947c51d7b8`). Verificado: cabeceras de seguridad, 404 en codigo y documentos, funcion activa, `anon` sin acceso a `can_edit`. |
| 19:00 | Timmy | `styles.css` (seccion 32), `App.jsx` | hecho | Bienvenida sin scroll en la app instalada: `html/body.is-welcome` bloquean el desplazamiento, alto `100dvh`, la tira solo se desliza de lado (`touch-action: pan-x`) y hay tamaños para pantallas bajas (≤720 px y ≤520 px de alto). Probado a 375×667, 390×844 y 700×360. |
| 7 nov | Javascript | `views/auth/AuthViews.jsx` | hecho | El correo debe tener dominio completo (`nombre@gmail.com`, `uni.edu.co`): el navegador por si solo aceptaba `nombre@gmail`. Se valida al crear cuenta, al entrar y en «¿Olvidaste tu contraseña?», sin llamar a Supabase si es incompleto. |
| 7 nov | — | Supabase, `supabase/schema.sql`, `AuthViews.jsx` | hecho | Migracion `validate_user_email`: trigger BEFORE INSERT/UPDATE OF email en `auth.users` que rechaza correos sin dominio completo (errcode 22023). Las cuentas existentes no se tocan (solo al crear o cambiar el correo). Probado con un insert dentro de un bloque que se deshace: bloqueado, 0 filas. La app traduce el error de Supabase al mismo aviso. |
| 9 nov | Javascript | `vite.config.js`, `.github/workflows/pages.yml`, `media.js`, logos | hecho | Copia en GitHub Pages: ruta base `/foxtrips-viajes/` con `GITHUB_PAGES=true`, CSP en `<meta>` (Pages no admite cabeceras), sin funcion de borrado (`VITE_SERVER_FUNCTIONS=off`). Netlify sigue igual. |
| 9 nov | — | GitHub | hecho | Repositorio publico https://github.com/sebastianFox05/foxtrips-viajes (rama `main`). GitHub Pages activado con origen "GitHub Actions": https://sebastianfox05.github.io/foxtrips-viajes/ (verificado: carga, logo, fotos, service worker en la subcarpeta, sin violaciones de CSP). |
