/* Componentes de interfaz: modal accesible, confirmacion y avisos. */
import { esc } from './utils.js';
import { hydrateMedia } from './media.js';

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const toastRegion = document.getElementById('toasts');
const TOAST_MS = 3200;

let lastFocus = null;
let confirmResolver = null;

/* ---- Modal ---- */

export function openModal(title, html) {
  // Si el modal ya estaba abierto (confirmacion dentro de otro modal) se conserva el foco original
  if (!modal.open) lastFocus = document.activeElement;
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  hydrateMedia(modalBody);
  if (!modal.open) modal.showModal();
  const firstField = modalBody.querySelector('input:not([type=hidden]), select, textarea, button');
  (firstField || modal.querySelector('.modal__close')).focus();
}

export function setModalBody(html) {
  modalBody.innerHTML = html;
  hydrateMedia(modalBody);
}

export function closeModal() {
  if (modal.open) modal.close();
}

export function isModalOpen() {
  return modal.open;
}

function modalCloseHandler() {
  // Si ya se volvio a abrir (cerrar y abrir seguidos) no se borra el contenido nuevo
  if (modal.open) return;
  modalBody.innerHTML = '';
  if (confirmResolver) {
    confirmResolver(false);
    confirmResolver = null;
  }
  // Restaurar el foco al elemento que abrio el modal
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

function modalBackdropHandler(event) {
  if (event.target === modal) closeModal();
}

/* ---- Confirmacion ---- */

export function confirmDialog(message, { confirmText = 'Eliminar', isDanger = true } = {}) {
  openModal('¿Estás seguro?', `
    <p class="card__text">${esc(message)}</p>
    <div class="form__actions form__actions--top">
      <button class="btn" type="button" data-action="close-modal">Cancelar</button>
      <button class="btn ${isDanger ? 'btn--destructive' : 'btn--primary'}" type="button" data-action="confirm-yes">${esc(confirmText)}</button>
    </div>`);
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

export function resolveConfirm() {
  const resolver = confirmResolver;
  confirmResolver = null;
  closeModal();
  resolver?.(true);
}

/* ---- Avisos ---- */

export function toast(message, { isError = false } = {}) {
  const item = document.createElement('p');
  item.className = `toast${isError ? ' toast--error' : ''}`;
  item.setAttribute('role', isError ? 'alert' : 'status');
  item.textContent = message;
  toastRegion.append(item);
  setTimeout(() => item.remove(), TOAST_MS);
}

export function toastError(error) {
  console.error(error);
  toast(error?.message || 'Algo salió mal. Inténtalo de nuevo.', { isError: true });
}

/* ---- Ayudantes de botones ---- */

export async function withBusy(button, task) {
  const label = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.textContent = 'Guardando…';
  }
  try {
    return await task();
  } finally {
    if (button && document.contains(button)) {
      button.disabled = false;
      button.innerHTML = label;
    }
  }
}

modal.addEventListener('close', modalCloseHandler);
modal.addEventListener('click', modalBackdropHandler);
