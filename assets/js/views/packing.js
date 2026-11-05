/* Equipaje: lista compartida (con responsable) y lista personal (solo la ve su dueño). */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { toastError } from '../ui.js';
import { esc, formToObject } from '../utils.js';

const SUGGESTIONS = ['Pasaporte', 'Cargador', 'Protector solar', 'Botiquín', 'Adaptador de enchufe', 'Ropa de baño', 'Gafas de sol', 'Seguro de viaje'];

let items = [];

function listHtml(list, { isShared, members, ctx }) {
  if (!list.length) return `<p class="card__text">${isShared ? 'Nada en la lista común todavía.' : 'Tu lista personal está vacía.'}</p>`;
  const done = list.filter((item) => item.is_done).length;
  const percent = Math.round((done / list.length) * 100);
  return `
    <p class="section__hint">${done} de ${list.length} listos</p>
    <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="Progreso"><div class="meter__bar" style="width:${percent}%"></div></div>
    <ul class="checklist">${list.map((item) => `
      <li class="checklist__item ${item.is_done ? 'checklist__item--done' : ''}">
        <label class="checklist__label">
          <input class="checklist__check" type="checkbox" data-input="toggle-item" data-id="${esc(item.id)}" ${item.is_done ? 'checked' : ''} ${isShared && !ctx.canEdit ? 'disabled' : ''}>
          <span class="checklist__text">${esc(item.text)}</span>
        </label>
        ${isShared ? `
          <label class="visually-hidden" for="assignee-${esc(item.id)}">Quién lleva ${esc(item.text)}</label>
          <select class="form__select form__select--compact" id="assignee-${esc(item.id)}" data-input="assign-item" data-id="${esc(item.id)}" ${ctx.canEdit ? '' : 'disabled'}>
            <option value="">¿Quién lo lleva?</option>
            ${members.map((member) => `<option ${member.name === item.assignee_name ? 'selected' : ''}>${esc(member.name)}</option>`).join('')}
          </select>` : ''}
        ${!isShared || ctx.canEdit ? `<button class="btn btn--ghost btn--small btn--icon" type="button" data-action="delete-item" data-id="${esc(item.id)}" aria-label="Quitar ${esc(item.text)}">${icon('trash', 16)}</button>` : ''}
      </li>`).join('')}</ul>`;
}

function addFormHtml(isShared) {
  const id = isShared ? 'sharedItem' : 'personalItem';
  return `
    <form class="form__inline form__inline--top" data-form="add-item" data-shared="${isShared}">
      <label class="visually-hidden" for="${id}">Añadir a la lista ${isShared ? 'común' : 'personal'}</label>
      <input class="form__input" id="${id}" name="text" required maxlength="80" placeholder="Añadir cosa…" list="packingSuggestions" autocomplete="off">
      <button class="btn btn--primary btn--icon" type="submit" aria-label="Añadir">${icon('plus')}</button>
    </form>`;
}

/* ---- Handlers ---- */

async function addItemHandler(form, ctx) {
  const { text } = formToObject(form);
  const isShared = form.dataset.shared === 'true';
  await store.insert('checklist_items', {
    trip_id: ctx.tripId,
    text,
    is_shared: isShared,
    is_done: false,
    owner_id: store.user.id,
    assignee_name: null
  }, isShared ? { tripId: ctx.tripId, text: `añadió "${text}" al equipaje común` } : undefined);
  await ctx.refresh();
  document.getElementById(isShared ? 'sharedItem' : 'personalItem')?.focus();
}

async function toggleItemHandler(input, ctx) {
  await store.update('checklist_items', input.dataset.id, { is_done: input.checked }).catch(toastError);
  ctx.refresh();
}

async function assignItemHandler(select, ctx) {
  await store.update('checklist_items', select.dataset.id, { assignee_name: select.value || null }).catch(toastError);
  ctx.refresh();
}

async function deleteItemHandler(button, event, ctx) {
  await store.remove('checklist_items', button.dataset.id).catch(toastError);
  ctx.refresh();
}

export default {
  async render(ctx) {
    items = await store.list('checklist_items', ctx.tripId);
    const shared = items.filter((item) => item.is_shared);
    const personal = items.filter((item) => !item.is_shared && item.owner_id === store.user.id);
    return `
      <div class="section__head">
        <div>
          <h2>Equipaje</h2>
          <p class="section__hint">Lo común se reparte; lo personal solo lo ves tú.</p>
        </div>
      </div>
      <datalist id="packingSuggestions">${SUGGESTIONS.map((text) => `<option value="${esc(text)}">`).join('')}</datalist>
      <div class="grid grid--2">
        <section class="card" aria-labelledby="sharedTitle">
          <h3 class="card__title" id="sharedTitle">${icon('users', 18)} Para el grupo</h3>
          ${listHtml(shared, { isShared: true, members: ctx.members, ctx })}
          ${ctx.canEdit ? addFormHtml(true) : ''}
        </section>
        <section class="card" aria-labelledby="personalTitle">
          <h3 class="card__title" id="personalTitle">${icon('bag', 18)} Mi maleta</h3>
          ${listHtml(personal, { isShared: false, members: ctx.members, ctx })}
          ${addFormHtml(false)}
        </section>
      </div>`;
  },
  actions: { 'delete-item': deleteItemHandler },
  inputs: { 'toggle-item': toggleItemHandler, 'assign-item': assignItemHandler },
  forms: { 'add-item': addItemHandler }
};
