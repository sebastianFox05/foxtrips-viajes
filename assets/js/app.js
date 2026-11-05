/*
 * Punto de entrada: enrutador por hash, contexto del viaje, tiempo real
 * y delegacion de eventos (data-action, data-form, data-input). Sin Javascript intrusivo.
 */
import { store } from './store/index.js';
import { hydrateMedia } from './media.js';
import { addComment, deleteComment } from './comments.js';
import { closeLightbox } from './lightbox.js';
import { initScrollers } from './scroller.js';
import { initAutocomplete } from './autocomplete.js';
import { closeModal, resolveConfirm, toastError } from './ui.js';
import { avatarHtml, debounce, esc } from './utils.js';
import tripsView from './views/trips.js';
import { loginView, profileView, joinView, recoveryView, rememberInvite } from './views/auth.js';
import { heroHtml, tabsHtml, bottomNavHtml, homeBottomNavHtml, moreView, shellActions, shellForms, canEdit, SECTIONS } from './views/shell.js';
import summaryView from './views/summary.js';
import itineraryView from './views/itinerary.js';
import mapView from './views/map.js';
import albumView from './views/album.js';
import recommendationsView from './views/recommendations.js';
import phrasesView from './views/phrases.js';
import proposalsView from './views/proposals.js';
import diaryView from './views/diary.js';
import packingView from './views/packing.js';
import documentsView from './views/documents.js';
import membersView from './views/members.js';
import historyView from './views/history.js';
import publicView from './views/public.js';
import welcomeView, { hasSeenWelcome } from './views/welcome.js';

/* ---- Constantes ---- */

const app = document.getElementById('app');
const userArea = document.getElementById('userArea');
const banner = document.getElementById('modeBanner');
const bottomNav = document.getElementById('bottomNav');
const siteNav = document.getElementById('siteNav');
const SECTION_VIEWS = {
  resumen: summaryView,
  itinerario: itineraryView,
  mapa: mapView,
  album: albumView,
  recomendaciones: recommendationsView,
  frases: phrasesView,
  propuestas: proposalsView,
  diario: diaryView,
  equipaje: packingView,
  documentos: documentsView,
  miembros: membersView,
  historial: historyView,
  mas: moreView
};
const REFRESH_DELAY = 350;
const FOCUS_KEYS = ['action', 'input', 'id', 'day', 'filter', 'category', 'mode', 'value', 'text', 'rate', 'role', 'user', 'target', 'step', 'index'];
const globalActions = {
  'close-modal': closeModalHandler,
  'confirm-yes': confirmYesHandler,
  'new-trip': tripsView.actions['new-trip'],
  'delete-comment': deleteCommentHandler
};
const globalForms = {
  comment: commentFormHandler,
  convert: noopFormHandler,
  'save-trip': tripsView.forms['save-trip']
};
const refreshNow = debounce(refreshNowHandler, REFRESH_DELAY);
const scheduleReloadTrip = debounce(reloadTripHandler, REFRESH_DELAY);

/* ---- Variables ---- */

let currentView = null;
let ctx = { params: {}, query: new URLSearchParams() };
let renderToken = 0;
let paintSeq = 0;
let unsubscribe = null;
let isRefreshPending = false;

/* ---- Rutas ---- */

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, search = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, query: new URLSearchParams(search) };
}

function resolveRoute({ parts }) {
  if (parts[0] === 'publico' && parts[1]) return { name: 'public', view: publicView, params: { token: parts[1] }, isPublic: true };
  if (!store.user) {
    // Sin sesion: primero la bienvenida (una vez por sesion) y luego el acceso.
    // Las invitaciones van directas al acceso para no hacer esperar a quien te invitan.
    if (parts[0] === 'unirse' && parts[1]) {
      rememberInvite(parts[1]);
      return { name: 'login', view: loginView, params: {}, isPublic: true };
    }
    const isWelcome = parts[0] === 'bienvenida' || (parts[0] !== 'acceso' && !hasSeenWelcome());
    if (isWelcome) return { name: 'welcome', view: welcomeView, params: {}, isPublic: true };
    return { name: 'login', view: loginView, params: {}, isPublic: true };
  }
  if (parts[0] === 'acceso' || parts[0] === 'bienvenida') return { name: 'home', view: tripsView, params: {} };
  // Volviendo del correo de recuperacion: primero se pide la contraseña nueva
  if (store.isRecovery) return { name: 'login', view: recoveryView, params: {} };
  if (parts[0] === 'unirse' && parts[1]) return { name: 'join', view: joinView, params: { code: parts[1] } };
  if (parts[0] === 'perfil') return { name: 'perfil', view: profileView, params: {} };
  if (parts[0] === 'planes') return { name: 'planes', view: recommendationsView, params: {} };
  if (parts[0] === 'viaje' && parts[1]) {
    const section = SECTION_VIEWS[parts[2]] ? parts[2] : 'resumen';
    return { name: 'trip', view: SECTION_VIEWS[section], params: { id: parts[1], section } };
  }
  return { name: 'home', view: tripsView, params: {} };
}

