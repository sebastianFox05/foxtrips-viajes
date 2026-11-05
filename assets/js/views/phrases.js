/*
 * Frases utiles en ingles de Estados Unidos: por situacion, con traduccion,
 * pronunciacion aproximada, voz (Web Speech API en-US) y favoritas.
 */
import { icon } from '../icons.js';
import { PHRASE_CATEGORIES } from '../phrases.js';
import { esc } from '../utils.js';
import { registerSuggestions } from '../autocomplete.js';

const FAVORITES_KEY = 'foxtrips:fav-phrases';
const RATE_KEY = 'foxtrips:speech-rate';
const RATES = [
  { key: '1', label: 'Normal' },
  { key: '0.7', label: 'Lento' }
];
const hasSpeech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let activeCategory = PHRASE_CATEGORIES[0].key;
let searchText = '';
let playingButton = null;

/* ---- Preferencias ---- */

function readFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []);
  } catch {
    return new Set();
  }
}

function saveFavorites(favorites) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
}

function currentRate() {
  return localStorage.getItem(RATE_KEY) || '1';
}

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/* ---- Voz ---- */

function englishVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang === 'en-US' && /natural|google|samantha|aria|jenny/i.test(voice.name))
    || voices.find((voice) => voice.lang === 'en-US')
    || voices.find((voice) => voice.lang.startsWith('en'));
}

function stopSpeaking() {
  if (!hasSpeech) return;
  window.speechSynthesis.cancel();
  playingButton?.closest('.phrase')?.classList.remove('phrase--playing');
  playingButton = null;
}

/* ---- Plantillas ---- */

function visiblePhrases(favorites) {
  const text = normalize(searchText);
  const all = PHRASE_CATEGORIES.flatMap((category) => category.phrases.map((phrase) => ({ ...phrase, category })));
  if (text) return all.filter((phrase) => normalize(`${phrase.en} ${phrase.es}`).includes(text));
  if (activeCategory === 'favoritas') return all.filter((phrase) => favorites.has(phrase.en));
  return all.filter((phrase) => phrase.category.key === activeCategory);
}

function phraseHtml(phrase, favorites, isSearch) {
  const isFavorite = favorites.has(phrase.en);
  return `
    <li class="phrase">
      ${hasSpeech ? `<button class="phrase__play" type="button" data-action="speak-phrase" data-text="${esc(phrase.en)}" aria-label="Escuchar: ${esc(phrase.en)}">${icon('speak', 22)}</button>` : ''}
      <div class="phrase__body">
        ${isSearch ? `<span class="phrase__category">${esc(phrase.category.label)}</span>` : ''}
        <p class="phrase__en" lang="en-US">${esc(phrase.en)}</p>
        <p class="phrase__es">${esc(phrase.es)}</p>
        <p class="phrase__say"><span class="visually-hidden">Pronunciación aproximada: </span>${esc(phrase.say)}</p>
      </div>
      <button class="phrase__fav ${isFavorite ? 'phrase__fav--active' : ''}" type="button" data-action="fav-phrase" data-text="${esc(phrase.en)}"
        aria-pressed="${isFavorite}" aria-label="${isFavorite ? 'Quitar de favoritas' : 'Guardar en favoritas'}: ${esc(phrase.en)}">${icon(isFavorite ? 'heartFill' : 'heart', 20)}</button>
    </li>`;
}

function listHtml() {
  const favorites = readFavorites();
  const isSearch = Boolean(searchText.trim());
  const list = visiblePhrases(favorites);
  const category = PHRASE_CATEGORIES.find((item) => item.key === activeCategory);
  const tip = !isSearch && category?.tip ? `
    <aside class="phrase-tip" aria-label="Consejo">
      <span class="phrase-tip__icon">${icon('star', 18)}</span>
      <p class="phrase-tip__text"><strong>Consejo:</strong> ${esc(category.tip)}</p>
    </aside>` : '';
  if (!list.length) {
    const message = isSearch ? 'No encontramos frases con esa búsqueda.' : 'Aún no tienes favoritas. Pulsa el corazón de una frase para guardarla aquí.';
    return `${tip}<p class="empty">${message}</p>`;
  }
  return `${tip}<ul class="phrase-list">${list.map((phrase) => phraseHtml(phrase, favorites, isSearch)).join('')}</ul>`;
}

function chipsHtml() {
  const favoriteCount = readFavorites().size;
  const options = PHRASE_CATEGORIES.map((category) => ({ key: category.key, label: category.label, icon: category.icon }))
    .concat({ key: 'favoritas', label: `Favoritas (${favoriteCount})`, icon: 'heart' });
  return options.map((option) => `
    <li><button class="chip ${option.key === activeCategory && !searchText ? 'chip--active' : ''}" type="button" data-action="phrase-category" data-category="${option.key}" aria-pressed="${option.key === activeCategory && !searchText}">
      <span class="chip__icon">${icon(option.icon, 18)}</span>${esc(option.label)}
    </button></li>`).join('');
}

