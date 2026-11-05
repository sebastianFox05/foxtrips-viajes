/* Inicio: saludo, buscador (con sugerencias), filtros y tarjetas de viaje. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../../lib/store/index.js';
import { CITY_CODES, normalize } from '../../lib/places.js';
import { registerSuggestions } from '../../lib/suggestions.js';
import { daysBetween, formatRange, registerAvatars, tripStatus } from '../../lib/utils.js';
import { createDemoTrip } from '../../lib/demo.js';
import Icon from '../../components/Icon.jsx';
import Picture from '../../components/Picture.jsx';
import { AvatarStack } from '../../components/Avatar.jsx';
import Scroller from '../../components/Scroller.jsx';
import SuggestInput from '../../components/SuggestInput.jsx';
import useLoad from '../../hooks/useLoad.js';
import { useBusy, useUi } from '../../ui/UiContext.jsx';
import { useSession } from '../../session/SessionContext.jsx';
import { useTripActions } from './TripForm.jsx';

const FILTERS = [
  { key: 'all', label: 'Todos', icon: 'compass' },
  { key: 'upcoming', label: 'Próximos', icon: 'calendar' },
  { key: 'ongoing', label: 'En curso', icon: 'pin' },
  { key: 'past', label: 'Pasados', icon: 'clock' }
];

// Se recuerdan al volver al inicio (como en la version anterior)
let rememberedFilter = 'all';
let rememberedSearch = '';
let knownTrips = [];

/* ¿El viaje coincide con lo escrito? Por nombre, destino o codigo de ciudad (CTG → Cartagena de Indias) */
function tripMatches(trip, query) {
  const text = normalize(query);
  if (!text) return true;
  const haystack = normalize(`${trip.name} ${trip.destination || ''}`);
  if (haystack.includes(text)) return true;
  const code = text.replace(/[\s.]/g, '').toUpperCase();
  const city = CITY_CODES.find((entry) => entry.codes.includes(code));
  return Boolean(city && haystack.includes(normalize(city.name).split(' ')[0]));
}

function tripSuggestions(query) {
  return knownTrips.filter((trip) => tripMatches(trip, query)).slice(0, 6).map((trip) => ({
    name: trip.name,
    detail: [trip.destination, formatRange(trip.start_date, trip.end_date)].filter(Boolean).join(' · '),
    value: trip.name,
    href: `#/viaje/${trip.id}`,
    icon: 'calendar'
  }));
}

registerSuggestions('trip', tripSuggestions, { minLength: 1, label: 'Viajes sugeridos' });

async function loadTrips() {
  const list = (await store.listTrips()).sort((first, second) => (first.start_date || '').localeCompare(second.start_date || ''));
  const now = new Date().toISOString().slice(0, 10);
  const notPast = list.filter((trip) => (trip.end_date || '9') >= now);
  const past = list.filter((trip) => (trip.end_date || '9') < now);
  const trips = [...notPast, ...past.reverse()];
  const members = await Promise.all(trips.map((trip) => store.listMembers(trip.id).catch(() => [])));
  registerAvatars(members.flat().map((member) => ({ id: member.user_id, name: member.name, avatar_url: member.avatar_url })));
  return { trips, membersByTrip: Object.fromEntries(trips.map((trip, position) => [trip.id, members[position]])) };
}

function TripCard({ trip, position, people }) {
  const status = tripStatus(trip);
  const days = trip.start_date && trip.end_date ? daysBetween(trip.start_date, trip.end_date) + 1 : 0;
  return (
    <li>
      <article className={`photo-card ${position === 0 ? 'photo-card--tall' : ''}`}>
        {trip.cover_url ? <Picture url={trip.cover_url} className="photo-card__media" isLazy={position > 1} width={900} height={600} /> : null}
        <div className="photo-card__overlay">
          <p className="photo-card__kicker">{formatRange(trip.start_date, trip.end_date)}{days ? ` · ${days} días` : ''}</p>
          <h3 className="photo-card__title"><a className="photo-card__link" href={`#/viaje/${trip.id}`}>{trip.name}</a></h3>
          <div className="photo-card__footer">
            <span className="photo-card__place"><Icon name="pin" size={16} /> {trip.destination || 'Destino por decidir'}</span>
            <AvatarStack people={people} />
          </div>
        </div>
        <span className="photo-card__badge">{status.label}</span>
      </article>
    </li>
  );
}

