/*
 * Ficha de un lugar a pantalla completa (Top planes y cada plan del itinerario):
 * foto grande con volver y favorito, miniaturas al lado para cambiar de foto, nombre y lugar sobre la foto,
 * tres datos en recuadros, descripcion con "Leer más" y abajo un dato y el boton principal (flecha).
 * Escape o "Volver" cierran (es un <dialog>, que devuelve el foco a quien lo abrio).
 *
 * place: { title, location, images: [url], stats: [{ label, value }], description, footLabel, footValue,
 *          action: { label, onClick, isDone? }, isFavorite?, onFavorite? }
 */
import { useEffect, useRef, useState } from 'react';
import { safeUrl } from '../lib/utils.js';
import { t } from '../lib/i18n/index.js';
import Icon from './Icon.jsx';
import Picture from './Picture.jsx';

const LONG_TEXT = 260;

export default function PlaceSheet({ place, onClose }) {
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const images = (place?.images || []).filter(Boolean);

  // Se abre o cierra segun haya lugar; al cambiar de lugar vuelve a la primera foto y al texto corto
  const isOpen = Boolean(place);
  const placeKey = place ? place.title : '';
  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && !dialog.open) {
      openerRef.current = document.activeElement;
      dialog.showModal();
      dialog.querySelector('.place__back')?.focus();
    }
    if (!isOpen && dialog.open) dialog.close();
    setPhotoIndex(0);
    setIsExpanded(false);
  }, [isOpen, placeKey]);

  function closedHandler() {
    onClose();
    const opener = openerRef.current;
    if (opener && document.contains(opener)) opener.focus();
  }

  async function actionHandler() {
    if (!place?.action || isBusy) return;
    setIsBusy(true);
    try {
      await place.action.onClick();
    } finally {
      setIsBusy(false);
    }
  }

  const description = place?.description || '';
  const isLong = description.length > LONG_TEXT;
  const main = images[photoIndex] || images[0];
  return (
    <dialog className="place" ref={dialogRef} aria-labelledby="placeTitle" onClose={closedHandler}>
      {place ? (
        <div className="place__scroll">
          <header className="place__hero">
            {main ? <Picture key={main} url={main} className="place__media" isLazy={false} width={900} height={1100} /> : null}
            <div className="place__bar">
              <button className="hero__btn place__back" type="button" aria-label={t('Volver')} onClick={() => dialogRef.current.close()}><Icon name="back" /></button>
              {place.onFavorite ? (
                <button className="hero__btn" type="button" aria-pressed={Boolean(place.isFavorite)} aria-label={place.isFavorite ? t('Quitar de favoritos') : t('Guardar en favoritos')} onClick={place.onFavorite}>
                  <Icon name={place.isFavorite ? 'heartFill' : 'heart'} />
                </button>
              ) : null}
            </div>
            {images.length > 1 ? (
              <ul className="place__thumbs" aria-label={t('Fotos')}>
                {images.slice(0, 4).map((url, index) => (
                  <li key={url}>
                    <button className={`place__thumb${index === photoIndex ? ' place__thumb--active' : ''}`} type="button" aria-pressed={index === photoIndex} aria-label={t('Ver foto {n}', { n: index + 1 })} onClick={() => setPhotoIndex(index)}>
                      <Picture url={url} width={120} height={120} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="place__heading">
              <h2 className="place__title" id="placeTitle">{place.title}</h2>
              {place.location ? <p className="place__location"><Icon name="pin" size={14} /> {place.location}</p> : null}
            </div>
          </header>
          <div className="place__body">
            {place.stats?.length ? (
              <ul className="place__stats">
                {place.stats.map((stat) => (
                  <li key={stat.label} className="place__stat">
                    <span className="place__stat-label">{stat.label}</span>
                    <span className="place__stat-value">{stat.value}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {description ? (
              <section className="place__section" aria-labelledby="placeDescription">
                <h3 id="placeDescription">{t('Descripción')}</h3>
                <p className={`place__text${isLong && !isExpanded ? ' place__text--clamped' : ''}`}>{description}</p>
                {isLong ? <button className="link-btn place__more" type="button" aria-expanded={isExpanded} onClick={() => setIsExpanded(!isExpanded)}>{isExpanded ? t('Leer menos') : t('Leer más')}</button> : null}
                {place.source ? <p className="place__source"><a href={safeUrl(place.source.url)} target="_blank" rel="noopener noreferrer">{place.source.label}</a></p> : null}
              </section>
            ) : null}
            {place.extra || null}
          </div>
          <footer className="place__foot">
            <div>
              {place.footLabel ? <span className="place__foot-label">{place.footLabel}</span> : null}
              {place.footValue ? <span className="place__foot-value">{place.footValue}</span> : null}
            </div>
            {place.action ? (
              place.action.isDone
                ? <span className="badge badge--success place__done"><Icon name="check" size={14} /> {place.action.label}</span>
                : (
                  <button className="place__go" type="button" aria-label={place.action.label} title={place.action.label} disabled={isBusy} onClick={actionHandler}>
                    <Icon name={place.action.icon || 'next'} size={22} />
                  </button>
                )
            ) : null}
          </footer>
        </div>
      ) : null}
    </dialog>
  );
}
