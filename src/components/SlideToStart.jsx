/*
 * Boton "desliza para empezar": una pildora de cristal con un circulo blanco que se arrastra hacia la derecha.
 * Al llegar al final (o al soltarlo pasada la mitad) llama a onComplete.
 * Tambien funciona sin arrastrar: tocar la pildora o pulsar Enter / espacio hace lo mismo (teclado y lectores de pantalla).
 */
import { useRef, useState } from 'react';
import Icon from './Icon.jsx';

const COMPLETE_RATIO = 0.55;
const TAP_PIXELS = 6;

export default function SlideToStart({ label, ariaLabel, onComplete }) {
  const trackRef = useRef(null);
  const dragRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  function maxOffset() {
    const track = trackRef.current;
    const thumb = track?.querySelector('.slide-start__thumb');
    return track && thumb ? track.clientWidth - thumb.offsetWidth - 8 : 0;
  }

  function finish() {
    if (isDone) return;
    setIsDone(true);
    setOffset(maxOffset());
    // Deja ver el circulo llegando al final antes de cambiar de pantalla
    setTimeout(onComplete, 180);
  }

  function pointerDownHandler(event) {
    if (isDone) return;
    dragRef.current = { startX: event.clientX, moved: 0 };
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function pointerMoveHandler(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = Math.max(0, Math.min(maxOffset(), event.clientX - drag.startX));
    drag.moved = Math.max(drag.moved, Math.abs(event.clientX - drag.startX));
    setOffset(delta);
  }

  function pointerUpHandler() {
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (!drag) return;
    // Un toque sin arrastrar tambien empieza; un arrastre corto vuelve a su sitio
    if (drag.moved < TAP_PIXELS || offset >= maxOffset() * COMPLETE_RATIO) finish();
    else setOffset(0);
  }

  const max = maxOffset() || 1;
  return (
    <button
      ref={trackRef}
      className={`slide-start${isDragging ? ' slide-start--dragging' : ''}`}
      type="button"
      aria-label={ariaLabel || label}
      onClick={(event) => {
        // Teclado (Enter / espacio): el clic llega sin puntero
        if (event.detail === 0) finish();
      }}
      onPointerDown={pointerDownHandler}
      onPointerMove={pointerMoveHandler}
      onPointerUp={pointerUpHandler}
      onPointerCancel={() => { dragRef.current = null; setIsDragging(false); setOffset(0); }}
    >
      <span className="slide-start__thumb" style={{ transform: `translateX(${offset}px)` }} aria-hidden="true">
        <Icon name="send" size={20} />
      </span>
      <span className="slide-start__label" style={{ opacity: 1 - Math.min(1, offset / max) }}>{label}</span>
      <span className="slide-start__chevrons" aria-hidden="true" style={{ opacity: 1 - Math.min(1, offset / max) }}>
        <Icon name="next" size={18} />
      </span>
    </button>
  );
}
