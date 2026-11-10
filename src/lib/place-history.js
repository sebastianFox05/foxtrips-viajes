/*
 * Historia de cada plan: busca en Wikipedia el articulo del lugar y devuelve
 * "por que es famoso" (la introduccion del articulo) y un resumen de su seccion "Historia".
 *
 * Como se elige el articulo (en Wikipedia en espanol y en ingles a la vez):
 *   1) Articulos a menos de 1,5 km de las coordenadas del plan (si las tiene).
 *   2) Busqueda de texto con las partes del titulo del plan y con el lugar; estos deben estar a menos de 40 km.
 *   El articulo tiene que parecerse al TITULO del plan (2 palabras en comun, o la mayoria de las suyas).
 *   Si ninguno se parece, no se muestra nada: mejor nada que la historia de otro sitio.
 * Se prefiere el espanol; si el mejor es un articulo en ingles, se usa su version en espanol si existe.
 */
import { getLanguage, t } from './i18n/index.js';

const CACHE_PREFIX = 'foxtrips:historia:';
const CACHE_TTL = 30 * 86400000;
const MISS_TTL = 86400000;
const NEAR_METERS = 1500;
const MAX_KM = 40;
const MIN_RATIO = 0.6;
const ENGLISH_ADVANTAGE = 0.1;
const INTRO_CHARS = 750;
const HISTORY_CHARS = 950;
const HISTORY_HEADINGS = /^(historia|history|historia y .+|history and .+|antecedentes|origen|origenes|background)$/;
// Palabras que no sirven para reconocer un lugar (genericas o de logistica del plan)
const STOP_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'a', 'al', 'con', 'por', 'para', 'un', 'una', 'su', 'sus', 'desde', 'hacia',
  'the', 'of', 'and', 'at', 'in', 'on', 'to', 'for',
  'visita', 'visitar', 'paseo', 'tour', 'entrada', 'entradas', 'gratis', 'ver', 'plan', 'planes', 'dia', 'noche', 'manana', 'tarde',
  'cena', 'almuerzo', 'desayuno', 'comida', 'compras', 'salida', 'llegada', 'regreso', 'traslado', 'vuelo', 'check',
  'encendido', 'vistas', 'vista', 'tiendas', 'fuera', 'opcional', 'aprox', 'cruzar',
  'calle', 'avenida', 'ave', 'street', 'avenue', 'manhattan', 'nueva', 'york', 'new', 'nyc', 'usa',
  'pensilvania', 'pennsylvania', 'maryland', 'jersey'
]);
// Ingles → espanol, para comparar titulos de los dos idiomas ("Brooklyn Bridge" = "Puente de Brooklyn")
const SYNONYMS = {
  museum: 'museo', bridge: 'puente', park: 'parque', library: 'biblioteca', square: 'plaza', island: 'isla',
  market: 'mercado', cathedral: 'catedral', church: 'iglesia', tower: 'torre', center: 'centro', centre: 'centro',
  station: 'estacion', statue: 'estatua', liberty: 'libertad', garden: 'jardin', gardens: 'jardin', christmas: 'navidad',
  tree: 'arbol', history: 'historia', art: 'arte', modern: 'moderno', metropolitan: 'metropolitano', building: 'edificio',
  memorial: 'monumento', theater: 'teatro', theatre: 'teatro', harbor: 'puerto', beach: 'playa', lake: 'lago',
  mountain: 'montana', falls: 'cataratas', house: 'casa', capitol: 'capitolio', national: 'nacional', public: 'publica',
  lights: 'luces', hall: 'sala', zoo: 'zoologico', aquarium: 'acuario', castle: 'castillo', palace: 'palacio'
};
// Siglas frecuentes en los planes → nombre completo
const ALIASES = {
  jfk: 'aeropuerto john kennedy', lga: 'aeropuerto laguardia', ewr: 'aeropuerto newark', met: 'museo metropolitano arte',
  moma: 'museo arte moderno', dc: 'washington'
};

/* ---- Utilidades ---- */

function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/* Palabras utiles de un texto. Las siglas solo se amplian en el texto del plan (isPlan), no en los articulos */
function tokens(text, isPlan = false) {
  const base = normalize(text);
  const expanded = isPlan
    ? Object.entries(ALIASES).reduce((value, [short, long]) => value.replace(new RegExp(`\\b${short}\\b`, 'g'), `${short} ${long}`), base)
    : base;
  const words = expanded.split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  return new Set(words.map((word) => SYNONYMS[word] || word));
}

