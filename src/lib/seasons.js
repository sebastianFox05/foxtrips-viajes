/*
 * Estacion del año de un viaje (como en las tarjetas "Invierno 2026 · 5 días").
 * Se mira el mes de salida y el hemisferio del destino; entre los tropicos no hay estaciones marcadas.
 */
import { m } from './i18n/index.js';

const TROPIC_LAT = 23.4;
const SEASONS = {
  winter: { icon: 'snow', label: m('Invierno') },
  spring: { icon: 'flower', label: m('Primavera') },
  summer: { icon: 'sun', label: m('Verano') },
  autumn: { icon: 'leaf', label: m('Otoño') }
};
const NORTH_BY_MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
const OPPOSITE = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' };

/* { key, icon, label } o null si no hay fecha o el destino esta en el tropico */
export function tripSeason(trip) {
  if (!trip?.start_date) return null;
  if (trip.lat != null && Math.abs(trip.lat) < TROPIC_LAT) return null;
  const month = Number(trip.start_date.slice(5, 7)) - 1;
  let key = NORTH_BY_MONTH[month];
  if (trip.lat != null && trip.lat < 0) key = OPPOSITE[key];
  return { key, ...SEASONS[key] };
}
