/*
 * Bienvenida (antes de iniciar sesion): carrusel de fotos a pantalla completa con frases.
 * Se puede pasar deslizando, con las flechas, con los puntos o con el teclado (← →).
 * "Saltar" o la ultima diapositiva llevan a la pantalla de acceso.
 */
import { icon } from '../icons.js';
import { esc } from '../utils.js';

const WELCOME_SEEN_KEY = 'foxtrips:welcome-seen';
const AUTOPLAY_MS = 6500;
const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/thumb';

/* Fotos libres de Wikimedia Commons (ruta, archivo, autor, licencia) */
export const WELCOME_PHOTOS = {
  road: ['c/c0', 'Breil-Brigels_in_Graub%C3%BCnden._23-09-2022._%28actm.%29_02.jpg', 'Agnes Monkelbaan', 'CC BY-SA 4.0'],
  lake: ['c/c5', 'Moraine_Lake_17092005.jpg', 'Gorgo', 'Dominio público'],
  balloons: ['a/a3', 'Cappadocia_Aerial_View_Landscape.jpg', 'Benh Lieu Song', 'CC BY-SA 4.0'],
  machuPicchu: ['0/02', 'Machu_Picchu%2C_Per%C3%BA%2C_2015-07-30%2C_DD_60.JPG', 'Diego Delso', 'CC BY-SA 4.0'],
  santorini: ['2/27', '1000_Three_domes_of_Oia_in_Santorini_Photo_by_Giles_Laurent.jpg', 'Giles Laurent', 'CC BY-SA 4.0']
};

const SLIDES = [
  {
    photo: 'road',
    title: ['Explora', 'la belleza', 'del mundo'],
    text: 'Descubre destinos increíbles, planea tu escapada perfecta y vive aventuras inolvidables con tu gente.'
  },
  {
    photo: 'lake',
    title: ['Planead', 'el viaje', 'juntos'],
    text: 'Un itinerario que todo el grupo puede editar, con votaciones para decidir cada plan sin cadenas eternas de mensajes.'
  },
  {
    photo: 'balloons',
    title: ['Guarda', 'cada', 'recuerdo'],
    text: 'Un álbum compartido para las fotos de todos y un diario que se convierte en la historia de vuestro viaje.'
  },
  {
    photo: 'machuPicchu',
    title: ['Descubre', 'qué hacer', 'en cada lugar'],
    text: 'El top 5 de lo más visitado de la ciudad donde estés, frases útiles y el clima, sin buscar en Google ni en redes.'
  }
];

let index = 0;
let timer = 0;
let isAutoplay = true;
let keyListener = null;

/* ---- Ayudantes ---- */

export function photoSources(key) {
  const [path, file, author, license] = WELCOME_PHOTOS[key];
  return {
    small: `${COMMONS}/${path}/${file}/960px-${file}`,
    large: `${COMMONS}/${path}/${file}/1920px-${file}`,
    credit: `${author} · ${license} · Wikimedia Commons`
  };
}

export function markWelcomeSeen() {
  sessionStorage.setItem(WELCOME_SEEN_KEY, '1');
}

export function hasSeenWelcome() {
  return sessionStorage.getItem(WELCOME_SEEN_KEY) === '1';
}

function slideHtml(slide, position) {
  const photo = photoSources(slide.photo);
  return `
    <article class="welcome__slide" id="welcome-slide-${position}" aria-roledescription="diapositiva" aria-label="${position + 1} de ${SLIDES.length}">
      <picture class="welcome__media">
        <source media="(min-width: 900px)" srcset="${esc(photo.large)}">
        <img src="${esc(photo.small)}" alt="" width="960" height="1280" ${position === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
      </picture>
      <div class="welcome__content">
        <h2 class="welcome__title">${slide.title.map((line) => `<span>${esc(line)}</span>`).join('')}</h2>
        <p class="welcome__text">${esc(slide.text)}</p>
        <p class="welcome__credit">Foto: ${esc(photo.credit)}</p>
      </div>
    </article>`;
}

function update() {
  const track = document.getElementById('welcomeTrack');
  if (!track) return;
  document.querySelectorAll('.welcome__dot').forEach((dot, position) => {
    const isActive = position === index;
    dot.classList.toggle('welcome__dot--active', isActive);
    dot.setAttribute('aria-current', isActive ? 'true' : 'false');
  });
  const prev = document.querySelector('.welcome__arrow--prev');
  const next = document.querySelector('.welcome__arrow--next');
  if (prev) prev.hidden = index === 0;
  if (next) next.setAttribute('aria-label', index === SLIDES.length - 1 ? 'Empezar: ir a crear cuenta o entrar' : 'Siguiente');
  const start = document.querySelector('.welcome__start');
  if (start) start.hidden = index !== SLIDES.length - 1;
}

