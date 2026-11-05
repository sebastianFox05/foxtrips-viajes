/* Pagina publica de solo lectura: itinerario y album, sin cuenta. */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { pictureHtml } from '../media.js';
import { openLightbox } from '../lightbox.js';
import { eachDay, esc, formatDay, formatRange, sortActivities } from '../utils.js';

let photos = [];

function openPublicPhotoHandler(button) {
  openLightbox(photos, Number(button.dataset.index), { hasComments: false });
}

export default {
  async render(ctx) {
    const data = await store.getPublicTrip(ctx.params.token).catch(() => null);
    if (!data?.trip) {
      return '<div class="empty"><h1 class="empty__title">Este enlace ya no está disponible</h1><p class="empty__text">Puede que el organizador haya desactivado la página pública.</p></div>';
    }
    const { trip } = data;
    const activities = sortActivities(data.activities || []);
    photos = data.photos || [];
    const days = eachDay(trip.start_date, trip.end_date);
    // Las actividades sin dia (o fuera de las fechas) se muestran al final como "Ideas sueltas"
    const loose = activities.filter((activity) => !activity.day || !days.includes(activity.day));
    const groups = days.map((day, index) => ({ day, index })).concat(loose.length ? [{ day: null, index: days.length }] : []);
    return `
      <header class="hero hero--tall">
        ${trip.cover_url ? pictureHtml(trip.cover_url, { alt: '', className: 'hero__media', isLazy: false, width: 1600, height: 900 }) : ''}
        <div class="hero__content">
          <p class="hero__kicker">${esc(formatRange(trip.start_date, trip.end_date))}</p>
          <h1 class="hero__title">${esc(trip.name)}</h1>
          ${trip.destination ? `<p class="hero__place">${icon('pin', 16)} ${esc(trip.destination)}</p>` : ''}
          ${trip.description ? `<div class="glass"><p class="glass__text">${esc(trip.description)}</p></div>` : ''}
        </div>
      </header>
      <p class="public-note badge">${icon('eye', 14)} Página de solo lectura</p>
      <section class="section" aria-labelledby="publicPlan">
        <h2 id="publicPlan" class="card__title">Itinerario</h2>
        ${groups.map(({ day, index }) => {
          const list = day ? activities.filter((activity) => activity.day === day) : loose;
          return `
            <section class="day">
              <header class="day__header"><div><span class="day__label">${day ? `Día ${index + 1}` : 'Sin día asignado'}</span><h3 class="day__date">${day ? esc(formatDay(day)) : 'Ideas sueltas'}</h3></div></header>
              ${list.length ? `<ul class="day__list">${list.map((activity) => `
                <li><article class="activity">
                  ${activity.image_url ? `<figure class="activity__media">${pictureHtml(activity.image_url, { alt: `Foto de ${activity.title}`, width: 800, height: 500 })}</figure>` : ''}
                  <div class="activity__body">
                    <span class="activity__time">${esc(activity.time || '—')}</span>
                    <div class="activity__info">
                      <h4 class="activity__title">${esc(activity.title)}</h4>
                      ${activity.place ? `<p class="activity__place">${icon('pin', 14)} ${esc(activity.place)}</p>` : ''}
                      ${activity.notes ? `<p class="activity__notes">${esc(activity.notes)}</p>` : ''}
                    </div>
                  </div>
                </article></li>`).join('')}</ul>` : '<p class="day__empty">Día libre</p>'}
            </section>`;
        }).join('')}
      </section>
      ${photos.length ? `
      <section class="section" aria-labelledby="publicAlbum">
        <h2 id="publicAlbum" class="card__title">Álbum</h2>
        <ul class="album">${photos.map((photo, index) => `
          <li class="album__item ${index % 5 === 0 || index % 5 === 3 ? 'album__item--tall' : ''}">
            <button class="album__button" type="button" data-action="open-public-photo" data-index="${index}" aria-label="Ver foto ${index + 1}">
              ${pictureHtml(photo.thumb_url || photo.url, { alt: photo.caption || `Foto ${index + 1}`, width: 480, height: 480 })}
              ${photo.caption ? `<span class="album__caption">${esc(photo.caption)}</span>` : ''}
            </button>
          </li>`).join('')}</ul>
      </section>` : ''}`;
  },
  actions: { 'open-public-photo': openPublicPhotoHandler }
};
