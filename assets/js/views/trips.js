/* Inicio: saludo, buscador, filtros y tarjetas de viaje. Incluye el formulario de crear/editar viaje. */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { pictureHtml, uploadPhoto, deleteTripFiles } from '../media.js';
import { CURRENCIES } from '../services.js';
import { bestCity, CITY_CODES, normalize } from '../places.js';
import { registerSuggestions } from '../autocomplete.js';
import { openModal, closeModal, toast, toastError, withBusy, confirmDialog } from '../ui.js';
import { avatarStackHtml, daysBetween, esc, formatRange, formToObject, tripStatus } from '../utils.js';
import { createDemoTrip } from '../demo.js';

const FILTERS = [
  { key: 'all', label: 'Todos', icon: 'compass' },
  { key: 'upcoming', label: 'Próximos', icon: 'calendar' },
  { key: 'ongoing', label: 'En curso', icon: 'pin' },
  { key: 'past', label: 'Pasados', icon: 'clock' }
];

let activeFilter = 'all';
let searchText = '';
let trips = [];
let membersByTrip = {};

/* ---- Plantillas ---- */

function tripCardHtml(trip, position) {
  const status = tripStatus(trip);
  const days = trip.start_date && trip.end_date ? daysBetween(trip.start_date, trip.end_date) + 1 : 0;
  const names = (membersByTrip[trip.id] || []).map((member) => member.name);
  return `
    <li>
      <article class="photo-card ${position === 0 ? 'photo-card--tall' : ''}">
        ${trip.cover_url ? pictureHtml(trip.cover_url, { alt: '', className: 'photo-card__media', isLazy: position > 1, width: 900, height: 600 }) : ''}
        <div class="photo-card__overlay">
          <p class="photo-card__kicker">${esc(formatRange(trip.start_date, trip.end_date))}${days ? ` · ${days} días` : ''}</p>
          <h3 class="photo-card__title"><a class="photo-card__link" href="#/viaje/${esc(trip.id)}">${esc(trip.name)}</a></h3>
          <div class="photo-card__footer">
            <span class="photo-card__place">${icon('pin', 16)} ${esc(trip.destination || 'Destino por decidir')}</span>
            ${avatarStackHtml(names)}
          </div>
        </div>
        <span class="photo-card__badge">${esc(status.label)}</span>
      </article>
    </li>`;
}

/* ¿El viaje coincide con lo escrito? Por nombre, destino o codigo de ciudad (CTG → Cartagena de Indias) */
function tripMatches(trip, query) {
  const text = normalize(query);
  if (!text) return true;
  const haystack = normalize(`${trip.name} ${trip.destination || ''}`);
  if (haystack.includes(text)) return true;
  const code = text.replace(/[s.]/g, '').toUpperCase();
  const city = CITY_CODES.find((entry) => entry.codes.includes(code));
  return Boolean(city && haystack.includes(normalize(city.name).split(' ')[0]));
}

function tripSuggestions(query) {
  return trips.filter((trip) => tripMatches(trip, query)).slice(0, 6).map((trip) => ({
    name: trip.name,
    detail: [trip.destination, formatRange(trip.start_date, trip.end_date)].filter(Boolean).join(' · '),
    value: trip.name,
    href: `#/viaje/${trip.id}`,
    icon: 'calendar'
  }));
}

function listHtml() {
  const text = searchText.toLowerCase();
  const visible = trips
    .filter((trip) => activeFilter === 'all' || tripStatus(trip).key === activeFilter)
    .filter((trip) => !text || tripMatches(trip, text));
  if (!trips.length) {
    return `
      <div class="empty">
        <span class="empty__icon">${icon('compass', 28)}</span>
        <h3 class="empty__title">Tu primer viaje empieza aquí</h3>
        <p class="empty__text">Crea un viaje e invita a tu grupo para planearlo juntos.</p>
        <div class="page-head__actions page-head__actions--center">
          <button class="btn btn--primary" type="button" data-action="new-trip">${icon('plus')} Crear viaje</button>
          <button class="btn" type="button" data-action="demo-trip">${icon('star', 16)} Ver ejemplo: Nueva York</button>
        </div>
      </div>`;
  }
  if (!visible.length) return '<p class="empty">No hay viajes con ese filtro.</p>';
  return `<ul class="trip-grid">${visible.map(tripCardHtml).join('')}</ul>`;
}