function goTo(target, { isSmooth = true } = {}) {
  const track = document.getElementById('welcomeTrack');
  if (!track) return;
  index = Math.max(0, Math.min(SLIDES.length - 1, target));
  track.scrollTo({ left: index * track.clientWidth, behavior: isSmooth ? 'smooth' : 'auto' });
  update();
}

function finish() {
  markWelcomeSeen();
  location.hash = '#/acceso';
}

function stopAutoplay() {
  isAutoplay = false;
  clearInterval(timer);
}

function autoplayTick() {
  if (!isAutoplay || document.hidden) return;
  if (index < SLIDES.length - 1) goTo(index + 1);
  else stopAutoplay();
}

/* ---- Handlers ---- */

function welcomeStepHandler(button) {
  stopAutoplay();
  const step = Number(button.dataset.step);
  if (step > 0 && index === SLIDES.length - 1) finish();
  else goTo(index + step);
}

function welcomeGoHandler(button) {
  stopAutoplay();
  goTo(Number(button.dataset.index));
}

function welcomeSkipHandler() {
  stopAutoplay();
  finish();
}

function welcomeKeyHandler(event) {
  if (event.target.matches('input, textarea, select')) return;
  if (event.key === 'ArrowRight') {
    stopAutoplay();
    if (index === SLIDES.length - 1) finish();
    else goTo(index + 1);
  }
  if (event.key === 'ArrowLeft') {
    stopAutoplay();
    goTo(index - 1);
  }
}

export default {
  async render() {
    return `
      <section class="welcome" aria-roledescription="carrusel" aria-label="Bienvenida a FoxTrips">
        <h1 class="visually-hidden">FoxTrips: viajes en grupo</h1>
        <div class="welcome__track" id="welcomeTrack">${SLIDES.map(slideHtml).join('')}</div>
        <header class="welcome__brand" aria-hidden="true">
          <img class="welcome__logo" src="assets/img/icono.svg" alt="" width="34" height="34">
          <span>FoxTrips</span>
        </header>
        <footer class="welcome__controls">
          <div class="welcome__dots" role="group" aria-label="Elegir diapositiva">
            ${SLIDES.map((slide, position) => `<button class="welcome__dot ${position === 0 ? 'welcome__dot--active' : ''}" type="button" data-action="welcome-go" data-index="${position}" aria-label="Ir a la diapositiva ${position + 1}" aria-current="${position === 0}"></button>`).join('')}
          </div>
          <div class="welcome__bar">
            <button class="welcome__skip" type="button" data-action="welcome-skip">Saltar</button>
            <div class="welcome__arrows">
              <button class="welcome__arrow welcome__arrow--prev" type="button" data-action="welcome-step" data-step="-1" aria-label="Anterior" hidden>${icon('back', 22)}</button>
              <button class="welcome__start" type="button" data-action="welcome-skip" hidden>Empezar</button>
              <button class="welcome__arrow welcome__arrow--next" type="button" data-action="welcome-step" data-step="1" aria-label="Siguiente">${icon('next', 22)}</button>
            </div>
          </div>
        </footer>
      </section>`;
  },
  mount() {
    const track = document.getElementById('welcomeTrack');
    index = 0;
    isAutoplay = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scrollHandler = () => {
      const current = Math.round(track.scrollLeft / track.clientWidth);
      if (current !== index) {
        index = current;
        update();
      }
    };
    const pointerHandler = () => stopAutoplay();
    track.addEventListener('scroll', scrollHandler, { passive: true });
    track.addEventListener('pointerdown', pointerHandler);
    keyListener = welcomeKeyHandler;
    document.addEventListener('keydown', keyListener);
    clearInterval(timer);
    timer = setInterval(autoplayTick, AUTOPLAY_MS);
    update();
  },
  unmount() {
    clearInterval(timer);
    if (keyListener) document.removeEventListener('keydown', keyListener);
    keyListener = null;
  },
  actions: {
    'welcome-step': welcomeStepHandler,
    'welcome-go': welcomeGoHandler,
    'welcome-skip': welcomeSkipHandler
  }
};
