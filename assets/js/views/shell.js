/* Estructura comun de un viaje: cabecera con foto, pestañas de escritorio y barra inferior movil. */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { pictureHtml } from '../media.js';
import { openModal, closeModal, toast, withBusy } from '../ui.js';
import { avatarStackHtml, daysBetween, esc, formatRange, tripStatus } from '../utils.js';
import { tripFormHtml, saveTrip, deleteTripFlow } from './trips.js';

export const SECTIONS = [
  { key: 'resumen', label: 'Inicio', icon: 'home', hint: 'Cuenta atrás, clima y divisas' },
  { key: 'itinerario', label: 'Plan', icon: 'calendar', hint: 'Actividades día a día' },
  { key: 'mapa', label: 'Mapa', icon: 'map', hint: 'Ruta de cada día' },
  { key: 'album', label: 'Álbum', icon: 'image', hint: 'Fotos del grupo' },
  { key: 'recomendaciones', label: 'Top planes', icon: 'star', hint: 'Lo más visitado de la ciudad' },
  { key: 'frases', label: 'Frases', icon: 'translate', hint: 'Inglés para el día a día' },
  { key: 'propuestas', label: 'Votaciones', icon: 'vote', hint: 'Proponer y votar planes' },
  { key: 'diario', label: 'Diario', icon: 'book', hint: 'Notas y resumen final' },
  { key: 'equipaje', label: 'Equipaje', icon: 'bag', hint: 'Qué llevar y quién' },
  { key: 'documentos', label: 'Documentos', icon: 'file', hint: 'Billetes y reservas' },
  { key: 'miembros', label: 'Grupo', icon: 'users', hint: 'Invitar y permisos' },
  { key: 'historial', label: 'Historial', icon: 'clock', hint: 'Quién cambió qué' }
];
const MOBILE_KEYS = ['resumen', 'itinerario', 'mapa', 'album'];

export function heroHtml(ctx, sectionKey) {
  const { trip, members } = ctx;
  const isTall = sectionKey === 'resumen';
  const status = tripStatus(trip);
  const days = trip.start_date && trip.end_date ? daysBetween(trip.start_date, trip.end_date) + 1 : 0;
  const section = SECTIONS.find((item) => item.key === sectionKey);
  const glass = isTall ? `
    <div class="glass">
      <div class="glass__top">
        <h2 class="glass__title">${esc(trip.destination || trip.name)}</h2>
        <span class="badge badge--accent">${icon('star', 14)} ${esc(status.label)}</span>
      </div>
      <p class="glass__meta">
        <span>${icon('calendar', 16)} ${esc(formatRange(trip.start_date, trip.end_date))}</span>
        ${days ? `<span>${icon('clock', 16)} ${days} días</span>` : ''}
        <span>${avatarStackHtml(members.map((member) => member.name), 4)} ${members.length} viajero${members.length === 1 ? '' : 's'}</span>
      </p>
      ${trip.description ? `<p class="glass__text">${esc(trip.description)}</p>` : ''}
      <div class="glass__actions">
        <a class="btn btn--white" href="#/viaje/${esc(trip.id)}/mapa">Ver en el mapa</a>
        <a class="btn btn--white btn--icon" href="#/viaje/${esc(trip.id)}/itinerario" aria-label="Ver itinerario">${icon('calendar')}</a>
      </div>
    </div>` : '';
  return `
    <header class="hero ${isTall ? 'hero--tall' : ''}">
      ${trip.cover_url ? pictureHtml(trip.cover_url, { alt: '', className: 'hero__media', isLazy: false, width: 1600, height: 900 }) : ''}
      <div class="hero__bar">
        <a class="hero__btn" href="#/" aria-label="Volver a mis viajes">${icon('back')}</a>
        <div class="hero__bar-actions">
          ${ctx.canEdit ? `<button class="hero__btn" type="button" data-action="edit-trip" aria-label="Editar viaje">${icon('edit')}</button>` : ''}
          <button class="hero__btn" type="button" data-action="print-trip" aria-label="Exportar itinerario a PDF">${icon('print')}</button>
        </div>
      </div>
      <div class="hero__content">
        <p class="hero__kicker">${isTall ? esc(formatRange(trip.start_date, trip.end_date)) : esc(section?.label || '')}</p>
        <h1 class="hero__title ${isTall ? '' : 'hero__title--compact'}">${esc(trip.name)}</h1>
        ${trip.destination ? `<p class="hero__place">${icon('pin', 16)} ${esc(trip.destination)}</p>` : ''}
        ${glass}
      </div>
    </header>`;
}