function chipsHtml() {
  return FILTERS.map((filter) => `
    <li><button class="chip ${filter.key === activeFilter ? 'chip--active' : ''}" type="button" data-action="filter-trips" data-filter="${filter.key}" aria-pressed="${filter.key === activeFilter}">
      <span class="chip__icon">${icon(filter.icon, 18)}</span>${filter.label}
    </button></li>`).join('');
}

export function tripFormHtml(trip = {}) {
  const currencyOptions = CURRENCIES.map((code) => `<option ${code === (trip.currency || 'USD') ? 'selected' : ''}>${code}</option>`).join('');
  return `
    <form class="form" data-form="save-trip" data-id="${esc(trip.id || '')}">
      <div class="form__field">
        <label class="form__label" for="tripName">Nombre del viaje</label>
        <input class="form__input" id="tripName" name="name" required maxlength="80" value="${esc(trip.name || '')}" placeholder="Ej. Vacaciones en Cartagena">
      </div>
      <div class="form__field">
        <label class="form__label" for="tripDestination">Destino</label>
        <input class="form__input" id="tripDestination" name="destination" maxlength="120" value="${esc(trip.destination || '')}" placeholder="Ciudad o código: Cartagena, CTG, NYC…" data-autocomplete="city">
        <input type="hidden" name="destination_lat" value="${trip.lat ?? ''}">
        <input type="hidden" name="destination_lon" value="${trip.lon ?? ''}">
        <p class="form__help">Elige la ciudad del menú para que el mapa, el clima y las recomendaciones sean del lugar correcto.</p>
      </div>
      <div class="form__row">
        <div class="form__field">
          <label class="form__label" for="tripStart">Ida</label>
          <input class="form__input" id="tripStart" name="start_date" type="date" required value="${esc(trip.start_date || '')}">
        </div>
        <div class="form__field">
          <label class="form__label" for="tripEnd">Vuelta</label>
          <input class="form__input" id="tripEnd" name="end_date" type="date" required value="${esc(trip.end_date || '')}">
        </div>
      </div>
      <div class="form__row">
        <div class="form__field">
          <label class="form__label" for="tripCurrency">Moneda del destino</label>
          <select class="form__select" id="tripCurrency" name="currency">${currencyOptions}</select>
        </div>
        <div class="form__field">
          <label class="form__label" for="tripCover">Foto de portada</label>
          <input class="form__input" id="tripCover" name="cover" type="file" accept="image/*">
        </div>
      </div>
      <div class="form__field">
        <label class="form__label" for="tripDescription">Descripción</label>
        <textarea class="form__textarea" id="tripDescription" name="description" maxlength="600" placeholder="¿Qué planes tenéis?">${esc(trip.description || '')}</textarea>
      </div>
      <div class="form__actions">
        ${trip.id && trip.role === 'owner' ? '<button class="btn btn--ghost btn--danger" type="button" data-action="delete-trip">Eliminar viaje</button>' : ''}
        <button class="btn" type="button" data-action="close-modal">Cancelar</button>
        <button class="btn btn--primary" type="submit">${trip.id ? 'Guardar cambios' : 'Crear viaje'}</button>
      </div>
    </form>`;
}

/* ---- Logica compartida del formulario de viaje ---- */

export async function saveTrip(form, previous) {
  const data = formToObject(form);
  const coverFile = form.elements.cover.files[0];
  if (data.end_date < data.start_date) throw new Error('La vuelta no puede ser antes de la ida.');
  const patch = {
    name: data.name,
    destination: data.destination,
    start_date: data.start_date,
    end_date: data.end_date,
    currency: data.currency,
    description: data.description
  };
  // Coordenadas: las de la ciudad elegida en el menu; si se escribio sin elegir, la mejor coincidencia
  const pickedLat = parseFloat(data.destination_lat);
  const pickedLon = parseFloat(data.destination_lon);
  if (!data.destination) {
    patch.lat = null;
    patch.lon = null;
  } else if (Number.isFinite(pickedLat) && Number.isFinite(pickedLon)) {
    patch.lat = pickedLat;
    patch.lon = pickedLon;
  } else {
    const place = await bestCity(data.destination);
    patch.lat = place?.lat ?? null;
    patch.lon = place?.lon ?? null;
  }
  if (previous?.id) {
    if (coverFile) patch.cover_url = (await uploadPhoto(previous.id, coverFile)).url;
    await store.updateTrip(previous.id, patch, { tripId: previous.id, text: 'editó los datos del viaje' });
    return previous.id;
  }
  // La portada se sube despues de crear el viaje: la ruta de almacenamiento empieza por su id
  const trip = await store.createTrip(patch);
  if (coverFile) {
    const cover = await uploadPhoto(trip.id, coverFile);
    await store.updateTrip(trip.id, { cover_url: cover.url });
  }
  return trip.id;
}

