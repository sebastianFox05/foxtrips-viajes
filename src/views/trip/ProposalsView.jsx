/* Votaciones: cualquiera propone un plan, el grupo vota y un editor lo pasa al itinerario. */
import { store } from '../../lib/store/index.js';
import { eachDay, formatDay, formToObject, timeAgo } from '../../lib/utils.js';
import Icon from '../../components/Icon.jsx';
import useLoad from '../../hooks/useLoad.js';
import { useBusy, useUi } from '../../ui/UiContext.jsx';
import { useTrip } from './TripContext.jsx';

const STATUS = {
  open: { label: 'Abierta', className: '' },
  accepted: { label: 'En el plan', className: 'badge--success' },
  rejected: { label: 'Descartada', className: 'badge--danger' }
};
const ORDER = { open: 0, accepted: 1, rejected: 2 };

function ProposalForm({ trip, onSave, onCancel }) {
  const [isBusy, runBusy] = useBusy();
  const { toastError } = useUi();
  const days = eachDay(trip.start_date, trip.end_date);

  async function submitHandler(event) {
    event.preventDefault();
    const data = formToObject(event.currentTarget);
    try {
      await runBusy(() => onSave(data));
    } catch (error) {
      toastError(error);
    }
  }

  return (
    <form className="form" onSubmit={submitHandler}>
      <div className="form__field">
        <label className="form__label" htmlFor="propTitle">¿Qué propones?</label>
        <input className="form__input" id="propTitle" name="title" required maxLength={100} placeholder="Ej. Excursión a Islas del Rosario" />
      </div>
      <div className="form__field">
        <label className="form__label" htmlFor="propDay">¿Para qué día? (opcional)</label>
        <select className="form__select" id="propDay" name="day" defaultValue="">
          <option value="">Cualquier día</option>
          {days.map((day, index) => <option key={day} value={day}>Día {index + 1} · {formatDay(day, { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}
        </select>
      </div>
      <div className="form__field">
        <label className="form__label" htmlFor="propText">Detalles</label>
        <textarea className="form__textarea" id="propText" name="description" maxLength={800} placeholder="Precio, enlaces, por qué mola…" />
      </div>
      <div className="form__actions">
        <button className="btn" type="button" onClick={onCancel}>Cancelar</button>
        <button className="btn btn--primary" type="submit" disabled={isBusy}>{isBusy ? 'Guardando…' : 'Proponer'}</button>
      </div>
    </form>
  );
}

export default function ProposalsView() {
  const { trip, tripId, canEdit, isOwner, refreshKey, refresh } = useTrip();
  const { openModal, closeModal, confirm, toast, toastError } = useUi();
  const { data } = useLoad(() => Promise.all([store.list('proposals', tripId), store.list('votes', tripId)]), [tripId, refreshKey]);
  if (!data) return null;
  const [proposalList, votes] = data;
  const score = (proposalId) => votes.filter((vote) => vote.proposal_id === proposalId).reduce((total, vote) => total + vote.value, 0);
  const myVote = (proposalId) => votes.find((vote) => vote.proposal_id === proposalId && vote.user_id === store.user.id);
  const proposals = proposalList.slice().sort((first, second) => ORDER[first.status] - ORDER[second.status] || score(second.id) - score(first.id));

  function newHandler() {
    async function saveHandler(values) {
      await store.insert('proposals', {
        trip_id: tripId,
        title: values.title,
        description: values.description,
        day: values.day || null,
        status: 'open',
        author_id: store.user.id,
        author_name: store.user.name
      }, { tripId, text: `propuso "${values.title}"` });
      closeModal();
      toast('Propuesta publicada');
      refresh();
    }
    openModal('Nueva propuesta', <ProposalForm trip={trip} onSave={saveHandler} onCancel={closeModal} />);
  }

  async function voteHandler(proposalId, value) {
    const mine = myVote(proposalId);
    try {
      if (mine?.value === value) await store.remove('votes', mine.id);
      else if (mine) await store.update('votes', mine.id, { value });
      else await store.insert('votes', { trip_id: tripId, proposal_id: proposalId, user_id: store.user.id, value });
      refresh();
    } catch (error) {
      toastError(error);
    }
  }

  async function acceptHandler(proposal) {
    try {
      await store.insert('activities', {
        trip_id: tripId,
        title: proposal.title,
        notes: proposal.description,
        day: proposal.day,
        created_by: store.user.id,
        created_by_name: store.user.name
      });
      await store.update('proposals', proposal.id, { status: 'accepted' }, { tripId, text: `pasó "${proposal.title}" al itinerario` });
      toast('Añadida al itinerario');
      refresh();
    } catch (error) {
      toastError(error);
    }
  }

  async function rejectHandler(proposal) {
    await store.update('proposals', proposal.id, { status: 'rejected' }, { tripId, text: `descartó "${proposal.title}"` }).catch(toastError);
    refresh();
  }

  async function deleteHandler(proposal) {
    if (!await confirm(`Se borrará la propuesta "${proposal.title}" y sus votos.`)) return;
    await store.remove('proposals', proposal.id).catch(toastError);
    refresh();
  }

  return (
    <>
      <div className="section__head">
        <div>
          <h2>Votaciones</h2>
          <p className="section__hint">Propón planes y decidid entre todos.</p>
        </div>
        <button className="btn btn--primary btn--small" type="button" onClick={newHandler}><Icon name="plus" size={16} /> Proponer</button>
      </div>
      {proposals.length ? (
        <ul className="proposal-list">
          {proposals.map((proposal) => {
            const mine = myVote(proposal.id);
            const status = STATUS[proposal.status] || STATUS.open;
            const isOpen = proposal.status === 'open';
            const count = votes.filter((vote) => vote.proposal_id === proposal.id).length;
            return (
              <li className="proposal" key={proposal.id}>
                <div className="proposal__votes" role="group" aria-label={`Votar ${proposal.title}`}>
                  <button className={`proposal__vote ${mine?.value === 1 ? 'proposal__vote--active' : ''}`} type="button" aria-pressed={mine?.value === 1} aria-label="A favor" disabled={!isOpen} onClick={() => voteHandler(proposal.id, 1)}><Icon name="up" /></button>
                  <span className="proposal__score" aria-label="Puntuación">{score(proposal.id)}</span>
                  <button className={`proposal__vote ${mine?.value === -1 ? 'proposal__vote--active' : ''}`} type="button" aria-pressed={mine?.value === -1} aria-label="En contra" disabled={!isOpen} onClick={() => voteHandler(proposal.id, -1)}><Icon name="down" /></button>
                </div>
                <div>
                  <h3>{proposal.title} <span className={`badge ${status.className}`}>{status.label}</span></h3>
                  <p className="proposal__meta">{proposal.author_name} · {timeAgo(proposal.created_at)}{proposal.day ? ` · para el ${formatDay(proposal.day, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''} · {count} voto{count === 1 ? '' : 's'}</p>
                  {proposal.description ? <p className="proposal__text">{proposal.description}</p> : null}
                  {canEdit && isOpen ? (
                    <div className="proposal__actions">
                      <button className="btn btn--primary btn--small" type="button" onClick={() => acceptHandler(proposal)}><Icon name="check" size={16} /> Pasar al plan</button>
                      <button className="btn btn--small" type="button" onClick={() => rejectHandler(proposal)}>Descartar</button>
                    </div>
                  ) : null}
                  {proposal.author_id === store.user.id || isOwner ? (
                    <div className="proposal__actions"><button className="link-btn" type="button" onClick={() => deleteHandler(proposal)}><Icon name="trash" size={14} /> Borrar</button></div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty"><span className="empty__icon"><Icon name="vote" size={28} /></span><h3 className="empty__title">Sin propuestas</h3><p className="empty__text">¿Tienes una idea? Proponla y que el grupo vote.</p></div>
      )}
    </>
  );
}
