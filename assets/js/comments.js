/* Comentarios en actividades y fotos (se usan en el modal de actividad y en el lightbox). */
import { store } from './store/index.js';
import { avatarHtml, esc, timeAgo } from './utils.js';

function listHtml(comments, user) {
  if (!comments.length) return '<p class="comments__empty">Aún no hay comentarios. ¡Escribe el primero!</p>';
  return `<ul class="comments__list">${comments.map((comment) => `
    <li class="comments__item">
      ${avatarHtml(comment.author_name, '', comment.author_id)}
      <div class="comments__bubble">
        <p class="comments__head">
          <span class="comments__author">${esc(comment.author_name)}</span>
          <span class="comments__date">${esc(timeAgo(comment.created_at))}
            ${comment.author_id === user?.id ? `<button class="link-btn" type="button" data-action="delete-comment" data-id="${esc(comment.id)}" aria-label="Borrar comentario">Borrar</button>` : ''}
          </span>
        </p>
        <p class="comments__text">${esc(comment.body)}</p>
      </div>
    </li>`).join('')}</ul>`;
}

function formHtml(targetType, targetId) {
  const fieldId = `comment-${targetId}`;
  return `
    <form class="form__inline" data-form="comment" data-target-type="${esc(targetType)}" data-target-id="${esc(targetId)}">
      <label class="visually-hidden" for="${esc(fieldId)}">Escribe un comentario</label>
      <input class="form__input" id="${esc(fieldId)}" name="body" maxlength="1000" placeholder="Escribe un comentario…" required autocomplete="off">
      <button class="btn btn--primary" type="submit">Enviar</button>
    </form>`;
}

/* Pinta los comentarios dentro de un contenedor con data-comments="tipo:id" */
export async function renderComments(container, tripId, { headingLevel } = {}) {
  const [targetType, targetId] = container.dataset.comments.split(':');
  const all = await store.list('comments', tripId);
  const comments = all.filter((comment) => comment.target_type === targetType && comment.target_id === targetId);
  // El nivel se recuerda para los refrescos (2 en el lightbox, 3 dentro de un modal con h2)
  if (headingLevel) container.dataset.heading = headingLevel;
  const tag = `h${container.dataset.heading || 3}`;
  container.innerHTML = `
    <${tag} class="card__title">Comentarios (${comments.length})</${tag}>
    ${listHtml(comments, store.user)}
    ${formHtml(targetType, targetId)}`;
}

export async function refreshAllComments(tripId) {
  const containers = document.querySelectorAll('[data-comments]');
  await Promise.all(Array.from(containers, (container) => renderComments(container, tripId)));
}

export async function addComment(form, tripId) {
  const body = form.elements.body.value.trim();
  if (!body) return;
  await store.insert('comments', {
    trip_id: tripId,
    target_type: form.dataset.targetType,
    target_id: form.dataset.targetId,
    body,
    author_id: store.user.id,
    author_name: store.user.name
  });
  await refreshAllComments(tripId);
  document.getElementById(`comment-${form.dataset.targetId}`)?.focus();
}

export async function deleteComment(id, tripId) {
  await store.remove('comments', id);
  await refreshAllComments(tripId);
}

export function countFor(comments, targetType, targetId) {
  return comments.filter((comment) => comment.target_type === targetType && comment.target_id === targetId).length;
}
