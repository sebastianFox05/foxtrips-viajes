/*
 * Comentarios de una actividad o una foto (modal del plan y lightbox).
 * Al comentar o borrar se avisa con el evento "foxtrips:comments" para que se actualicen
 * los demas bloques de comentarios y los contadores (tambien llega por tiempo real).
 */
import { useCallback, useEffect, useState } from 'react';
import { store } from '../lib/store/index.js';
import { timeAgo } from '../lib/utils.js';
import { Avatar } from './Avatar.jsx';
import { useUi } from '../ui/UiContext.jsx';

export const COMMENTS_EVENT = 'foxtrips:comments';

export function notifyComments() {
  window.dispatchEvent(new Event(COMMENTS_EVENT));
}

export function countFor(comments, targetType, targetId) {
  return comments.filter((comment) => comment.target_type === targetType && comment.target_id === targetId).length;
}

export default function Comments({ tripId, targetType, targetId, headingLevel = 3 }) {
  const { toastError } = useUi();
  const [comments, setComments] = useState(null);
  const [body, setBody] = useState('');
  const fieldId = `comment-${targetId}`;
  const Heading = `h${headingLevel}`;

  const load = useCallback(async () => {
    const all = await store.list('comments', tripId);
    setComments(all.filter((comment) => comment.target_type === targetType && comment.target_id === targetId));
  }, [tripId, targetType, targetId]);

  useEffect(() => {
    let isCurrent = true;
    const refreshHandler = () => load().catch(() => null);
    load().catch((error) => isCurrent && toastError(error));
    window.addEventListener(COMMENTS_EVENT, refreshHandler);
    return () => {
      isCurrent = false;
      window.removeEventListener(COMMENTS_EVENT, refreshHandler);
    };
  }, [load, toastError]);

  async function submitHandler(event) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    try {
      await store.insert('comments', {
        trip_id: tripId,
        target_type: targetType,
        target_id: targetId,
        body: text,
        author_id: store.user.id,
        author_name: store.user.name
      });
      setBody('');
      notifyComments();
      document.getElementById(fieldId)?.focus();
    } catch (error) {
      toastError(error);
    }
  }

  async function deleteHandler(id) {
    try {
      await store.remove('comments', id);
      notifyComments();
    } catch (error) {
      toastError(error);
    }
  }

  if (!comments) return <p className="loading">Cargando…</p>;
  return (
    <>
      <Heading className="card__title">Comentarios ({comments.length})</Heading>
      {comments.length ? (
        <ul className="comments__list">
          {comments.map((comment) => (
            <li className="comments__item" key={comment.id}>
              <Avatar name={comment.author_name} userId={comment.author_id} />
              <div className="comments__bubble">
                <p className="comments__head">
                  <span className="comments__author">{comment.author_name}</span>
                  <span className="comments__date">{timeAgo(comment.created_at)}
                    {comment.author_id === store.user?.id ? (
                      <> <button className="link-btn" type="button" aria-label="Borrar comentario" onClick={() => deleteHandler(comment.id)}>Borrar</button></>
                    ) : null}
                  </span>
                </p>
                <p className="comments__text">{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="comments__empty">Aún no hay comentarios. ¡Escribe el primero!</p>}
      <form className="form__inline" onSubmit={submitHandler}>
        <label className="visually-hidden" htmlFor={fieldId}>Escribe un comentario</label>
        <input className="form__input" id={fieldId} name="body" maxLength={1000} placeholder="Escribe un comentario…" required autoComplete="off" value={body} onChange={(event) => setBody(event.target.value)} />
        <button className="btn btn--primary" type="submit">Enviar</button>
      </form>
    </>
  );
}
