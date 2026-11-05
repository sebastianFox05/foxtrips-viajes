/*
 * Itinerario: carrete horizontal de tarjetas (una por dia) con la fecha en grande.
 * Al centrar o pulsar una tarjeta se muestran debajo las actividades de ese dia.
 * La imagen del sitio de cada actividad tambien se guarda en el album.
 */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { pictureHtml, uploadPhoto, hydrateMedia } from '../media.js';
import { geocode } from '../services.js';
import { renderComments, countFor } from '../comments.js';
import { placeHistory } from '../place-history.js';
import { openModal, closeModal, confirmDialog, setModalBody, toast, toastError, withBusy } from '../ui.js';
import { debounce, eachDay, esc, formatDay, formToObject, parseDay, safeUrl, sortActivities, today } from '../utils.js';

const LOOSE_KEY = 'sin-dia';
const VIEW_KEY = 'foxtrips:itinerary-view';
const VIEW_MODES = [
  { key: 'carrete', label: 'Carrete', icon: 'image' },
  { key: 'lista', label: 'Lista', icon: 'calendar' }
];
const CARD_HUES = [24, 200, 330, 150, 265, 45, 185];

let activities = [];
let comments = [];
let reelDays = [];
let selectedDay = null;
let selectedTripId = null;
let viewCtx = null;

/* ---- Plantillas ---- */

function bigDate(day) {
  if (day === LOOSE_KEY) return { main: 'IDEAS', sub: 'Planes sin día asignado' };
  const date = parseDay(day);
  const month = date.toLocaleDateString('es', { month: 'short' }).replace('.', '').toUpperCase();
  return { main: `${date.getDate()} ${month}`, sub: formatDay(day, { weekday: 'long' }) };
}

function activitiesOf(day) {
  if (day === LOOSE_KEY) return activities.filter((activity) => !activity.day || !reelDays.includes(activity.day));
  return activities.filter((activity) => activity.day === day);
}

function dayCardHtml(day, index, ctx) {
  const list = activitiesOf(day);
  const withImage = list.find((activity) => activity.image_url);
  const image = withImage?.image_url || ctx.trip.cover_url;
  const isLoose = day === LOOSE_KEY;
  const label = isLoose ? 'Ideas' : `Día ${index + 1}`;
  const title = isLoose ? 'Ideas sueltas' : list[0]?.title || 'Día libre';
  return `
    <li class="day-reel__item">
      <button class="day-card ${day === selectedDay ? 'day-card--active' : ''}" type="button" data-action="select-day" data-day="${esc(day)}"
        style="--card-hue:${CARD_HUES[index % CARD_HUES.length]}" aria-pressed="${day === selectedDay}"
        aria-label="${esc(label)}: ${esc(isLoose ? 'ideas sueltas' : formatDay(day))}, ${list.length} planes">
        ${image ? pictureHtml(image, { alt: '', className: 'day-card__media', width: 480, height: 640, isLazy: index > 2 }) : ''}
        <span class="day-card__tags">
          <span class="day-card__tag">${esc(label)}</span>
          <span class="day-card__tag">${list.length} plan${list.length === 1 ? '' : 'es'}</span>
        </span>
        <span class="day-card__bottom">
          <span class="day-card__weekday">${isLoose ? 'Sin fecha' : esc(formatDay(day, { weekday: 'long', day: 'numeric' }))}</span>
          <span class="day-card__title">${esc(title)}</span>
        </span>
      </button>
    </li>`;
}

