/*
 * Itinerario en dos versiones: "Carrete" (tarjetas poster por dia, la del centro muestra sus planes)
 * y "Lista" (todos los dias seguidos). Incluye el formulario de plan, comentarios, la historia del lugar y el PDF.
 * La imagen del sitio de cada actividad tambien se guarda en el album.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { store } from '../../lib/store/index.js';
import { uploadPhoto } from '../../lib/media.js';
import { geocode } from '../../lib/services.js';
import { placeHistory } from '../../lib/place-history.js';
import { debounce, eachDay, formatDay, formToObject, parseDay, safeUrl, sortActivities, today } from '../../lib/utils.js';
import Icon from '../../components/Icon.jsx';
import Picture from '../../components/Picture.jsx';
import Scroller from '../../components/Scroller.jsx';
import SuggestInput from '../../components/SuggestInput.jsx';
import Comments, { countFor } from '../../components/Comments.jsx';
import useLoad from '../../hooks/useLoad.js';
import { useBusy, useUi } from '../../ui/UiContext.jsx';
import { useTrip } from './TripContext.jsx';
import { PRINT_FLAG } from './TripLayout.jsx';

const LOOSE_KEY = 'sin-dia';
const VIEW_KEY = 'foxtrips:itinerary-view';
const VIEW_MODES = [
  { key: 'carrete', label: 'Carrete', icon: 'image' },
  { key: 'lista', label: 'Lista', icon: 'calendar' }
];
const CARD_HUES = [24, 200, 330, 150, 265, 45, 185];

// El dia elegido se recuerda al cambiar de pestaña dentro del mismo viaje
let rememberedDay = null;
let rememberedTripId = null;

function currentMode() {
  const saved = localStorage.getItem(VIEW_KEY);
  return VIEW_MODES.some((mode) => mode.key === saved) ? saved : 'carrete';
}

function bigDate(day) {
  if (day === LOOSE_KEY) return { main: 'IDEAS', sub: 'Planes sin día asignado' };
  const date = parseDay(day);
  const month = date.toLocaleDateString('es', { month: 'short' }).replace('.', '').toUpperCase();
  return { main: `${date.getDate()} ${month}`, sub: formatDay(day, { weekday: 'long' }) };
}

/* ---- Historia del lugar (Wikipedia) ---- */

function Paragraphs({ text }) {
  return text.split(/\n+/).filter((line) => line.trim()).map((line, index) => <p key={index}>{line.trim()}</p>);
}

function HistoryContent({ activity }) {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let isCurrent = true;
    placeHistory(activity)
      .then((history) => isCurrent && setState({ status: history ? 'found' : 'empty', history }))
      .catch((error) => isCurrent && setState({ status: 'error', message: error.message }));
    return () => {
      isCurrent = false;
    };
  }, [activity]);

  if (state.status === 'loading') return <p className="loading">Buscando la historia de este lugar…</p>;
  if (state.status === 'error') return <p className="history__empty">{state.message}</p>;
  if (state.status === 'empty') {
    const search = `https://es.wikipedia.org/w/index.php?search=${encodeURIComponent(activity.place || activity.title)}`;
    return (
      <div className="history">
        <p className="history__empty">No encontramos la historia de este lugar en Wikipedia. Suele pasar con restaurantes, hoteles, traslados o sitios muy nuevos.</p>
        <p className="history__source"><a href={search} target="_blank" rel="noopener noreferrer">Buscarlo en Wikipedia</a></p>
      </div>
    );
  }
  const { history } = state;
  return (
    <article className="history">
      <header className="history__head">
        <p className="history__article"><Icon name="book" size={16} /> {history.title}</p>
        {history.description ? <p className="history__description">{history.description}</p> : null}
      </header>
      <section className="history__block" aria-labelledby="historyFamous">
        <h3 className="history__heading" id="historyFamous"><Icon name="star" size={16} /> Por qué es famoso</h3>
        <Paragraphs text={history.intro} />
      </section>
      {history.history ? (
        <section className="history__block" aria-labelledby="historyPast">
          <h3 className="history__heading" id="historyPast"><Icon name="clock" size={16} /> Su historia</h3>
          <Paragraphs text={history.history} />
        </section>
      ) : null}
      <p className="history__source">
        {history.lang === 'en' ? 'Este lugar solo tiene artículo en inglés. ' : ''}
        Fuente: <a href={safeUrl(history.url)} target="_blank" rel="noopener noreferrer">Wikipedia, artículo completo</a> · Texto con licencia CC BY-SA 4.0.
      </p>
    </article>
  );
}

