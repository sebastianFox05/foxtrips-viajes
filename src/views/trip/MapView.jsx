/* Mapa del viaje: un marcador por actividad y la ruta de cada dia, con filtro por dia. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import L from 'leaflet';
import { store } from '../../lib/store/index.js';
import { eachDay, esc, formatDay, sortActivities } from '../../lib/utils.js';
import { formatTime } from '../../lib/locale.js';
import Icon from '../../components/Icon.jsx';
import Scroller from '../../components/Scroller.jsx';
import useLoad from '../../hooks/useLoad.js';
import { useTrip } from './TripContext.jsx';
import { t, tn } from '../../lib/i18n/index.js';

const DAY_COLORS = ['#f08a3c', '#2f80ed', '#9b51e0', '#27ae60', '#eb5757', '#f2c94c', '#56ccf2', '#bb6bd9'];

// El filtro de dia se recuerda al volver al mapa
let rememberedDay = 'all';

/* Marcador de una parada del viaje (ciudad): cuadrado oscuro con su numero */
function stopIcon(number) {
  return L.divIcon({
    className: '',
    html: `<span class="map-stop">${esc(String(number))}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
}

function pinIcon(label, color) {
  return L.divIcon({
    className: '',
    html: `<span class="map-pin" style="background:${color}"><span class="map-pin__label">${esc(label)}</span></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28]
  });
}

export default function MapView() {
  const location = useLocation();
  const { trip, tripId, refreshKey, stops, stopOn } = useTrip();
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const focusRef = useRef(new URLSearchParams(location.search).get('foco'));
  const days = useMemo(() => eachDay(trip.start_date, trip.end_date), [trip.start_date, trip.end_date]);
  const [activeDay, setActiveDay] = useState(() => (rememberedDay !== 'all' && !days.includes(rememberedDay) ? 'all' : rememberedDay));
  const { data } = useLoad(() => store.list('activities', tripId), [tripId, refreshKey]);
  const activities = useMemo(() => sortActivities(data || []), [data]);
  rememberedDay = activeDay;

  const colorFor = (day) => {
    const index = days.indexOf(day);
    return index < 0 ? '#6b6b6b' : DAY_COLORS[index % DAY_COLORS.length];
  };

  // Crear el mapa una vez (y quitarlo al salir)
  useEffect(() => {
    if (!data || mapRef.current || !canvasRef.current) return undefined;
    const map = L.map(canvasRef.current, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    mapRef.current = map;
    return undefined;
  }, [data]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
    layersRef.current = [];
  }, []);

  // Dibujar marcadores y rutas segun el dia elegido
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    const focusId = focusRef.current;
    focusRef.current = null;
    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];
    const located = activities.filter((activity) => activity.lat != null && (activeDay === 'all' || activity.day === activeDay));
    const bounds = [];
    const byDay = new Map();
    for (const activity of located) {
      const dayIndex = days.indexOf(activity.day);
      const popup = `<strong>${esc(activity.title)}</strong><br>${activity.day ? esc(formatDay(activity.day, { weekday: 'short', day: 'numeric', month: 'short' })) : esc(t('Sin día'))}${activity.time ? ` · ${esc(formatTime(activity.time))}` : ''}<br>${esc(activity.place || '')}`;
      const marker = L.marker([activity.lat, activity.lon], { icon: pinIcon(dayIndex >= 0 ? dayIndex + 1 : '•', colorFor(activity.day)), title: activity.title })
        .addTo(map)
        .bindPopup(popup);
      layersRef.current.push(marker);
      bounds.push([activity.lat, activity.lon]);
      if (activity.id === focusId) setTimeout(() => marker.openPopup(), 300);
      if (activity.day) byDay.set(activity.day, [...(byDay.get(activity.day) || []), [activity.lat, activity.lon]]);
    }
    // Viaje con varias paradas: cada ciudad con su numero y la ruta entre ellas
    const locatedStops = stops.filter((stop) => stop.lat != null);
    if (locatedStops.length > 1) {
      const visibleStops = activeDay === 'all' ? locatedStops : locatedStops.filter((stop) => stop.index === stopOn(activeDay)?.index);
      for (const stop of visibleStops) {
        const when = [stop.from, stop.to].filter(Boolean).map((day) => formatDay(day, { day: 'numeric', month: 'short' }));
        const marker = L.marker([stop.lat, stop.lon], { icon: stopIcon(stop.index + 1), title: stop.name, zIndexOffset: -100 })
          .addTo(map)
          .bindPopup(`<strong>${esc(stop.name)}</strong>${when.length ? `<br>${esc([...new Set(when)].join(' – '))}` : ''}`);
        layersRef.current.push(marker);
        if (!located.length || activeDay === 'all') bounds.push([stop.lat, stop.lon]);
      }
      if (activeDay === 'all') {
        layersRef.current.push(L.polyline(locatedStops.map((stop) => [stop.lat, stop.lon]), { color: '#141414', weight: 3, opacity: 0.55 }).addTo(map));
      }
    }
    byDay.forEach((points, day) => {
      if (points.length > 1) layersRef.current.push(L.polyline(points, { color: colorFor(day), weight: 4, opacity: 0.75, dashArray: '6 8' }).addTo(map));
    });
    const focus = activities.find((activity) => activity.id === focusId && activity.lat != null);
    if (focus) map.setView([focus.lat, focus.lon], 15);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });
    else if (bounds.length === 1) map.setView(bounds[0], located.length ? 14 : 11);
    else if (trip.lat != null) map.setView([trip.lat, trip.lon], 11);
    else map.setView([20, -40], 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, activeDay, data, stops]);

  if (!data) return null;
  const missing = activities.filter((activity) => activity.lat == null && activity.place).length;
  const options = [{ key: 'all', label: t('Todos los días'), color: '#141414' }]
    .concat(days.map((day, index) => ({ key: day, label: t('Día {n}', { n: index + 1 }), color: colorFor(day) })));

  return (
    <section className="map" aria-labelledby="mapTitle">
      <div className="section__head">
        <h2 id="mapTitle">{t('Mapa del viaje')}</h2>
        <span className="section__hint"><Icon name="pin" size={14} /> {tn(activities.filter((activity) => activity.lat != null).length, '{n} lugar', '{n} lugares')}</span>
      </div>
      <Scroller>
        <ul className="chips map__legend" id="mapLegend">
          {options.map((option) => (
            <li key={option.key}>
              <button className={`chip chip--plain ${option.key === activeDay ? 'chip--active' : ''}`} type="button" aria-pressed={option.key === activeDay} onClick={() => setActiveDay(option.key)}>
                <span className="map__swatch" style={{ '--swatch': option.color }} aria-hidden="true" />{option.label}
              </button>
            </li>
          ))}
        </ul>
      </Scroller>
      <div className="map__canvas" id="mapCanvas" role="region" aria-label={t('Mapa interactivo con los lugares del viaje')} ref={canvasRef} />
      {missing ? <p className="section__hint">{tn(missing, '{n} actividad tiene lugar pero no se pudo ubicar. Edítala con una dirección más precisa.', '{n} actividades tienen lugar pero no se pudieron ubicar. Edítalas con una dirección más precisa.')}</p> : null}
    </section>
  );
}
