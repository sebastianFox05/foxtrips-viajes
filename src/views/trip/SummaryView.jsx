/* Pestaña Inicio del viaje: datos clave, accesos, proximos planes, clima, divisas y compartir. */
import { useEffect, useMemo, useState } from 'react';
import { store } from '../../lib/store/index.js';
import { forecast, rates, tripWeather, weatherInfo, CURRENCIES } from '../../lib/services.js';
import { nearestCityName } from '../../lib/places.js';
import { defaultCurrency, eachDay, formatDay, formatMoney, sortActivities, today, tripStatus } from '../../lib/utils.js';
import Icon from '../../components/Icon.jsx';
import Picture from '../../components/Picture.jsx';
import Scroller from '../../components/Scroller.jsx';
import useLoad from '../../hooks/useLoad.js';
import { useUi } from '../../ui/UiContext.jsx';
import { SECTIONS } from './sections.js';
import { useTrip } from './TripContext.jsx';
import { PRINT_FLAG } from './TripLayout.jsx';
import { useNavigate } from 'react-router-dom';

const HOME_CURRENCY_KEY = 'foxtrips:home-currency';
const MAX_WEATHER_DAYS = 21;

function homeCurrency() {
  return localStorage.getItem(HOME_CURRENCY_KEY) || defaultCurrency();
}

function InfoItem({ iconName, label, value }) {
  return (
    <div className="info-row__item">
      <span className="info-row__icon"><Icon name={iconName} /></span>
      <div><span className="info-row__label">{label}</span><span className="info-row__value">{value}</span></div>
    </div>
  );
}

