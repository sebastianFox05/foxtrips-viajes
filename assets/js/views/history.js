/* Historial de cambios del viaje: quien hizo que y cuando. */
import { store } from '../store/index.js';
import { avatarHtml, esc, formatDateTime, timeAgo } from '../utils.js';

const MAX_ITEMS = 150;

export default {
  async render(ctx) {
    const log = (await store.list('activity_log', ctx.tripId))
      .sort((first, second) => second.created_at.localeCompare(first.created_at))
      .slice(0, MAX_ITEMS);
    return `
      <div class="section__head"><h2>Historial</h2><span class="section__hint">Últimos ${log.length} cambios</span></div>
      <section class="card">
        ${log.length ? `<ol class="timeline">${log.map((entry) => `
          <li class="timeline__item">
            ${avatarHtml(entry.actor_name)}
            <div class="timeline__body">
              <p><strong>${esc(entry.actor_name || 'Alguien')}</strong> ${esc(entry.text)}</p>
              <time class="timeline__time" datetime="${esc(entry.created_at)}" title="${esc(formatDateTime(entry.created_at))}">${esc(timeAgo(entry.created_at))}</time>
            </div>
          </li>`).join('')}</ol>` : '<p class="card__text">Todavía no hay cambios.</p>'}
      </section>`;
  }
};