/* ---- Cabecera, banner y barra inferior ---- */

function renderChrome(route) {
  const user = store.user;
  userArea.innerHTML = user
    ? `<span class="site-header__name">${esc(user.name)}</span><a href="#/perfil" aria-label="Tu perfil">${avatarHtml(user.name)}</a>`
    : '';
  const isAuthScreen = route.name === 'login' || route.name === 'welcome';
  // Navegacion principal: solo con sesion, y marcando la seccion actual
  const activeRoute = route.name === 'trip' ? 'home' : route.name;
  siteNav.hidden = !user;
  siteNav.querySelectorAll('.site-header__link').forEach((link) => {
    const isActive = link.dataset.route === activeRoute;
    link.classList.toggle('site-header__link--active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  banner.hidden = store.mode !== 'local' || route.name === 'public' || isAuthScreen;
  banner.textContent = 'Modo local · los datos solo se guardan en este navegador.';
  let navHtml = '';
  if (route.name === 'trip') navHtml = bottomNavHtml(route.params.id, route.params.section);
  else if (['home', 'perfil', 'planes'].includes(route.name)) navHtml = homeBottomNavHtml(route.name);
  bottomNav.innerHTML = navHtml;
  bottomNav.hidden = !navHtml;
  document.body.classList.toggle('has-bottom-nav', Boolean(navHtml));
  document.body.classList.toggle('is-trip', route.name === 'trip' || route.name === 'public');
  document.body.classList.toggle('is-auth', isAuthScreen);
}

function setTitle(route) {
  const section = SECTIONS.find((item) => item.key === route.params?.section);
  const parts = [section?.label, ctx.trip?.name, 'FoxTrips'].filter(Boolean);
  document.title = route.name === 'trip' ? parts.join(' · ') : 'FoxTrips · Viajes en grupo';
}

/* ---- Contexto del viaje ---- */

async function loadTrip(id) {
  const [trip, members] = await Promise.all([store.getTrip(id), store.listMembers(id).catch(() => [])]);
  if (!trip) return null;
  return {
    trip,
    tripId: id,
    members,
    role: trip.role,
    canEdit: canEdit(trip.role),
    isOwner: trip.role === 'owner'
  };
}

function realtimeHandler(payload) {
  const table = payload?.table;
  if (table === 'trips' || table === 'trip_members') scheduleReloadTrip();
  else refreshNow();
}

function subscribeTrip(tripId) {
  if (ctx.subscribedId === tripId) return;
  unsubscribe?.();
  unsubscribe = store.subscribe(tripId, realtimeHandler);
  ctx.subscribedId = tripId;
}

function stopSubscription() {
  unsubscribe?.();
  unsubscribe = null;
  ctx.subscribedId = null;
}

/* ---- Foco: se recupera tras repintar (votar, filtrar, marcar…) ---- */

function focusSelector(element) {
  if (!element || element === document.body || !app.contains(element)) return null;
  if (element.id) return `#${CSS.escape(element.id)}`;
  const parts = FOCUS_KEYS
    .filter((key) => element.dataset[key] !== undefined)
    .map((key) => `[data-${key}="${CSS.escape(element.dataset[key])}"]`);
  return parts.length ? element.tagName.toLowerCase() + parts.join('') : null;
}

function restoreFocus(selector) {
  if (!selector) return;
  const element = app.querySelector(selector);
  if (element && document.activeElement !== element) element.focus({ preventScroll: true });
}

/* ---- Pintado ---- */

function errorHtml(error) {
  return `<div class="empty"><h1 class="empty__title">No se pudo cargar</h1><p class="empty__text">${esc(error.message || error)}</p><a class="btn btn--primary" href="#/">Volver al inicio</a></div>`;
}

/*
 * Pinta la pestaña actual. Cada pintado lleva su numero: si mientras esperaba datos
 * empezo otro mas nuevo, este se descarta (evita montar dos veces el mapa o los listeners).
 */
async function renderPanel(token) {
  const paint = ++paintSeq;
  const view = currentView;
  const panel = document.getElementById('tabPanel') || app;
  const focus = focusSelector(document.activeElement);
  const html = await view.render(ctx);
  if (token !== renderToken || paint !== paintSeq) return;
  view.unmount?.();
  panel.innerHTML = html;
  await hydrateMedia(panel);
  if (token !== renderToken || paint !== paintSeq) return;
  view.mount?.(ctx, panel);
  restoreFocus(focus);
}

async function render({ isNavigation = true } = {}) {
  const token = ++renderToken;
  const parsed = parseHash();
  const route = resolveRoute(parsed);
  const subscribedId = ctx.subscribedId;
  currentView?.unmount?.();
  currentView = route.view;
  ctx = {
    ...ctx,
    subscribedId,
    route,
    params: route.params,
    query: parsed.query,
    user: store.user,
    refresh: () => renderPanel(renderToken).catch(toastError),
    reloadTrip: () => render({ isNavigation: false }),
    reloadApp: () => render(),
    hydrate: hydrateMedia
  };
  renderChrome(route);
  try {
    if (route.name === 'trip') {
      const fresh = await loadTrip(route.params.id);
      if (token !== renderToken) return;
      if (!fresh) throw new Error('Este viaje no existe o no tienes acceso.');
      Object.assign(ctx, fresh);
      subscribeTrip(route.params.id);
      app.innerHTML = `${heroHtml(ctx, route.params.section)}${tabsHtml(ctx, route.params.section)}<section id="tabPanel" aria-live="off"></section>`;
      hydrateMedia(app);
      await renderPanel(token);
    } else {
      stopSubscription();
      Object.assign(ctx, { trip: null, tripId: null, members: [], canEdit: false, isOwner: false });
      // Fuera de un viaje se quita su cabecera y su panel: la vista ocupa todo el contenido
      if (document.getElementById('tabPanel')) app.innerHTML = '<p class="loading">Cargando…</p>';
      await renderPanel(token);
    }
    setTitle(route);
  } catch (error) {
    if (token !== renderToken) return;
    console.error(error);
    app.innerHTML = errorHtml(error);
  }
  if (isNavigation && token === renderToken) {
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }
}

/* Refresco por cambios de otras personas (tiempo real) u otras pestañas */
async function refreshNowHandler() {
  const active = document.activeElement;
  const isTyping = active && app.contains(active) && active.matches('input:not([type=checkbox]):not([type=file]), textarea, select');
  const isBusy = currentView?.isBusy?.() === true;
  if (isTyping || isBusy) {
    isRefreshPending = true;
    return;
  }
  isRefreshPending = false;
  try {
    await renderPanel(renderToken);
  } catch (error) {
    toastError(error);
  }
}

function reloadTripHandler() {
  render({ isNavigation: false });
}

/* ---- Acciones y formularios globales ---- */

function closeModalHandler() {
  closeModal();
}

function confirmYesHandler() {
  resolveConfirm();
}

function deleteCommentHandler(button) {
  return deleteComment(button.dataset.id, ctx.tripId);
}

function commentFormHandler(form) {
  return addComment(form, ctx.tripId);
}

/* Formularios que solo calculan en pantalla (conversor): Enter no debe recargar la pagina */
function noopFormHandler() {}

/* ---- Delegacion de eventos ---- */

function findHandler(group, name) {
  const shell = ctx.route?.name === 'trip' ? { actions: shellActions, forms: shellForms } : {};
  const globals = { actions: globalActions, forms: globalForms };
  return currentView?.[group]?.[name] || shell[group]?.[name] || globals[group]?.[name];
}

async function clickHandler(event) {
  const target = event.target.closest('[data-action]');
  const isLightboxControl = target?.closest('#lightbox') && target.dataset.action.startsWith('lightbox-');
  if (!target || isLightboxControl) return;
  const handler = findHandler('actions', target.dataset.action);
  if (!handler) return;
  event.preventDefault();
  try {
    await handler(target, event, ctx);
  } catch (error) {
    toastError(error);
  }
}

async function submitHandler(event) {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const handler = findHandler('forms', form.dataset.form);
  if (!handler) return;
  try {
    await handler(form, ctx, event.submitter);
    if (form.dataset.form === 'comment' || form.dataset.form === 'add-item') form.reset?.();
  } catch (error) {
    toastError(error);
  }
}

function dispatchInput(element) {
  const handler = findHandler('inputs', element.dataset.input);
  if (!handler) return;
  Promise.resolve(handler(element, ctx)).catch(toastError);
}

function isChangeOnly(element) {
  return element.type === 'file' || element.type === 'checkbox' || element.tagName === 'SELECT';
}

function inputHandler(event) {
  const element = event.target.closest('[data-input]');
  if (element && !isChangeOnly(element)) dispatchInput(element);
}

function changeHandler(event) {
  const element = event.target.closest('[data-input]');
  if (element && isChangeOnly(element)) dispatchInput(element);
}

function focusOutHandler() {
  if (isRefreshPending) setTimeout(refreshNow, 50);
}

function hashChangeHandler() {
  closeModal();
  closeLightbox();
  render();
}

function onlineHandler() {
  if (ctx.route?.name === 'trip') refreshNow();
}

function serviceWorkerErrorHandler(error) {
  console.warn('Service worker no registrado', error);
}

/* ---- Arranque ---- */

async function start() {
  try {
    await store.init();
  } catch (error) {
    console.error(error);
  }
  await render();
  initScrollers();
  initAutocomplete();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(serviceWorkerErrorHandler);
  }
}

/* ---- Asignacion de eventos ---- */

document.addEventListener('click', clickHandler);
document.addEventListener('submit', submitHandler);
document.addEventListener('input', inputHandler);
document.addEventListener('change', changeHandler);
app.addEventListener('focusout', focusOutHandler);
window.addEventListener('hashchange', hashChangeHandler);
window.addEventListener('online', onlineHandler);

start();