function activityHtml(activity, ctx, isPrint = false) {
  const commentCount = countFor(comments, 'activity', activity.id);
  const place = activity.place ? `<p class="activity__place">${icon('pin', 14)} ${esc(activity.place)}</p>` : '';
  const media = activity.image_url && !isPrint ? `
    <figure class="activity__media">
      ${pictureHtml(activity.image_url, { alt: `Foto de ${activity.title}`, width: 800, height: 500 })}
      <figcaption class="activity__media-text">
        <h4 class="activity__title">${esc(activity.title)}</h4>
        ${place}
      </figcaption>
      ${activity.image_credit ? `<small class="activity__credit">Foto: ${esc(activity.image_credit)}</small>` : ''}
    </figure>` : '';
  const hasMediaTitle = Boolean(media);
  return `
    <li>
      <article class="activity">
        ${media}
        <div class="activity__body">
          <span class="activity__time">${esc(activity.time || '—')}</span>
          <div class="activity__info">
            ${hasMediaTitle ? '' : `<h4 class="activity__title">${esc(activity.title)}</h4>${place}`}
            ${activity.notes ? `<p class="activity__notes">${esc(activity.notes)}</p>` : ''}
          </div>
        </div>
        ${isPrint ? '' : `
        <footer class="activity__footer">
          <span>${activity.created_by_name ? `Añadido por ${esc(activity.created_by_name)}` : ''}</span>
          <div class="activity__actions">
            <button class="btn btn--ghost btn--small" type="button" data-action="activity-history" data-id="${esc(activity.id)}" aria-label="Historia de ${esc(activity.title)}">${icon('book', 16)} Historia</button>
            <button class="btn btn--ghost btn--small" type="button" data-action="activity-comments" data-id="${esc(activity.id)}" aria-label="Comentarios de ${esc(activity.title)}: ${commentCount}">${icon('chat', 16)} ${commentCount}</button>
            ${activity.lat != null ? `<a class="btn btn--ghost btn--small btn--icon" href="#/viaje/${esc(ctx.trip.id)}/mapa?foco=${esc(activity.id)}" aria-label="Ver ${esc(activity.title)} en el mapa">${icon('map', 16)}</a>` : ''}
            ${ctx.canEdit ? `
              <button class="btn btn--ghost btn--small btn--icon" type="button" data-action="edit-activity" data-id="${esc(activity.id)}" aria-label="Editar ${esc(activity.title)}">${icon('edit', 16)}</button>
              <button class="btn btn--ghost btn--small btn--icon btn--danger" type="button" data-action="delete-activity" data-id="${esc(activity.id)}" aria-label="Eliminar ${esc(activity.title)}">${icon('trash', 16)}</button>` : ''}
          </div>
        </footer>`}
      </article>
    </li>`;
}

function dayDetailHtml(ctx) {
  const list = activitiesOf(selectedDay);
  const isLoose = selectedDay === LOOSE_KEY;
  const heading = isLoose ? 'Ideas sueltas' : formatDay(selectedDay);
  return `
    <div class="section__head">
      <h3 class="day__date">${esc(heading)}</h3>
      ${ctx.canEdit ? `<button class="btn btn--small" type="button" data-action="new-activity" data-day="${isLoose ? '' : esc(selectedDay)}">${icon('plus', 16)} Añadir a este día</button>` : ''}
    </div>
    ${list.length
      ? `<ul class="day__list">${list.map((activity) => activityHtml(activity, ctx)).join('')}</ul>`
      : '<p class="day__empty">Nada planeado todavía. ¡Añade algo o mira las votaciones!</p>'}`;
}

/* Version "Lista": todos los dias uno debajo de otro */
function listViewHtml(ctx, keys) {
  const chips = keys.map((day, index) => `<li><button class="chip chip--plain" type="button" data-action="jump-day" data-target="dia-${esc(day)}">${day === LOOSE_KEY ? 'Ideas' : `Día ${index + 1} · ${esc(formatDay(day, { day: 'numeric', month: 'short' }))}`}</button></li>`).join('');
  const sections = keys.map((day, index) => {
    const list = activitiesOf(day);
    const isLoose = day === LOOSE_KEY;
    return `
      <section class="day" id="dia-${esc(day)}" aria-labelledby="title-${esc(day)}">
        <header class="day__header">
          <div>
            <span class="day__label">${isLoose ? 'Sin día asignado' : `Día ${index + 1}`}</span>
            <h3 class="day__date" id="title-${esc(day)}">${isLoose ? 'Ideas sueltas' : esc(formatDay(day))}</h3>
          </div>
          ${ctx.canEdit ? `<button class="btn btn--small" type="button" data-action="new-activity" data-day="${isLoose ? '' : esc(day)}">${icon('plus', 16)} Añadir</button>` : ''}
        </header>
        ${list.length
          ? `<ul class="day__list">${list.map((activity) => activityHtml(activity, ctx)).join('')}</ul>`
          : '<p class="day__empty">Nada planeado todavía para este día.</p>'}
      </section>`;
  }).join('');
  return `${keys.length > 1 ? `<ul class="chips">${chips}</ul>` : ''}${sections}`;
}

