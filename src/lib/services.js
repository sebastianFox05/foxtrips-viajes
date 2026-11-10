/* Servicios externos gratuitos y sin clave: geocodificacion, clima, zona horaria y divisas. */
import { getLanguage, m, t } from './i18n/index.js';

const GEOCODE_URL = 'https://nominatim.openstreetmap.org/search';
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const RATES_URL = 'https://open.er-api.com/v6/latest/';
const RATES_TTL = 6 * 3600 * 1000;
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const FORECAST_DAYS = 15;
const TYPICAL_YEARS = 3;
const WEATHER_TTL = 3 * 3600 * 1000;
const WEATHER_CODES = [
  [0, '☀️', m('Despejado')], [2, '🌤️', m('Poco nuboso')], [3, '☁️', m('Nublado')], [48, '🌫️', m('Niebla')],
  [57, '🌦️', m('Llovizna')], [67, '🌧️', m('Lluvia')], [77, '🌨️', m('Nieve')], [82, '🌧️', m('Chubascos')],
  [86, '🌨️', m('Chubascos de nieve')], [99, '⛈️', m('Tormenta')]
];

const NEAR_DEGREES = 0.6;

let lastGeocode = 0;

/* Nominatim pide como maximo 1 peticion por segundo */
async function searchPlace(query, near) {
  const wait = Math.max(0, 1100 - (Date.now() - lastGeocode));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastGeocode = Date.now();
  let url = `${GEOCODE_URL}?format=jsonv2&limit=1&accept-language=${getLanguage()}&q=${encodeURIComponent(query)}`;
  if (near) {
    const box = [near.lon - NEAR_DEGREES, near.lat + NEAR_DEGREES, near.lon + NEAR_DEGREES, near.lat - NEAR_DEGREES];
    url += `&viewbox=${box.join(',')}&bounded=1`;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(t('No se pudo buscar la ubicación.'));
  const [place] = await response.json();
  return place ? { lat: Number(place.lat), lon: Number(place.lon), label: place.display_name } : null;
}

/*
 * Busca un lugar. Si se conoce el destino del viaje ("near"), primero busca cerca de el
 * y despues en todo el mundo; asi "Centro Historico" cae en la ciudad correcta.
 */
export async function geocode(query, near = null) {
  if (!query?.trim()) return null;
  if (near?.lat != null) {
    const nearby = await searchPlace(query, near);
    if (nearby) return nearby;
  }
  return searchPlace(query);
}

/* Nombre de la ciudad a partir de coordenadas (para "Donde estoy") */
export async function reverseGeocode(lat, lon) {
  const wait = Math.max(0, 1100 - (Date.now() - lastGeocode));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastGeocode = Date.now();
  const url = `${REVERSE_URL}?format=jsonv2&zoom=10&accept-language=${getLanguage()}&lat=${lat}&lon=${lon}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const address = data.address || {};
  const city = address.city || address.town || address.village || address.municipality || address.county || '';
  return { city, country: address.country || '', label: [city, address.country].filter(Boolean).join(', ') };
}

/* Codigo de pais (dos letras, mayusculas) de unas coordenadas, o '' si no se sabe */
export async function countryCodeAt(lat, lon) {
  const wait = Math.max(0, 1100 - (Date.now() - lastGeocode));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastGeocode = Date.now();
  const response = await fetch(`${REVERSE_URL}?format=jsonv2&zoom=3&lat=${lat}&lon=${lon}`);
  if (!response.ok) return '';
  const data = await response.json();
  return String(data.address?.country_code || '').toUpperCase();
}

/* Zona horaria (nombre IANA, por ejemplo "Europe/Rome") de unas coordenadas */
export async function timeZoneAt(lat, lon) {
  const response = await fetch(`${WEATHER_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`);
  if (!response.ok) return '';
  const data = await response.json();
  return data.timezone || '';
}

/* Posicion actual del dispositivo (pide permiso al navegador) */
export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error(t('Tu navegador no permite obtener la ubicación.')));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      (error) => reject(new Error(error.code === 1
        ? t('No diste permiso para usar tu ubicación. Puedes activarlo en el candado de la barra de direcciones.')
        : t('No pudimos obtener tu ubicación. Inténtalo de nuevo o busca la ciudad.'))),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }
    );
  });
}

export function weatherInfo(code) {
  const match = WEATHER_CODES.find(([max]) => code <= max) || WEATHER_CODES.at(-1);
  return { emoji: match[1], label: t(match[2]) };
}

export async function forecast(lat, lon) {
  const url = `${WEATHER_URL}?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(t('No se pudo cargar el clima.'));
  const { daily } = await response.json();
  return daily.time.map((day, index) => ({
    day,
    code: daily.weather_code[index],
    max: Math.round(daily.temperature_2m_max[index]),
    min: Math.round(daily.temperature_2m_min[index])
  }));
}

/* ---- Clima de los dias del viaje ---- */

function shiftYear(day, years) {
  const [year, rest] = [Number(day.slice(0, 4)), day.slice(4)];
  return `${year - years}${rest}`;
}

function addDaysIso(day, amount) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function mostFrequent(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((first, second) => second[1] - first[1])[0]?.[0] ?? 0;
}

async function dailyWeather(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(t('No se pudo cargar el clima.'));
  const { daily } = await response.json();
  return daily.time.map((day, index) => ({
    day,
    code: daily.weather_code[index],
    max: daily.temperature_2m_max[index],
    min: daily.temperature_2m_min[index]
  }));
}

async function forecastRange(lat, lon, start, end) {
  const url = `${WEATHER_URL}?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${start}&end_date=${end}`;
  return dailyWeather(url);
}

/* Clima tipico: promedio de las mismas fechas en los ultimos años */
async function typicalRange(lat, lon, start, end) {
  const years = await Promise.all(Array.from({ length: TYPICAL_YEARS }, (item, index) => {
    const url = `${ARCHIVE_URL}?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${shiftYear(start, index + 1)}&end_date=${shiftYear(end, index + 1)}`;
    return dailyWeather(url).catch(() => []);
  }));
  const valid = years.filter((list) => list.length);
  if (!valid.length) return [];
  return valid[0].map((entry, position) => {
    const sameDay = valid.map((list) => list[position]).filter((item) => item && item.max != null);
    const average = (key) => sameDay.reduce((total, item) => total + item[key], 0) / sameDay.length;
    return {
      day: addDaysIso(start, position),
      code: mostFrequent(sameDay.map((item) => item.code)),
      max: average('max'),
      min: average('min')
    };
  });
}

/*
 * Clima de cada dia del viaje en el lugar de ese dia.
 * points: [{ day: 'YYYY-MM-DD', lat, lon }]
 * Devuelve: [{ day, code, max, min, isForecast }]. Pronostico real hasta 15 dias vista; despues, clima tipico.
 */
export async function tripWeather(points) {
  const cacheKey = `foxtrips:tripweather:${points.map((point) => `${point.day}@${point.lat.toFixed(2)},${point.lon.toFixed(2)}`).join('|')}`;
  try {
    const saved = JSON.parse(localStorage.getItem(cacheKey));
    if (saved && Date.now() - saved.at < WEATHER_TTL) return saved.days;
  } catch {
    /* sin cache */
  }
  const lastForecastDay = addDaysIso(new Date().toISOString().slice(0, 10), FORECAST_DAYS);
  const groups = new Map();
  for (const point of points) {
    const key = `${point.lat.toFixed(2)},${point.lon.toFixed(2)}`;
    if (!groups.has(key)) groups.set(key, { lat: point.lat, lon: point.lon, days: [] });
    groups.get(key).days.push(point.day);
  }
  const byDay = new Map();
  await Promise.all([...groups.values()].map(async (group) => {
    const sorted = [...group.days].sort();
    const forecastDays = sorted.filter((day) => day <= lastForecastDay);
    const typicalDays = sorted.filter((day) => day > lastForecastDay);
    const [forecastList, typicalList] = await Promise.all([
      forecastDays.length ? forecastRange(group.lat, group.lon, forecastDays[0], forecastDays.at(-1)).catch(() => []) : [],
      typicalDays.length ? typicalRange(group.lat, group.lon, typicalDays[0], typicalDays.at(-1)) : []
    ]);
    forecastList.filter((item) => forecastDays.includes(item.day)).forEach((item) => byDay.set(item.day, { ...item, isForecast: true }));
    typicalList.filter((item) => typicalDays.includes(item.day)).forEach((item) => byDay.set(item.day, { ...item, isForecast: false }));
  }));
  const days = points.map((point) => byDay.get(point.day)).filter(Boolean).map((item) => ({
    ...item,
    max: Math.round(item.max),
    min: Math.round(item.min)
  }));
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), days }));
  } catch {
    /* cache llena */
  }
  return days;
}

export async function rates(base) {
  const key = `foxtrips:rates:${base}`;
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && Date.now() - saved.at < RATES_TTL) return saved.rates;
  } catch {
    /* sin cache */
  }
  const response = await fetch(RATES_URL + base);
  const data = await response.json();
  if (data.result !== 'success') throw new Error(t('No se pudieron cargar las divisas.'));
  localStorage.setItem(key, JSON.stringify({ at: Date.now(), rates: data.rates }));
  return data.rates;
}
