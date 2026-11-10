/*
 * Datos del destino que no se guardan en el viaje: zona horaria y pais (a partir de sus coordenadas).
 * Se consultan una vez y se recuerdan en este navegador, asi tambien funcionan sin conexion.
 */
import { countryCodeAt, timeZoneAt } from './services.js';
import { nearestCountryCode } from './places.js';

const CACHE_PREFIX = 'foxtrips:destino:';

function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PREFIX + key)) || {};
  } catch {
    return {};
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* cache llena */
  }
}

const cacheKey = (lat, lon) => `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;

/* Lo que ya se sabe del destino sin esperar a la red: { timeZone?, countryCode? } */
export function knownDestination(lat, lon) {
  if (lat == null || lon == null) return {};
  const saved = readCache(cacheKey(lat, lon));
  return { ...saved, countryCode: saved.countryCode || nearestCountryCode(lat, lon) };
}

/* { timeZone, countryCode } del destino; lo que no se pueda averiguar queda en '' */
export async function destinationInfo(lat, lon) {
  if (lat == null || lon == null) return { timeZone: '', countryCode: '' };
  const key = cacheKey(lat, lon);
  const saved = readCache(key);
  if (saved.timeZone && saved.countryCode) return saved;
  const [timeZone, countryCode] = await Promise.all([
    saved.timeZone || timeZoneAt(lat, lon).catch(() => ''),
    // Cerca de una ciudad de la lista propia el pais ya se sabe: no hace falta preguntarlo
    saved.countryCode || nearestCountryCode(lat, lon) || countryCodeAt(lat, lon).catch(() => '')
  ]);
  const info = { timeZone, countryCode };
  if (timeZone || countryCode) writeCache(key, info);
  return info;
}