export function tabsHtml(ctx, sectionKey) {
  return `
    <nav class="tabs" aria-label="Secciones del viaje">
      <ul class="tabs__list">
        ${SECTIONS.map((section) => `
          <li><a class="tabs__link ${section.key === sectionKey ? 'tabs__link--active' : ''}" href="#/viaje/${esc(ctx.trip.id)}/${section.key}" ${section.key === sectionKey ? 'aria-current="page"' : ''}>
            ${icon(section.icon, 18)} ${section.label}
          </a></li>`).join('')}
      </ul>
    </nav>`;
}

export function bottomNavHtml(tripId, sectionKey) {
  const isMore = !MOBILE_KEYS.includes(sectionKey);
  const links = MOBILE_KEYS.map((key) => SECTIONS.find((section) => section.key === key));
  return `
    <ul class="bottom-nav__list">
      ${links.map((section) => `
        <li><a class="bottom-nav__link ${section.key === sectionKey ? 'bottom-nav__link--active' : ''}" href="#/viaje/${esc(tripId)}/${section.key}" ${section.key === sectionKey ? 'aria-current="page"' : ''}>
          ${icon(section.icon, 22)}<span>${section.label}</span>
        </a></li>`).join('')}
      <li><a class="bottom-nav__link ${isMore ? 'bottom-nav__link--active' : ''}" href="#/viaje/${esc(tripId)}/mas" ${isMore ? 'aria-current="page"' : ''}>
        ${icon('grid', 22)}<span>Más</span>
      </a></li>
    </ul>`;
}

export function homeBottomNavHtml(routeKey) {
  return `
    <ul class="bottom-nav__list">
      <li><a class="bottom-nav__link ${routeKey === 'home' ? 'bottom-nav__link--active' : ''}" href="#/">${icon('home', 22)}<span>Viajes</span></a></li>
      <li><button class="bottom-nav__link" type="button" data-action="new-trip">${icon('plus', 22)}<span>Nuevo</span></button></li>
      <li><a class="bottom-nav__link ${routeKey === 'planes' ? 'bottom-nav__link--active' : ''}" href="#/planes">${icon('star', 22)}<span>Planes</span></a></li>
      <li><a class="bottom-nav__link ${routeKey === 'perfil' ? 'bottom-nav__link--active' : ''}" href="#/perfil">${icon('user', 22)}<span>Perfil</span></a></li>
    </ul>`;
}

/* Menu "Mas" (solo movil) */
export const moreView = {
  async render(ctx) {
    return `
      <h2 class="visually-hidden">Más secciones</h2>
      <ul class="menu-grid">
        ${SECTIONS.filter((section) => !MOBILE_KEYS.includes(section.key)).map((section) => `
          <li><a class="menu-grid__link" href="#/viaje/${esc(ctx.trip.id)}/${section.key}">
            <span class="menu-grid__icon">${icon(section.icon)}</span>
            ${section.label}
            <span class="menu-grid__hint">${section.hint}</span>
          </a></li>`).join('')}
      </ul>`;
  }
};

/* ---- Acciones comunes a todas las pestañas del viaje ---- */

function editTripHandler(button, event, ctx) {
  openModal('Editar viaje', tripFormHtml(ctx.trip));
}

async function saveTripEditHandler(form, ctx, submitter) {
  await withBusy(submitter, () => saveTrip(form, ctx.trip));
  closeModal();
  toast('Viaje actualizado');
  ctx.reloadTrip();
}

function deleteTripHandler(button, event, ctx) {
  deleteTripFlow(ctx.trip);
}

function printTripHandler(button, event, ctx) {
  if (!location.hash.endsWith('/itinerario')) {
    sessionStorage.setItem('foxtrips:print', '1');
    location.hash = `#/viaje/${ctx.trip.id}/itinerario`;
    return;
  }
  window.print();
}

export const shellActions = {
  'edit-trip': editTripHandler,
  'delete-trip': deleteTripHandler,
  'print-trip': printTripHandler
};

export const shellForms = {
  'save-trip': saveTripEditHandler
};

export function roleLabel(role) {
  return { owner: 'Organizador', editor: 'Editor', viewer: 'Lector' }[role] || role;
}

export function canEdit(role) {
  return role === 'owner' || role === 'editor';
}

export { store };
