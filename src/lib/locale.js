/*
 * Formatos regionales: horas (12 h / 24 h), temperatura (°C / °F), distancias (km / millas),
 * nombres de paises, idiomas y monedas, y horas en otra zona horaria.
 * Cada preferencia vale "auto" (segun la region del dispositivo) hasta que se cambia en Perfil.
 */
import { getLanguage } from './i18n/index.js';

const PREF_PREFIX = 'foxtrips:pref:';
const DEFAULT_LOCALES = { es: 'es', en: 'en-US', pt: 'pt-BR' };
const FAHRENHEIT_REGIONS = ['US', 'BS', 'BZ', 'KY', 'PW', 'LR', 'FM', 'MH'];
const MILE_REGIONS = ['US', 'GB', 'LR', 'MM'];
const KM_PER_MILE = 1.609344;
const FEET_PER_KM = 3280.84;

export const PREFERENCES = {
  hour: ['auto', '12', '24'],
  temp: ['auto', 'C', 'F'],
  dist: ['auto', 'km', 'mi']
};

/* ---- Region e idioma del dispositivo ---- */

/* Region del dispositivo en mayusculas ("CO", "US"…) o '' si el navegador no la da */
export function deviceRegion() {
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  for (const tag of tags) {
    const region = String(tag).split('-').find((part, index) => index > 0 && /^[A-Za-z]{2}$/.test(part));
    if (region) return region.toUpperCase();
  }
  return '';
}

/*
 * Configuracion regional para fechas y numeros: la del dispositivo si es del idioma en uso
 * (es-CO, en-GB, pt-PT…); si no, la general de ese idioma.
 */
export function intlLocale() {
  const language = getLanguage();
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  const match = tags.find((tag) => String(tag).toLowerCase().split('-')[0] === language);
  return match || DEFAULT_LOCALES[language] || language;
}

/* ---- Preferencias ---- */

export function getPreference(name) {
  try {
    const saved = localStorage.getItem(PREF_PREFIX + name);
    return PREFERENCES[name]?.includes(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
}

export function setPreference(name, value) {
  try {
    if (value === 'auto' || !PREFERENCES[name]?.includes(value)) localStorage.removeItem(PREF_PREFIX + name);
    else localStorage.setItem(PREF_PREFIX + name, value);
  } catch {
    /* sin almacenamiento */
  }
}

/* Lo que vale "auto" en este dispositivo: '12' | '24', 'C' | 'F', 'km' | 'mi' */
export function automaticValue(name) {
  if (name === 'temp') return FAHRENHEIT_REGIONS.includes(deviceRegion()) ? 'F' : 'C';
  if (name === 'dist') return MILE_REGIONS.includes(deviceRegion()) ? 'mi' : 'km';
  try {
    return new Intl.DateTimeFormat(intlLocale(), { hour: 'numeric' }).resolvedOptions().hour12 ? '12' : '24';
  } catch {
    return '24';
  }
}

function preferenceValue(name) {
  const preference = getPreference(name);
  return preference === 'auto' ? automaticValue(name) : preference;
}

export function uses12Hours() {
  return preferenceValue('hour') === '12';
}

export function temperatureUnit() {
  return preferenceValue('temp');
}

export function distanceUnit() {
  return preferenceValue('dist');
}

/* ---- Formatos ---- */

function timeOptions(extra = {}) {
  return { hour: uses12Hours() ? 'numeric' : '2-digit', minute: '2-digit', hour12: uses12Hours(), ...extra };
}

/* Hora de un plan ("14:30", hora local del destino) en el formato elegido: "14:30" o "2:30 p. m." */
export function formatTime(time) {
  const match = /^(\d{1,2}):(\d{2})/.exec(time || '');
  if (!match) return time || '';
  if (!uses12Hours()) return `${match[1].padStart(2, '0')}:${match[2]}`;
  return new Date(2000, 0, 1, Number(match[1]), Number(match[2])).toLocaleTimeString(intlLocale(), timeOptions());
}

/* Opciones de hora para toLocaleString segun la preferencia de 12 h / 24 h */
export function clockOptions() {
  return timeOptions();
}

/* Temperatura (llega en °C) en la unidad elegida, sin decimales */
export function formatDegrees(celsius) {
  return Math.round(temperatureUnit() === 'F' ? (celsius * 9) / 5 + 32 : celsius);
}

function formatNumber(value, digits = 1) {
  return new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

/* Distancia (llega en km): "350 m" / "2,4 km" o "0.2 mi" / "800 ft" */
export function formatDistance(km) {
  if (distanceUnit() === 'mi') {
    const miles = km / KM_PER_MILE;
    return miles < 0.1 ? `${Math.round((km * FEET_PER_KM) / 10) * 10} ft` : `${formatNumber(miles)} mi`;
  }
  return km < 1 ? `${Math.round(km * 1000)} m` : `${formatNumber(km)} km`;
}

/* ---- Nombres en el idioma en uso ---- */

function displayName(type, code) {
  try {
    return new Intl.DisplayNames([intlLocale()], { type }).of(code) || code;
  } catch {
    return code;
  }
}

export function countryName(code) {
  return code ? displayName('region', String(code).toUpperCase()) : '';
}

/* Nombre de un idioma; isTitle lo pone con mayuscula inicial (para listas) */
export function languageName(code, isTitle = false) {
  const name = displayName('language', code);
  return isTitle ? name.charAt(0).toLocaleUpperCase(intlLocale()) + name.slice(1) : name;
}

export function currencyName(code) {
  const name = displayName('currency', code);
  return name === code ? code : `${code} · ${name}`;
}

/* ---- Zonas horarias ---- */

/* Diferencia con UTC, en minutos, de una zona horaria en un momento dado */
export function zoneOffsetMinutes(timeZone, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
    }).formatToParts(date);
    const value = (type) => Number(parts.find((part) => part.type === type)?.value);
    const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return -date.getTimezoneOffset();
  }
}

/* Horas que el destino va por delante (+) o por detras (−) del dispositivo; 0 si coinciden o no se conoce */
export function zoneDifferenceHours(timeZone, date = new Date()) {
  if (!timeZone) return 0;
  return (zoneOffsetMinutes(timeZone, date) + date.getTimezoneOffset()) / 60;
}

/* Fecha de hoy (YYYY-MM-DD) en una zona horaria */
export function todayIn(timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return null;
  }
}

/* Hora actual en una zona horaria, en el formato elegido */
export function timeIn(timeZone, date = new Date()) {
  try {
    return date.toLocaleTimeString(intlLocale(), timeOptions({ timeZone }));
  } catch {
    return '';
  }
}

/* "GMT+1", "GMT-5"… */
export function zoneLabel(timeZone, date = new Date()) {
  const minutes = zoneOffsetMinutes(timeZone, date);
  const sign = minutes < 0 ? '-' : '+';
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  return `GMT${sign}${hours}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`;
}

/* Numero de horas sin ceros de mas: 6 → "6", 5.5 → "5,5" */
export function formatHours(hours) {
  return new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 2 }).format(Math.abs(hours));
}