function distanceKm(latA, lonA, latB, lonB) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const value = Math.sin(toRad(latB - latA) / 2) ** 2
    + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(toRad(lonB - lonA) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function readCache(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_PREFIX + key));
    if (!saved) return undefined;
    const ttl = saved.value ? CACHE_TTL : MISS_TTL;
    return Date.now() - saved.at < ttl ? saved.value : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* cache llena */
  }
}

async function wiki(lang, params) {
  const query = new URLSearchParams({ action: 'query', format: 'json', origin: '*', ...params });
  const response = await fetch(`https://${lang}.wikipedia.org/w/api.php?${query}`);
  if (!response.ok) throw new Error(t('Wikipedia no respondió. Inténtalo en un momento.'));
  return response.json();
}

/* Recorta en el final de una frase, sin pasar del maximo */
function trimText(text, max) {
  const clean = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  return lastStop > max * 0.4 ? cut.slice(0, lastStop + 1).trim() : `${cut.trim()}…`;
}

/* ---- Elegir el articulo ---- */

/*
 * Textos para buscar: las dos primeras partes del titulo ("Hudson Yards: The Edge + Vessel" → "Hudson Yards", "The Edge")
 * sin parentesis, y la primera parte del lugar.
 */
function searchTexts(activity) {
  const parts = String(activity.title || '').replace(/\([^)]*\)/g, ' ').split(/[→:+·/]/).map((text) => text.trim()).slice(0, 2);
  const place = String(activity.place || '').split(/[,·]/)[0].replace(/^\d+\s+/, '').trim();
  return [...new Set([...parts, place].filter((text) => tokens(text).size))];
}

/*
 * Parecido entre un articulo y el plan (0 = descartado).
 * - Debe compartir palabras con el TITULO del plan: la direccion sola no basta ("Katz's Delicatessen" no es "Calle Houston").
 * - Un numero que el plan no menciona descarta el articulo ("1501 Broadway" no es "Musical de Broadway").
 */
function score(candidate, wanted, titleWords, planText) {
  const words = [...tokens(candidate.title)];
  if (!words.length || !words.some((word) => titleWords.has(word))) return 0;
  const numbers = normalize(candidate.title).match(/\d+/g) || [];
  if (numbers.some((number) => !new RegExp(`(^|\\D)${number}(\\D|$)`).test(planText))) return 0;
  const shared = words.filter((word) => wanted.has(word)).length;
  const ratio = shared / words.length;
  if (shared < 2 && ratio < MIN_RATIO) return 0;
  return ratio + shared * 0.15 + (candidate.isNear ? 0.05 : 0) - candidate.title.length * 0.001;
}

async function candidatesFor(lang, activity) {
  const hasCoords = activity.lat != null && activity.lon != null;
  const requests = searchTexts(activity).map((text) => wiki(lang, { list: 'search', srsearch: text, srlimit: '6', srnamespace: '0' })
    .then((data) => (data.query?.search || []).map((item) => ({ title: item.title, isNear: false }))));
  if (hasCoords) {
    requests.push(wiki(lang, { list: 'geosearch', gscoord: `${activity.lat}|${activity.lon}`, gsradius: String(NEAR_METERS), gslimit: '50' })
      .then((data) => (data.query?.geosearch || []).map((item) => ({ title: item.title, isNear: true }))));
  }
  // Un mismo articulo puede salir por cercania y por texto: se queda la version "cerca"
  const byTitle = new Map();
  for (const group of await Promise.all(requests)) {
    for (const item of group) if (!byTitle.has(item.title) || item.isNear) byTitle.set(item.title, item);
  }
  return [...byTitle.values()];
}