/* Version "Carrete": tarjetas tipo poster que se deslizan */
function reelViewHtml(ctx, keys) {
  const { main, sub } = bigDate(selectedDay);
  return `
    <section class="day-reel" aria-label="Días del viaje">
      <p class="day-reel__date" id="reelDate" aria-live="polite">${esc(main)}</p>
      <p class="day-reel__sub" id="reelSub">${esc(sub)}</p>
      <div class="day-reel__viewport">
        <button class="day-reel__nav day-reel__nav--prev" type="button" data-action="reel-step" data-step="-1" aria-label="Día anterior">${icon('back')}</button>
        <ul class="day-reel__track" id="reelTrack">${keys.map((day, index) => dayCardHtml(day, index, ctx)).join('')}</ul>
        <button class="day-reel__nav day-reel__nav--next" type="button" data-action="reel-step" data-step="1" aria-label="Día siguiente">${icon('next')}</button>
      </div>
    </section>
    <section class="day-detail" id="dayDetail" aria-live="polite">${dayDetailHtml(ctx)}</section>`;
}

function currentMode() {
  const saved = localStorage.getItem(VIEW_KEY);
  return VIEW_MODES.some((mode) => mode.key === saved) ? saved : 'carrete';
}

/* Copia completa para imprimir / exportar a PDF */
function printHtml(ctx) {
  return reelDays.concat(activitiesOf(LOOSE_KEY).length ? [LOOSE_KEY] : []).map((day, index) => {
    const list = activitiesOf(day);
    return `
      <section class="day">
        <h3 class="day__date">${day === LOOSE_KEY ? 'Ideas sueltas' : `Día ${index + 1} · ${esc(formatDay(day))}`}</h3>
        ${list.length ? `<ul class="day__list">${list.map((activity) => activityHtml(activity, ctx, true)).join('')}</ul>` : '<p class="day__empty">Día libre</p>'}
      </section>`;
  }).join('');
}

function activityFormHtml(ctx, activity = {}, presetDay = '') {
  const selected = activity.day ?? presetDay;
  const dayOptions = reelDays.map((day, index) => `<option value="${day}" ${day === selected ? 'selected' : ''}>Día ${index + 1} · ${esc(formatDay(day, { weekday: 'short', day: 'numeric', month: 'short' }))}</option>`).join('');
  // Un dia fuera de las fechas del viaje se mantiene como opcion para no borrarlo sin avisar
  const outsideOption = selected && !reelDays.includes(selected) ? `<option value="${esc(selected)}" selected>${esc(formatDay(selected, { weekday: 'short', day: 'numeric', month: 'short' }))} (fuera del viaje)</option>` : '';
  return `
    <form class="form" data-form="save-activity" data-id="${esc(activity.id || '')}">
      <div class="form__field">
        <label class="form__label" for="actTitle">¿Qué vais a hacer?</label>
        <input class="form__input" id="actTitle" name="title" required maxlength="100" value="${esc(activity.title || '')}" placeholder="Ej. Tour por la ciudad amurallada">
      </div>
      <div class="form__row">
        <div class="form__field">
          <label class="form__label" for="actDay">Día</label>
          <select class="form__select" id="actDay" name="day">
            <option value="">Sin día</option>${outsideOption}${dayOptions}
          </select>
        </div>
        <div class="form__field">
          <label class="form__label" for="actTime">Hora</label>
          <input class="form__input" id="actTime" name="time" type="time" value="${esc(activity.time || '')}">
        </div>
      </div>
      <div class="form__field">
        <label class="form__label" for="actPlace">Lugar</label>
        <input class="form__input" id="actPlace" name="place" maxlength="160" value="${esc(activity.place || '')}" placeholder="Museo, restaurante, dirección…" data-autocomplete="place" ${ctx.trip.lat != null ? `data-near-lat="${ctx.trip.lat}" data-near-lon="${ctx.trip.lon}"` : ''}>
        <input type="hidden" name="place_lat" value="${activity.lat ?? ''}">
        <input type="hidden" name="place_lon" value="${activity.lon ?? ''}">
        <p class="form__help">Elige el sitio del menú para ubicarlo exacto en el mapa (salen primero los cercanos al destino).</p>
      </div>
      <div class="form__field">
        <label class="form__label" for="actNotes">Notas</label>
        <textarea class="form__textarea" id="actNotes" name="notes" maxlength="1000" placeholder="Reservas, precios, cómo llegar…">${esc(activity.notes || '')}</textarea>
      </div>
      <div class="form__field">
        <label class="form__label" for="actImage">Imagen del sitio</label>
        <input class="form__input" id="actImage" name="image" type="file" accept="image/*">
        <p class="form__help">También se guarda en el álbum del viaje.</p>
        ${activity.image_url ? `<figure class="form__preview">${pictureHtml(activity.image_url, { alt: 'Imagen actual', width: 220, height: 140 })}</figure>
          <label class="form__check"><input type="checkbox" name="remove_image" value="1"> Quitar la imagen</label>` : ''}
      </div>
      <div class="form__actions">
        <button class="btn" type="button" data-action="close-modal">Cancelar</button>
        <button class="btn btn--primary" type="submit">${activity.id ? 'Guardar' : 'Añadir al plan'}</button>
      </div>
    </form>`;
}

