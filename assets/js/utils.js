/* Utilidades compartidas: escape de HTML, fechas, formato y pequeños ayudantes. */

const LOCALE = 'es';
const DAY_MS = 86400000;
const AVATAR_HUES = [12, 28, 160, 200, 260, 320, 45, 100];
const CURRENCY_BY_REGION = { CO: 'COP', ES: 'EUR', MX: 'MXN', AR: 'ARS', CL: 'CLP', PE: 'PEN', US: 'USD', BR: 'BRL', UY: 'UYU', EC: 'USD' };

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* Solo deja pasar enlaces http(s): evita "javascript:" y similares en href */
export function safeUrl(value) {
  try {
    const url = new URL(value, location.href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

export function uid() {
  return crypto.randomUUID();
}

export function randomCode(length = 10) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

/* ---- Fechas (cadenas YYYY-MM-DD en hora local) ---- */

export function parseDay(day) {
  const [year, month, date] = String(day).split('-').map(Number);
  return new Date(year, month - 1, date);
}

export function toDay(date) {
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function today() {
  return toDay(new Date());
}

export function eachDay(start, end) {
  if (!start || !end) return [];
  const days = [];
  const cursor = parseDay(start);
  const last = parseDay(end);
  while (cursor <= last && days.length < 120) {
    days.push(toDay(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function daysBetween(fromDay, toDayValue) {
  return Math.round((parseDay(toDayValue) - parseDay(fromDay)) / DAY_MS);
}

export function formatDay(day, options = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return parseDay(day).toLocaleDateString(LOCALE, options);
}

export function formatShort(day) {
  return parseDay(day).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

export function formatRange(start, end) {
  if (!start) return 'Sin fechas';
  if (!end || start === end) return formatShort(start);
  return `${formatShort(start)} – ${formatShort(end)}`;
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  if (seconds < 60) return 'ahora';
  if (seconds < 3600) return formatter.format(-Math.round(seconds / 60), 'minute');
  if (seconds < 86400) return formatter.format(-Math.round(seconds / 3600), 'hour');
  if (seconds < 604800) return formatter.format(-Math.round(seconds / 86400), 'day');
  return formatDateTime(iso);
}

/* Estado del viaje respecto a hoy */
export function tripStatus(trip) {
  const now = today();
  if (!trip.start_date) return { key: 'draft', label: 'Sin fechas' };
  const end = trip.end_date || trip.start_date;
  if (now < trip.start_date) {
    const days = daysBetween(now, trip.start_date);
    return { key: 'upcoming', label: days === 1 ? 'Mañana' : `Faltan ${days} días`, days };
  }
  if (now <= end) {
    return { key: 'ongoing', label: `Día ${daysBetween(trip.start_date, now) + 1} del viaje` };
  }
  return { key: 'past', label: 'Terminado' };
}

/* ---- Personas ---- */

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

export function avatarHtml(name, extraClass = '') {
  const text = String(name || '?');
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = AVATAR_HUES[hash % AVATAR_HUES.length];
  return `<span class="avatar ${extraClass}" style="--avatar-hue:${hue}" title="${esc(text)}" aria-hidden="true">${esc(initials(text))}</span>`;
}

export function avatarStackHtml(names, max = 3) {
  if (!names.length) return '';
  const shown = names.slice(0, max).map((name) => avatarHtml(name)).join('');
  const rest = names.length > max ? `<span class="avatar-stack__more">+${names.length - max}</span>` : '';
  return `<span class="avatar-stack" aria-label="${esc(names.join(', '))}">${shown}${rest}</span>`;
}

/* ---- Varios ---- */

export function defaultCurrency() {
  const region = (navigator.language.split('-')[1] || '').toUpperCase();
  return CURRENCY_BY_REGION[region] || 'USD';
}

export function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function debounce(callback, wait = 250) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), wait);
  };
}

export function formToObject(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    if (!(value instanceof File)) data[key] = typeof value === 'string' ? value.trim() : value;
  });
  return data;
}

export function sortActivities(list) {
  return [...list].sort((first, second) =>
    (first.day || '').localeCompare(second.day || '') ||
    (first.time || '99:99').localeCompare(second.time || '99:99') ||
    (first.created_at || '').localeCompare(second.created_at || ''));
}

export function fileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
