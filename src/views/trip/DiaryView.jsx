/* Diario: una entrada compartida por dia y un "resumen final" que junta diario, planes y fotos. */
import { useMemo, useState } from 'react';
import { store } from '../../lib/store/index.js';
import { eachDay, formatDay, formToObject, sortActivities, timeAgo } from '../../lib/utils.js';
import { formatTime } from '../../lib/locale.js';
import Icon from '../../components/Icon.jsx';
import Picture from '../../components/Picture.jsx';
import useLoad from '../../hooks/useLoad.js';
import { useBusy, useUi } from '../../ui/UiContext.jsx';
import { useTrip } from './TripContext.jsx';
import { t, tn } from '../../lib/i18n/index.js';

// La vista elegida (diario o resumen) se recuerda al volver
let rememberedStory = false;

function DiaryForm({ entry, onSave, onCancel }) {
  const [isBusy, runBusy] = useBusy();
  const { toastError } = useUi();

  async function submitHandler(event) {
    event.preventDefault();
    const { body } = formToObject(event.currentTarget);
    try {
      await runBusy(() => onSave(body));
    } catch (error) {
      toastError(error);
    }
  }

  return (
    <form className="form" onSubmit={submitHandler}>
      <div className="form__field">
        <label className="form__label" htmlFor="diaryBody">{t('¿Qué tal fue el día?')}</label>
        <textarea className="form__textarea form__textarea--tall" id="diaryBody" name="body" rows={10} maxLength={5000} placeholder={t('Lo mejor, lo peor, anécdotas…')} defaultValue={entry?.body || ''} />
        <p className="form__help">{t('El diario es compartido: cualquier editor puede completarlo.')}</p>
      </div>
      <div className="form__actions">
        <button className="btn" type="button" onClick={onCancel}>{t('Cancelar')}</button>
        <button className="btn btn--primary" type="submit" disabled={isBusy}>{isBusy ? t('Guardando…') : t('Guardar')}</button>
      </div>
    </form>
  );
}

function Story({ trip, days, entryFor, activities, photos }) {
  const sections = days.map((day, index) => {
    const entry = entryFor(day);
    const dayActivities = activities.filter((activity) => activity.day === day);
    const dayPhotos = photos.filter((photo) => photo.day === day).slice(0, 8);
    if (!entry?.body && !dayActivities.length && !dayPhotos.length) return null;
    return (
      <section className="story__day" key={day}>
        <h3 className="story__title">{t('Día {n}', { n: index + 1 })} · <span className="diary__date">{formatDay(day)}</span></h3>
        {entry?.body ? <p className="diary__text">{entry.body}</p> : null}
        {dayActivities.length ? <ul className="story__list">{dayActivities.map((activity) => <li key={activity.id}>{activity.time ? `${formatTime(activity.time)} · ` : ''}{activity.title}</li>)}</ul> : null}
        {dayPhotos.length ? (
          <ul className="story__photos">
            {dayPhotos.map((photo) => <li key={photo.id}><figure className="story__photo"><Picture url={photo.thumb_url || photo.url} alt={photo.caption || t('Foto del día {n}', { n: index + 1 })} width={300} height={300} /></figure></li>)}
          </ul>
        ) : null}
      </section>
    );
  }).filter(Boolean);
  return (
    <article>
      <header className="story__cover photo-card photo-card--tall">
        {trip.cover_url ? <Picture url={trip.cover_url} className="photo-card__media" width={1200} height={700} /> : null}
        <div className="photo-card__overlay">
          <p className="photo-card__kicker">{t('El resumen del viaje')}</p>
          <h3 className="photo-card__title photo-card__title--xl">{trip.name}</h3>
          <p className="photo-card__place">{tn(days.length, '{n} día', '{n} días')} · {tn(activities.length, '{n} plan', '{n} planes')} · {tn(photos.length, '{n} foto', '{n} fotos')}</p>
        </div>
      </header>
      {sections.length ? sections : <p className="empty">{t('Cuando escribáis el diario y subáis fotos, aquí aparecerá la historia del viaje.')}</p>}
    </article>
  );
}

export default function DiaryView() {
  const { trip, tripId, canEdit, refreshKey, refresh } = useTrip();
  const { openModal, closeModal, toast } = useUi();
  const [isStory, setIsStory] = useState(rememberedStory);
  const days = useMemo(() => eachDay(trip.start_date, trip.end_date), [trip.start_date, trip.end_date]);
  const { data } = useLoad(() => Promise.all([
    store.list('diary_entries', tripId),
    isStory ? store.list('activities', tripId) : [],
    isStory ? store.list('photos', tripId) : []
  ]), [tripId, refreshKey, isStory]);
  rememberedStory = isStory;
  if (!data) return null;
  const [entries, activities, photos] = data;
  const entryFor = (day) => entries.find((entry) => entry.day === day);

  function editHandler(day) {
    const entry = entryFor(day);
    async function saveHandler(body) {
      const log = { tripId, text: t('escribió en el diario del {day}', { day: formatDay(day, { day: 'numeric', month: 'short' }) }) };
      if (entry) await store.update('diary_entries', entry.id, { body, author_id: store.user.id, author_name: store.user.name }, log);
      else await store.insert('diary_entries', { trip_id: tripId, day, body, author_id: store.user.id, author_name: store.user.name }, log);
      closeModal();
      toast(t('Diario guardado'));
      refresh();
    }
    openModal(`${t('Diario')} · ${formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}`, <DiaryForm entry={entry} onSave={saveHandler} onCancel={closeModal} />);
  }

  let content;
  if (isStory) content = <Story trip={trip} days={days} entryFor={entryFor} activities={sortActivities(activities)} photos={photos} />;
  else if (!days.length) content = <p className="empty">{t('Añade las fechas del viaje (botón de editar, arriba) para escribir el diario día a día.')}</p>;
  else {
    content = (
      <div className="diary">
        {days.map((day, index) => {
          const entry = entryFor(day);
          return (
            <article className="diary__entry" key={day}>
              <header className="diary__head">
                <div>
                  <h3>{t('Día {n}', { n: index + 1 })}</h3>
                  <p className="diary__date">{formatDay(day)}</p>
                </div>
                {canEdit ? <button className="btn btn--small" type="button" onClick={() => editHandler(day)}><Icon name="edit" size={16} /> {entry ? t('Editar') : t('Escribir')}</button> : null}
              </header>
              {entry?.body ? (
                <>
                  <p className="diary__text">{entry.body}</p>
                  <p className="row__meta row__meta--top">{t('Última edición de {name}', { name: entry.author_name })} · {timeAgo(entry.updated_at || entry.created_at)}</p>
                </>
              ) : <p className="diary__text diary__text--empty">{t('Todavía no hay nada escrito para este día.')}</p>}
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div className="section__head">
        <h2>{isStory ? t('Resumen final') : t('Diario del viaje')}</h2>
        <div className="segmented segmented--compact" role="group" aria-label={t('Vista del diario')}>
          <button className={`segmented__btn ${isStory ? '' : 'segmented__btn--active'}`} type="button" aria-pressed={!isStory} onClick={() => setIsStory(false)}><Icon name="book" size={16} /> {t('Diario')}</button>
          <button className={`segmented__btn ${isStory ? 'segmented__btn--active' : ''}`} type="button" aria-pressed={isStory} onClick={() => setIsStory(true)}><Icon name="star" size={16} /> {t('Resumen')}</button>
        </div>
      </div>
      {content}
    </>
  );
}
