/*
 * Ayudas para planear un dia: tiempo de traslado entre planes seguidos y avisos de choque de horario.
 * Son estimaciones en linea recta (sin servicios externos):
 *   a pie hasta 1,6 km (4,5 km/h) · por la ciudad hasta 8 km (transporte, ~20 km/h + 8 min de espera)
 *   · carretera mas lejos (carro o bus: 60 km/h, o 80 km/h desde 60 km, + unos minutos).
 */
import { distanceKm } from '../../lib/recommendations.js';
import { m, t } from '../../lib/i18n/index.js';

const WALK_MAX_KM = 1.6;
const WALK_KMH = 4.5;
const CITY_MAX_KM = 8;
const CITY_KMH = 20;
const CITY_WAIT_MIN = 8;
const ROAD_KMH = 60;
const HIGHWAY_FROM_KM = 60;
const HIGHWAY_KMH = 80;
const ROAD_EXTRA_MIN = 8;
const TIGHT_GAP_MIN = 15;

/* Se traducen al pintarlos con t() */
export const TRAVEL_LABELS = { walk: m('a pie'), city: m('en transporte'), road: m('en carro o bus') };

export function timeToMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})/.exec(time || '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/* Traslado estimado entre dos planes con ubicacion: { minutes, km, mode: 'walk' | 'transport' } o null */
export function travelEstimate(from, to) {
  if (from?.lat == null || to?.lat == null) return null;
  const km = distanceKm(from.lat, from.lon, to.lat, to.lon);
  if (km < 0.05) return { minutes: 0, km, mode: 'walk' };
  if (km <= WALK_MAX_KM) return { minutes: Math.max(2, Math.round((km / WALK_KMH) * 60)), km, mode: 'walk' };
  if (km <= CITY_MAX_KM) return { minutes: Math.round((km / CITY_KMH) * 60 + CITY_WAIT_MIN), km, mode: 'city' };
  const speed = km >= HIGHWAY_FROM_KM ? HIGHWAY_KMH : ROAD_KMH;
  return { minutes: Math.round((km / speed) * 60 + ROAD_EXTRA_MIN), km, mode: 'road' };
}

export function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/*
 * Para los planes de UN dia (ya ordenados): Map id → { travel, from, warning, isConflict }.
 * - travel: traslado desde el plan anterior (si los dos tienen ubicacion).
 * - warning: misma hora que el anterior, no da tiempo a llegar o quedan muy seguidos.
 */
export function dayInsights(list) {
  const result = new Map();
  for (let index = 1; index < list.length; index += 1) {
    const previous = list[index - 1];
    const current = list[index];
    const travel = travelEstimate(previous, current);
    const start = timeToMinutes(previous.time);
    const end = timeToMinutes(current.time);
    let warning = null;
    let isConflict = false;
    if (start != null && end != null) {
      const gap = end - start;
      if (gap <= 0) {
        warning = t('A la misma hora que «{name}».', { name: previous.title });
        isConflict = true;
      } else if (travel && travel.minutes > gap) {
        warning = t('No da tiempo: hay {gap} desde «{name}» y el trayecto es de ~{travel}.', { gap: formatMinutes(gap), name: previous.title, travel: formatMinutes(travel.minutes) });
        isConflict = true;
      } else if (gap < TIGHT_GAP_MIN) {
        warning = t('Muy seguido: solo {gap} después de «{name}».', { gap: formatMinutes(gap), name: previous.title });
      }
    }
    if (travel || warning) result.set(current.id, { travel, from: previous.title, warning, isConflict });
  }
  return result;
}
