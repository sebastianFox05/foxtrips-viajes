/*
 * TEMPORAL (diagnostico, nov 2026): en iPhone una pantalla del viaje se ve encogida porque algo es mas ancho
 * que la pantalla y Safari aleja la pagina. En Chromium no se reproduce, asi que esta caja muestra en el propio
 * telefono QUE elemento se sale. Solo aparece si la pagina es mas ancha que la pantalla. Quitar cuando se arregle.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const CHECK_DELAY_MS = 1500;
const MAX_ITEMS = 5;

function describe(element) {
  const id = element.id ? `#${element.id}` : '';
  const classes = [...element.classList].slice(0, 3).map((name) => `.${name}`).join('');
  return `${element.tagName.toLowerCase()}${id}${classes}`;
}

/*
 * Elementos que se salen por la derecha aunque su contenedor cabe: son los que empujan la pagina.
 * Se ignoran los fijos (barra inferior, avisos), el interior de los dibujos SVG y lo que esta dentro de una zona con scroll.
 */
function offenders(limit) {
  const found = [];
  for (const element of document.body.querySelectorAll('*')) {
    if (element.closest('svg') && element.tagName.toLowerCase() !== 'svg') continue;
    if (element.closest('.overflow-probe')) continue;
    const box = element.getBoundingClientRect();
    if (!box.width || box.right <= limit + 1) continue;
    const parent = element.parentElement;
    if (!parent || parent.getBoundingClientRect().right > limit + 1) continue;
    let node = element;
    let isIgnored = false;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if (style.position === 'fixed') isIgnored = true;
      if (node !== element && ['auto', 'scroll'].includes(style.overflowX)) isIgnored = true;
      node = node.parentElement;
    }
    if (!isIgnored) found.push(`${describe(element)} dentro de ${describe(parent)} → ${Math.round(box.right)}px (${Math.round(box.width)} de ancho)`);
  }
  return found.slice(0, MAX_ITEMS);
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
      setReport({ screenWidth, pageWidth, items: offenders(screenWidth) });
    };
    const timers = [setTimeout(check, CHECK_DELAY_MS), setTimeout(check, CHECK_DELAY_MS * 3)];
    return () => timers.forEach(clearTimeout);
  }, [location.pathname]);

  if (!report) return null;
  return (
    <div className="overflow-probe" role="status">
      <strong>Diagnóstico de ancho · pantalla {report.screenWidth}px, página {report.pageWidth}px</strong>
      {report.items.length ? report.items.map((item) => <span key={item}>{item}</span>) : <span>No se encontró el elemento.</span>}
      <button type="button" onClick={() => setReport(null)}>Cerrar</button>
    </div>
  );
}
