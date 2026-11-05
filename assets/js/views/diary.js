/* Diario: una entrada compartida por dia y un "resumen final" que junta diario, planes y fotos. */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { pictureHtml } from '../media.js';
import { openModal, closeModal, toast, withBusy } from '../ui.js';
import { eachDay, esc, formatDay, formToObject, sortActivities, timeAgo } from '../utils.js';

let entries = [];
let isStory = false;

function entryFor(day) {
  return entries.find((entry) => entry.day === day);
}

function diaryListHtml(ctx, days) {
  if (!days.length) return '<p class="empty">Añade las fechas del viaje (botón de editar, arriba) para escribir el diario día a día.</p>';
  return `<div class="diary">${days.map((day, index) => {
    const entry = entryFor(day);
    return `
      <article class="diary__entry">
        <header class="diary__head">
          <div>
            <h3>Día ${index + 1}</h3>
            <p class="diary__date">${esc(formatDay(day))}</p>
          </div>
          ${ctx.canEdit ? `<button class="btn btn--small" type="button" data-action="edit-diary" data-day="${day}">${icon('edit', 16)} ${entry ? 'Editar' : 'Escribir'}</button>` : ''}
        </header>
        ${entry?.body
          ? `<p class="diary__text">${esc(entry.body)}</p><p class="row__meta row__meta--top">Última edición de ${esc(entry.author_name)} · ${esc(timeAgo(entry.updated_at || entry.created_at))}</p>`
          : '<p class="diary__text diary__text--empty">Todavía no hay nada escrito para este día.</p>'}
      </article>`;
  }).join('')}</div>`;
}

function storyHtml(ctx, days, activities, photos) {
  return `
    <article>
      <header class="story__cover photo-card photo-card--tall">
        ${ctx.trip.cover_url ? pictureHtml(ctx.trip.cover_url, { alt: '', className: 'photo-card__media', width: 1200, height: 700 }) : ''}
        <div class="photo-card__overlay">
          <p class="photo-card__kicker">El resumen del viaje</p>
          <h3 class="photo-card__title photo-card__title--xl">${esc(ctx.trip.name)}</h3>
          <p class="photo-card__place">${days.length} días · ${activities.length} planes · ${photos.length} fotos</p>
        </div>
      </header>
      ${days.map((day, index) => {
        const entry = entryFor(day);
        const dayActivities = activities.filter((activity) => activity.day === day);
        const dayPhotos = photos.filter((photo) => photo.day === day).slice(0, 8);
        if (!entry?.body && !dayActivities.length && !dayPhotos.length) return '';
        return `
          <section class="story__day">
            <h3 class="story__title">Día ${index + 1} · <span class="diary__date">${esc(formatDay(day))}</span></h3>
            ${entry?.body ? `<p class="diary__text">${esc(entry.body)}</p>` : ''}
            ${dayActivities.length ? `<ul class="story__list">${dayActivities.map((activity) => `<li>${activity.time ? `${esc(activity.time)} · ` : ''}${esc(activity.title)}</li>`).join('')}</ul>` : ''}
            ${dayPhotos.length ? `<ul class="story__photos">${dayPhotos.map((photo) => `<li><figure class="story__photo">${pictureHtml(photo.thumb_url || photo.url, { alt: photo.caption || `Foto del día ${index + 1}`, width: 300, height: 300 })}</figure></li>`).join('')}</ul>` : ''}
          </section>`;
      }).join('') || '<p class="empty">Cuando escribáis el diario y subáis fotos, aquí aparecerá la historia del viaje.</p>'}
    </article>`;
}

/* ---- Handlers ---- */

function diaryModeHandler(button, event, ctx) {
  isStory = button.dataset.mode === 'story';
  ctx.refresh();
}

function editDiaryHandler(button, event, ctx) {
  const day = button.dataset.day;
  const entry = entryFor(day);
  openModal(`Diario · ${formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}`, `
    <form class="form" data-form="save-diary" data-day="${day}">
      <div class="form__field">
        <label class="form__label" for="diaryBody">¿Qué tal fue el día?</label>
        <textarea class="form__textarea form__textarea--tall" id="diaryBody" name="body" rows="10" maxlength="5000" placeholder="Lo mejor, lo peor, anécdotas…">${esc(entry?.body || '')}</textarea>
        <p class="form__help">El diario es compartido: cualquier editor puede completarlo.</p>
      </div>
      <div class="form__actions">
        <button class="btn" type="button" data-action="close-modal">Cancelar</button>
        <button class="btn btn--primary" type="submit">Guardar</button>
      </div>
    </form>`);
}

async function saveDiaryHandler(form, ctx, submitter) {
  const { body } = formToObject(form);
  const day = form.dataset.day;
  const entry = entryFor(day);
  const log = { tripId: ctx.tripId, text: `escribió en el diario del ${formatDay(day, { day: 'numeric', month: 'short' })}` };
  await withBusy(submitter, () => entry
    ? store.update('diary_entries', entry.id, { body, author_id: store.user.id, author_name: store.user.name }, log)
    : store.insert('diary_entries', { trip_id: ctx.tripId, day, body, author_id: store.user.id, author_name: store.user.name }, log));
  closeModal();
  toast('Diario guardado');
  ctx.refresh();
}

export default {
  async render(ctx) {
    const days = eachDay(ctx.trip.start_date, ctx.trip.end_date);
    const [diary, activities, photos] = await Promise.all([
      store.list('diary_entries', ctx.tripId),
      isStory ? store.list('activities', ctx.tripId) : [],
      isStory ? store.list('photos', ctx.tripId) : []
    ]);
    entries = diary;
    return `
      <div class="section__head">
        <h2>${isStory ? 'Resumen final' : 'Diario del viaje'}</h2>
        <div class="segmented segmented--compact" role="group" aria-label="Vista del diario">
          <button class="segmented__btn ${isStory ? '' : 'segmented__btn--active'}" type="button" data-action="diary-mode" data-mode="diary" aria-pressed="${!isStory}">${icon('book', 16)} Diario</button>
          <button class="segmented__btn ${isStory ? 'segmented__btn--active' : ''}" type="button" data-action="diary-mode" data-mode="story" aria-pressed="${isStory}">${icon('star', 16)} Resumen</button>
        </div>
      </div>
      ${isStory ? storyHtml(ctx, days, sortActivities(activities), photos) : diaryListHtml(ctx, days)}`;
  },
  actions: {
    'diary-mode': diaryModeHandler,
    'edit-diary': editDiaryHandler
  },
  forms: { 'save-diary': saveDiaryHandler }
};
