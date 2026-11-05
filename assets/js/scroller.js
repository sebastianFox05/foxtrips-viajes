/*
 * Flechas para las tiras deslizables (chips de categorias, filtros, clima).
 * Permiten moverse sin gestos tactiles: con raton, teclado o lector de pantalla.
 * Se aplican solas a cualquier tira nueva gracias a un MutationObserver.
 */
import { icon } from './icons.js';

const STRIP_SELECTOR = '.chips, .weather';
const STEP_RATIO = 0.8;

let observer = null;

function arrowButton(direction) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `scroller__btn scroller__btn--${direction < 0 ? 'prev' : 'next'}`;
  button.dataset.scroll = String(direction);
  button.setAttribute('aria-label', direction < 0 ? 'Ver opciones anteriores' : 'Ver más opciones');
  button.innerHTML = icon(direction < 0 ? 'back' : 'next', 18);
  return button;
}

function updateArrows(wrapper) {
  const strip = wrapper.querySelector(STRIP_SELECTOR);
  if (!strip) return;
  const maxScroll = strip.scrollWidth - strip.clientWidth;
  const hasOverflow = maxScroll > 4;
  wrapper.querySelector('.scroller__btn--prev').hidden = !hasOverflow || strip.scrollLeft <= 4;
  wrapper.querySelector('.scroller__btn--next').hidden = !hasOverflow || strip.scrollLeft >= maxScroll - 4;
}

function scrollerClickHandler(event) {
  const button = event.target.closest('[data-scroll]');
  if (!button) return;
  const wrapper = button.closest('.scroller');
  const strip = wrapper.querySelector(STRIP_SELECTOR);
  strip.scrollBy({ left: Number(button.dataset.scroll) * strip.clientWidth * STEP_RATIO, behavior: 'smooth' });
}

function enhance(strip) {
  if (strip.parentElement?.classList.contains('scroller')) return;
  const wrapper = document.createElement('div');
  wrapper.className = `scroller${strip.classList.contains('weather') ? ' scroller--weather' : ''}`;
  strip.parentNode.insertBefore(wrapper, strip);
  wrapper.append(arrowButton(-1), strip, arrowButton(1));
  const scrollHandler = () => updateArrows(wrapper);
  strip.addEventListener('scroll', scrollHandler, { passive: true });
  wrapper.addEventListener('click', scrollerClickHandler);
  if ('ResizeObserver' in window) new ResizeObserver(scrollHandler).observe(strip);
  updateArrows(wrapper);
}

function enhanceAll(root = document) {
  root.querySelectorAll(STRIP_SELECTOR).forEach(enhance);
  // Las tiras que se repintan por dentro (filtros) cambian de ancho: se recalculan sus flechas
  root.querySelectorAll('.scroller').forEach(updateArrows);
}

function mutationHandler() {
  enhanceAll(document.getElementById('app') || document);
}

export function initScrollers() {
  if (observer) return;
  observer = new MutationObserver(mutationHandler);
  observer.observe(document.getElementById('app'), { childList: true, subtree: true });
  window.addEventListener('resize', mutationHandler);
  mutationHandler();
}
