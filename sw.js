/*
 * Service worker de FoxTrips: deja la app instalable y usable sin conexion.
 * Red primero para los archivos propios y cache primero para librerias y fotos externas;
 * los datos del viaje los guarda en cache el propio almacen (store/supabase.js).
 */
const CACHE = 'foxtrips-v14';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/styles.css',
  'assets/img/logo.png',
  'assets/img/favicon-48.png',
  'assets/img/apple-touch-icon.png',
  'assets/img/icono-maskable-512.png',
  'assets/js/app.js',
  'assets/js/config.js',
  'assets/js/utils.js',
  'assets/js/icons.js',
  'assets/js/ui.js',
  'assets/js/media.js',
  'assets/js/services.js',
  'assets/js/comments.js',
  'assets/js/lightbox.js',
  'assets/js/scroller.js',
  'assets/js/places.js',
  'assets/js/autocomplete.js',
  'assets/js/demo.js',
  'assets/js/phrases.js',
  'assets/js/views/phrases.js',
  'assets/img/icono-192.png',
  'assets/img/icono-512.png',
  'assets/js/store/index.js',
  'assets/js/store/local.js',
  'assets/js/store/supabase.js',
  'assets/js/recommendations.js',
  'assets/js/views/recommendations.js',
  'assets/js/views/trips.js',
  'assets/js/views/auth.js',
  'assets/js/views/shell.js',
  'assets/js/views/summary.js',
  'assets/js/views/itinerary.js',
  'assets/js/place-history.js',
  'assets/js/views/map.js',
  'assets/js/views/album.js',
  'assets/js/views/proposals.js',
  'assets/js/views/diary.js',
  'assets/js/views/packing.js',
  'assets/js/views/documents.js',
  'assets/js/views/members.js',
  'assets/js/views/history.js',
  'assets/js/views/public.js',
  'assets/js/views/welcome.js'
];
const CACHEABLE_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'res.cloudinary.com', 'upload.wikimedia.org'];
// Librerias externas que se guardan al instalar (con CORS), para arrancar sin conexion desde la primera visita
const VENDOR = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm'
];

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  // Si una libreria externa falla no se bloquea la instalacion
  await Promise.all(VENDOR.map((url) => cache.add(new Request(url, { mode: 'cors' })).catch(() => null)));
}

async function cleanOldCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
  await self.clients.claim();
}

async function respond(request, isSameOrigin) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: isSameOrigin });
  const network = fetch(request).then((response) => {
    // Las imagenes opacas ocupan mucha cuota: solo se guardan librerias y fuentes opacas
    const isOpaqueAllowed = response.type === 'opaque' && request.destination !== 'image';
    if (response.ok || isOpaqueAllowed) cache.put(request, response.clone()).catch(() => null);
    return response;
  });
  // Archivos propios: red primero (siempre la ultima version) y cache si no hay conexion
  if (isSameOrigin) {
    return network.catch(() => cached || (request.mode === 'navigate' ? cache.match('index.html') : Response.error()));
  }
  // Librerias, fuentes y fotos externas: cache primero
  return cached || network.catch(() => Response.error());
}

function installHandler(event) {
  event.waitUntil(precache().then(() => self.skipWaiting()));
}

function activateHandler(event) {
  event.waitUntil(cleanOldCaches());
}

function fetchHandler(event) {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin && !CACHEABLE_HOSTS.includes(url.hostname)) return;
  event.respondWith(respond(request, isSameOrigin));
}

self.addEventListener('install', installHandler);
self.addEventListener('activate', activateHandler);
self.addEventListener('fetch', fetchHandler);
