/*
 * Idioma de la interfaz. Los textos del codigo estan en español y sirven de clave:
 *   t('Faltan {n} días', { n: 3 })  →  "3 days to go" (en) · "Faltam 3 dias" (pt) · el propio texto (es)
 * Si falta una traduccion se muestra el texto en español. Para añadir un idioma: un archivo como en.js
 * con las mismas claves, y una linea en LANGUAGES y en DICTIONARIES.
 * El idioma se elige solo segun el dispositivo y se puede cambiar en Perfil (se guarda en este navegador).
 */
import en from './en.js';
import pt from './pt.js';

export const LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' }
];

const DICTIONARIES = { en, pt };
const LANGUAGE_KEY = 'foxtrips:lang';
const FALLBACK_LANGUAGE = 'en';
const isSupported = (code) => LANGUAGES.some((language) => language.code === code);

function readChoice() {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return isSupported(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
}

/* Primer idioma del dispositivo que la app tiene; si no hay ninguno, ingles */
export function deviceLanguage() {
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  for (const tag of tags) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (isSupported(base)) return base;
  }
  return FALLBACK_LANGUAGE;
}

let choice = readChoice();
let current = choice === 'auto' ? deviceLanguage() : choice;

/* Idioma en uso: 'es' | 'en' | 'pt' */
export function getLanguage() {
  return current;
}

/* Lo elegido en Perfil: 'auto' o un codigo de idioma */
export function getLanguageChoice() {
  return choice;
}

/* Guarda la eleccion. Devuelve true si cambia el idioma en uso (la app se recarga para aplicarlo). */
export function setLanguageChoice(value) {
  const next = isSupported(value) ? value : 'auto';
  try {
    if (next === 'auto') localStorage.removeItem(LANGUAGE_KEY);
    else localStorage.setItem(LANGUAGE_KEY, next);
  } catch {
    /* sin almacenamiento: vale solo para esta visita */
  }
  choice = next;
  const language = next === 'auto' ? deviceLanguage() : next;
  const hasChanged = language !== current;
  current = language;
  return hasChanged;
}

function fill(text, values) {
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (values[name] ?? match));
}

/* Traduce un texto (la clave es el texto en español) y rellena sus {valores} */
export function t(text, values) {
  const translated = DICTIONARIES[current]?.[text];
  return fill(translated ?? text, values);
}

/* Singular o plural segun n (los tres idiomas usan la misma regla: 1 es singular) */
export function tn(count, one, other, values) {
  return t(count === 1 ? one : other, { n: count, ...values });
}

/* Marca un texto para traducir mas tarde con t() (listas fijas que se crean antes de saber el idioma) */
export function m(text) {
  return text;
}

/* Etiqueta <html lang> y descripcion de la pagina en el idioma en uso */
export function applyDocumentLanguage() {
  document.documentElement.lang = current;
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('FoxTrips: organiza viajes en grupo con itinerario compartido, mapa, álbum de fotos, votaciones, diario y documentos.'));
}