/* ---- Seleccion de dia en el carrete ---- */

function applySelection(root, day, { shouldScroll = false } = {}) {
  if (!day || !viewCtx) return;
  selectedDay = day;
  const { main, sub } = bigDate(day);
  root.querySelector('#reelDate').textContent = main;
  root.querySelector('#reelSub').textContent = sub;
  root.querySelectorAll('.day-card').forEach((card) => {
    const isActive = card.dataset.day === day;
    card.classList.toggle('day-card--active', isActive);
    card.setAttribute('aria-pressed', String(isActive));
    if (isActive && shouldScroll) card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
  const detail = root.querySelector('#dayDetail');
  detail.innerHTML = dayDetailHtml(viewCtx);
  hydrateMedia(detail);
}

function centeredDay(track) {
  const center = track.getBoundingClientRect().left + track.clientWidth / 2;
  let best = null;
  let bestDistance = Infinity;
  track.querySelectorAll('.day-card').forEach((card) => {
    const box = card.getBoundingClientRect();
    const distance = Math.abs(box.left + box.width / 2 - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = card.dataset.day;
    }
  });
  return best;
}

function initialDay() {
  const now = today();
  if (selectedTripId === viewCtx.tripId && selectedDay && (reelDays.includes(selectedDay) || selectedDay === LOOSE_KEY)) return selectedDay;
  selectedTripId = viewCtx.tripId;
  if (reelDays.includes(now)) return now;
  return reelDays[0] || LOOSE_KEY;
}

/* ---- Handlers ---- */

function selectDayHandler(button) {
  applySelection(document.getElementById('itinerary'), button.dataset.day, { shouldScroll: true });
}

function reelStepHandler(button) {
  const keys = Array.from(document.querySelectorAll('.day-card'), (card) => card.dataset.day);
  const next = keys[keys.indexOf(selectedDay) + Number(button.dataset.step)];
  if (next) applySelection(document.getElementById('itinerary'), next, { shouldScroll: true });
}

function reelKeyHandler(event) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const keys = Array.from(document.querySelectorAll('.day-card'), (card) => card.dataset.day);
  const next = keys[keys.indexOf(selectedDay) + (event.key === 'ArrowRight' ? 1 : -1)];
  if (!next) return;
  applySelection(document.getElementById('itinerary'), next, { shouldScroll: true });
  document.querySelector(`.day-card[data-day="${next}"]`)?.focus({ preventScroll: true });
}

function itineraryViewHandler(button, event, ctx) {
  localStorage.setItem(VIEW_KEY, button.dataset.mode);
  ctx.refresh();
}

function jumpDayHandler(button) {
  document.getElementById(button.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function newActivityHandler(button, event, ctx) {
  openModal('Nueva actividad', activityFormHtml(ctx, {}, button.dataset.day));
}

function editActivityHandler(button, event, ctx) {
  const activity = activities.find((item) => item.id === button.dataset.id);
  openModal('Editar actividad', activityFormHtml(ctx, activity));
}

async function saveActivityHandler(form, ctx, submitter) {
  const data = formToObject(form);
  const previous = activities.find((item) => item.id === form.dataset.id);
  const imageFile = form.elements.image.files[0];
  await withBusy(submitter, async () => {
    const patch = { title: data.title, day: data.day || null, time: data.time || null, place: data.place, notes: data.notes };
    const pickedLat = parseFloat(data.place_lat);
    const pickedLon = parseFloat(data.place_lon);
    if (data.place && Number.isFinite(pickedLat) && Number.isFinite(pickedLon)) {
      // Lugar elegido en el menu de sugerencias: coordenadas exactas
      patch.lat = pickedLat;
      patch.lon = pickedLon;
    } else if (data.place !== (previous?.place || '') || !data.place) {
      const near = ctx.trip.lat != null ? { lat: ctx.trip.lat, lon: ctx.trip.lon } : null;
      const located = data.place
        ? await geocode(near ? data.place : `${data.place}, ${ctx.trip.destination || ''}`, near).catch(() => null)
        : null;
      patch.lat = located?.lat ?? null;
      patch.lon = located?.lon ?? null;
      if (data.place && !located) toast('No encontramos el lugar en el mapa; se guarda sin ubicación.');
    }
    if (data.remove_image) Object.assign(patch, { image_url: null, image_thumb: null });
    let photoUpload = null;
    if (imageFile) {
      photoUpload = await uploadPhoto(ctx.tripId, imageFile);
      Object.assign(patch, { image_url: photoUpload.url, image_thumb: photoUpload.thumb_url });
    }
    const saved = previous
      ? await store.update('activities', previous.id, patch, { tripId: ctx.tripId, text: `editó la actividad "${data.title}"` })
      : await store.insert('activities', { ...patch, trip_id: ctx.tripId, created_by: store.user.id, created_by_name: store.user.name },
        { tripId: ctx.tripId, text: `añadió la actividad "${data.title}"` });
    if (photoUpload) {
      await store.insert('photos', {
        ...photoUpload,
        trip_id: ctx.tripId,
        activity_id: saved.id,
        day: patch.day,
        caption: data.title,
        uploaded_by: store.user.id,
        uploader_name: store.user.name
      });
    }
    if (patch.day) selectedDay = patch.day;
    closeModal();
    toast(previous ? 'Actividad actualizada' : 'Añadida al plan');
    ctx.refresh();
  });
}

async function deleteActivityHandler(button, event, ctx) {
  const activity = activities.find((item) => item.id === button.dataset.id);
  const isConfirmed = await confirmDialog(`Se quitará "${activity.title}" del itinerario. Sus fotos seguirán en el álbum.`);
  if (!isConfirmed) return;
  try {
    await store.remove('activities', activity.id, { tripId: ctx.tripId, text: `eliminó la actividad "${activity.title}"` });
    toast('Actividad eliminada');
    ctx.refresh();
  } catch (error) {
    toastError(error);
  }
}

/* ---- Historia del lugar (Wikipedia) ---- */

function paragraphsHtml(text) {
  return text.split(/\n+/).filter((line) => line.trim()).map((line) => `<p>${esc(line.trim())}</p>`).join('');
}

function historyHtml(history) {
  return `
    <article class="history">
      <header class="history__head">
        <p class="history__article">${icon('book', 16)} ${esc(history.title)}</p>
        ${history.description ? `<p class="history__description">${esc(history.description)}</p>` : ''}
      </header>
      <section class="history__block" aria-labelledby="historyFamous">
        <h3 class="history__heading" id="historyFamous">${icon('star', 16)} Por qué es famoso</h3>
        ${paragraphsHtml(history.intro)}
      </section>
      ${history.history ? `
        <section class="history__block" aria-labelledby="historyPast">
          <h3 class="history__heading" id="historyPast">${icon('clock', 16)} Su historia</h3>
          ${paragraphsHtml(history.history)}
        </section>` : ''}
      <p class="history__source">
        ${history.lang === 'en' ? 'Este lugar solo tiene artículo en inglés. ' : ''}
        Fuente: <a href="${esc(safeUrl(history.url))}" target="_blank" rel="noopener">Wikipedia, artículo completo</a> · Texto con licencia CC BY-SA 4.0.
      </p>
    </article>`;
}

function emptyHistoryHtml(activity) {
  const search = `https://es.wikipedia.org/w/index.php?search=${encodeURIComponent(activity.place || activity.title)}`;
  return `
    <div class="history">
      <p class="history__empty">No encontramos la historia de este lugar en Wikipedia. Suele pasar con restaurantes, hoteles, traslados o sitios muy nuevos.</p>
      <p class="history__source"><a href="${esc(search)}" target="_blank" rel="noopener">Buscarlo en Wikipedia</a></p>
    </div>`;
}

async function activityHistoryHandler(button) {
  const activity = activities.find((item) => item.id === button.dataset.id);
  if (!activity) return;
  openModal(activity.title, '<p class="loading">Buscando la historia de este lugar…</p>');
  let html;
  try {
    const history = await placeHistory(activity);
    html = history ? historyHtml(history) : emptyHistoryHtml(activity);
  } catch (error) {
    html = `<p class="history__empty">${esc(error.message)}</p>`;
  }
  // Si mientras se buscaba se cerro el modal o se abrio otro, no se pisa
  const modal = document.getElementById('modal');
  if (modal?.open && document.getElementById('modalTitle')?.textContent === activity.title) setModalBody(html);
}

async function activityCommentsHandler(button, event, ctx) {
  const activity = activities.find((item) => item.id === button.dataset.id);
  openModal(activity.title, `<div data-comments="activity:${esc(activity.id)}"><p class="loading">Cargando…</p></div>`);
  await renderComments(document.querySelector('#modalBody [data-comments]'), ctx.tripId);
  document.getElementById(`comment-${activity.id}`)?.focus();
}

export default {
  async render(ctx) {
    viewCtx = ctx;
    const [list, commentList] = await Promise.all([store.list('activities', ctx.tripId), store.list('comments', ctx.tripId)]);
    activities = sortActivities(list);
    comments = commentList;
    reelDays = eachDay(ctx.trip.start_date, ctx.trip.end_date);
    const keys = [...reelDays];
    if (activitiesOf(LOOSE_KEY).length || !keys.length) keys.push(LOOSE_KEY);
    selectedDay = initialDay();
    if (!keys.includes(selectedDay)) selectedDay = keys[0];
    const mode = currentMode();
    const toggle = VIEW_MODES.map((item) => `
      <button class="segmented__btn ${item.key === mode ? 'segmented__btn--active' : ''}" type="button" data-action="itinerary-view" data-mode="${item.key}" aria-pressed="${item.key === mode}">
        ${icon(item.icon, 16)} ${item.label}
      </button>`).join('');
    return `
      <div id="itinerary">
        <div class="section__head no-print">
          <h2>Itinerario</h2>
          <div class="page-head__actions">
            <div class="segmented segmented--compact" role="group" aria-label="Forma de ver los días">${toggle}</div>
            <button class="btn btn--small" type="button" data-action="print-trip">${icon('print', 16)} PDF</button>
            ${ctx.canEdit ? `<button class="btn btn--primary btn--small" type="button" data-action="new-activity" data-day="">${icon('plus', 16)} Actividad</button>` : ''}
          </div>
        </div>
        <div class="no-print">${mode === 'carrete' ? reelViewHtml(ctx, keys) : listViewHtml(ctx, keys)}</div>
        <div class="print-only">${printHtml(ctx)}</div>
      </div>`;
  },
  mount(ctx, root) {
    const track = root.querySelector('#reelTrack');
    const active = track?.querySelector('.day-card--active');
    if (active) track.scrollLeft = active.offsetLeft - (track.clientWidth - active.offsetWidth) / 2;
    const reelScrollHandler = debounce(() => {
      const day = centeredDay(track);
      if (day && day !== selectedDay) applySelection(root.querySelector('#itinerary'), day);
    }, 140);
    track?.addEventListener('scroll', reelScrollHandler, { passive: true });
    track?.addEventListener('keydown', reelKeyHandler);
    if (sessionStorage.getItem('foxtrips:print')) {
      sessionStorage.removeItem('foxtrips:print');
      setTimeout(() => window.print(), 500);
    }
  },
  actions: {
    'itinerary-view': itineraryViewHandler,
    'jump-day': jumpDayHandler,
    'select-day': selectDayHandler,
    'reel-step': reelStepHandler,
    'new-activity': newActivityHandler,
    'edit-activity': editActivityHandler,
    'delete-activity': deleteActivityHandler,
    'activity-comments': activityCommentsHandler,
    'activity-history': activityHistoryHandler
  },
  forms: { 'save-activity': saveActivityHandler }
};