function Upcoming({ tripId, activities }) {
  const now = today();
  const next = sortActivities(activities).filter((activity) => (activity.day || '') >= now).slice(0, 4);
  const list = next.length ? next : sortActivities(activities).slice(0, 4);
  if (!list.length) return <p className="card__text">Aún no hay planes. <a href={`#/viaje/${tripId}/itinerario`}>Añade el primero</a>.</p>;
  return (
    <ul className="upcoming">
      {list.map((activity) => (
        <li className="upcoming__item" key={activity.id}>
          <figure className="upcoming__thumb">
            {activity.image_url ? <Picture url={activity.image_thumb || activity.image_url} alt="" width={104} height={104} /> : <Icon name="pin" />}
          </figure>
          <div className="upcoming__body">
            <p className="upcoming__title">{activity.title}</p>
            <p className="upcoming__when">{activity.day ? formatDay(activity.day, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Sin día'}{activity.time ? ` · ${activity.time}` : ''}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/*
 * Punto de cada dia: la ciudad donde ocurren la mayoria de sus actividades
 * (en un dia de carretera la primera actividad es la salida, no el destino) o, si no hay, el destino del viaje.
 */
function weatherPoints(trip, activities) {
  const days = eachDay(trip.start_date, trip.end_date).slice(0, MAX_WEATHER_DAYS);
  const located = sortActivities(activities).filter((activity) => activity.lat != null && activity.day);
  return days.map((day) => {
    const ofDay = located.filter((activity) => activity.day === day);
    if (!ofDay.length) return { day, lat: trip.lat, lon: trip.lon };
    const groups = new Map();
    for (const activity of ofDay) {
      const key = nearestCityName(activity.lat, activity.lon, 60) || `${activity.lat.toFixed(1)},${activity.lon.toFixed(1)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(activity);
    }
    const [, main] = [...groups.entries()].sort((first, second) => second[1].length - first[1].length)[0];
    return { day, lat: main[0].lat, lon: main[0].lon };
  }).filter((point) => point.lat != null);
}

function WeatherDay({ day, point }) {
  const info = weatherInfo(day.code);
  const city = point ? nearestCityName(point.lat, point.lon) : '';
  return (
    <li className={`weather__day ${day.isForecast ? '' : 'weather__day--typical'}`} title={`${info.label}${day.isForecast ? '' : ' (clima típico)'}`}>
      <span className="weather__date">{formatDay(day.day, { weekday: 'short', day: 'numeric' })}</span>
      <span className="weather__icon" aria-hidden="true">{info.emoji}</span>
      <span className="visually-hidden">{info.label}{day.isForecast ? '' : ', clima típico'}</span>
      <span className="weather__temp">{day.max}° / {day.min}°</span>
      {city ? <span className="weather__place">{city}</span> : null}
    </li>
  );
}

function WeatherCard({ trip, activities }) {
  const [state, setState] = useState({ status: 'loading' });
  const points = useMemo(() => (trip.end_date && trip.end_date >= today() ? weatherPoints(trip, activities) : []), [trip, activities]);
  const pointsKey = points.map((point) => `${point.day}@${point.lat},${point.lon}`).join('|');

  useEffect(() => {
    let isCurrent = true;
    async function load() {
      if (trip.lat == null) {
        setState({ status: 'noDestination' });
        return;
      }
      try {
        // Viaje sin fechas o ya pasado: los proximos 7 dias en el destino
        if (!points.length) {
          const days = await forecast(trip.lat, trip.lon);
          if (isCurrent) setState({ status: 'next', days: days.map((day) => ({ ...day, isForecast: true })) });
          return;
        }
        const days = await tripWeather(points);
        if (isCurrent) setState({ status: 'trip', days });
      } catch {
        if (isCurrent) setState({ status: 'error' });
      }
    }
    load();
    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.lat, trip.lon, pointsKey]);

  const pointByDay = new Map(points.map((point) => [point.day, point]));
  const hasTypical = state.days?.some((day) => !day.isForecast);
  const hasForecast = state.days?.some((day) => day.isForecast);
  let hint = 'Cargando…';
  if (state.status === 'next') hint = 'Próximos 7 días';
  if (state.status === 'trip') hint = hasTypical && !hasForecast ? 'Clima típico' : 'Días del viaje';

  let body = <p className="card__text">Cargando clima…</p>;
  if (state.status === 'noDestination') body = <p className="card__text">Añade un destino al viaje para ver el clima.</p>;
  if (state.status === 'error') body = <p className="card__text">No se pudo cargar el clima ahora mismo.</p>;
  if (state.status === 'next' || state.status === 'trip') {
    body = (
      <>
        <Scroller isWeather>
          <ul className="weather">{state.days.map((day) => <WeatherDay key={day.day} day={day} point={pointByDay.get(day.day)} />)}</ul>
        </Scroller>
        {state.status === 'trip' && hasTypical ? (
          <p className="weather__note">{hasForecast ? 'Los días en gris aún no tienen pronóstico: muestran' : 'Aún falta para el pronóstico: se muestra'} el clima típico de esas fechas (promedio de los últimos 3 años). Se actualiza solo al acercarse el viaje.</p>
        ) : null}
      </>
    );
  }

  return (
    <section className="card" aria-labelledby="weatherTitle">
      <div className="section__head">
        <h2 id="weatherTitle">Clima del viaje</h2>
        <span className="section__hint" id="weatherHint">{hint}</span>
      </div>
      <div id="weatherBox">{body}</div>
    </section>
  );
}

function Converter({ tripCurrency }) {
  const [rateTable, setRateTable] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState(tripCurrency || 'USD');
  const [to, setTo] = useState(homeCurrency());
  const [isTurned, setIsTurned] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    rates('USD').then((table) => isCurrent && setRateTable(table)).catch(() => isCurrent && setIsOffline(true));
    return () => {
      isCurrent = false;
    };
  }, []);

  let result = '…';
  if (isOffline) result = 'Sin conexión para las divisas.';
  else if (rateTable) {
    const value = (Number(amount) || 0) * (rateTable[to] / rateTable[from]);
    result = Number.isFinite(value) ? formatMoney(value, to) : '—';
  }

  function swapHandler() {
    setFrom(to);
    setTo(from);
    setIsTurned(!isTurned);
  }

  function toHandler(event) {
    setTo(event.target.value);
    localStorage.setItem(HOME_CURRENCY_KEY, event.target.value);
  }

  return (
    <section className="card" aria-labelledby="moneyTitle">
      <h2 className="card__title" id="moneyTitle">Conversor de moneda</h2>
      {/* Formulario que solo calcula en pantalla: Enter no recarga la pagina */}
      <form className="converter" data-converter="" onSubmit={(event) => event.preventDefault()}>
        <div className="form__field converter__amount">
          <label className="form__label" htmlFor="convAmount">Cantidad</label>
          <input className="form__input" id="convAmount" name="amount" type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </div>
        <div className="form__field">
          <label className="form__label" htmlFor="convFrom">De</label>
          <select className="form__select" id="convFrom" name="from" value={from} onChange={(event) => setFrom(event.target.value)}>
            {CURRENCIES.map((code) => <option key={code}>{code}</option>)}
          </select>
        </div>
        <button className={`converter__swap${isTurned ? ' converter__swap--turned' : ''}`} type="button" aria-label="Intercambiar monedas" title="Intercambiar monedas" onClick={swapHandler}><Icon name="swap" size={20} /></button>
        <div className="form__field">
          <label className="form__label" htmlFor="convTo">A</label>
          <select className="form__select" id="convTo" name="to" value={to} onChange={toHandler}>
            {CURRENCIES.map((code) => <option key={code}>{code}</option>)}
          </select>
        </div>
        <output className="converter__result" id="converterResult" htmlFor="convAmount convFrom convTo">{result}</output>
      </form>
    </section>
  );
}

export default function SummaryView() {
  const navigate = useNavigate();
  const { trip, tripId, isOwner, refreshKey, reloadTrip } = useTrip();
  const { toast, toastError } = useUi();
  const { data } = useLoad(() => Promise.all([
    store.list('activities', tripId),
    store.list('photos', tripId),
    store.list('proposals', tripId)
  ]), [tripId, refreshKey]);

  if (!data) return null;
  const [activities, photos, proposals] = data;
  const status = tripStatus(trip);
  const openProposals = proposals.filter((proposal) => proposal.status === 'open').length;
  const quickLinks = SECTIONS.filter((section) => section.key !== 'resumen');

  async function copyPublicLinkHandler() {
    try {
      const token = trip.public_token || await store.setPublic(trip.id, true);
      const url = `${location.origin}${location.pathname}#/publico/${token}`;
      await navigator.clipboard.writeText(url).catch(() => null);
      if (navigator.share) navigator.share({ title: trip.name, url }).catch(() => null);
      toast('Enlace público copiado');
      reloadTrip();
    } catch (error) {
      toastError(error);
    }
  }

  function printHandler() {
    sessionStorage.setItem(PRINT_FLAG, '1');
    navigate(`/viaje/${trip.id}/itinerario`);
  }

  return (
    <>
      <h2 className="visually-hidden">Resumen del viaje</h2>
      <div className="info-row">
        <InfoItem iconName="clock" label="Estado" value={status.label} />
        <InfoItem iconName="calendar" label="Planes" value={`${activities.length} actividades`} />
        <InfoItem iconName="image" label="Álbum" value={`${photos.length} fotos`} />
        <InfoItem iconName="vote" label="Votaciones" value={`${openProposals} abiertas`} />
      </div>

      <section className="section" aria-labelledby="exploreTitle">
        <div className="section__head"><h2 id="exploreTitle">Explorar</h2></div>
        <Scroller>
          <ul className="chips">
            {quickLinks.map((section) => (
              <li key={section.key}><a className="chip" href={`#/viaje/${trip.id}/${section.key}`}><span className="chip__icon"><Icon name={section.icon} size={18} /></span>{section.label}</a></li>
            ))}
          </ul>
        </Scroller>
      </section>

      <div className="grid grid--2 section">
        <section className="card" aria-labelledby="nextTitle">
          <div className="section__head">
            <h2 id="nextTitle">Próximos planes</h2>
            <a className="link-btn" href={`#/viaje/${trip.id}/itinerario`}>Ver todo <Icon name="next" size={16} /></a>
          </div>
          <Upcoming tripId={trip.id} activities={activities} />
        </section>
        <WeatherCard trip={trip} activities={activities} />
        <Converter tripCurrency={trip.currency} />
        <section className="card" aria-labelledby="shareTitle">
          <h2 className="card__title" id="shareTitle">Compartir y exportar</h2>
          <p className="card__text">Comparte una página de solo lectura con el itinerario y el álbum, o guarda el itinerario en PDF.</p>
          <div className="page-head__actions page-head__actions--top">
            {isOwner ? <button className="btn btn--primary" type="button" onClick={copyPublicLinkHandler}><Icon name="share" size={18} /> {trip.public_token ? 'Copiar enlace público' : 'Crear enlace público'}</button> : null}
            <button className="btn" type="button" onClick={printHandler}><Icon name="print" size={18} /> Exportar PDF</button>
          </div>
          {trip.public_token ? <p className="form__help form__help--top">La página pública está activa. Puedes desactivarla en Grupo.</p> : null}
        </section>
      </div>
    </>
  );
}
