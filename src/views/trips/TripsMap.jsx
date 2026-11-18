/*
 * Mapa de tus viajes (inicio, boton del globo): cada viaje es una miniatura de su foto con su inicial.
 * Al pulsar uno aparece su tarjeta flotante con la foto, el nombre y una flecha para abrirlo.
 * Abajo, "Nuevo viaje". Los viajes sin destino ubicado no salen en el mapa.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { daysBetween, esc, safeUrl } from '../../lib/utils.js';
import { tripSeason } from '../../lib/seasons.js';
import { routeLabel } from '../../lib/stops.js';
import { navigateWithTransition, photoTransitionName } from '../../lib/transition.js';
import { t, tn } from '../../lib/i18n/index.js';
import Icon from '../../components/Icon.jsx';
import Picture from '../../components/Picture.jsx';

const WORLD_VIEW = [[25, -30], 2];

/* Miniatura cuadrada con la foto del viaje (solo https: las fotos del modo local no se pueden poner aqui) y su inicial */
function thumbIcon(trip, isSelected) {
  const photo = safeUrl(trip.cover_url || '');
  const initial = esc((trip.name || '?').trim().charAt(0).toUpperCase());
  const image = photo.startsWith('https://') ? `<img src="${esc(photo)}" alt="" loading="lazy">` : '';
  return L.divIcon({
    className: '',
    html: `<span class="trip-pin${isSelected ? ' trip-pin--selected' : ''}">${image}<span class="trip-pin__initial">${initial}</span></span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
}

export default function TripsMap({ trips, onNewTrip }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const located = useMemo(() => trips.filter((trip) => trip.lat != null && trip.lon != null), [trips]);
  const [selectedId, setSelectedId] = useState(() => located[0]?.id || null);
  const selected = located.find((trip) => trip.id === selectedId) || null;

  useEffect(() => {
    const map = L.map(canvasRef.current, { zoomControl: false, attributionControl: true, worldCopyJump: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    map.setView(...WORLD_VIEW);
    mapRef.current = map;
    // En el movil el mapa queda bajo los accesos: se baja hasta el para ver la tarjeta del viaje elegido
    const section = canvasRef.current.closest('.trips-map');
    if (section && section.getBoundingClientRect().bottom > window.innerHeight) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'end' });
    }
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Marcadores: se rehacen al cambiar los viajes o el elegido; el mapa encuadra todos los viajes una vez
  const fittedRef = useRef('');
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = located.map((trip) => L.marker([trip.lat, trip.lon], {
      icon: thumbIcon(trip, trip.id === selectedId),
      title: trip.name,
      keyboard: true,
      zIndexOffset: trip.id === selectedId ? 500 : 0
    }).addTo(map).on('click', () => setSelectedId(trip.id)));
    const key = located.map((trip) => trip.id).join('|');
    if (key && fittedRef.current !== key) {
      fittedRef.current = key;
      if (located.length === 1) map.setView([located[0].lat, located[0].lon], 5);
      else map.fitBounds(located.map((trip) => [trip.lat, trip.lon]), { padding: [60, 60], maxZoom: 6 });
    }
  }, [located, selectedId]);

  function openHandler(event) {
    if (!selected) return;
    event.preventDefault();
    navigateWithTransition(navigate, `/viaje/${selected.id}`, { state: { trip: selected } });
  }

  const season = selected ? tripSeason(selected) : null;
  const days = selected?.start_date && selected?.end_date ? daysBetween(selected.start_date, selected.end_date) + 1 : 0;
  return (
    <section className="trips-map" aria-label={t('Mapa de tus viajes')}>
      <div className="trips-map__canvas" ref={canvasRef} role="region" aria-label={t('Mapa interactivo con tus viajes')} />
      {!located.length ? <p className="trips-map__empty">{t('Tus viajes aparecerán aquí cuando tengan un destino.')}</p> : null}
      {selected ? (
        <a className="trips-map__card" href={`#/viaje/${selected.id}`} onClick={openHandler}>
          {selected.cover_url ? <Picture url={selected.cover_url} className="trips-map__photo" width={360} height={240} style={{ viewTransitionName: photoTransitionName(selected.id) }} /> : null}
          <span className="trips-map__info">
            <span className="trips-map__title">{selected.name}</span>
            <span className="trips-map__meta">
              {season ? `${t(season.label)} ${selected.start_date.slice(0, 4)}` : routeLabel(selected)}
              {days ? ` · ${tn(days, '{n} día', '{n} días')}` : ''}
            </span>
          </span>
          <span className="trips-map__go" aria-hidden="true"><Icon name="next" size={18} /></span>
        </a>
      ) : null}
      <button className="btn btn--primary trips-map__new" type="button" onClick={onNewTrip}><Icon name="plus" size={18} /> {t('Nuevo viaje')}</button>
    </section>
  );
}
