/*
 * Flechas para una tira deslizable (.chips o .weather): permiten moverse sin gestos tactiles.
 * Mismo marcado que scroller.js: <div class="scroller"> [‹] tira [›] </div>.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const STRIP_SELECTOR = '.chips, .weather';
const STEP_RATIO = 0.8;
const EDGE = 4;

export default function Scroller({ isWeather = false, children }) {
  const wrapperRef = useRef(null);
  const [edges, setEdges] = useState({ isPrevHidden: true, isNextHidden: true });

  const strip = () => wrapperRef.current?.querySelector(STRIP_SELECTOR);

  const updateArrows = useCallback(() => {
    const element = wrapperRef.current?.querySelector(STRIP_SELECTOR);
    if (!element) return;
    const maxScroll = element.scrollWidth - element.clientWidth;
    const hasOverflow = maxScroll > EDGE;
    const next = {
      isPrevHidden: !hasOverflow || element.scrollLeft <= EDGE,
      isNextHidden: !hasOverflow || element.scrollLeft >= maxScroll - EDGE
    };
    setEdges((current) => (current.isPrevHidden === next.isPrevHidden && current.isNextHidden === next.isNextHidden ? current : next));
  }, []);

  useEffect(() => {
    const element = strip();
    if (!element) return undefined;
    element.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    const observer = 'ResizeObserver' in window ? new ResizeObserver(updateArrows) : null;
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
      observer?.disconnect();
    };
  }, [updateArrows]);

  // Las tiras que cambian por dentro (filtros, clima cargado) cambian de ancho: se recalculan las flechas
  useLayoutEffect(() => {
    updateArrows();
  });

  function scrollHandler(direction) {
    const element = strip();
    element?.scrollBy({ left: direction * element.clientWidth * STEP_RATIO, behavior: 'smooth' });
  }

  return (
    <div className={`scroller${isWeather ? ' scroller--weather' : ''}`} ref={wrapperRef}>
      <button className="scroller__btn scroller__btn--prev" type="button" aria-label="Ver opciones anteriores" hidden={edges.isPrevHidden} onClick={() => scrollHandler(-1)}>
        <Icon name="back" size={18} />
      </button>
      {children}
      <button className="scroller__btn scroller__btn--next" type="button" aria-label="Ver más opciones" hidden={edges.isNextHidden} onClick={() => scrollHandler(1)}>
        <Icon name="next" size={18} />
      </button>
    </div>
  );
}
