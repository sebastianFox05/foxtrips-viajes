/* Inicio: tu foto y saludo, buscador (con sugerencias), accesos, filtros y los viajes en tarjetas o en un mapa. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../../lib/store/index.js';
import { CITY_CODES, cityNames, normalize } from '../../lib/places.js';
import { registerSuggestions } from '../../lib/suggestions.js';
import { daysBetween, formatRange, registerAvatars, tripStatus } from '../../lib/utils.js';
import { createDemoTrip } from '../../lib/demo.js';
import { routeLabel } from '../../lib/stops.js';
import Icon from '../../components/Icon.jsx';
import Picture from '../../components/Picture.jsx';
import { Avatar, AvatarStack } from '../../components/Avatar.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import { tripSeason } from '../../lib/seasons.js';
import { navigateWithTransition, photoTransitionName } from '../../lib/transition.js';
import TripsMap from './TripsMap.jsx';
import Scroller from '../../components/Scroller.jsx';
import SuggestInput from '../../components/SuggestInput.jsx';
import useLoad from '../../hooks/useLoad.js';
import { useBusy, useUi } from '../../ui/UiContext.jsx';
import { useSession } from '../../session/SessionContext.jsx';
import { useTripActions } from './TripForm.jsx';
import { m, t, tn } from '../../lib/i18n/index.js';

const FILTERS = [
  { key: 'all', label: m('Todos'), icon: 'compass' },
  { key: 'upcoming', label: m('Próximos'), icon: 'calendar' },
  { key: 'ongoing', label: m('En curso'), icon: 'pin' },
  { key: 'past', label: m('Pasados'), icon: 'clock' }
];

// Se recuerdan al volver al inicio (como en la version anterior)
let rememberedFilter = 'all';
let rememberedSearch = '';
let rememberedView = 'list';
let knownTrips = [];

/* ¿El viaje coincide con lo escrito? Por nombre, destino o codigo de ciudad (CTG → Cartagena de Indias) */
function tripMatches(trip, query) {
  const text = normalize(query);
  if (!text) return true;
  const haystack = normalize(`${trip.name} ${trip.destination || ''} ${(trip.stops || []).map((stop) => stop.name).join(' ')}`);
  if (haystack.includes(text)) return true;
  const code = text.replace(/[\s.]/g, '').toUpperCase();
  const city = CITY_CODES.find((entry) => entry.codes.includes(code));
  return Boolean(city && cityNames(city).some((name) => haystack.includes(normalize(name).split(' ')[0])));
}

function tripSuggestions(query) {
  return knownTrips.filter((trip) => tripMatches(trip, query)).slice(0, 6).map((trip) => ({
    name: trip.name,
    detail: [routeLabel(trip), formatRange(trip.start_date, trip.end_date)].filter(Boolean).join(' · '),
    value: trip.name,
    href: `#/viaje/${trip.id}`,
    icon: 'calendar'
  }));
}

registerSuggestions('trip', tripSuggestions, { minLength: 1, label: m('Viajes sugeridos') });

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

/* Tarjeta de viaje: foto grande con la estacion arriba y un panel de cristal abajo (titulo, ruta, estado y dias) */
function TripCard({ trip, position, people }) {
  const navigate = useNavigate();
  const status = tripStatus(trip);
  const season = tripSeason(trip);
  const days = trip.start_date && trip.end_date ? daysBetween(trip.start_date, trip.end_date) + 1 : 0;
  const year = trip.start_date ? trip.start_date.slice(0, 4) : '';

  function openHandler(event) {
    // La foto crece hasta ser la cabecera del viaje; el viaje se pasa para pintarla sin esperar
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigateWithTransition(navigate, `/viaje/${trip.id}`, { state: { trip } });
  }

  return (
    <li>
      <article className={`trip-card${position === 0 ? ' trip-card--first' : ''}`}>
        {trip.cover_url ? <Picture url={trip.cover_url} className="trip-card__media" isLazy={position > 1} width={900} height={1100} style={{ viewTransitionName: photoTransitionName(trip.id) }} /> : null}
        <div className="trip-card__top">
          {season ? <span className="trip-card__season" title={t(season.label)}><Icon name={season.icon} size={22} /></span> : <span />}
          <AvatarStack people={people} max={3} />
        </div>
        <div className="trip-card__panel">
          <div className="trip-card__info">
            <h3 className="trip-card__title"><a className="trip-card__link" href={`#/viaje/${trip.id}`} onClick={openHandler}>{trip.name}</a></h3>
            <p className="trip-card__meta">
              {season ? `${t(season.label)} ${year}` : formatRange(trip.start_date, trip.end_date)}
              {days ? ` · ${tn(days, '{n} día', '{n} días')}` : ''}
            </p>
            <p className="trip-card__place"><Icon name="pin" size={14} /> {routeLabel(trip) || t('Destino por decidir')}</p>
          </div>
          <span className="trip-card__status">{status.label}</span>
        </div>
      </article>
    </li>
  );
}