/* Sugerencias: primero categorias ("Cafeteria"), luego frases en español o ingles */
function phraseSuggestions(query) {
  const text = normalize(query);
  const categories = PHRASE_CATEGORIES
    .filter((category) => normalize(category.label).includes(text))
    .map((category) => ({ name: category.label, detail: `Categoría · ${category.phrases.length} frases`, value: '', category: category.key, icon: category.icon }));
  const phrases = PHRASE_CATEGORIES
    .flatMap((category) => category.phrases.map((phrase) => ({ phrase, category })))
    .filter(({ phrase }) => normalize(`${phrase.en} ${phrase.es}`).includes(text))
    .slice(0, 6)
    .map(({ phrase, category }) => ({ name: phrase.en, detail: `${phrase.es} · ${category.label}`, value: phrase.en, icon: 'speak' }));
  return [...categories, ...phrases].slice(0, 8);
}

function phrasePickHandler(event) {
  const category = event.detail?.category;
  if (!category) return;
  // Elegir una categoria: se abre esa categoria y se limpia el buscador
  activeCategory = category;
  searchText = '';
}

function refreshList() {
  document.getElementById('phraseChips').innerHTML = chipsHtml();
  document.getElementById('phraseList').innerHTML = listHtml();
}

/* ---- Handlers ---- */

function phraseCategoryHandler(button) {
  stopSpeaking();
  activeCategory = button.dataset.category;
  searchText = '';
  const search = document.getElementById('phraseSearch');
  if (search) search.value = '';
  refreshList();
}

function searchPhrasesHandler(input) {
  searchText = input.value;
  refreshList();
}

function speakPhraseHandler(button) {
  const isSameButton = playingButton === button;
  stopSpeaking();
  if (isSameButton) return;
  const utterance = new SpeechSynthesisUtterance(button.dataset.text);
  utterance.lang = 'en-US';
  utterance.rate = Number(currentRate());
  const voice = englishVoice();
  if (voice) utterance.voice = voice;
  const card = button.closest('.phrase');
  utterance.onend = () => {
    card?.classList.remove('phrase--playing');
    if (playingButton === button) playingButton = null;
  };
  card?.classList.add('phrase--playing');
  playingButton = button;
  window.speechSynthesis.speak(utterance);
}

function favPhraseHandler(button) {
  const favorites = readFavorites();
  const text = button.dataset.text;
  if (favorites.has(text)) favorites.delete(text);
  else favorites.add(text);
  saveFavorites(favorites);
  refreshList();
  document.querySelector(`[data-action="fav-phrase"][data-text="${CSS.escape(text)}"]`)?.focus();
}

function speechRateHandler(button) {
  localStorage.setItem(RATE_KEY, button.dataset.rate);
  document.querySelectorAll('[data-action="speech-rate"]').forEach((item) => {
    const isActive = item.dataset.rate === button.dataset.rate;
    item.classList.toggle('segmented__btn--active', isActive);
    item.setAttribute('aria-pressed', String(isActive));
  });
}

export default {
  async render() {
    const rate = currentRate();
    return `
      <div class="section__head">
        <div>
          <h2>Frases útiles</h2>
          <p class="section__hint">${icon('translate', 14)} Inglés de Estados Unidos para el día a día</p>
        </div>
        ${hasSpeech ? `
        <div class="segmented segmented--compact" role="group" aria-label="Velocidad de la voz">
          ${RATES.map((item) => `<button class="segmented__btn ${item.key === rate ? 'segmented__btn--active' : ''}" type="button" data-action="speech-rate" data-rate="${item.key}" aria-pressed="${item.key === rate}">${item.label}</button>`).join('')}
        </div>` : ''}
      </div>
      <label class="search">
        ${icon('search')}
        <span class="visually-hidden">Buscar frase en español o inglés</span>
        <input class="search__input" id="phraseSearch" type="search" placeholder="Busca: café, talla, metro, cuenta…" value="${esc(searchText)}" data-input="search-phrases" autocomplete="off" data-autocomplete="phrase">
      </label>
      <ul class="chips" id="phraseChips">${chipsHtml()}</ul>
      ${hasSpeech ? '' : '<p class="section__hint">Tu navegador no permite reproducir voz; aun así puedes leer la pronunciación.</p>'}
      <div id="phraseList">${listHtml()}</div>`;
  },
  mount(ctx, root) {
    root.querySelector('#phraseSearch')?.addEventListener('suggest:select', phrasePickHandler);
    // Algunas voces se cargan despues del primer render
    if (hasSpeech) window.speechSynthesis.getVoices();
  },
  unmount() {
    stopSpeaking();
  },
  actions: {
    'phrase-category': phraseCategoryHandler,
    'speak-phrase': speakPhraseHandler,
    'fav-phrase': favPhraseHandler,
    'speech-rate': speechRateHandler
  },
  inputs: { 'search-phrases': searchPhrasesHandler }
};

registerSuggestions('phrase', phraseSuggestions, { minLength: 2, label: 'Frases y categorías sugeridas' });