export default function TripsView() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { toast, toastError } = useUi();
  const { openNewTrip } = useTripActions();
  const [isDemoBusy, runDemo] = useBusy();
  const [filter, setFilter] = useState(rememberedFilter);
  const [searchText, setSearchText] = useState(rememberedSearch);
  const { data, error } = useLoad(loadTrips, []);

  useEffect(() => {
    if (error) toastError(error);
  }, [error, toastError]);

  const trips = data?.trips || [];
  knownTrips = trips;
  rememberedFilter = filter;
  rememberedSearch = searchText;

  const visible = useMemo(() => trips
    .filter((trip) => filter === 'all' || tripStatus(trip).key === filter)
    .filter((trip) => !searchText || tripMatches(trip, searchText.toLowerCase())), [trips, filter, searchText]);

  async function demoHandler() {
    try {
      await runDemo(async () => {
        const id = await createDemoTrip();
        toast('Viaje de ejemplo creado');
        navigate(`/viaje/${id}`);
      });
    } catch (demoError) {
      toastError(demoError);
    }
  }

  if (!data) return error ? null : <p className="loading">Cargando…</p>;
  const firstName = user.name.split(' ')[0];

  let list;
  if (!trips.length) {
    list = (
      <div className="empty">
        <span className="empty__icon"><Icon name="compass" size={28} /></span>
        <h3 className="empty__title">Tu primer viaje empieza aquí</h3>
        <p className="empty__text">Crea un viaje e invita a tu grupo para planearlo juntos.</p>
        <div className="page-head__actions page-head__actions--center">
          <button className="btn btn--primary" type="button" onClick={openNewTrip}><Icon name="plus" /> Crear viaje</button>
          <button className="btn" type="button" onClick={demoHandler} disabled={isDemoBusy}>{isDemoBusy ? 'Guardando…' : <><Icon name="star" size={16} /> Ver ejemplo: Nueva York</>}</button>
        </div>
      </div>
    );
  } else if (!visible.length) {
    list = <p className="empty">No hay viajes con ese filtro.</p>;
  } else {
    list = <ul className="trip-grid">{visible.map((trip, position) => <TripCard key={trip.id} trip={trip} position={position} people={data.membersByTrip[trip.id] || []} />)}</ul>;
  }

  return (
    <>
      <section className="home-head">
        <div>
          <p className="home-head__hello">Hola, {firstName} 👋</p>
          <h1 className="home-head__title">¿A dónde vamos?</h1>
        </div>
      </section>
      <label className="search suggest-host">
        <Icon name="search" />
        <span className="visually-hidden">Buscar viaje</span>
        <SuggestInput
          id="tripSearch"
          className="search__input"
          kind="trip"
          type="search"
          placeholder="Buscar viaje, destino o código (NYC, CTG…)"
          defaultValue={searchText}
          onValueChange={(value) => setSearchText(value.trim())}
        />
      </label>
      <section className="section" aria-labelledby="tripsTitle">
        <div className="section__head">
          <h2 id="tripsTitle">Tus viajes</h2>
          <button className="link-btn" type="button" onClick={openNewTrip}><Icon name="plus" size={16} /> Nuevo viaje</button>
        </div>
        <Scroller>
          <ul className="chips" id="tripChips">
            {FILTERS.map((item) => (
              <li key={item.key}>
                <button className={`chip ${item.key === filter ? 'chip--active' : ''}`} type="button" aria-pressed={item.key === filter} onClick={() => setFilter(item.key)}>
                  <span className="chip__icon"><Icon name={item.icon} size={18} /></span>{item.label}
                </button>
              </li>
            ))}
          </ul>
        </Scroller>
        <div id="tripList">{list}</div>
        {trips.length ? (
          <p className="section__hint section__hint--center">¿Quieres ver todo lo que puede hacer FoxTrips? <button className="link-btn" type="button" onClick={demoHandler} disabled={isDemoBusy}>{isDemoBusy ? 'Guardando…' : 'Crear el viaje de ejemplo a Nueva York'}</button></p>
        ) : null}
      </section>
    </>
  );
}
