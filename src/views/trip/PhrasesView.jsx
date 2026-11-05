/*
 * Frases utiles en ingles de Estados Unidos: por situacion, con traduccion,
 * pronunciacion aproximada, voz (Web Speech API en-US) y favoritas.
 */
import { useEffect, useRef, useState } from 'react';
import { PHRASE_CATEGORIES } from '../../lib/phrases.js';
import { registerSuggestions } from '../../lib/suggestions.js';
import Icon from '../../components/Icon.jsx';
import Scroller from '../../components/Scroller.jsx';
import SuggestInput from '../../components/SuggestInput.jsx';

const FAVORITES_KEY = 'foxtrips:fav-phrases';
const RATE_KEY = 'foxtrips:speech-rate';
const RATES = [
  { key: '1', label: 'Normal' },
  { key: '0.7', label: 'Lento' }
];
const hasSpeech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

// Categoria y busqueda se recuerdan al volver a la pestaña
let rememberedCategory = PHRASE_CATEGORIES[0].key;
let rememberedSearch = '';

function readFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []);
  } catch {
    return new Set();
  }
}

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function englishVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang === 'en-US' && /natural|google|samantha|aria|jenny/i.test(voice.name))
    || voices.find((voice) => voice.lang === 'en-US')
    || voices.find((voice) => voice.lang.startsWith('en'));
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

registerSuggestions('phrase', phraseSuggestions, { minLength: 2, label: 'Frases y categorías sugeridas' });

export default function PhrasesView() {
  const [category, setCategory] = useState(rememberedCategory);
  const [searchText, setSearchText] = useState(rememberedSearch);
  const [favorites, setFavorites] = useState(readFavorites);
  const [rate, setRate] = useState(() => localStorage.getItem(RATE_KEY) || '1');
  const [playingText, setPlayingText] = useState(null);
  const searchRef = useRef(null);
  rememberedCategory = category;
  rememberedSearch = searchText;

  // Algunas voces se cargan despues del primer render; al salir se para la voz
  useEffect(() => {
    if (hasSpeech) window.speechSynthesis.getVoices();
    return () => {
      if (hasSpeech) window.speechSynthesis.cancel();
    };
  }, []);

  function stopSpeaking() {
    if (!hasSpeech) return;
    window.speechSynthesis.cancel();
    setPlayingText(null);
  }

  function speakHandler(text) {
    const isSame = playingText === text;
    stopSpeaking();
    if (isSame) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = Number(rate);
    const voice = englishVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => setPlayingText((current) => (current === text ? null : current));
    setPlayingText(text);
    window.speechSynthesis.speak(utterance);
  }

  function favHandler(text) {
    const next = new Set(favorites);
    if (next.has(text)) next.delete(text);
    else next.add(text);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
    setFavorites(next);
  }

  function categoryHandler(key) {
    stopSpeaking();
    setCategory(key);
    setSearchText('');
    if (searchRef.current) searchRef.current.value = '';
  }

  function rateHandler(key) {
    localStorage.setItem(RATE_KEY, key);
    setRate(key);
  }

  const isSearch = Boolean(searchText.trim());
  const text = normalize(searchText);
  const all = PHRASE_CATEGORIES.flatMap((item) => item.phrases.map((phrase) => ({ ...phrase, category: item })));
  let list;
  if (text) list = all.filter((phrase) => normalize(`${phrase.en} ${phrase.es}`).includes(text));
  else if (category === 'favoritas') list = all.filter((phrase) => favorites.has(phrase.en));
  else list = all.filter((phrase) => phrase.category.key === category);
  const activeCategory = PHRASE_CATEGORIES.find((item) => item.key === category);
  const options = PHRASE_CATEGORIES.map((item) => ({ key: item.key, label: item.label, icon: item.icon }))
    .concat({ key: 'favoritas', label: `Favoritas (${favorites.size})`, icon: 'heart' });

  return (
    <>
      <div className="section__head">
        <div>
          <h2>Frases útiles</h2>
          <p className="section__hint"><Icon name="translate" size={14} /> Inglés de Estados Unidos para el día a día</p>
        </div>
        {hasSpeech ? (
          <div className="segmented segmented--compact" role="group" aria-label="Velocidad de la voz">
            {RATES.map((item) => <button key={item.key} className={`segmented__btn ${item.key === rate ? 'segmented__btn--active' : ''}`} type="button" aria-pressed={item.key === rate} onClick={() => rateHandler(item.key)}>{item.label}</button>)}
          </div>
        ) : null}
      </div>
      <label className="search suggest-host">
        <Icon name="search" />
        <span className="visually-hidden">Buscar frase en español o inglés</span>
        <SuggestInput
          ref={searchRef}
          id="phraseSearch"
          className="search__input"
          kind="phrase"
          type="search"
          placeholder="Busca: café, talla, metro, cuenta…"
          defaultValue={searchText}
          onValueChange={(value) => setSearchText(value)}
          onSelect={(item) => {
            // Elegir una categoria: se abre esa categoria y se limpia el buscador
            if (item.category) {
              setCategory(item.category);
              setSearchText('');
            }
          }}
        />
      </label>
      <Scroller>
        <ul className="chips" id="phraseChips">
          {options.map((option) => {
            const isActive = option.key === category && !searchText;
            return (
              <li key={option.key}>
                <button className={`chip ${isActive ? 'chip--active' : ''}`} type="button" aria-pressed={isActive} onClick={() => categoryHandler(option.key)}>
                  <span className="chip__icon"><Icon name={option.icon} size={18} /></span>{option.label}
                </button>
              </li>
            );
          })}
        </ul>
      </Scroller>
      {hasSpeech ? null : <p className="section__hint">Tu navegador no permite reproducir voz; aun así puedes leer la pronunciación.</p>}
      <div id="phraseList">
        {!isSearch && activeCategory?.tip ? (
          <aside className="phrase-tip" aria-label="Consejo">
            <span className="phrase-tip__icon"><Icon name="star" size={18} /></span>
            <p className="phrase-tip__text"><strong>Consejo:</strong> {activeCategory.tip}</p>
          </aside>
        ) : null}
        {list.length ? (
          <ul className="phrase-list">
            {list.map((phrase) => {
              const isFavorite = favorites.has(phrase.en);
              return (
                <li className={`phrase${playingText === phrase.en ? ' phrase--playing' : ''}`} key={`${phrase.category.key}-${phrase.en}`}>
                  {hasSpeech ? <button className="phrase__play" type="button" aria-label={`Escuchar: ${phrase.en}`} onClick={() => speakHandler(phrase.en)}><Icon name="speak" size={22} /></button> : null}
                  <div className="phrase__body">
                    {isSearch ? <span className="phrase__category">{phrase.category.label}</span> : null}
                    <p className="phrase__en" lang="en-US">{phrase.en}</p>
                    <p className="phrase__es">{phrase.es}</p>
                    <p className="phrase__say"><span className="visually-hidden">Pronunciación aproximada: </span>{phrase.say}</p>
                  </div>
                  <button className={`phrase__fav ${isFavorite ? 'phrase__fav--active' : ''}`} type="button" aria-pressed={isFavorite} aria-label={`${isFavorite ? 'Quitar de favoritas' : 'Guardar en favoritas'}: ${phrase.en}`} onClick={() => favHandler(phrase.en)}>
                    <Icon name={isFavorite ? 'heartFill' : 'heart'} size={20} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <p className="empty">{isSearch ? 'No encontramos frases con esa búsqueda.' : 'Aún no tienes favoritas. Pulsa el corazón de una frase para guardarla aquí.'}</p>}
      </div>
    </>
  );
}
