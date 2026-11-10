/* Imagen animada del acceso: tarjeta con fotos que cambian con zoom lento y halo de color detras. */
import { useEffect, useState } from 'react';
import { photoSources } from '../welcome/welcomeState.js';
import { t } from '../../lib/i18n/index.js';

const VISUAL_PHOTOS = ['santorini', 'lake', 'balloons', 'road', 'machuPicchu'];
const VISUAL_INTERVAL_MS = 7000;

export default function AuthVisual() {
  const [index, setIndex] = useState(0);
  const [glow, setGlow] = useState(photoSources(VISUAL_PHOTOS[0]).small);

  useEffect(() => {
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReducedMotion) return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % VISUAL_PHOTOS.length);
    }, VISUAL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // El halo usa la foto que el navegador eligio (pequeña o grande)
  useEffect(() => {
    const image = document.querySelectorAll('.auth-visual__slide img')[index];
    setGlow(image?.currentSrc || image?.src || photoSources(VISUAL_PHOTOS[index]).small);
  }, [index]);

  const active = photoSources(VISUAL_PHOTOS[index]);
  return (
    <div className="auth-visual" style={{ '--glow': `url('${glow}')` }}>
      <div className="auth-visual__glow" aria-hidden="true" />
      <figure className="auth-visual__card">
        {VISUAL_PHOTOS.map((key, position) => {
          const photo = photoSources(key);
          return (
            <picture key={key} className={`auth-visual__slide ${position === index ? 'auth-visual__slide--active' : ''}`} data-credit={photo.credit}>
              <source media="(min-width: 900px)" srcSet={photo.large} />
              <img src={photo.small} alt="" width="960" height="1280" fetchpriority={position === 0 ? 'high' : undefined} loading={position === 0 ? undefined : 'lazy'} decoding="async" />
            </picture>
          );
        })}
        <figcaption className="auth-visual__brand">
          <span className="auth-visual__logo">
            <img src={`${import.meta.env.BASE_URL}assets/img/logo.png`} alt="" width="30" height="30" />
            FoxTrips <span className="auth-visual__badge">{t('Viajes')}</span>
          </span>
          <span className="auth-visual__tagline">{t('Planead, votad y guardad cada recuerdo con tu gente.')}</span>
          <span className="auth-visual__credit" id="authCredit">{t('Foto: {credit}', { credit: active.credit })}</span>
        </figcaption>
      </figure>
    </div>
  );
}