/* ---- Formulario de actividad ---- */

function ActivityForm({ trip, tripId, reelDays, activity = {}, presetDay = '', onSaved, onCancel }) {
  const { toast, toastError } = useUi();
  const [isBusy, runBusy] = useBusy();
  const selected = activity.day ?? presetDay;
  const isOutside = selected && !reelDays.includes(selected);

  async function submitHandler(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formToObject(form);
    const imageFile = form.elements.image.files[0];
    try {
      await runBusy(async () => {
        const patch = { title: data.title, day: data.day || null, time: data.time || null, place: data.place, notes: data.notes };
        const pickedLat = parseFloat(data.place_lat);
        const pickedLon = parseFloat(data.place_lon);
        if (data.place && Number.isFinite(pickedLat) && Number.isFinite(pickedLon)) {
          // Lugar elegido en el menu de sugerencias: coordenadas exactas
          patch.lat = pickedLat;
          patch.lon = pickedLon;
        } else if (data.place !== (activity.place || '') || !data.place) {
          const near = trip.lat != null ? { lat: trip.lat, lon: trip.lon } : null;
          const located = data.place
            ? await geocode(near ? data.place : `${data.place}, ${trip.destination || ''}`, near).catch(() => null)
            : null;
          patch.lat = located?.lat ?? null;
          patch.lon = located?.lon ?? null;
          if (data.place && !located) toast('No encontramos el lugar en el mapa; se guarda sin ubicación.');
        }
        if (data.remove_image) Object.assign(patch, { image_url: null, image_thumb: null });
        let photoUpload = null;
        if (imageFile) {
          photoUpload = await uploadPhoto(tripId, imageFile);
          Object.assign(patch, { image_url: photoUpload.url, image_thumb: photoUpload.thumb_url });
        }
        const saved = activity.id
          ? await store.update('activities', activity.id, patch, { tripId, text: `editó la actividad "${data.title}"` })
          : await store.insert('activities', { ...patch, trip_id: tripId, created_by: store.user.id, created_by_name: store.user.name },
            { tripId, text: `añadió la actividad "${data.title}"` });
        if (photoUpload) {
          await store.insert('photos', {
            ...photoUpload,
            trip_id: tripId,
            activity_id: saved.id,
            day: patch.day,
            caption: data.title,
            uploaded_by: store.user.id,
            uploader_name: store.user.name
          });
        }
        toast(activity.id ? 'Actividad actualizada' : 'Añadida al plan');
        onSaved(patch.day);
      });
    } catch (error) {
      toastError(error);
    }
  }

  return (
    <form className="form" onSubmit={submitHandler}>
      <div className="form__field">
        <label className="form__label" htmlFor="actTitle">¿Qué vais a hacer?</label>
        <input className="form__input" id="actTitle" name="title" required maxLength={100} defaultValue={activity.title || ''} placeholder="Ej. Tour por la ciudad amurallada" />
      </div>
      <div className="form__row">
        <div className="form__field">
          <label className="form__label" htmlFor="actDay">Día</label>
          <select className="form__select" id="actDay" name="day" defaultValue={selected || ''}>
            <option value="">Sin día</option>
            {/* Un dia fuera de las fechas del viaje se mantiene como opcion para no borrarlo sin avisar */}
            {isOutside ? <option value={selected}>{formatDay(selected, { weekday: 'short', day: 'numeric', month: 'short' })} (fuera del viaje)</option> : null}
            {reelDays.map((day, index) => <option key={day} value={day}>Día {index + 1} · {formatDay(day, { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}
          </select>
        </div>
        <div className="form__field">
          <label className="form__label" htmlFor="actTime">Hora</label>
          <input className="form__input" id="actTime" name="time" type="time" defaultValue={activity.time || ''} />
        </div>
      </div>
      <div className="form__field suggest-host">
        <label className="form__label" htmlFor="actPlace">Lugar</label>
        <SuggestInput
          id="actPlace"
          name="place"
          kind="place"
          maxLength={160}
          defaultValue={activity.place || ''}
          placeholder="Museo, restaurante, dirección…"
          near={trip.lat != null ? { lat: trip.lat, lon: trip.lon } : null}
          isOverlay
          withCoords
          defaultCoords={{ lat: activity.lat, lon: activity.lon }}
        />
        <p className="form__help">Elige el sitio del menú para ubicarlo exacto en el mapa (salen primero los cercanos al destino).</p>
      </div>
      <div className="form__field">
        <label className="form__label" htmlFor="actNotes">Notas</label>
        <textarea className="form__textarea" id="actNotes" name="notes" maxLength={1000} placeholder="Reservas, precios, cómo llegar…" defaultValue={activity.notes || ''} />
      </div>
      <div className="form__field">
        <label className="form__label" htmlFor="actImage">Imagen del sitio</label>
        <input className="form__input" id="actImage" name="image" type="file" accept="image/*" />
        <p className="form__help">También se guarda en el álbum del viaje.</p>
        {activity.image_url ? (
          <>
            <figure className="form__preview"><Picture url={activity.image_url} alt="Imagen actual" width={220} height={140} /></figure>
            <label className="form__check"><input type="checkbox" name="remove_image" value="1" /> Quitar la imagen</label>
          </>
        ) : null}
      </div>
      <div className="form__actions">
        <button className="btn" type="button" onClick={onCancel}>Cancelar</button>
        <button className="btn btn--primary" type="submit" disabled={isBusy}>{isBusy ? 'Guardando…' : activity.id ? 'Guardar' : 'Añadir al plan'}</button>
      </div>
    </form>
  );
}

/* ---- Piezas del itinerario ---- */

function Activity({ activity, comments, isPrint = false, handlers }) {
  const { trip, canEdit } = useTrip();
  const commentCount = countFor(comments, 'activity', activity.id);
  const place = activity.place ? <p className="activity__place"><Icon name="pin" size={14} /> {activity.place}</p> : null;
  const hasMedia = Boolean(activity.image_url) && !isPrint;
  return (
    <li>
      <article className="activity">
        {hasMedia ? (
          <figure className="activity__media">
            <Picture url={activity.image_url} alt={`Foto de ${activity.title}`} width={800} height={500} />
            <figcaption className="activity__media-text">
              <h4 className="activity__title">{activity.title}</h4>
              {place}
            </figcaption>
            {activity.image_credit ? <small className="activity__credit">Foto: {activity.image_credit}</small> : null}
          </figure>
        ) : null}
        <div className="activity__body">
          <span className="activity__time">{activity.time || '—'}</span>
          <div className="activity__info">
            {hasMedia ? null : <><h4 className="activity__title">{activity.title}</h4>{place}</>}
            {activity.notes ? <p className="activity__notes">{activity.notes}</p> : null}
          </div>
        </div>
        {isPrint ? null : (
          <footer className="activity__footer">
            <span>{activity.created_by_name ? `Añadido por ${activity.created_by_name}` : ''}</span>
            <div className="activity__actions">
              <button className="btn btn--ghost btn--small" type="button" aria-label={`Historia de ${activity.title}`} onClick={() => handlers.history(activity)}><Icon name="book" size={16} /> Historia</button>
              <button className="btn btn--ghost btn--small" type="button" aria-label={`Comentarios de ${activity.title}: ${commentCount}`} onClick={() => handlers.comments(activity)}><Icon name="chat" size={16} /> {commentCount}</button>
              {activity.lat != null ? <a className="btn btn--ghost btn--small btn--icon" href={`#/viaje/${trip.id}/mapa?foco=${activity.id}`} aria-label={`Ver ${activity.title} en el mapa`}><Icon name="map" size={16} /></a> : null}
              {canEdit ? (
                <>
                  <button className="btn btn--ghost btn--small btn--icon" type="button" aria-label={`Editar ${activity.title}`} onClick={() => handlers.edit(activity)}><Icon name="edit" size={16} /></button>
                  <button className="btn btn--ghost btn--small btn--icon btn--danger" type="button" aria-label={`Eliminar ${activity.title}`} onClick={() => handlers.remove(activity)}><Icon name="trash" size={16} /></button>
                </>
              ) : null}
            </div>
          </footer>
        )}
      </article>
    </li>
  );
}

function DayCard({ day, index, list, isActive, coverUrl, onSelect }) {
  const withImage = list.find((activity) => activity.image_url);
  const image = withImage?.image_url || coverUrl;
  const isLoose = day === LOOSE_KEY;
  const label = isLoose ? 'Ideas' : `Día ${index + 1}`;
  const title = isLoose ? 'Ideas sueltas' : list[0]?.title || 'Día libre';
  return (
    <li className="day-reel__item">
      <button
        className={`day-card ${isActive ? 'day-card--active' : ''}`}
        type="button"
        data-day={day}
        style={{ '--card-hue': CARD_HUES[index % CARD_HUES.length] }}
        aria-pressed={isActive}
        aria-label={`${label}: ${isLoose ? 'ideas sueltas' : formatDay(day)}, ${list.length} planes`}
        onClick={() => onSelect(day)}
      >
        {image ? <Picture url={image} className="day-card__media" width={480} height={640} isLazy={index > 2} /> : null}
        <span className="day-card__tags">
          <span className="day-card__tag">{label}</span>
          <span className="day-card__tag">{list.length} plan{list.length === 1 ? '' : 'es'}</span>
        </span>
        <span className="day-card__bottom">
          <span className="day-card__weekday">{isLoose ? 'Sin fecha' : formatDay(day, { weekday: 'long', day: 'numeric' })}</span>
          <span className="day-card__title">{title}</span>
        </span>
      </button>
    </li>
  );
}

export default function ItineraryView() {
  const { trip, tripId, canEdit, refreshKey, refresh } = useTrip();
  const { openModal, closeModal, confirm, toast, toastError } = useUi();
  const [mode, setMode] = useState(currentMode);
  const [selectedDay, setSelectedDay] = useState(null);
  const trackRef = useRef(null);
  const selectedRef = useRef(null);
  const shouldScrollRef = useRef(false);
  const { data } = useLoad(() => Promise.all([store.list('activities', tripId), store.list('comments', tripId)]), [tripId, refreshKey]);

  const reelDays = useMemo(() => eachDay(trip.start_date, trip.end_date), [trip.start_date, trip.end_date]);
  const activities = useMemo(() => sortActivities(data?.[0] || []), [data]);
  const comments = data?.[1] || [];
  const activitiesOf = (day) => (day === LOOSE_KEY
    ? activities.filter((activity) => !activity.day || !reelDays.includes(activity.day))
    : activities.filter((activity) => activity.day === day));
  const keys = [...reelDays];
  if (activitiesOf(LOOSE_KEY).length || !keys.length) keys.push(LOOSE_KEY);

  // Dia inicial: el recordado (mismo viaje), hoy si cae en el viaje, o el primero
  let currentDay = selectedDay;
  if (!currentDay && data) {
    const now = today();
    if (rememberedTripId === tripId && rememberedDay && (reelDays.includes(rememberedDay) || rememberedDay === LOOSE_KEY)) currentDay = rememberedDay;
    else currentDay = reelDays.includes(now) ? now : reelDays[0] || LOOSE_KEY;
  }
  if (currentDay && !keys.includes(currentDay)) currentDay = keys[0];
  selectedRef.current = currentDay;
  rememberedDay = currentDay;
  rememberedTripId = tripId;

  function selectDay(day, { shouldScroll = false } = {}) {
    shouldScrollRef.current = shouldScroll;
    setSelectedDay(day);
  }

  // Al montar el carrete, la tarjeta activa queda centrada; al elegir con clic o flechas, se desliza hasta ella
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const active = track.querySelector('.day-card--active');
    if (!active) return;
    if (shouldScrollRef.current) {
      shouldScrollRef.current = false;
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentDay]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const active = track?.querySelector('.day-card--active');
    if (active) track.scrollLeft = active.offsetLeft - (track.clientWidth - active.offsetWidth) / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, Boolean(data)]);

  // Deslizar el carrete elige el dia que queda en el centro
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const scrollHandler = debounce(() => {
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
      if (best && best !== selectedRef.current) selectDay(best);
    }, 140);
    function keyHandler(event) {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const cards = Array.from(track.querySelectorAll('.day-card'), (card) => card.dataset.day);
      const next = cards[cards.indexOf(selectedRef.current) + (event.key === 'ArrowRight' ? 1 : -1)];
      if (!next) return;
      selectDay(next, { shouldScroll: true });
      requestAnimationFrame(() => track.querySelector(`.day-card[data-day="${next}"]`)?.focus({ preventScroll: true }));
    }
    track.addEventListener('scroll', scrollHandler, { passive: true });
    track.addEventListener('keydown', keyHandler);
    return () => {
      track.removeEventListener('scroll', scrollHandler);
      track.removeEventListener('keydown', keyHandler);
    };
  }, [mode, Boolean(data)]);

  // Exportar PDF desde otra pestaña: se llega aqui con la marca y se abre la impresion
  useEffect(() => {
    if (!data || !sessionStorage.getItem(PRINT_FLAG)) return undefined;
    sessionStorage.removeItem(PRINT_FLAG);
    const timer = setTimeout(() => window.print(), 500);
    return () => clearTimeout(timer);
  }, [Boolean(data)]);

  if (!data) return null;

  function stepHandler(delta) {
    const next = keys[keys.indexOf(currentDay) + delta];
    if (next) selectDay(next, { shouldScroll: true });
  }

  function modeHandler(nextMode) {
    localStorage.setItem(VIEW_KEY, nextMode);
    setMode(nextMode);
  }

  function savedHandler(day) {
    if (day) {
      rememberedDay = day;
      setSelectedDay(day);
    }
    closeModal();
    refresh();
  }

  function newActivityHandler(day) {
    openModal('Nueva actividad', <ActivityForm trip={trip} tripId={tripId} reelDays={reelDays} presetDay={day === LOOSE_KEY ? '' : day} onSaved={savedHandler} onCancel={closeModal} />);
  }

  const handlers = {
    edit(activity) {
      openModal('Editar actividad', <ActivityForm trip={trip} tripId={tripId} reelDays={reelDays} activity={activity} onSaved={savedHandler} onCancel={closeModal} />);
    },
    async remove(activity) {
      const isConfirmed = await confirm(`Se quitará "${activity.title}" del itinerario. Sus fotos seguirán en el álbum.`);
      if (!isConfirmed) return;
      try {
        await store.remove('activities', activity.id, { tripId, text: `eliminó la actividad "${activity.title}"` });
        toast('Actividad eliminada');
        refresh();
      } catch (error) {
        toastError(error);
      }
    },
    comments(activity) {
      openModal(activity.title, <div><Comments tripId={tripId} targetType="activity" targetId={activity.id} headingLevel={3} /></div>);
    },
    history(activity) {
      openModal(activity.title, <HistoryContent activity={activity} />);
    }
  };

  const activityList = (list, isPrint = false) => <ul className="day__list">{list.map((activity) => <Activity key={activity.id} activity={activity} comments={comments} isPrint={isPrint} handlers={handlers} />)}</ul>;

  function detailView() {
    const list = activitiesOf(currentDay);
    const isLoose = currentDay === LOOSE_KEY;
    return (
      <>
        <div className="section__head">
          <h3 className="day__date">{isLoose ? 'Ideas sueltas' : formatDay(currentDay)}</h3>
          {canEdit ? <button className="btn btn--small" type="button" onClick={() => newActivityHandler(currentDay)}><Icon name="plus" size={16} /> Añadir a este día</button> : null}
        </div>
        {list.length ? activityList(list) : <p className="day__empty">Nada planeado todavía. ¡Añade algo o mira las votaciones!</p>}
      </>
    );
  }

  function reelView() {
    const { main, sub } = bigDate(currentDay);
    return (
      <>
        <section className="day-reel" aria-label="Días del viaje">
          <p className="day-reel__date" id="reelDate" aria-live="polite">{main}</p>
          <p className="day-reel__sub" id="reelSub">{sub}</p>
          <div className="day-reel__viewport">
            <button className="day-reel__nav day-reel__nav--prev" type="button" aria-label="Día anterior" onClick={() => stepHandler(-1)}><Icon name="back" /></button>
            <ul className="day-reel__track" id="reelTrack" ref={trackRef}>
              {keys.map((day, index) => <DayCard key={day} day={day} index={index} list={activitiesOf(day)} isActive={day === currentDay} coverUrl={trip.cover_url} onSelect={(value) => selectDay(value, { shouldScroll: true })} />)}
            </ul>
            <button className="day-reel__nav day-reel__nav--next" type="button" aria-label="Día siguiente" onClick={() => stepHandler(1)}><Icon name="next" /></button>
          </div>
        </section>
        <section className="day-detail" id="dayDetail" aria-live="polite">{detailView()}</section>
      </>
    );
  }

  function listView() {
    return (
      <>
        {keys.length > 1 ? (
          <Scroller>
            <ul className="chips">
              {keys.map((day, index) => (
                <li key={day}>
                  <button className="chip chip--plain" type="button" onClick={() => document.getElementById(`dia-${day}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                    {day === LOOSE_KEY ? 'Ideas' : `Día ${index + 1} · ${formatDay(day, { day: 'numeric', month: 'short' })}`}
                  </button>
                </li>
              ))}
            </ul>
          </Scroller>
        ) : null}
        {keys.map((day, index) => {
          const list = activitiesOf(day);
          const isLoose = day === LOOSE_KEY;
          return (
            <section className="day" id={`dia-${day}`} aria-labelledby={`title-${day}`} key={day}>
              <header className="day__header">
                <div>
                  <span className="day__label">{isLoose ? 'Sin día asignado' : `Día ${index + 1}`}</span>
                  <h3 className="day__date" id={`title-${day}`}>{isLoose ? 'Ideas sueltas' : formatDay(day)}</h3>
                </div>
                {canEdit ? <button className="btn btn--small" type="button" onClick={() => newActivityHandler(day)}><Icon name="plus" size={16} /> Añadir</button> : null}
              </header>
              {list.length ? activityList(list) : <p className="day__empty">Nada planeado todavía para este día.</p>}
            </section>
          );
        })}
      </>
    );
  }

  const printDays = reelDays.concat(activitiesOf(LOOSE_KEY).length ? [LOOSE_KEY] : []);
  return (
    <div id="itinerary">
      <div className="section__head no-print">
        <h2>Itinerario</h2>
        <div className="page-head__actions">
          <div className="segmented segmented--compact" role="group" aria-label="Forma de ver los días">
            {VIEW_MODES.map((item) => (
              <button key={item.key} className={`segmented__btn ${item.key === mode ? 'segmented__btn--active' : ''}`} type="button" aria-pressed={item.key === mode} onClick={() => modeHandler(item.key)}>
                <Icon name={item.icon} size={16} /> {item.label}
              </button>
            ))}
          </div>
          <button className="btn btn--small" type="button" onClick={() => window.print()}><Icon name="print" size={16} /> PDF</button>
          {canEdit ? <button className="btn btn--primary btn--small" type="button" onClick={() => newActivityHandler('')}><Icon name="plus" size={16} /> Actividad</button> : null}
        </div>
      </div>
      <div className="no-print">{mode === 'carrete' ? reelView() : listView()}</div>
      {/* Copia completa para imprimir / exportar a PDF */}
      <div className="print-only">
        {printDays.map((day, index) => {
          const list = activitiesOf(day);
          return (
            <section className="day" key={day}>
              <h3 className="day__date">{day === LOOSE_KEY ? 'Ideas sueltas' : `Día ${index + 1} · ${formatDay(day)}`}</h3>
              {list.length ? activityList(list, true) : <p className="day__empty">Día libre</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
