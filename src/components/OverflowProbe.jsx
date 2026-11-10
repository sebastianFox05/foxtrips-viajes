/*
 * TEMPORAL (diagnostico, nov 2026): en iPhone una pantalla del viaje se ve encogida porque algo es mas ancho
 * que la pantalla y Safari aleja la pagina. En Chromium no se reproduce, asi que esta caja muestra en el propio
 * telefono QUE elemento se sale. Solo aparece si la pagina es mas ancha que la pantalla. Quitar cuando se arregle.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const CHECK_DELAY_MS = 1500;
const MAX_ITEMS = 8;

function describe(element) {
  const id = element.id ? `#${element.id}` : '';
  const classes = [...element.classList].slice(0, 3).map((name) => `.${name}`).join('');
  return `${element.tagName.toLowerCase()}${id}${classes}`;
}

function path(element) {
  const parts = [];
  for (let node = element; node && node !== document.body && parts.length < 4; node = node.parentElement) parts.unshift(describe(node));
  return parts.join(' > ');
}

/*
 * Elementos que llegan mas alla del borde derecho, sin excepciones (tambien fijos y dentro de zonas con scroll),
 * ordenados por cuanto se salen. Se marca entre corchetes si es fijo o si esta dentro de una zona con scroll.
 */
function offenders(limit) {
  const found = [];
  for (const element of document.body.querySelectorAll('*')) {
    if (element.closest('.overflow-probe')) continue;
    if (element.closest('svg') && element.tagName.toLowerCase() !== 'svg') continue;
    const box = element.getBoundingClientRect();
    if (!box.width || box.right <= limit + 1) continue;
    const style = getComputedStyle(element);
    let marks = style.position === 'fixed' ? ' [fijo]' : '';
    // Dentro de una zona con scroll o recorte que si cabe en la pantalla: esta bien recortado, no cuenta
    let isClipped = false;
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(node).overflowX)) {
        if (node.getBoundingClientRect().right <= limit + 1) isClipped = true;
        else marks += ` [dentro de ${describe(node)}, que tambien se sale]`;
        break;
      }
    }
    if (isClipped) continue;
    const parentRight = element.parentElement ? element.parentElement.getBoundingClientRect().right : 0;
    found.push({ right: box.right, isFixed: Boolean(marks.includes('[fijo]')) || Boolean(element.closest('#bottomNav, #toasts')), isPusher: parentRight <= limit + 1, text: `${path(element)} → ${Math.round(box.right)}px${marks}` });
  }
  // Primero los que se salen aunque su contenedor cabe (los que empujan), luego los que mas se salen
  // Los fijos (barra inferior, avisos) se estiran con la pagina: van al final
  found.sort((first, second) => Number(first.isFixed) - Number(second.isFixed) || Number(second.isPusher) - Number(first.isPusher) || second.right - first.right);
  return found.slice(0, MAX_ITEMS).map((item) => (item.isPusher ? `★ ${item.text}` : item.text));
}

export default function OverflowProbe() {
  const location = useLocation();
  const [report, setReport] = useState(null);

  useEffect(() => {
    setReport(null);
    // Se mira dos veces: al cambiar de pantalla y cuando ya han llegado los datos (clima, fotos…)
    const check = () => {
      const screenWidth = Math.min(window.screen.width, document.documentElement.clientWidth || window.screen.width);
      const pageWidth = Math.max(document.documentElement.scrollWidth, window.innerWidth);
      if (pageWidth <= screenWidth + 1) return;
      const scale = window.visualViewport ? window.visualViewport.scale.toFixed(2) : '?';
      const details = `scroll ${document.documentElement.scrollWidth} · ventana ${window.innerWidth} · zoom ${scale}`;
      setReport({ screenWidth, pageWidth, details, items: offenders(screenWidth) });
    };
    const timers = [setTimeout(check, CHECK_DELAY_MS), setTimeout(check, CHECK_DELAY_MS * 3)];
    return () => timers.forEach(clearTimeout);
  }, [location.pathname]);

  if (!report) return null;
  return (
    <div className="overflow-probe" role="status">
      <strong>Diagnóstico de ancho · pantalla {report.screenWidth}px, página {report.pageWidth}px</strong>
      <span>{report.details}</span>
      {report.items.length ? report.items.map((item) => <span key={item}>{item}</span>) : <span>No se encontró el elemento.</span>}
      <button type="button" onClick={() => setReport(null)}>Cerrar</button>
    </div>
  );
}
