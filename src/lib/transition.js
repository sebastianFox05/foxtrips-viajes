/*
 * Transicion entre pantallas con la View Transitions API: la foto de la tarjeta crece hasta ser la cabecera
 * del viaje (como en el GIF de referencia). Donde el navegador no la tiene, o con "reducir movimiento",
 * se cambia de pantalla sin animar.
 */
import { flushSync } from 'react-dom';

export function photoTransitionName(tripId) {
  return `viaje-foto-${tripId}`;
}

export function navigateWithTransition(navigate, to, options) {
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || isReduced) {
    navigate(to, options);
    return;
  }
  document.startViewTransition(() => {
    flushSync(() => navigate(to, options));
  });
}