/* Unirse a un viaje pegando el enlace de invitacion (o solo su codigo) */
function JoinForm({ onCancel }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  function submitHandler(event) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('invite') || '').trim();
    const code = (/unirse\/([a-z0-9]+)/i.exec(value) || [null, value])[1];
    if (!/^[a-z0-9]{6,32}$/i.test(code || '')) {
      setError(t('Pega el enlace de invitación que te enviaron (o su código).'));
      return;
    }
    onCancel();
    navigate(`/unirse/${code}`);
  }

  return (
    <form className="form" onSubmit={submitHandler} noValidate>
      <div className="form__field">
        <label className="form__label" htmlFor="joinInvite">{t('Enlace o código de invitación')}</label>
        <input className="form__input" id="joinInvite" name="invite" autoComplete="off" placeholder="https://…/#/unirse/…" />
        {error ? <p className="form__help form__help--error" role="alert">{error}</p> : <p className="form__help">{t('Te lo envía quien organiza el viaje desde la sección Grupo.')}</p>}
      </div>
      <div className="form__actions">
        <button className="btn" type="button" onClick={onCancel}>{t('Cancelar')}</button>
        <button className="btn btn--primary" type="submit">{t('Unirme')}</button>
      </div>
    </form>
  );
}

export default function TripsView() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { toast, toastError, openModal, closeModal } = useUi();
  const { openNewTrip } = useTripActions();
  const [isDemoBusy, runDemo] = useBusy();
  const [filter, setFilter] = useState(rememberedFilter);
  const [searchText, setSearchText] = useState(rememberedSearch);
  const [view, setView] = useState(rememberedView);
  const { data, error } = useLoad(loadTrips, []);

  useEffect(() => {
    if (error) toastError(error);
  }, [error, toastError]);

  const trips = data?.trips || [];
  knownTrips = trips;
  rememberedFilter = filter;
  rememberedSearch = searchText;
  rememberedView = view;

  const visible = useMemo(() => trips
    .filter((trip) => filter === 'all' || tripStatus(trip).key === filter)
    .filter((trip) => !searchText || tripMatches(trip, searchText.toLowerCase())), [trips, filter, searchText]);

  async function demoHandler() {
    try {
      await runDemo(async () => {
        const id = await createDemoTrip();
        toast(t('Viaje de ejemplo creado'));
        navigate(`/viaje/${id}`);
      });
    } catch (demoError) {
      toastError(demoError);
    }
  }

  function joinHandler() {
    openModal(t('Unirme a un viaje'), <JoinForm onCancel={closeModal} />);
  }

  if (!data) return error ? null : <p className="loading">{t('Cargando…')}</p>;
  const firstName = user.name.split(' ')[0];
  const isMap = view === 'map';
  const shortcuts = [
    { key: 'new', label: m('Nuevo viaje'), hint: m('Crear'), icon: 'plus', hue: 262, onClick: openNewTrip },
    { key: 'plans', label: m('Top planes'), hint: m('Ideas'), icon: 'star', hue: 150, href: '#/planes' },
    { key: 'map', label: m('Mapa'), hint: m('Tus viajes'), icon: 'globe', hue: 205, onClick: () => setView(isMap ? 'list' : 'map'), isActive: isMap },
    { key: 'join', label: m('Unirme'), hint: m('Con enlace'), icon: 'link', hue: 25, onClick: joinHandler }
  ];

  let list;
  if (!trips.length) {
    list = (
      <div className="empty">
        <span className="empty__icon"><Icon name="compass" size={28} /></span>
        <h3 className="empty__title">{t('Tu primer viaje empieza aquí')}</h3>
        <p className="empty__text">{t('Crea un viaje e invita a tu grupo para planearlo juntos.')}</p>
        <div className="page-head__actions page-head__actions--center">
          <button className="btn btn--primary" type="button" onClick={openNewTrip}><Icon name="plus" /> {t('Crear viaje')}</button>
          <button className="btn" type="button" onClick={demoHandler} disabled={isDemoBusy}>{isDemoBusy ? t('Guardando…') : <><Icon name="star" size={16} /> {t('Ver ejemplo: Nueva York')}</>}</button>
        </div>
      </div>
    );
  } else if (isMap) {
    list = <TripsMap trips={visible} onNewTrip={openNewTrip} />;
  } else if (!visible.length) {
    list = <p className="empty">{t('No hay viajes con ese filtro.')}</p>;
  } else {
    list = <ul className="trip-grid">{visible.map((trip, position) => <TripCard key={trip.id} trip={trip} position={position} people={data.membersByTrip[trip.id] || []} />)}</ul>;
  }

  return (
    <>
      {/* En movil esta fila hace de cabecera: tu foto y saludo a la izquierda, el modo claro/oscuro a la derecha */}
      <section className="home-top">
        <a className="home-top__user" href="#/perfil" aria-label={t('Tu perfil')}>
          <Avatar name={user.name} userId={user.id} extraClass="avatar--lg" />
          <span>
            <span className="home-top__hello">{t('Hola,')}</span>
            <span className="home-top__name">{firstName}</span>
          </span>
        </a>
        <span className="home-top__theme"><ThemeToggle /></span>
      </section>
      <h1 className="home-head__title">{t('¿A dónde vamos?')}</h1>
      <div className="home-search">
        <label className="search suggest-host">
          <Icon name="search" />
          <span className="visually-hidden">{t('Buscar viaje')}</span>
          <SuggestInput
            id="tripSearch"
            className="search__input"
            kind="trip"
            type="search"
            placeholder={t('Buscar viaje o destino')}
            defaultValue={searchText}
            onValueChange={(value) => setSearchText(value.trim())}
          />
        </label>
        <button className="round-btn" type="button" aria-pressed={isMap} aria-label={isMap ? t('Ver los viajes en lista') : t('Ver los viajes en el mapa')} title={isMap ? t('Lista') : t('Mapa')} onClick={() => setView(isMap ? 'list' : 'map')}>
          <Icon name={isMap ? 'list' : 'globe'} size={20} />
        </button>
      </div>
      <ul className="shortcuts">
        {shortcuts.map((item) => {
          const content = (
            <>
              <span className="shortcuts__icon" style={{ '--hue': item.hue }}><Icon name={item.icon} size={20} /></span>
              <span className="shortcuts__label">{t(item.label)}</span>
              <span className="shortcuts__hint">{t(item.hint)}</span>
            </>
          );
          return (
            <li key={item.key}>
              {item.href
                ? <a className="shortcuts__item" href={item.href}>{content}</a>
                : <button className={`shortcuts__item${item.isActive ? ' shortcuts__item--active' : ''}`} type="button" aria-pressed={item.key === 'map' ? isMap : undefined} onClick={item.onClick}>{content}</button>}
            </li>
          );
        })}
      </ul>
      <section className="section" aria-labelledby="tripsTitle">
        <h2 className="visually-hidden" id="tripsTitle">{t('Tus viajes')}</h2>
        <Scroller>
          <ul className="chips" id="tripChips">
            {FILTERS.map((item) => (
              <li key={item.key}>
                <button className={`chip ${item.key === filter ? 'chip--active' : ''}`} type="button" aria-pressed={item.key === filter} onClick={() => setFilter(item.key)}>
                  {t(item.label)}
                </button>
              </li>
            ))}
          </ul>
        </Scroller>
        <div id="tripList">{list}</div>
        {trips.length && !isMap ? (
          <p className="section__hint section__hint--center">{t('¿Quieres ver todo lo que puede hacer FoxTrips?')} <button className="link-btn" type="button" onClick={demoHandler} disabled={isDemoBusy}>{isDemoBusy ? t('Guardando…') : t('Crear el viaje de ejemplo a Nueva York')}</button></p>
        ) : null}
      </section>
    </>
  );
}
