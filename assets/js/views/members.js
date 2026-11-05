/* Grupo: miembros y roles, enlaces de invitacion (editor / lector) y pagina publica. */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { confirmDialog, toast, toastError } from '../ui.js';
import { avatarHtml, esc } from '../utils.js';
import { roleLabel } from './shell.js';

let lastInvite = null;

function baseUrl() {
  return `${location.origin}${location.pathname}`;
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Enlace copiado');
  } catch {
    toast('Copia el enlace manualmente');
  }
}

/* ---- Handlers ---- */

async function createInviteHandler(button, event, ctx) {
  try {
    const role = button.dataset.role;
    const code = await store.createInvite(ctx.tripId, role);
    lastInvite = { tripId: ctx.tripId, role, url: `${baseUrl()}#/unirse/${code}` };
    await copy(lastInvite.url);
    if (navigator.share) navigator.share({ title: `Únete a ${ctx.trip.name}`, url: lastInvite.url }).catch(() => null);
    ctx.refresh();
  } catch (error) {
    toastError(error);
  }
}

function copyInviteHandler(button) {
  copy(button.dataset.url);
}

async function changeRoleHandler(select, ctx) {
  try {
    await store.setMemberRole(ctx.tripId, select.dataset.user, select.value);
    toast('Permisos actualizados');
  } catch (error) {
    toastError(error);
  }
  // Los miembros viven en el contexto del viaje: hay que recargarlo para ver el rol nuevo
  ctx.reloadTrip();
}

async function revokeInvitesHandler(button, event, ctx) {
  const isConfirmed = await confirmDialog('Los enlaces de invitación que hayas compartido dejarán de funcionar. Quien ya está en el grupo sigue dentro.', { confirmText: 'Revocar enlaces' });
  if (!isConfirmed) return;
  try {
    await store.revokeInvites(ctx.tripId);
    lastInvite = null;
    toast('Enlaces revocados');
    ctx.refresh();
  } catch (error) {
    toastError(error);
  }
}

async function removeMemberHandler(button, event, ctx) {
  const isSelf = button.dataset.user === store.user.id;
  const isConfirmed = await confirmDialog(isSelf ? 'Dejarás de ver este viaje.' : `${button.dataset.name} ya no podrá ver el viaje.`, { confirmText: isSelf ? 'Salir del viaje' : 'Quitar' });
  if (!isConfirmed) return;
  try {
    await store.removeMember(ctx.tripId, button.dataset.user);
    if (isSelf) location.hash = '#/';
    else ctx.reloadTrip();
  } catch (error) {
    toastError(error);
  }
}

async function togglePublicHandler(button, event, ctx) {
  try {
    await store.setPublic(ctx.tripId, !ctx.trip.public_token);
    ctx.reloadTrip();
  } catch (error) {
    toastError(error);
  }
}

export default {
  async render(ctx) {
    const publicUrl = ctx.trip.public_token ? `${baseUrl()}#/publico/${ctx.trip.public_token}` : null;
    const owners = ctx.members.filter((member) => member.role === 'owner').length;
    const invite = lastInvite?.tripId === ctx.tripId ? lastInvite : null;
    return `
      <div class="section__head"><h2>Grupo</h2><span class="section__hint">${ctx.members.length} viajeros</span></div>
      <div class="grid grid--2">
        <section class="card" aria-labelledby="membersTitle">
          <h3 class="card__title" id="membersTitle">Quién viaja</h3>
          <ul class="rows">${ctx.members.map((member) => {
            const isMe = member.user_id === store.user.id;
            const isLastOwner = member.role === 'owner' && owners === 1;
            return `
              <li class="row">
                ${avatarHtml(member.name, 'avatar--lg')}
                <div class="row__body">
                  <p class="row__title">${esc(member.name)}${isMe ? ' (tú)' : ''}</p>
                  <p class="row__meta">${roleLabel(member.role)}</p>
                </div>
                <div class="row__actions">
                  ${ctx.isOwner && !isMe ? `
                    <label class="visually-hidden" for="role-${esc(member.user_id)}">Rol de ${esc(member.name)}</label>
                    <select class="form__select form__select--compact" id="role-${esc(member.user_id)}" data-input="change-role" data-user="${esc(member.user_id)}">
                      ${['owner', 'editor', 'viewer'].map((role) => `<option value="${role}" ${role === member.role ? 'selected' : ''}>${roleLabel(role)}</option>`).join('')}
                    </select>` : ''}
                  ${(ctx.isOwner && !isMe) || (isMe && !isLastOwner) ? `<button class="btn btn--ghost btn--small" type="button" data-action="remove-member" data-user="${esc(member.user_id)}" data-name="${esc(member.name)}">${isMe ? 'Salir' : 'Quitar'}</button>` : ''}
                </div>
              </li>`;
          }).join('')}</ul>
        </section>
        <div class="grid">
          ${ctx.canEdit ? `
          <section class="card" aria-labelledby="inviteTitle">
            <h3 class="card__title" id="inviteTitle">${icon('link', 18)} Invitar por enlace</h3>
            <p class="card__text">Los <strong>editores</strong> pueden cambiar el plan y subir fotos. Los <strong>lectores</strong> solo ven, votan y comentan.</p>
            <div class="page-head__actions page-head__actions--top">
              <button class="btn btn--primary btn--small" type="button" data-action="create-invite" data-role="editor">Enlace de editor</button>
              <button class="btn btn--small" type="button" data-action="create-invite" data-role="viewer">Enlace de lector</button>
            </div>
            ${invite ? `
              <div class="invite">
                <p class="form__help">Último enlace (${roleLabel(invite.role).toLowerCase()}, caduca en 14 días):</p>
                <p class="invite__link">${esc(invite.url)}</p>
                <button class="btn btn--small" type="button" data-action="copy-invite" data-url="${esc(invite.url)}">Copiar de nuevo</button>
              </div>` : ''}
            ${ctx.isOwner ? `<button class="link-btn btn--top" type="button" data-action="revoke-invites">${icon('trash', 14)} Revocar todos los enlaces</button>` : ''}
            ${store.mode === 'local' ? '<p class="form__help form__help--top">Modo local: el enlace solo funciona en este navegador (prueba a entrar con otro nombre). Con Supabase funciona en cualquier dispositivo.</p>' : ''}
          </section>` : ''}
          ${ctx.isOwner ? `
          <section class="card" aria-labelledby="publicTitle">
            <h3 class="card__title" id="publicTitle">${icon('share', 18)} Página pública</h3>
            <p class="card__text">Una página de solo lectura con el itinerario y el álbum, sin necesidad de cuenta.</p>
            ${publicUrl ? `<div class="invite"><p class="invite__link">${esc(publicUrl)}</p>
              <div class="page-head__actions"><button class="btn btn--small" type="button" data-action="copy-invite" data-url="${esc(publicUrl)}">Copiar</button>
              <a class="btn btn--small" href="${esc(publicUrl)}" target="_blank" rel="noopener">Ver</a></div></div>` : ''}
            <button class="btn btn--small btn--top ${publicUrl ? 'btn--danger' : 'btn--primary'}" type="button" data-action="toggle-public">${publicUrl ? 'Desactivar página pública' : 'Activar página pública'}</button>
          </section>` : ''}
        </div>
      </div>`;
  },
  actions: {
    'create-invite': createInviteHandler,
    'copy-invite': copyInviteHandler,
    'remove-member': removeMemberHandler,
    'toggle-public': togglePublicHandler,
    'revoke-invites': revokeInvitesHandler
  },
  inputs: { 'change-role': changeRoleHandler }
};
