/*
 * Frases utiles en el idioma del destino: por situacion, con su significado en el idioma de la app,
 * pronunciacion cuando la hay, voz (Web Speech API) y favoritas.
 * El idioma sale del pais del destino y se puede cambiar; si alli se habla tu idioma se propone otro.
 */
import { useEffect, useRef, useState } from 'react';
import { PHRASE_CATEGORIES, PHRASE_LANGUAGES, languageForCountry, speechLocale } from '../../lib/phrases.js';
import { registerSuggestions } from '../../lib/suggestions.js';
import { getLanguage, m, t, tn } from '../../lib/i18n/index.js';
import { countryName, languageName } from '../../lib/locale.js';
import Icon from '../../components/Icon.jsx';
import Scroller from '../../components/Scroller.jsx';
import SuggestInput from '../../components/SuggestInput.jsx';
import { useTrip } from './TripContext.jsx';

const FAVORITES_KEY = 'foxtrips:fav-phrases';
const RATE_KEY = 'foxtrips:speech-rate';
const LANGUAGE_KEY = 'foxtrips:phrase-lang:';
const TIPS_COUNTRY = 'US';
const RATES = [
  { key: '1', label: m('Normal') },
  { key: '0.7', label: m('Lento') }
];
const hasSpeech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

// Categoria y busqueda se recuerdan al volver a la pestaña
let rememberedCategory = PHRASE_CATEGORIES[0].key;
let rememberedSearch = '';
// Idioma de las frases que se estan viendo (lo usan las sugerencias del buscador)
let shownLanguage = 'en';

function readFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []);
  } catch {
    return new Set();
  }
}

function savedLanguage(tripId) {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY + tripId);
    return PHRASE_LANGUAGES.includes(saved) ? saved : '';
  } catch {
    return '';
  }
}

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/* Lo que significa la frase, en el idioma de la app */
function meaningOf(phrase) {
  const language = getLanguage();
  return phrase.meaning?.[language] || phrase[language] || phrase.en;
}

/* Lectura para quien no conoce el idioma: romaji del japones o el ingles "como suena" para hispanohablantes */
function pronunciationOf(phrase, language) {
  if (language === 'ja') return phrase.romaji;
  if (language === 'en' && getLanguage() === 'es') return phrase.say;
  return '';
}

function voiceFor(locale) {
  const voices = window.speechSynthesis.getVoices();
  const base = locale.split('-')[0];
  return voices.find((voice) => voice.lang.replace('_', '-') === locale && /natural|google|samantha|aria|jenny/i.test(voice.name))
    || voices.find((voice) => voice.lang.replace('_', '-') === locale)
    || voices.find((voice) => voice.lang.toLowerCase().startsWith(base));
}

/* Sugerencias: primero categorias ("Cafeteria"), luego frases (por su texto o por su significado) */
function phraseSuggestions(query) {
  const text = normalize(query);
  const categories = PHRASE_CATEGORIES
    .filter((category) => normalize(t(category.label)).includes(text))
    .map((category) => ({ name: t(category.label), detail: `${t('Categoría')} · ${tn(category.phrases.length, '{n} frase', '{n} frases')}`, value: '', category: category.key, icon: category.icon }));
  const phrases = PHRASE_CATEGORIES
    .flatMap((category) => category.phrases.map((phrase) => ({ phrase, category })))
    .filter(({ phrase }) => normalize(`${phrase[shownLanguage]} ${meaningOf(phrase)}`).includes(text))
    .slice(0, 6)
    .map(({ phrase, category }) => ({ name: phrase[shownLanguage], detail: `${meaningOf(phrase)} · ${t(category.label)}`, value: phrase[shownLanguage], icon: 'speak' }));
  return [...categories, ...phrases].slice(0, 8);
}

registerSuggestions('phrase', phraseSuggestions, { minLength: 2, label: m('Frases y categorías sugeridas') });

