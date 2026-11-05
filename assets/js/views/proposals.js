/* Votaciones: cualquiera propone un plan, el grupo vota y un editor lo pasa al itinerario. */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { openModal, closeModal, confirmDialog, toast, toastError, withBusy } from '../ui.js';
import { eachDay, esc, formatDay, formToObject, timeAgo } from '../utils.js';

const STATUS = {
  open: { label: 'Abierta', className: '' },
  accepted: { label: 'En el plan', className: 'badge--success' },
  rejected: { label: 'Descartada', className: 'badge--danger' }
};

let proposals = [];
let votes = [];

function score(proposalId) {
  return votes.filter((vote) => vote.proposal_id === proposalId).reduce((total, vote) => total + vote.value, 0);
}

function myVote(proposalId) {
  return votes.find((vote) => vote.proposal_id === proposalId && vote.user_id === store.user.id);
}

function proposalHtml(proposal, ctx) {
  const mine = myVote(proposal.id);
  const status = STATUS[proposal.status] || STATUS.open;
  const isOpen = proposal.status === 'open';
  const count = votes.filter((vote) => vote.proposal_id === proposal.id).length;
  return `
    <li class="proposal">
      <div class="proposal__votes" role="group" aria-label="Votar ${esc(proposal.title)}">
        <button class="proposal__vote ${mine?.value === 1 ? 'proposal__vote--active' : ''}" type="button" data-action="vote" data-id="${esc(proposal.id)}" data-value="1" aria-pressed="${mine?.value === 1}" aria-label="A favor" ${isOpen ? '' : 'disabled'}>${icon('up')}</button>
        <span class="proposal__score" aria-label="Puntuación">${score(proposal.id)}</span>
        <button class="proposal__vote ${mine?.value === -1 ? 'proposal__vote--active' : ''}" type="button" data-action="vote" data-id="${esc(proposal.id)}" data-value="-1" aria-pressed="${mine?.value === -1}" aria-label="En contra" ${isOpen ? '' : 'disabled'}>${icon('down')}</button>
      </div>
      <div>
        <h3>${esc(proposal.title)} <span class="badge ${status.className}">${status.label}</span></h3>
        <p class="proposal__meta">${esc(proposal.author_name)} · ${esc(timeAgo(proposal.created_at))}${proposal.day ? ` · para el ${esc(formatDay(proposal.day, { weekday: 'short', day: 'numeric', month: 'short' }))}` : ''} · ${count} voto${count === 1 ? '' : 's'}</p>
        ${proposal.description ? `<p class="proposal__text">${esc(proposal.description)}</p>` : ''}
        ${ctx.canEdit && isOpen ? `
          <div class="proposal__actions">
            <button class="btn btn--primary btn--small" type="button" data-action="accept-proposal" data-id="${esc(proposal.id)}">${icon('check', 16)} Pasar al plan</button>
            <button class="btn btn--small" type="button" data-action="reject-proposal" data-id="${esc(proposal.id)}">Descartar</button>
          </div>` : ''}
        ${proposal.author_id === store.user.id || ctx.isOwner ? `<div class="proposal__actions"><button class="link-btn" type="button" data-action="delete-proposal" data-id="${esc(proposal.id)}">${icon('trash', 14)} Borrar</button></div>` : ''}
      </div>
    </li>`;
}

function formHtml(ctx) {
  const options = eachDay(ctx.trip.start_date, ctx.trip.end_date)
    .map((day, index) => `<option value="${day}">Día ${index + 1} · ${esc(formatDay(day, { weekday: 'short', day: 'numeric', month: 'short' }))}</option>`).join('');
  return `
    <form class="form" data-form="save-proposal">
      <div class="form__field">
        <label class="form__label" for="propTitle">¿Qué propones?</label>
        <input class="form__input" id="propTitle" name="title" required maxlength="100" placeholder="Ej. Excursión a Islas del Rosario">
      </div>
      <div class="form__field">
        <label class="form__label" for="propDay">¿Para qué día? (opcional)</label>
        <select class="form__select" id="propDay" name="day"><option value="">Cualquier día</option>${options}</select>
      </div>
      <div class="form__field">
        <label class="form__label" for="propText">Detalles</label>
        <textarea class="form__textarea" id="propText" name="description" maxlength="800" placeholder="Precio, enlaces, por qué mola…"></textarea>
      </div>
      <div class="form__actions">
        <button class="btn" type="button" data-action="close-modal">Cancelar</button>
        <button class="btn btn--primary" type="submit">Proponer</button>
      </div>
    </form>`;
}

