/*
 * Campo con menu desplegable de sugerencias (patron "combobox" accesible), igual que autocomplete.js:
 * - Flechas ↑ ↓ para moverse, Enter para elegir, Escape para cerrar (sin cerrar el modal).
 * - Boton ✕ para borrar el texto. La parte que coincide va en negrita y el codigo entre parentesis.
 * - Al elegir guarda las coordenadas en los campos ocultos "<name>_lat" y "<name>_lon" (withCoords).
 *   Si se vuelve a escribir, las coordenadas elegidas se borran (asi nunca quedan desfasadas).
 * El contenedor (padre) debe llevar la clase "suggest-host"; si es un .form__field, usa isOverlay.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { normalize } from '../lib/places.js';
import { SUGGEST_ICONS, suggestionLabel, suggestionMinLength, suggestionProvider } from '../lib/suggestions.js';

const DEBOUNCE_MS = 220;
const BLUR_DELAY_MS = 120;

function Highlight({ text, query }) {
  const plain = normalize(text);
  const needle = normalize(query);
  const start = needle ? plain.indexOf(needle) : -1;
  if (start < 0) return text;
  return (
    <>
      {text.slice(0, start)}
      <strong>{text.slice(start, start + needle.length)}</strong>
      {text.slice(start + needle.length)}
    </>
  );
}

const SuggestInput = forwardRef(function SuggestInput({
  id, name, kind, defaultValue = '', className = 'form__input', near = null, isOverlay = false,
  withCoords = false, defaultCoords = null, onSelect, onValueChange, ...inputProps
}, forwardedRef) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const controllerRef = useRef(null);
  const seqRef = useRef(0);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('closed'); // closed | loading | empty | list
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasText, setHasText] = useState(Boolean(defaultValue));
  const [coords, setCoords] = useState({ lat: defaultCoords?.lat ?? '', lon: defaultCoords?.lon ?? '' });
  const [overlayTop, setOverlayTop] = useState(null);

  useImperativeHandle(forwardedRef, () => inputRef.current);

  // Dentro de un campo con etiqueta, el ✕ y el menu se colocan sobre/bajo el input
  useLayoutEffect(() => {
    if (!isOverlay || !inputRef.current) return;
    const input = inputRef.current;
    setOverlayTop({ clear: input.offsetTop + input.offsetHeight / 2, list: input.offsetTop + input.offsetHeight + 6 });
  }, [isOverlay]);

  useEffect(() => () => {
    clearTimeout(timerRef.current);
    controllerRef.current?.abort();
  }, []);

  const close = useCallback(() => {
    setStatus('closed');
    setActiveIndex(-1);
  }, []);

  const search = useCallback((query) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const seq = ++seqRef.current;
      controllerRef.current?.abort();
      if (query.trim().length < suggestionMinLength(kind)) {
        setItems([]);
        close();
        return;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      setStatus('loading');
      try {
        const provider = suggestionProvider(kind);
        const nearPoint = near?.lat != null ? { lat: Number(near.lat), lon: Number(near.lon) } : null;
        const results = provider ? await provider(query.trim(), { near: nearPoint, signal: controller.signal }) : [];
        if (seq !== seqRef.current) return;
        setItems(results);
        setActiveIndex(results.length ? 0 : -1);
        setStatus(results.length ? 'list' : 'empty');
      } catch (error) {
        if (error.name !== 'AbortError' && seq === seqRef.current) {
          setItems([]);
          setStatus('empty');
        }
      }
    }, DEBOUNCE_MS);
  }, [kind, near?.lat, near?.lon, close]);

  function choose(position) {
    const item = items[position];
    const input = inputRef.current;
    if (!item || !input) return;
    close();
    // Sugerencias que llevan a otra pantalla (por ejemplo, un viaje)
    if (item.href) {
      input.value = '';
      setHasText(false);
      navigate(item.href.replace(/^#/, ''));
      return;
    }
    input.value = item.value;
    setHasText(true);
    setCoords({ lat: item.lat ?? '', lon: item.lon ?? '' });
    onSelect?.(item);
    onValueChange?.(item.value, { isFromSelect: true, item });
  }

  function inputHandler(event) {
    const { value } = event.target;
    setHasText(Boolean(value));
    setCoords({ lat: '', lon: '' });
    onValueChange?.(value, { isFromSelect: false });
    search(value);
  }

  function keyHandler(event) {
    const isOpen = status === 'list' && items.length > 0;
    if (event.key === 'ArrowDown' && items.length) {
      event.preventDefault();
      setStatus('list');
      setActiveIndex((index) => (index + 1) % items.length);
    } else if (event.key === 'ArrowUp' && isOpen) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + items.length) % items.length);
    } else if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      // Con el menu abierto, Enter elige la opcion en vez de enviar el formulario
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === 'Escape' && (status === 'list' || status === 'empty' || status === 'loading')) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    inputProps.onKeyDown?.(event);
  }

  function blurHandler(event) {
    setTimeout(() => {
      if (document.activeElement !== inputRef.current) close();
    }, BLUR_DELAY_MS);
    inputProps.onBlur?.(event);
  }

  function clearHandler(event) {
    event.preventDefault();
    const input = inputRef.current;
    input.value = '';
    setHasText(false);
    setCoords({ lat: '', lon: '' });
    setItems([]);
    close();
    onValueChange?.('', { isFromSelect: false });
    input.focus();
  }

  const listId = `${id}-sugerencias`;
  const isListVisible = status !== 'closed';
  const query = inputRef.current?.value || '';
  const { onKeyDown, onBlur, ...restProps } = inputProps;

  return (
    <>
      <input
        {...restProps}
        ref={inputRef}
        id={id}
        name={name}
        className={className}
        defaultValue={defaultValue}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isListVisible}
        aria-controls={listId}
        aria-activedescendant={isListVisible && activeIndex >= 0 ? `${id}-op-${activeIndex}` : undefined}
        autoComplete="off"
        data-autocomplete={kind}
        onInput={inputHandler}
        onKeyDown={keyHandler}
        onBlur={blurHandler}
      />
      <button
        type="button"
        className={`suggest__clear${isOverlay ? ' suggest__clear--overlay' : ''}`}
        aria-label="Borrar texto"
        hidden={!hasText}
        style={isOverlay && overlayTop ? { top: `${overlayTop.clear}px` } : undefined}
        onPointerDown={clearHandler}
      >×</button>
      <ul
        className="suggest"
        id={listId}
        role="listbox"
        aria-label={suggestionLabel(kind)}
        hidden={!isListVisible}
        style={isOverlay && overlayTop ? { top: `${overlayTop.list}px` } : undefined}
      >
        {status === 'loading' ? <li className="suggest__status" role="presentation">Buscando…</li> : null}
        {status === 'empty' ? <li className="suggest__status" role="presentation">Sin resultados. Prueba con otro nombre o con el código (por ejemplo CTG).</li> : null}
        {status === 'list' ? items.map((item, position) => {
          const isCodeMatch = item.code && normalize(item.code) === normalize(query).replace(/[\s.]/g, '');
          return (
            <li
              key={`${item.name}-${position}`}
              className={`suggest__option ${position === activeIndex ? 'suggest__option--active' : ''}`}
              id={`${id}-op-${position}`}
              role="option"
              aria-selected={position === activeIndex}
              onPointerDown={(event) => {
                // Se elige al pulsar (antes del blur) para que el menu no se cierre sin elegir
                event.preventDefault();
                choose(position);
              }}
            >
              <span className="suggest__icon"><Icon name={item.icon || SUGGEST_ICONS[kind] || 'search'} size={18} /></span>
              <span className="suggest__text">
                <span className="suggest__name">
                  <Highlight text={item.name} query={query} />
                  {item.code ? <> ({isCodeMatch ? <strong>{item.code}</strong> : item.code})</> : null}
                </span>
                {item.detail ? <span className="suggest__detail">{item.detail}</span> : null}
              </span>
            </li>
          );
        }) : null}
      </ul>
      {withCoords ? (
        <>
          <input type="hidden" name={`${name}_lat`} value={coords.lat} readOnly />
          <input type="hidden" name={`${name}_lon`} value={coords.lon} readOnly />
        </>
      ) : null}
    </>
  );
});

export default SuggestInput;