export default function PhrasesView() {
  const { tripId, countryCode } = useTrip();
  const appLanguage = getLanguage();
  const [category, setCategory] = useState(rememberedCategory);
  const [searchText, setSearchText] = useState(rememberedSearch);
  const [favorites, setFavorites] = useState(readFavorites);
  const [rate, setRate] = useState(() => localStorage.getItem(RATE_KEY) || '1');
  const [playingText, setPlayingText] = useState(null);
  const [chosenLanguage, setChosenLanguage] = useState(() => savedLanguage(tripId));
  const searchRef = useRef(null);
  rememberedCategory = category;
  rememberedSearch = searchText;

  // Idioma: el elegido; si no, el del destino; y si alli se habla el tuyo, ingles (o español para quien usa la app en ingles)
  const localLanguage = languageForCountry(countryCode);
  const isSameLanguage = Boolean(localLanguage) && localLanguage === appLanguage;
  const fallbackLanguage = appLanguage === 'en' ? 'es' : 'en';
  const language = chosenLanguage && chosenLanguage !== appLanguage ? chosenLanguage : (localLanguage && !isSameLanguage ? localLanguage : fallbackLanguage);
  const locale = speechLocale(language, language === localLanguage ? countryCode : '');
  shownLanguage = language;

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
    utterance.lang = locale;
    utterance.rate = Number(rate);
    const voice = voiceFor(locale);
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

  function languageHandler(event) {
    stopSpeaking();
    const { value } = event.target;
    try {
      localStorage.setItem(LANGUAGE_KEY + tripId, value);
    } catch {
      /* sin almacenamiento: vale para esta visita */
    }
    setChosenLanguage(value);
  }

  const isSearch = Boolean(searchText.trim());
  const text = normalize(searchText);
  const all = PHRASE_CATEGORIES.flatMap((item) => item.phrases.map((phrase) => ({ ...phrase, category: item })));
  let list;
  if (text) list = all.filter((phrase) => normalize(`${phrase[language]} ${meaningOf(phrase)}`).includes(text));
  else if (category === 'favoritas') list = all.filter((phrase) => favorites.has(phrase.en));
  else list = all.filter((phrase) => phrase.category.key === category);
  const activeCategory = PHRASE_CATEGORIES.find((item) => item.key === category);
  const options = PHRASE_CATEGORIES.map((item) => ({ key: item.key, label: t(item.label), icon: item.icon }))
    .concat({ key: 'favoritas', label: t('Favoritas ({n})', { n: favorites.size }), icon: 'heart' });
  // Los consejos hablan de costumbres de Estados Unidos: solo se muestran en viajes alli y con las frases en ingles
  const tip = !isSearch && countryCode === TIPS_COUNTRY && language === 'en' ? activeCategory?.tip : '';

  let hint = t('Frases en {language} para el día a día', { language: languageName(language) });
  if (!chosenLanguage && isSameLanguage) hint = t('En {country} se habla tu idioma: te dejamos las frases en {language}.', { country: countryName(countryCode), language: languageName(language) });
  else if (localLanguage === language && countryCode) hint = t('Frases en {language} para tu viaje a {country}', { language: languageName(language), country: countryName(countryCode) });

  return (
    <>
      <div className="section__head">
        <div>
          <h2>{t('Frases útiles')}</h2>
          <p className="section__hint"><Icon name="translate" size={14} /> {hint}</p>
        </div>
        <div className="page-head__actions">
          <label className="visually-hidden" htmlFor="phraseLanguage">{t('Idioma de las frases')}</label>
          <select className="form__select form__select--compact" id="phraseLanguage" value={language} onChange={languageHandler}>
            {PHRASE_LANGUAGES.filter((code) => code !== appLanguage).map((code) => <option key={code} value={code}>{languageName(code, true)}</option>)}
          </select>
          {hasSpeech ? (
            <div className="segmented segmented--compact" role="group" aria-label={t('Velocidad de la voz')}>
              {RATES.map((item) => <button key={item.key} className={`segmented__btn ${item.key === rate ? 'segmented__btn--active' : ''}`} type="button" aria-pressed={item.key === rate} onClick={() => rateHandler(item.key)}>{t(item.label)}</button>)}
            </div>
          ) : null}
        </div>
      </div>
      <label className="search suggest-host">
        <Icon name="search" />
        <span className="visually-hidden">{t('Buscar frase')}</span>
        <SuggestInput
          ref={searchRef}
          id="phraseSearch"
          className="search__input"
          kind="phrase"
          type="search"
          placeholder={t('Busca: café, talla, metro, cuenta…')}
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
      {hasSpeech ? null : <p className="section__hint">{t('Tu navegador no permite reproducir voz; aun así puedes leer las frases.')}</p>}
      <div id="phraseList">
        {tip ? (
          <aside className="phrase-tip" aria-label={t('Consejo')}>
            <span className="phrase-tip__icon"><Icon name="star" size={18} /></span>
            <p className="phrase-tip__text"><strong>{t('Consejo:')}</strong> {t(tip)}</p>
          </aside>
        ) : null}
        {list.length ? (
          <ul className="phrase-list">
            {list.map((phrase) => {
              const isFavorite = favorites.has(phrase.en);
              const spoken = phrase[language];
              const pronunciation = pronunciationOf(phrase, language);
              return (
                <li className={`phrase${playingText === spoken ? ' phrase--playing' : ''}`} key={`${phrase.category.key}-${phrase.en}`}>
                  {hasSpeech ? <button className="phrase__play" type="button" aria-label={t('Escuchar: {phrase}', { phrase: spoken })} onClick={() => speakHandler(spoken)}><Icon name="speak" size={22} /></button> : null}
                  <div className="phrase__body">
                    {isSearch ? <span className="phrase__category">{t(phrase.category.label)}</span> : null}
                    <p className="phrase__en" lang={locale}>{spoken}</p>
                    <p className="phrase__es">{meaningOf(phrase)}</p>
                    {pronunciation ? <p className="phrase__say"><span className="visually-hidden">{t('Pronunciación aproximada:')} </span>{pronunciation}</p> : null}
                  </div>
                  <button className={`phrase__fav ${isFavorite ? 'phrase__fav--active' : ''}`} type="button" aria-pressed={isFavorite} aria-label={`${isFavorite ? t('Quitar de favoritas') : t('Guardar en favoritas')}: ${spoken}`} onClick={() => favHandler(phrase.en)}>
                    <Icon name={isFavorite ? 'heartFill' : 'heart'} size={20} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <p className="empty">{isSearch ? t('No encontramos frases con esa búsqueda.') : t('Aún no tienes favoritas. Pulsa el corazón de una frase para guardarla aquí.')}</p>}
      </div>
    </>
  );
}
