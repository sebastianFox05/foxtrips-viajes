/*
 * Menu desplegable de sugerencias (patron "combobox" accesible).
 * Se activa solo en cualquier <input data-autocomplete="..."> (delegacion de eventos, sin JS intrusivo).
 * Tipos incluidos: "city" (ciudades y codigos) y "place" (lugares). Cada vista puede registrar los suyos
 * con registerSuggestions() (viajes, frases…).
 * - Flechas ↑ ↓ para moverse, Enter para elegir, Escape para cerrar.
 * - Al elegir guarda las coordenadas en el input (data-lat / data-lon) y en los campos ocultos
 *   "<name>_lat" y "<name>_lon" del formulario, y lanza el evento "suggest:select".
 * - Si se vuelve a escribir, las coordenadas elegidas se borran (asi nunca quedan desfasadas).
 */
import { icon } from './icons.js';
import { suggestCities, suggestPlaces, normalize } from './places.js';
import { debounce, esc } from './utils.js';

const DEBOUNCE_MS = 220;
const ICONS = { city: 'pin', place: 'compass' };
const MIN_LENGTH = { city: 2, place: 3 };
const LABELS = { city: 'Ciudades sugeridas', place: 'Lugares sugeridos' };
const providers = {
  city: (query, options) => suggestCities(query, options),
  place: (query, options) => suggestPlaces(query, options)
};

let activeInput = null;
let items = [];
let activeIndex = -1;
let requestSeq = 0;
let controller = null;

/* ---- Ayudantes ---- */

function listFor(input) {
  return document.getElementById(`${input.id}-sugerencias`);
}

function hostFor(input) {
  return input.closest('.suggest-host') || input.parentElement;
}

function setupInput(input) {
  if (input.dataset.suggestReady) return;
  input.dataset.suggestReady = '1';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', `${input.id}-sugerencias`);
  input.setAttribute('autocomplete', 'off');
  const host = hostFor(input);
  host.classList.add('suggest-host');
  const list = document.createElement('ul');
  list.className = 'suggest';
  list.id = `${input.id}-sugerencias`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', LABELS[input.dataset.autocomplete] || 'Sugerencias');
  list.hidden = true;
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'suggest__clear';
  clear.dataset.suggestClear = input.id;
  clear.setAttribute('aria-label', 'Borrar texto');
  clear.innerHTML = '×';
  clear.hidden = !input.value;
  input.insertAdjacentElement('afterend', clear);
  clear.insertAdjacentElement('afterend', list);
  if (host.classList.contains('form__field')) {
    // El boton de borrar se coloca centrado sobre el input (el campo tiene etiqueta y ayuda)
    clear.classList.add('suggest__clear--overlay');
    clear.style.top = `${input.offsetTop + input.offsetHeight / 2}px`;
    list.style.top = `${input.offsetTop + input.offsetHeight + 6}px`;
  }
}

/* Pone en negrita la parte del texto que coincide con lo escrito */
function highlight(text, query) {
  const plain = normalize(text);
  const needle = normalize(query);
  const start = needle ? plain.indexOf(needle) : -1;
  if (start < 0) return esc(text);
  return `${esc(text.slice(0, start))}<strong>${esc(text.slice(start, start + needle.length))}</strong>${esc(text.slice(start + needle.length))}`;
}

function optionHtml(item, position, query, kind) {
  const isCodeMatch = item.code && normalize(item.code) === normalize(query).replace(/[\s.]/g, '');
  const code = item.code ? ` (${isCodeMatch ? `<strong>${esc(item.code)}</strong>` : esc(item.code)})` : '';
  return `
    <li class="suggest__option ${position === activeIndex ? 'suggest__option--active' : ''}" id="${activeInput.id}-op-${position}" role="option" aria-selected="${position === activeIndex}" data-suggest-index="${position}">
      <span class="suggest__icon">${icon(item.icon || ICONS[kind] || 'search', 18)}</span>
      <span class="suggest__text">
        <span class="suggest__name">${highlight(item.name, query)}${code}</span>
        ${item.detail ? `<span class="suggest__detail">${esc(item.detail)}</span>` : ''}
      </span>
    </li>`;
}

function render(state) {
  const input = activeInput;
  const list = input && listFor(input);
  if (!list) return;
  const kind = input.dataset.autocomplete;
  let html = '';
  if (state === 'loading') html = '<li class="suggest__status" role="presentation">Buscando…</li>';
  else if (state === 'empty') html = '<li class="suggest__status" role="presentation">Sin resultados. Prueba con otro nombre o con el código (por ejemplo CTG).</li>';
  else html = items.map((item, position) => optionHtml(item, position, input.value, kind)).join('');
  list.innerHTML = html;
  list.hidden = !html;
  input.setAttribute('aria-expanded', String(!list.hidden));
  if (activeIndex >= 0) input.setAttribute('aria-activedescendant', `${input.id}-op-${activeIndex}`);
  else input.removeAttribute('aria-activedescendant');
}

function close(input = activeInput) {
  if (!input) return;
  const list = listFor(input);
  if (list) list.hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
  activeIndex = -1;
}

