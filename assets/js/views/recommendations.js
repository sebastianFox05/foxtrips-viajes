/*
 * Recomendaciones: top 5 de planes mas visitados segun la ciudad.
 * Tres origenes: el destino del viaje, donde esta la persona ahora (geolocalizacion) o una ciudad buscada.
 * Desde cada plan se puede añadir al itinerario o proponerlo al grupo.
 */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { pictureHtml } from '../media.js';
import { CATEGORIES, cityRecommendations, distanceKm, findCity, nearbyRecommendations } from '../recommendations.js';
import { currentPosition, reverseGeocode } from '../services.js';
import { bestCity } from '../places.js';
import { toast, toastError, withBusy } from '../ui.js';
import { esc, formToObject, safeUrl } from '../utils.js';

const TOP = 5;
const SOURCES = [
  { key: 'viaje', label: 'Destino del viaje', icon: 'compass' },
  { key: 'aqui', label: 'Donde estoy', icon: 'pin' }
];

let source = null;
let place = null;
let results = [];
let isShowingAll = false;
let isLoading = false;
let errorMessage = '';
let loadedKey = '';
let plannedTitles = new Set();
let loadSeq = 0;
let contextKey = '';

/* ---- Datos ---- */

async function recommendationsFor({ text, lat, lon }) {
  // Con coordenadas manda la distancia (asi "Cartagena, España" no se confunde con Cartagena de Indias)
  const city = lat != null && lon != null ? findCity({ lat, lon }) : findCity({ text });
  if (city) return { city, items: await cityRecommendations(city), isCurated: true };
  if (lat == null || lon == null) throw new Error('No encontramos esa zona. Prueba con el nombre de la ciudad y el país.');
  return { city: null, items: await nearbyRecommendations(lat, lon), isCurated: false };
}

async function resolvePlace(ctx) {
  if (source === 'viaje') {
    const trip = ctx.trip;
    if (!trip?.destination && trip?.lat == null) throw new Error('Añade un destino al viaje para ver sus recomendaciones.');
    return { label: trip.destination || trip.name, text: trip.destination, lat: trip.lat, lon: trip.lon };
  }
  if (source === 'aqui') {
    const position = await currentPosition();
    const named = await reverseGeocode(position.lat, position.lon).catch(() => null);
    return { label: named?.label || 'Tu ubicación', text: named?.city || '', ...position, isHere: true };
  }
  return place;
}

async function load(ctx) {
  const seq = ++loadSeq;
  isLoading = true;
  errorMessage = '';
  paintResults(ctx);
  try {
    const resolved = await resolvePlace(ctx);
    const data = await recommendationsFor(resolved);
    if (seq !== loadSeq) return;
    place = { ...resolved, cityName: data.city?.name, isCurated: data.isCurated };
    results = data.items;
    loadedKey = `${source}:${resolved.label}`;
    if (!results.length) errorMessage = 'No encontramos planes populares en esta zona. Prueba con la ciudad más cercana.';
  } catch (error) {
    if (seq !== loadSeq) return;
    results = [];
    errorMessage = error.message;
  }
  isLoading = false;
  paintResults(ctx);
}

/* ---- Plantillas ---- */

function sourceButtonsHtml(ctx) {
  const options = SOURCES.filter((option) => option.key !== 'viaje' || ctx.trip);
  return options.map((option) => `
    <button class="segmented__btn ${option.key === source ? 'segmented__btn--active' : ''}" type="button" data-action="reco-source" data-mode="${option.key}" aria-pressed="${option.key === source}">
      ${icon(option.icon, 16)} ${option.label}
    </button>`).join('');
}

