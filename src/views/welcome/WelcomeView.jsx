/*
 * Bienvenida (antes de iniciar sesion): carrusel de fotos a pantalla completa con frases.
 * Se pasa deslizando, con las flechas, con los puntos o con el teclado (← →).
 * "Saltar" o la ultima diapositiva llevan a la pantalla de acceso.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { markWelcomeSeen, photoSources } from './welcomeState.js';

const AUTOPLAY_MS = 6500;
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
const LAST = SLIDES.length - 1;

export default function WelcomeView() {
  const navigate = useNavigate();
  const trackRef = useRef(null);
  const indexRef = useRef(0);
  const autoplayRef = useRef(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [index, setIndex] = useState(0);

  const setCurrent = useCallback((value) => {
    indexRef.current = value;
    setIndex(value);
  }, []);

  const goTo = useCallback((target, isSmooth = true) => {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(LAST, target));
    setCurrent(next);
    track.scrollTo({ left: next * track.clientWidth, behavior: isSmooth ? 'smooth' : 'auto' });
  }, [setCurrent]);

  const finish = useCallback(() => {
    markWelcomeSeen();
    navigate('/acceso');
  }, [navigate]);

  const stopAutoplay = useCallback(() => {
    autoplayRef.current = false;
  }, []);

  const step = useCallback((delta) => {
    stopAutoplay();
    if (delta > 0 && indexRef.current === LAST) finish();
    else goTo(indexRef.current + delta);
  }, [finish, goTo, stopAutoplay]);

  useEffect(() => {
    const track = trackRef.current;
    function scrollHandler() {
      const current = Math.round(track.scrollLeft / track.clientWidth);
      if (current !== indexRef.current) setCurrent(current);
    }
    function keyHandler(event) {
      if (event.target.matches('input, textarea, select')) return;
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    }
    function autoplayTick() {
      if (!autoplayRef.current || document.hidden) return;
      if (indexRef.current < LAST) goTo(indexRef.current + 1);
      else stopAutoplay();
    }
    track.addEventListener('scroll', scrollHandler, { passive: true });
    track.addEventListener('pointerdown', stopAutoplay);
    document.addEventListener('keydown', keyHandler);
    const timer = setInterval(autoplayTick, AUTOPLAY_MS);
    return () => {
      track.removeEventListener('scroll', scrollHandler);
      track.removeEventListener('pointerdown', stopAutoplay);
      document.removeEventListener('keydown', keyHandler);
      clearInterval(timer);
    };
  }, [goTo, setCurrent, step, stopAutoplay]);

  return (
    <section className="welcome" aria-roledescription="carrusel" aria-label="Bienvenida a FoxTrips">
      <h1 className="visually-hidden">FoxTrips: viajes en grupo</h1>
      <div className="welcome__track" id="welcomeTrack" ref={trackRef}>
        {SLIDES.map((slide, position) => {
          const photo = photoSources(slide.photo);
          return (
            <article key={slide.photo} className="welcome__slide" id={`welcome-slide-${position}`} aria-roledescription="diapositiva" aria-label={`${position + 1} de ${SLIDES.length}`}>
              <picture className="welcome__media">
                <source media="(min-width: 900px)" srcSet={photo.large} />
                <img src={photo.small} alt="" width="960" height="1280" fetchpriority={position === 0 ? 'high' : undefined} loading={position === 0 ? undefined : 'lazy'} decoding="async" />
              </picture>
              <div className="welcome__content">
                <h2 className="welcome__title">{slide.title.map((line) => <span key={line}>{line}</span>)}</h2>
                <p className="welcome__text">{slide.text}</p>
                <p className="welcome__credit">Foto: {photo.credit}</p>
              </div>
            </article>
          );
        })}
      </div>
      <header className="welcome__brand" aria-hidden="true">
        <img className="welcome__logo" src="/assets/img/logo.png" alt="" width="34" height="34" />
        <span>FoxTrips</span>
      </header>
      <footer className="welcome__controls">
        <div className="welcome__dots" role="group" aria-label="Elegir diapositiva">
          {SLIDES.map((slide, position) => (
            <button
              key={slide.photo}
              className={`welcome__dot ${position === index ? 'welcome__dot--active' : ''}`}
              type="button"
              aria-label={`Ir a la diapositiva ${position + 1}`}
              aria-current={position === index ? 'true' : 'false'}
              onClick={() => { stopAutoplay(); goTo(position); }}
            />
          ))}
        </div>
        <div className="welcome__bar">
          <button className="welcome__skip" type="button" onClick={() => { stopAutoplay(); finish(); }}>Saltar</button>
          <div className="welcome__arrows">
            <button className="welcome__arrow welcome__arrow--prev" type="button" aria-label="Anterior" hidden={index === 0} onClick={() => step(-1)}><Icon name="back" size={22} /></button>
            <button className="welcome__start" type="button" hidden={index !== LAST} onClick={() => { stopAutoplay(); finish(); }}>Empezar</button>
            <button className="welcome__arrow welcome__arrow--next" type="button" aria-label={index === LAST ? 'Empezar: ir a crear cuenta o entrar' : 'Siguiente'} onClick={() => step(1)}><Icon name="next" size={22} /></button>
          </div>
        </div>
      </footer>
    </section>
  );
}
