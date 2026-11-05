/*
 * Lightbox accesible del album:
 * - Escape cierra (comportamiento nativo de <dialog>)
 * - Flechas izquierda/derecha navegan
 * - Al cerrar se devuelve el foco a la miniatura que lo abrio
 */
import { esc, safeUrl } from './utils.js';
import { pictureHtml, hydrateMedia } from './media.js';
import { renderComments } from './comments.js';

const lightbox = document.getElementById('lightbox');
const picture = document.getElementById('lightboxPicture');
const counter = document.getElementById('lightboxCounter');
const caption = document.getElementById('lightboxText');
const comments = document.getElementById('lightboxComments');

let photos = [];
let index = 0;
let tripId = null;
let opener = null;
let hasComments = true;

function show() {
  const photo = photos[index];
  if (!photo) return;
  picture.innerHTML = pictureHtml(photo.url, {
    alt: photo.caption || `Foto ${index + 1} del viaje`,
    isLazy: false,
    width: 1600,
    height: 1200
  }).replace(/^<picture[^>]*>|<\/picture>$/g, '');
  counter.textContent = `${index + 1} / ${photos.length}`;
  const sourceUrl = safeUrl(photo.source_url);
  let credit = '';
  if (photo.credit) {
    credit = sourceUrl
      ? ` · <a class="lightbox__credit" href="${esc(sourceUrl)}" target="_blank" rel="noopener">Foto: ${esc(photo.credit)}</a>`
      : ` · <span class="lightbox__credit">Foto: ${esc(photo.credit)}</span>`;
  }
  caption.innerHTML = `${esc(photo.caption || '')}${photo.uploader_name ? ` · <span>${esc(photo.uploader_name)}</span>` : ''}${credit}`;
  hydrateMedia(lightbox);
  comments.hidden = !hasComments;
  if (hasComments) {
    comments.dataset.comments = `photo:${photo.id}`;
    renderComments(comments, tripId, { headingLevel: 2 });
  }
}

export function closeLightbox() {
  if (lightbox.open) lightbox.close();
}

export function openLightbox(list, startIndex, options) {
  photos = list;
  index = startIndex;
  tripId = options.tripId;
  hasComments = options.hasComments !== false;
  opener = document.activeElement;
  show();
  lightbox.showModal();
  lightbox.querySelector('.lightbox__close').focus();
}

function step(delta) {
  index = (index + delta + photos.length) % photos.length;
  show();
}

function lightboxClickHandler(event) {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'lightbox-close') lightbox.close();
  if (action === 'lightbox-prev') step(-1);
  if (action === 'lightbox-next') step(1);
}

function lightboxKeyHandler(event) {
  const isTyping = event.target.matches('input, textarea');
  if (isTyping) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    step(-1);
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    step(1);
  }
}

function lightboxCloseHandler() {
  picture.innerHTML = '';
  delete comments.dataset.comments;
  if (opener && document.contains(opener)) opener.focus();
}

lightbox.addEventListener('click', lightboxClickHandler);
lightbox.addEventListener('keydown', lightboxKeyHandler);
lightbox.addEventListener('close', lightboxCloseHandler);