/* ---- Vista ---- */

async function newTripHandler() {
  openModal('Nuevo viaje', tripFormHtml());
}

function filterTripsHandler(button) {
  activeFilter = button.dataset.filter;
  document.getElementById('tripChips').innerHTML = chipsHtml();
  document.getElementById('tripList').innerHTML = listHtml();
}

function searchTripsHandler(input) {
  searchText = input.value.trim();
  document.getElementById('tripList').innerHTML = listHtml();
}

async function demoTripHandler(button) {
  await withBusy(button, async () => {
    const id = await createDemoTrip();
    toast('Viaje de ejemplo creado');
    location.hash = `#/viaje/${id}`;
  });
}

async function saveTripHandler(form, ctx, submitter) {
  if (form.dataset.id) return;
  await withBusy(submitter, async () => {
    const id = await saveTrip(form, null);
    closeModal();
    toast('¡Viaje creado!');
    location.hash = `#/viaje/${id}`;
  });
}

export async function deleteTripFlow(trip) {
  const isConfirmed = await confirmDialog(`Se borrará "${trip.name}" con su itinerario, fotos y documentos para todo el grupo.`);
  if (!isConfirmed) return;
  try {
    // Primero las fotos de Cloudinary: el servidor comprueba que el viaje aun existe y que eres quien organiza
    await deleteTripFiles(trip.id).catch(() => null);
    await store.deleteTrip(trip.id);
    toast('Viaje eliminado');
    location.hash = '#/';
  } catch (error) {
    toastError(error);
  }
}

export default {
  async render() {
    trips = (await store.listTrips()).sort((first, second) => (first.start_date || '').localeCompare(second.start_date || ''));
    const now = new Date().toISOString().slice(0, 10);
    const notPast = trips.filter((trip) => (trip.end_date || '9') >= now);
    const past = trips.filter((trip) => (trip.end_date || '9') < now);
    trips = [...notPast, ...past.reverse()];
    const members = await Promise.all(trips.map((trip) => store.listMembers(trip.id).catch(() => [])));
    membersByTrip = Object.fromEntries(trips.map((trip, position) => [trip.id, members[position]]));
    const firstName = store.user.name.split(' ')[0];
    return `
      <section class="home-head">
        <div>
          <p class="home-head__hello">Hola, ${esc(firstName)} 👋</p>
          <h1 class="home-head__title">¿A dónde vamos?</h1>
        </div>
      </section>
      <label class="search">
        ${icon('search')}
        <span class="visually-hidden">Buscar viaje</span>
        <input class="search__input" id="tripSearch" type="search" placeholder="Buscar viaje, destino o código (NYC, CTG…)" value="${esc(searchText)}" data-input="search-trips" data-autocomplete="trip">
      </label>
      <section class="section" aria-labelledby="tripsTitle">
        <div class="section__head">
          <h2 id="tripsTitle">Tus viajes</h2>
          <button class="link-btn" type="button" data-action="new-trip">${icon('plus', 16)} Nuevo viaje</button>
        </div>
        <ul class="chips" id="tripChips">${chipsHtml()}</ul>
        <div id="tripList">${listHtml()}</div>
        ${trips.length ? `<p class="section__hint section__hint--center">¿Quieres ver todo lo que puede hacer FoxTrips? <button class="link-btn" type="button" data-action="demo-trip">Crear el viaje de ejemplo a Nueva York</button></p>` : ''}
      </section>`;
  },
  actions: {
    'new-trip': newTripHandler,
    'demo-trip': demoTripHandler,
    'filter-trips': filterTripsHandler
  },
  inputs: {
    'search-trips': searchTripsHandler
  },
  forms: {
    'save-trip': saveTripHandler
  }
};

registerSuggestions('trip', tripSuggestions, { minLength: 1, label: 'Viajes sugeridos' });
