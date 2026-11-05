/*
 * Visor de fotos accesible (lightbox), igual que lightbox.js:
 * - Escape cierra (comportamiento nativo de <dialog>), flechas ← → navegan.
 * - Al cerrar se devuelve el foco a la miniatura que lo abrio.
 * - Debajo, los comentarios de la foto (salvo en la pagina publica).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Comments from '../components/Comments.jsx';
import { safeUrl } from '../lib/utils.js';
import { store } from '../lib/store/index.js';

const LightboxContext = createContext(null);

function variants(url) {
  if (url?.includes('res.cloudinary.com')) {
    return { webp: url.replace('f_auto', 'f_webp'), fallback: url.replace('f_auto', 'f_jpg') };
  }
  return { webp: url, fallback: url };
}

function LightboxPicture({ photo, index }) {
  const [localUrl, setLocalUrl] = useState('');
  const isLocal = Boolean(photo?.url?.startsWith('local:'));
  useEffect(() => {
    let isCurrent = true;
    setLocalUrl('');
    if (isLocal) store.fileUrl('photos', photo.url).then((value) => isCurrent && setLocalUrl(value)).catch(() => null);
    return () => {
      isCurrent = false;
    };
  }, [photo?.url, isLocal]);
  if (!photo) return null;
  const { webp, fallback } = isLocal ? { webp: localUrl, fallback: localUrl } : variants(photo.url);
  return (
    <>
      <source srcSet={webp || undefined} type="image/webp" />
      <img src={fallback || undefined} alt={photo.caption || `Foto ${index + 1} del viaje`} width={1600} height={1200} decoding="async" />
    </>
  );
}

function Lightbox({ state, onStep, onClosed }) {
  const dialogRef = useRef(null);
  const photo = state ? state.photos[state.index] : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (state && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('.lightbox__close').focus();
    }
    if (!state && dialog.open) dialog.close();
  }, [state]);

  function keyHandler(event) {
    if (event.target.matches('input, textarea')) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onStep(-1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onStep(1);
    }
  }

  const sourceUrl = safeUrl(photo?.source_url || '');
  return (
    <dialog className="lightbox" id="lightbox" aria-label="Visor de fotos" ref={dialogRef} onKeyDown={keyHandler} onClose={onClosed}>
      <button className="lightbox__close" type="button" aria-label="Cerrar visor" onClick={() => dialogRef.current.close()}>×</button>
      <button className="lightbox__nav lightbox__nav--prev" type="button" aria-label="Foto anterior" onClick={() => onStep(-1)}>‹</button>
      <figure className="lightbox__figure">
        <picture className="lightbox__picture" id="lightboxPicture">
          <LightboxPicture photo={photo} index={state?.index || 0} />
        </picture>
        <figcaption className="lightbox__caption">
          <span className="lightbox__counter" id="lightboxCounter">{state ? `${state.index + 1} / ${state.photos.length}` : ''}</span>
          <span className="lightbox__text" id="lightboxText">
            {photo?.caption || ''}
            {photo?.uploader_name ? <> · <span>{photo.uploader_name}</span></> : null}
            {photo?.credit ? (
              <> · {sourceUrl
                ? <a className="lightbox__credit" href={sourceUrl} target="_blank" rel="noopener noreferrer">Foto: {photo.credit}</a>
                : <span className="lightbox__credit">Foto: {photo.credit}</span>}</>
            ) : null}
          </span>
        </figcaption>
      </figure>
      <button className="lightbox__nav lightbox__nav--next" type="button" aria-label="Foto siguiente" onClick={() => onStep(1)}>›</button>
      <section className="lightbox__comments" id="lightboxComments" aria-label="Comentarios de la foto" hidden={!state?.hasComments}>
        {state?.hasComments && photo ? <Comments key={photo.id} tripId={state.tripId} targetType="photo" targetId={photo.id} headingLevel={2} /> : null}
      </section>
    </dialog>
  );
}

export function LightboxProvider({ children }) {
  const [state, setState] = useState(null);
  const openerRef = useRef(null);

  const openLightbox = useCallback((photos, startIndex, { tripId, hasComments = true } = {}) => {
    openerRef.current = document.activeElement;
    setState({ photos, index: startIndex, tripId, hasComments: hasComments !== false });
  }, []);

  const closeLightbox = useCallback(() => setState(null), []);

  const stepHandler = useCallback((delta) => {
    setState((current) => (current ? { ...current, index: (current.index + delta + current.photos.length) % current.photos.length } : current));
  }, []);

  const closedHandler = useCallback(() => {
    setState(null);
    const opener = openerRef.current;
    if (opener && document.contains(opener)) opener.focus();
  }, []);

  const value = useMemo(() => ({ openLightbox, closeLightbox }), [openLightbox, closeLightbox]);
  return (
    <LightboxContext.Provider value={value}>
      {children}
      <Lightbox state={state} onStep={stepHandler} onClosed={closedHandler} />
    </LightboxContext.Provider>
  );
}

export function useLightbox() {
  return useContext(LightboxContext);
}
