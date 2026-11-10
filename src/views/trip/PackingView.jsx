/* Equipaje: lista compartida (con responsable) y lista personal (solo la ve su dueño). */
import { useState } from 'react';
import { store } from '../../lib/store/index.js';
import Icon from '../../components/Icon.jsx';
import useLoad from '../../hooks/useLoad.js';
import { useUi } from '../../ui/UiContext.jsx';
import { useTrip } from './TripContext.jsx';
import { m, t } from '../../lib/i18n/index.js';

const SUGGESTIONS = [m('Pasaporte'), m('Cargador'), m('Protector solar'), m('Botiquín'), m('Adaptador de enchufe'), m('Ropa de baño'), m('Gafas de sol'), m('Seguro de viaje')];

function PackingList({ list, isShared, members, canEdit, onChanged }) {
  const { toastError } = useUi();
  if (!list.length) return <p className="card__text">{isShared ? t('Nada en la lista común todavía.') : t('Tu lista personal está vacía.')}</p>;
  const done = list.filter((item) => item.is_done).length;
  const percent = Math.round((done / list.length) * 100);

  async function change(task) {
    await task().catch(toastError);
    onChanged();
  }

  return (
    <>
      <p className="section__hint">{t('{done} de {total} listos', { done, total: list.length })}</p>
      <div className="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent} aria-label={t('Progreso')}><div className="meter__bar" style={{ width: `${percent}%` }} /></div>
      <ul className="checklist">
        {list.map((item) => (
          <li className={`checklist__item ${item.is_done ? 'checklist__item--done' : ''}`} key={item.id}>
            <label className="checklist__label">
              <input
                className="checklist__check"
                type="checkbox"
                checked={Boolean(item.is_done)}
                disabled={isShared && !canEdit}
                onChange={(event) => change(() => store.update('checklist_items', item.id, { is_done: event.target.checked }))}
              />
              <span className="checklist__text">{item.text}</span>
            </label>
            {isShared ? (
              <>
                <label className="visually-hidden" htmlFor={`assignee-${item.id}`}>{t('Quién lleva {item}', { item: item.text })}</label>
                <select
                  className="form__select form__select--compact"
                  id={`assignee-${item.id}`}
                  value={item.assignee_name || ''}
                  disabled={!canEdit}
                  onChange={(event) => change(() => store.update('checklist_items', item.id, { assignee_name: event.target.value || null }))}
                >
                  <option value="">{t('¿Quién lo lleva?')}</option>
                  {members.map((member) => <option key={member.user_id} value={member.name}>{member.name}</option>)}
                  {item.assignee_name && !members.some((member) => member.name === item.assignee_name) ? <option value={item.assignee_name}>{item.assignee_name}</option> : null}
                </select>
              </>
            ) : null}
            {!isShared || canEdit ? (
              <button className="btn btn--ghost btn--small btn--icon" type="button" aria-label={t('Quitar {item}', { item: item.text })} onClick={() => change(() => store.remove('checklist_items', item.id))}><Icon name="trash" size={16} /></button>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function AddForm({ isShared, tripId, onAdded }) {
  const { toastError } = useUi();
  const [text, setText] = useState('');
  const id = isShared ? 'sharedItem' : 'personalItem';

  async function submitHandler(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    try {
      await store.insert('checklist_items', {
        trip_id: tripId,
        text: value,
        is_shared: isShared,
        is_done: false,
        owner_id: store.user.id,
        assignee_name: null
      }, isShared ? { tripId, text: t('añadió "{item}" al equipaje común', { item: value }) } : undefined);
      setText('');
      onAdded();
      document.getElementById(id)?.focus();
    } catch (error) {
      toastError(error);
    }
  }

  return (
    <form className="form__inline form__inline--top" onSubmit={submitHandler}>
      <label className="visually-hidden" htmlFor={id}>{isShared ? t('Añadir a la lista común') : t('Añadir a la lista personal')}</label>
      <input className="form__input" id={id} name="text" required maxLength={80} placeholder={t('Añadir cosa…')} list="packingSuggestions" autoComplete="off" value={text} onChange={(event) => setText(event.target.value)} />
      <button className="btn btn--primary btn--icon" type="submit" aria-label={t('Añadir')}><Icon name="plus" /></button>
    </form>
  );
}

export default function PackingView() {
  const { tripId, members, canEdit, refreshKey, refresh } = useTrip();
  const { data } = useLoad(() => store.list('checklist_items', tripId), [tripId, refreshKey]);
  if (!data) return null;
  const shared = data.filter((item) => item.is_shared);
  const personal = data.filter((item) => !item.is_shared && item.owner_id === store.user.id);
  return (
    <>
      <div className="section__head">
        <div>
          <h2>{t('Equipaje')}</h2>
          <p className="section__hint">{t('Lo común se reparte; lo personal solo lo ves tú.')}</p>
        </div>
      </div>
      <datalist id="packingSuggestions">{SUGGESTIONS.map((text) => <option key={text} value={t(text)} />)}</datalist>
      <div className="grid grid--2">
        <section className="card" aria-labelledby="sharedTitle">
          <h3 className="card__title" id="sharedTitle"><Icon name="users" size={18} /> {t('Para el grupo')}</h3>
          <PackingList list={shared} isShared members={members} canEdit={canEdit} onChanged={refresh} />
          {canEdit ? <AddForm isShared tripId={tripId} onAdded={refresh} /> : null}
        </section>
        <section className="card" aria-labelledby="personalTitle">
          <h3 className="card__title" id="personalTitle"><Icon name="bag" size={18} /> {t('Mi maleta')}</h3>
          <PackingList list={personal} isShared={false} members={members} canEdit={canEdit} onChanged={refresh} />
          <AddForm isShared={false} tripId={tripId} onAdded={refresh} />
        </section>
      </div>
    </>
  );
}