/* ---- Handlers ---- */

function newProposalHandler(button, event, ctx) {
  openModal('Nueva propuesta', formHtml(ctx));
}

async function saveProposalHandler(form, ctx, submitter) {
  const data = formToObject(form);
  await withBusy(submitter, () => store.insert('proposals', {
    trip_id: ctx.tripId,
    title: data.title,
    description: data.description,
    day: data.day || null,
    status: 'open',
    author_id: store.user.id,
    author_name: store.user.name
  }, { tripId: ctx.tripId, text: `propuso "${data.title}"` }));
  closeModal();
  toast('Propuesta publicada');
  ctx.refresh();
}

async function voteHandler(button, event, ctx) {
  const value = Number(button.dataset.value);
  const proposalId = button.dataset.id;
  const mine = myVote(proposalId);
  try {
    if (mine?.value === value) await store.remove('votes', mine.id);
    else if (mine) await store.update('votes', mine.id, { value });
    else await store.insert('votes', { trip_id: ctx.tripId, proposal_id: proposalId, user_id: store.user.id, value });
    ctx.refresh();
  } catch (error) {
    toastError(error);
  }
}

async function acceptProposalHandler(button, event, ctx) {
  const proposal = proposals.find((item) => item.id === button.dataset.id);
  try {
    await store.insert('activities', {
      trip_id: ctx.tripId,
      title: proposal.title,
      notes: proposal.description,
      day: proposal.day,
      created_by: store.user.id,
      created_by_name: store.user.name
    });
    await store.update('proposals', proposal.id, { status: 'accepted' }, { tripId: ctx.tripId, text: `pasó "${proposal.title}" al itinerario` });
    toast('Añadida al itinerario');
    ctx.refresh();
  } catch (error) {
    toastError(error);
  }
}

async function rejectProposalHandler(button, event, ctx) {
  const proposal = proposals.find((item) => item.id === button.dataset.id);
  await store.update('proposals', proposal.id, { status: 'rejected' }, { tripId: ctx.tripId, text: `descartó "${proposal.title}"` }).catch(toastError);
  ctx.refresh();
}

async function deleteProposalHandler(button, event, ctx) {
  const proposal = proposals.find((item) => item.id === button.dataset.id);
  if (!await confirmDialog(`Se borrará la propuesta "${proposal.title}" y sus votos.`)) return;
  await store.remove('proposals', proposal.id).catch(toastError);
  ctx.refresh();
}

export default {
  async render(ctx) {
    [proposals, votes] = await Promise.all([store.list('proposals', ctx.tripId), store.list('votes', ctx.tripId)]);
    const order = { open: 0, accepted: 1, rejected: 2 };
    proposals.sort((first, second) => order[first.status] - order[second.status] || score(second.id) - score(first.id));
    return `
      <div class="section__head">
        <div>
          <h2>Votaciones</h2>
          <p class="section__hint">Propón planes y decidid entre todos.</p>
        </div>
        <button class="btn btn--primary btn--small" type="button" data-action="new-proposal">${icon('plus', 16)} Proponer</button>
      </div>
      ${proposals.length
        ? `<ul class="proposal-list">${proposals.map((proposal) => proposalHtml(proposal, ctx)).join('')}</ul>`
        : `<div class="empty"><span class="empty__icon">${icon('vote', 28)}</span><h3 class="empty__title">Sin propuestas</h3><p class="empty__text">¿Tienes una idea? Proponla y que el grupo vote.</p></div>`}`;
  },
  actions: {
    'new-proposal': newProposalHandler,
    vote: voteHandler,
    'accept-proposal': acceptProposalHandler,
    'reject-proposal': rejectProposalHandler,
    'delete-proposal': deleteProposalHandler
  },
  forms: { 'save-proposal': saveProposalHandler }
};