/* Mejor articulo en un idioma: { title, score } o null */
async function bestMatch(lang, activity) {
  const titleWords = tokens(activity.title, true);
  const planText = normalize(`${activity.title} ${activity.place || ''}`);
  const wanted = tokens(planText, true);
  if (!titleWords.size) return null;
  const ranked = (await candidatesFor(lang, activity))
    .map((candidate) => {
      const words = [...tokens(candidate.title)];
      const isExact = words.length >= 2 && words.every((word) => titleWords.has(word));
      return { ...candidate, isExact, score: score(candidate, wanted, titleWords, planText) };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 5);
  if (!ranked.length) return null;
  // Los encontrados por texto deben ser un lugar (con coordenadas) cerca del plan:
  // evita "Little Italy" de otra ciudad, un disco llamado "Brooklyn Bridge…" o el articulo general "Musical"
  const hasCoords = activity.lat != null && activity.lon != null;
  const info = await wiki(lang, { prop: 'coordinates', titles: ranked.map((item) => item.title).join('|') });
  const pages = Object.values(info.query?.pages || {});
  for (const candidate of ranked) {
    if (candidate.isNear || !hasCoords) return candidate;
    const point = pages.find((item) => item.title === candidate.title)?.coordinates?.[0];
    if (point && distanceKm(activity.lat, activity.lon, point.lat, point.lon) <= MAX_KM) return candidate;
    // Sin coordenadas (trenes turisticos, eventos): solo si el titulo coincide entero con el plan
    if (!point && candidate.isExact) return candidate;
  }
  return null;
}

/* ---- Texto del articulo ---- */

function splitSections(text) {
  const parts = text.split(/\n(?===)/);
  const intro = parts.shift() || '';
  const sections = parts.map((part) => {
    const match = part.match(/^(=+)\s*(.+?)\s*=+[ \t]*\n?/);
    return { level: match ? match[1].length : 2, heading: match ? match[2] : '', body: match ? part.slice(match[0].length) : part };
  });
  return { intro, sections };
}

function historyOf(sections) {
  const start = sections.findIndex((section) => section.level === 2 && HISTORY_HEADINGS.test(normalize(section.heading).trim()));
  if (start === -1) return '';
  const body = [];
  for (let index = start; index < sections.length; index += 1) {
    if (index > start && sections[index].level <= 2) break;
    body.push(sections[index].body);
  }
  return body.join('\n').trim();
}

async function article(lang, title) {
  const data = await wiki(lang, {
    prop: 'extracts|description|info', titles: title, redirects: '1',
    explaintext: '1', exsectionformat: 'wiki', inprop: 'url'
  });
  const page = Object.values(data.query?.pages || {})[0];
  if (!page || page.missing !== undefined || !page.extract) return null;
  const { intro, sections } = splitSections(page.extract);
  const introText = trimText(intro, INTRO_CHARS);
  if (introText.length < 60) return null;
  return {
    title: page.title,
    description: page.description || '',
    intro: introText,
    history: trimText(historyOf(sections), HISTORY_CHARS),
    url: page.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
    lang
  };
}

/* Titulo del mismo articulo en otro idioma (a partir del de Wikipedia en ingles) */
async function localVersion(enTitle, lang) {
  const data = await wiki('en', { prop: 'langlinks', titles: enTitle, lllang: lang, redirects: '1' });
  const page = Object.values(data.query?.pages || {})[0];
  return page?.langlinks?.[0]?.['*'] || null;
}

/* ---- API publica ---- */

/*
 * Historia del lugar de un plan.
 * Devuelve { title, description, intro, history, url, lang } o null si no se encuentra.
 * Si Wikipedia falla lanza un error (y no se guarda nada en cache, para reintentar).
 */
export async function placeHistory(activity) {
  // Se busca en la Wikipedia del idioma de la app y en la inglesa (la mas completa)
  const lang = getLanguage();
  const key = normalize(`${lang === 'es' ? '' : `${lang}|`}${activity.title}|${activity.place || ''}|${activity.lat ?? ''}|${activity.lon ?? ''}`);
  const cached = readCache(key);
  if (cached !== undefined) return cached;

  const [inLocal, inEnglish] = await Promise.all([lang === 'en' ? null : bestMatch(lang, activity), bestMatch('en', activity)]);
  let result = null;
  const isEnglishBetter = inEnglish && (!inLocal || inEnglish.score > inLocal.score + ENGLISH_ADVANTAGE);
  if (isEnglishBetter) {
    const translated = lang === 'en' ? null : await localVersion(inEnglish.title, lang);
    result = (translated && await article(lang, translated)) || await article('en', inEnglish.title);
  }
  if (!result && inLocal) result = await article(lang, inLocal.title);
  if (!result && inEnglish && !isEnglishBetter) result = await article('en', inEnglish.title);
  writeCache(key, result);
  return result;
}
