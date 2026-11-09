/*
 * Interfaz comun: ventana modal accesible, confirmaciones y avisos (toasts).
 * Mismo marcado y comportamiento que ui.js de la version anterior:
 * - el modal guarda el foco de quien lo abrio y lo devuelve al cerrarse;
 * - una confirmacion dentro de otro modal reutiliza la misma ventana;
 * - pulsar fuera de la caja o Escape cierra (y una confirmacion abierta responde "no").
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const TOAST_MS = 3200;
const TOAST_ACTION_MS = 10000;
const UiContext = createContext(null);

let toastSeq = 0;
let modalSeq = 0;

function Modal({ modal, onRequestClose, onClosed }) {
  const dialogRef = useRef(null);
  const bodyRef = useRef(null);

  // Abrir / cerrar el <dialog> nativo segun el estado
  useEffect(() => {
    const dialog = dialogRef.current;
    if (modal && !dialog.open) dialog.showModal();
    if (!modal && dialog.open) dialog.close();
  }, [modal]);

  // Cada contenido nuevo enfoca su primer campo (o el boton de cerrar)
  useEffect(() => {
    if (!modal) return;
    const firstField = bodyRef.current?.querySelector('input:not([type=hidden]), select, textarea, button');
    (firstField || dialogRef.current.querySelector('.modal__close'))?.focus();
  }, [modal?.key]);

  function closeHandler() {
    // Si ya se volvio a abrir (cerrar y abrir seguidos) no se borra el contenido nuevo
    if (dialogRef.current.open) return;
    onClosed();
  }

  function backdropHandler(event) {
    if (event.target === dialogRef.current) onRequestClose();
  }

  return (
    <dialog className="modal" id="modal" aria-labelledby="modalTitle" ref={dialogRef} onClose={closeHandler} onClick={backdropHandler}>
      <div className="modal__box">
        <header className="modal__header">
          <h2 className="modal__title" id="modalTitle">{modal?.title || ''}</h2>
          <button className="modal__close" type="button" aria-label="Cerrar ventana" onClick={onRequestClose}>×</button>
        </header>
        <div className="modal__body" id="modalBody" ref={bodyRef}>{modal?.content || null}</div>
      </div>
    </dialog>
  );
}

function ConfirmBody({ message, confirmText, isDanger, onCancel, onConfirm }) {
  return (
    <>
      <p className="card__text">{message}</p>
      <div className="form__actions form__actions--top">
        <button className="btn" type="button" onClick={onCancel}>Cancelar</button>
        <button className={`btn ${isDanger ? 'btn--destructive' : 'btn--primary'}`} type="button" onClick={onConfirm}>{confirmText}</button>
      </div>
    </>
  );
}

export function UiProvider({ children }) {
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const lastFocusRef = useRef(null);
  const confirmRef = useRef(null);
  const isOpenRef = useRef(false);

  /* action: { label, onClick } añade un boton al aviso (por ejemplo "Deshacer"); entonces dura mas */
  const toast = useCallback((message, { isError = false, action = null } = {}) => {
    const id = ++toastSeq;
    setToasts((list) => [...list, { id, message, isError, action }]);
    setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), action ? TOAST_ACTION_MS : TOAST_MS);
  }, []);

  const toastActionHandler = useCallback((item) => {
    setToasts((list) => list.filter((entry) => entry.id !== item.id));
    item.action.onClick();
  }, []);

  const toastError = useCallback((error) => {
    console.error(error);
    toast(error?.message || 'Algo salió mal. Inténtalo de nuevo.', { isError: true });
  }, [toast]);

  const openModal = useCallback((title, content) => {
    // Si ya estaba abierto (confirmacion dentro de otro modal) se conserva el foco original
    if (!isOpenRef.current) lastFocusRef.current = document.activeElement;
    isOpenRef.current = true;
    setModal({ title, content, key: ++modalSeq });
  }, []);

  /* Cambia el contenido sin mover el foco (por ejemplo, al terminar de cargar) */
  const setModalContent = useCallback((content) => {
    setModal((current) => (current ? { ...current, content } : current));
  }, []);

  const closeModal = useCallback(() => {
    isOpenRef.current = false;
    setModal(null);
  }, []);

  const modalClosedHandler = useCallback(() => {
    isOpenRef.current = false;
    if (confirmRef.current) {
      confirmRef.current(false);
      confirmRef.current = null;
    }
    setModal(null);
    const lastFocus = lastFocusRef.current;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }, []);

  const confirm = useCallback((message, { confirmText = 'Eliminar', isDanger = true } = {}) => new Promise((resolve) => {
    const cancel = () => closeModal();
    const accept = () => {
      const resolver = confirmRef.current;
      confirmRef.current = null;
      closeModal();
      resolver?.(true);
    };
    openModal('¿Estás seguro?', <ConfirmBody message={message} confirmText={confirmText} isDanger={isDanger} onCancel={cancel} onConfirm={accept} />);
    confirmRef.current = resolve;
  }), [closeModal, openModal]);

  const value = useMemo(() => ({
    toast, toastError, openModal, setModalContent, closeModal, confirm, isModalOpen: () => isOpenRef.current
  }), [toast, toastError, openModal, setModalContent, closeModal, confirm]);

  return (
    <UiContext.Provider value={value}>
      {children}
      <Modal modal={modal} onRequestClose={closeModal} onClosed={modalClosedHandler} />
      <div className="toast-region" id="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((item) => (
          <p key={item.id} className={`toast${item.isError ? ' toast--error' : ''}${item.action ? ' toast--action' : ''}`} role={item.isError ? 'alert' : 'status'}>
            {item.message}
            {item.action ? <button className="toast__action" type="button" onClick={() => toastActionHandler(item)}>{item.action.label}</button> : null}
          </p>
        ))}
      </div>
    </UiContext.Provider>
  );
}

export function useUi() {
  return useContext(UiContext);
}

/*
 * Estado "Guardando…" de un boton mientras dura una tarea (equivale a withBusy()).
 * const [isBusy, runBusy] = useBusy();  …  <button disabled={isBusy}>{isBusy ? 'Guardando…' : 'Guardar'}</button>
 */
export function useBusy() {
  const [isBusy, setIsBusy] = useState(false);
  const isMountedRef = useRef(true);
  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);
  const runBusy = useCallback(async (task) => {
    setIsBusy(true);
    try {
      return await task();
    } finally {
      if (isMountedRef.current) setIsBusy(false);
    }
  }, []);
  return [isBusy, runBusy];
}