function distanceText(item) {
  if (!place?.isHere || item.lat == null) return '';
  const km = distanceKm(place.lat, place.lon, item.lat, item.lon);
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function cardHtml(item, ctx) {
  const category = CATEGORIES[item.category] || CATEGORIES.lugar;
  const isPlanned = plannedTitles.has(item.name.toLowerCase());
  const distance = distanceText(item);
  const mapsUrl = item.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lon}` : '';
  const wikiUrl = safeUrl(item.url);
  const image = safeUrl(item.image);
  return `
    <li>
      <article class="reco">
        <div class="reco__media photo-card ${item.rank === 1 ? 'photo-card--tall' : ''}">
          ${image ? pictureHtml(image, { alt: item.name, className: 'photo-card__media', width: 960, height: 640, isLazy: item.rank > 2 }) : ''}
          <span class="reco__rank" aria-label="Puesto ${item.rank}">#${item.rank}</span>
          <div class="photo-card__overlay">
            <p class="photo-card__kicker">${icon(category.icon, 12)} ${esc(category.label)}${distance ? ` · a ${esc(distance)}` : ''}</p>
            <h3 class="photo-card__title">${esc(item.name)}</h3>
            ${item.description ? `<p class="photo-card__place">${esc(item.description)}</p>` : ''}
          </div>
        </div>
        <div class="reco__body">
          ${item.tip ? `<p class="reco__tip">${icon('star', 14)} ${esc(item.tip)}</p>` : ''}
          ${item.extract ? `<p class="reco__extract">${esc(item.extract)}</p>` : ''}
          <div class="reco__actions">
            ${ctx.trip && ctx.canEdit ? (isPlanned
              ? `<span class="badge badge--success">${icon('check', 14)} En tu plan</span>`
              : `<button class="btn btn--primary btn--small" type="button" data-action="reco-add" data-index="${item.rank - 1}">${icon('plus', 16)} Añadir al plan</button>`) : ''}
            ${ctx.trip ? `<button class="btn btn--small" type="button" data-action="reco-propose" data-index="${item.rank - 1}">${icon('vote', 16)} Proponer</button>` : ''}
            ${mapsUrl ? `<a class="btn btn--ghost btn--small" href="${esc(mapsUrl)}" target="_blank" rel="noopener">${icon('map', 16)} Cómo llegar</a>` : ''}
            ${wikiUrl ? `<a class="btn btn--ghost btn--small" href="${esc(wikiUrl)}" target="_blank" rel="noopener">Saber más</a>` : ''}
          </div>
          ${item.credit ? `<p class="reco__credit">Foto e información: ${esc(item.credit)}</p>` : ''}
        </div>
      </article>
    </li>`;
}

function resultsHtml(ctx) {
  if (isLoading) {
    return `<p class="loading" role="status">${source === 'aqui' ? 'Buscando dónde estás…' : 'Buscando los planes más populares…'}</p>`;
  }
  if (errorMessage) {
    return `<div class="empty"><span class="empty__icon">${icon('compass', 28)}</span><p class="empty__text">${esc(errorMessage)}</p>
      <button class="btn" type="button" data-action="reco-retry">Intentar de nuevo</button></div>`;
  }
  if (!results.length) return '';
  const visible = isShowingAll ? results : results.slice(0, TOP);
  const where = place.cityName || place.label;
  const basis = place.isCurated
    ? 'Ordenado según las atracciones más visitadas de la ciudad.'
    : 'Zona sin top propio: lugares turísticos cercanos ordenados según su popularidad en Wikipedia.';
  return `
    <div class="section__head">
      <div>
        <h3>Top ${visible.length} en ${esc(where)}</h3>
        <p class="section__hint">${esc(basis)}${place.isHere ? ' Distancias desde tu ubicación actual.' : ''}</p>
      </div>
    </div>
    <ol class="reco-list">${visible.map((item) => cardHtml(item, ctx)).join('')}</ol>
    ${results.length > TOP ? `<p class="section__hint section__hint--center"><button class="btn" type="button" data-action="reco-more">${isShowingAll ? 'Ver solo el top 5' : `Ver ${results.length - TOP} ${results.length - TOP === 1 ? 'plan' : 'planes'} más`}</button></p>` : ''}`;
}

function paintResults(ctx) {
  const box = document.getElementById('recoResults');
  if (box) box.innerHTML = resultsHtml(ctx);
}

/* ---- Handlers ---- */

function recoSourceHandler(button, event, ctx) {
  source = button.dataset.mode;
  isShowingAll = false;
  document.querySelectorAll('[data-action="reco-source"]').forEach((item) => {
    const isActive = item.dataset.mode === source;
    item.classList.toggle('segmented__btn--active', isActive);
    item.setAttribute('aria-pressed', String(isActive));
  });
  load(ctx);
}

async function recoSearchHandler(form, ctx, submitter) {
  const { query } = formToObject(form);
  if (!query) return;
  await withBusy(submitter, async () => {
    // Se muestra "cargando" desde ya: localizar la zona puede tardar un segundo
    isLoading = true;
    errorMessage = '';
    paintResults(ctx);
    // Ciudad elegida en el menu de sugerencias o, si no se eligio, la mejor coincidencia
    const input = form.elements.query;
    const pickedLat = parseFloat(input.dataset.lat);
    const pickedLon = parseFloat(input.dataset.lon);
    const isPicked = Number.isFinite(pickedLat) && Number.isFinite(pickedLon);
    const best = isPicked ? null : await bestCity(query);
    source = 'buscar';
    isShowingAll = false;
    place = {
      label: isPicked ? query : best?.value || query,
      text: isPicked || best ? '' : query,
      lat: isPicked ? pickedLat : best?.lat ?? null,
      lon: isPicked ? pickedLon : best?.lon ?? null
    };
    document.querySelectorAll('[data-action="reco-source"]').forEach((item) => {
      item.classList.remove('segmented__btn--active');
      item.setAttribute('aria-pressed', 'false');
    });
    await load(ctx);
  });
}

function recoMoreHandler(button, event, ctx) {
  isShowingAll = !isShowingAll;
  paintResults(ctx);
}

function recoRetryHandler(button, event, ctx) {
  load(ctx);
}

async function recoAddHandler(button, event, ctx) {
  const item = results[Number(button.dataset.index)];
  await withBusy(button, async () => {
    const saved = await store.insert('activities', {
      trip_id: ctx.tripId,
      day: null,
      time: null,
      title: item.name,
      place: item.name,
      notes: [item.tip, item.extract].filter(Boolean).join('\n\n'),
      lat: item.lat,
      lon: item.lon,
      image_url: item.image || null,
      image_thumb: item.thumb || null,
      image_credit: item.credit || null,
      created_by: store.user.id,
      created_by_name: store.user.name
    }, { tripId: ctx.tripId, text: `añadió "${item.name}" desde Recomendaciones` });
    if (item.image) {
      await store.insert('photos', {
        url: item.image, thumb_url: item.thumb, caption: item.name, credit: item.credit, source_url: item.url,
        provider: 'wikimedia', trip_id: ctx.tripId, activity_id: saved.id, day: null,
        uploaded_by: store.user.id, uploader_name: store.user.name
      });
    }
  });
  plannedTitles.add(item.name.toLowerCase());
  toast(`"${item.name}" está en Ideas sueltas del itinerario`);
  paintResults(ctx);
}

async function recoProposeHandler(button, event, ctx) {
  const item = results[Number(button.dataset.index)];
  try {
    await store.insert('proposals', {
      trip_id: ctx.tripId,
      title: item.name,
      description: [item.tip, item.description].filter(Boolean).join(' · '),
      day: null,
      status: 'open',
      author_id: store.user.id,
      author_name: store.user.name
    }, { tripId: ctx.tripId, text: `propuso "${item.name}"` });
    toast('Propuesta enviada al grupo para votar');
  } catch (error) {
    toastError(error);
  }
}

export default {
  async render(ctx) {
    // Al cambiar de viaje (o salir a la pagina general) se empieza de cero
    const context = ctx.tripId || 'general';
    if (context !== contextKey) {
      contextKey = context;
      source = ctx.trip ? 'viaje' : 'aqui';
      place = null;
      results = [];
      errorMessage = '';
      loadedKey = '';
      isShowingAll = false;
      loadSeq += 1;
      isLoading = false;
    }
    if (ctx.trip) {
      const activities = await store.list('activities', ctx.tripId).catch(() => []);
      plannedTitles = new Set(activities.map((activity) => activity.title.toLowerCase()));
    }
    return `
      <div class="section__head">
        <div>
          ${ctx.trip ? '<h2>Recomendaciones</h2>' : '<h1 class="home-head__title">Planes recomendados</h1>'}
          <p class="section__hint">El top 5 de lo que más visita la gente, sin buscar en Google ni en redes.</p>
        </div>
      </div>
      <div class="reco-controls">
        <div class="segmented" role="group" aria-label="Recomendaciones para">${sourceButtonsHtml(ctx)}</div>
        <form class="search search--form" data-form="reco-search" role="search">
          ${icon('search')}
          <label class="visually-hidden" for="recoQuery">Buscar otra ciudad o zona</label>
          <input class="search__input" id="recoQuery" name="query" type="search" placeholder="Ciudad o código: Roma, MDE, CTG…" autocomplete="off" data-autocomplete="city">
          <button class="btn btn--primary btn--small" type="submit">Buscar</button>
        </form>
      </div>
      <section id="recoResults" aria-live="polite">${resultsHtml(ctx)}</section>`;
  },
  mount(ctx, root) {
    // Al elegir una ciudad del menu se busca al momento
    const form = root.querySelector('[data-form="reco-search"]');
    const recoPickHandler = () => form.requestSubmit();
    form?.addEventListener('suggest:select', recoPickHandler);
    // "Donde estoy" pide permiso: solo se lanza al pulsar el boton, no al entrar
    const key = source === 'viaje' ? `viaje:${ctx.trip?.destination || ctx.trip?.name}` : loadedKey;
    if (source === 'viaje' && key !== loadedKey) load(ctx);
    else if (source === 'aqui' && !results.length && !errorMessage && !isLoading) {
      const box = document.getElementById('recoResults');
      if (box) {
        box.innerHTML = `<div class="empty"><span class="empty__icon">${icon('pin', 28)}</span>
          <h3 class="empty__title">¿Dónde estás?</h3>
          <p class="empty__text">Usa tu ubicación para ver el top 5 de la ciudad en la que te encuentras, o busca una ciudad arriba.</p>
          <button class="btn btn--primary" type="button" data-action="reco-source" data-mode="aqui">${icon('pin', 18)} Usar mi ubicación</button></div>`;
      }
    }
  },
  actions: {
    'reco-source': recoSourceHandler,
    'reco-more': recoMoreHandler,
    'reco-retry': recoRetryHandler,
    'reco-add': recoAddHandler,
    'reco-propose': recoProposeHandler
  },
  forms: { 'reco-search': recoSearchHandler }
};
