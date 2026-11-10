/*
 * Viajes con varias paradas (Roma → Florencia → Venecia).
 * El destino principal del viaje es la primera parada y empieza el dia de ida.
 * trip.stops guarda las siguientes, cada una con su dia de llegada: [{ name, lat, lon, from }].
 * Cada parada dura hasta el dia antes de la siguiente; la ultima, hasta la vuelta.
 */
import { parseDay, toDay } from './utils.js';

const MAX_STOPS = 20;

function dayBefore(day) {
  const date = parseDay(day);
  date.setDate(date.getDate() - 1);
  return toDay(date);
}

/* Todas las paradas en orden, con su tramo de fechas: [{ index, name, lat, lon, from, to }] */
export function tripStops(trip) {
  if (!trip) return [];
  const extra = (Array.isArray(trip.stops) ? trip.stops : [])
    .filter((stop) => stop && stop.name)
    .slice(0, MAX_STOPS)
    .sort((first, second) => (first.from || '9').localeCompare(second.from || '9'));
  const list = [{ name: trip.destination || trip.name || '', lat: trip.lat ?? null, lon: trip.lon ?? null, from: trip.start_date || null }, ...extra];
  return list.map((stop, index) => {
    const next = list[index + 1];
    const to = next?.from ? dayBefore(next.from) : trip.end_date || stop.from;
    return { index, name: stop.name, lat: stop.lat ?? null, lon: stop.lon ?? null, from: stop.from || null, to: to || null };
  });
}

export function hasManyStops(trip) {
  return tripStops(trip).length > 1;
}

/* Parada en la que se esta un dia (antes del viaje, la primera; despues, la ultima) */
export function stopForDay(stops, day) {
  if (!stops.length) return null;
  if (!day) return stops[0];
  let found = stops[0];
  for (const stop of stops) if (stop.from && stop.from <= day) found = stop;
  return found;
}

/* Nombre corto de una parada: "Florencia, Italia" → "Florencia" */
export function shortStopName(stop) {
  return String(stop?.name || '').split(',')[0].trim();
}

/* "Roma → Florencia → Venecia" (o el destino tal cual si solo hay uno) */
export function routeLabel(trip) {
  const stops = tripStops(trip).filter((stop) => stop.name);
  if (stops.length <= 1) return trip?.destination || '';
  return stops.map(shortStopName).join(' → ');
}