function setHidden(input, lat, lon) {
  const form = input.form;
  if (!form) return;
  const latField = form.elements[`${input.name}_lat`];
  const lonField = form.elements[`${input.name}_lon`];
  if (latField) latField.value = lat ?? '';
  if (lonField) lonField.value = lon ?? '';
}

function clearSelection(input) {
  delete input.dataset.lat;
  delete input.dataset.lon;
  setHidden(input, '', '');
}

function choose(position) {
  const input = activeInput;
  const item = items[position];
  if (!input || !item) return;
  close(input);
  // Sugerencias que llevan a otra pantalla (por ejemplo, un viaje)
  if (item.href) {
    input.value = '';
    location.hash = item.href;
    return;
  }
  input.value = item.value;
  input.dataset.lat = item.lat;
  input.dataset.lon = item.lon;
  setHidden(input, item.lat, item.lon);
  close(input);
  const clear = input.parentElement.querySelector(`[data-suggest-clear="${input.id}"]`);
  if (clear) clear.hidden = false;
  input.dispatchEvent(new CustomEvent('suggest:select', { bubbles: true, detail: item }));
  // Avisa a los filtros de la vista (data-input) sin volver a abrir el menu
  input.dataset.suggestSkip = '1';
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/* Permite que una vista aporte sus propias sugerencias: provider(texto) → [{ name, detail, value, href?, icon? }] */
export function registerSuggestions(kind, provider, { minLength = 1, label } = {}) {
  providers[kind] = provider;
  MIN_LENGTH[kind] = minLength;
  if (label) LABELS[kind] = label;
}

const search = debounce(async (input) => {
  const query = input.value.trim();
  const kind = input.dataset.autocomplete;
  const minLength = MIN_LENGTH[kind] ?? 1;
  const provider = providers[kind];
  const seq = ++requestSeq;
  controller?.abort();
  if (query.length < minLength) {
    items = [];
    close(input);
    return;
  }
  controller = new AbortController();
  render('loading');
  try {
    const near = input.dataset.nearLat ? { lat: Number(input.dataset.nearLat), lon: Number(input.dataset.nearLon) } : null;
    const results = provider ? await provider(query, { near, signal: controller.signal }) : [];
    if (seq !== requestSeq || activeInput !== input) return;
    items = results;
    activeIndex = results.length ? 0 : -1;
    render(results.length ? 'list' : 'empty');
  } catch (error) {
    if (error.name !== 'AbortError' && seq === requestSeq) {
      items = [];
      render('empty');
    }
  }
}, DEBOUNCE_MS);

/* ---- Handlers ---- */

function suggestFocusHandler(event) {
  const input = event.target.closest?.('input[data-autocomplete]');
  if (!input) return;
  setupInput(input);
  activeInput = input;
}

function suggestInputHandler(event) {
  const input = event.target.closest?.('input[data-autocomplete]');
  if (!input) return;
  if (input.dataset.suggestSkip) {
    delete input.dataset.suggestSkip;
    return;
  }
  setupInput(input);
  activeInput = input;
  clearSelection(input);
  const clear = input.parentElement.querySelector(`[data-suggest-clear="${input.id}"]`);
  if (clear) clear.hidden = !input.value;
  search(input);
}

function suggestKeyHandler(event) {
  const input = event.target.closest?.('input[data-autocomplete]');
  if (!input || input !== activeInput) return;
  const list = listFor(input);
  const isOpen = list && !list.hidden && items.length;
  if (event.key === 'ArrowDown' && items.length) {
    event.preventDefault();
    if (list.hidden) render('list');
    activeIndex = (activeIndex + 1) % items.length;
    render('list');
  } else if (event.key === 'ArrowUp' && isOpen) {
    event.preventDefault();
    activeIndex = (activeIndex - 1 + items.length) % items.length;
    render('list');
  } else if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
    // Con el menu abierto, Enter elige la opcion en vez de enviar el formulario
    event.preventDefault();
    choose(activeIndex);
  } else if (event.key === 'Escape' && isOpen) {
    event.preventDefault();
    event.stopPropagation();
    close(input);
  }
}

function suggestPointerHandler(event) {
  const option = event.target.closest?.('[data-suggest-index]');
  if (option) {
    // Se elige al pulsar (antes del blur) para que el menu no se cierre sin elegir
    event.preventDefault();
    choose(Number(option.dataset.suggestIndex));
    return;
  }
  const clear = event.target.closest?.('[data-suggest-clear]');
  if (clear) {
    event.preventDefault();
    const input = document.getElementById(clear.dataset.suggestClear);
    input.value = '';
    clearSelection(input);
    clear.hidden = true;
    items = [];
    close(input);
    input.focus();
    return;
  }
  if (activeInput && !event.target.closest?.('.suggest-host')) close(activeInput);
}

function suggestBlurHandler(event) {
  const input = event.target.closest?.('input[data-autocomplete]');
  if (input) setTimeout(() => { if (document.activeElement !== input) close(input); }, 120);
}

export function initAutocomplete() {
  document.addEventListener('focusin', suggestFocusHandler);
  document.addEventListener('input', suggestInputHandler);
  document.addEventListener('keydown', suggestKeyHandler, true);
  document.addEventListener('pointerdown', suggestPointerHandler);
  document.addEventListener('focusout', suggestBlurHandler);
}
