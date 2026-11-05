/* Grupo: miembros y roles, enlaces de invitacion (editor / lector) y pagina publica. */
import { useNavigate } from 'react-router-dom';
import { store } from '../../lib/store/index.js';
import Icon from '../../components/Icon.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { useUi } from '../../ui/UiContext.jsx';
import { roleLabel } from './sections.js';
import { useTrip } from './TripContext.jsx';
import { useState } from 'react';

// El ultimo enlace creado se muestra al volver a la pestaña (mismo viaje)
let lastInvite = null;

function baseUrl() {
  return `${location.origin}${location.pathname}`;
}

export default function MembersView() {
  const navigate = useNavigate();
  const { trip, tripId, members, canEdit, isOwner, reloadTrip } = useTrip();
  const { toast, toastError, confirm } = useUi();
  const [invite, setInvite] = useState(lastInvite?.tripId === tripId ? lastInvite : null);
  const publicUrl = trip.public_token ? `${baseUrl()}#/publico/${trip.public_token}` : null;
  const owners = members.filter((member) => member.role === 'owner').length;

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Enlace copiado');
    } catch {
      toast('Copia el enlace manualmente');
    }
  }

  async function createInviteHandler(role) {
    try {
      const code = await store.createInvite(tripId, role);
      lastInvite = { tripId, role, url: `${baseUrl()}#/unirse/${code}` };
      setInvite(lastInvite);
      await copy(lastInvite.url);
      if (navigator.share) navigator.share({ title: `Únete a ${trip.name}`, url: lastInvite.url }).catch(() => null);
    } catch (error) {
      toastError(error);
    }
  }

  async function changeRoleHandler(userId, role) {
    try {
      await store.setMemberRole(tripId, userId, role);
      toast('Permisos actualizados');
    } catch (error) {
      toastError(error);
    }
    // Los miembros viven en el contexto del viaje: hay que recargarlo para ver el rol nuevo
    reloadTrip();
  }

  async function revokeInvitesHandler() {
    const isConfirmed = await confirm('Los enlaces de invitación que hayas compartido dejarán de funcionar. Quien ya está en el grupo sigue dentro.', { confirmText: 'Revocar enlaces' });
    if (!isConfirmed) return;
    try {
      await store.revokeInvites(tripId);
      lastInvite = null;
      setInvite(null);
      toast('Enlaces revocados');
    } catch (error) {
      toastError(error);
    }
  }

  async function removeMemberHandler(member) {
    const isSelf = member.user_id === store.user.id;
    const isConfirmed = await confirm(isSelf ? 'Dejarás de ver este viaje.' : `${member.name} ya no podrá ver el viaje.`, { confirmText: isSelf ? 'Salir del viaje' : 'Quitar' });
    if (!isConfirmed) return;
    try {
      await store.removeMember(tripId, member.user_id);
      if (isSelf) navigate('/');
      else reloadTrip();
    } catch (error) {
      toastError(error);
    }
  }

  async function togglePublicHandler() {
    try {
      await store.setPublic(tripId, !trip.public_token);
      reloadTrip();
    } catch (error) {
      toastError(error);
    }
  }

  return (
    <>
      <div className="section__head"><h2>Grupo</h2><span className="section__hint">{members.length} viajeros</span></div>
      <div className="grid grid--2">
        <section className="card" aria-labelledby="membersTitle">
          <h3 className="card__title" id="membersTitle">Quién viaja</h3>
          <ul className="rows">
            {members.map((member) => {
              const isMe = member.user_id === store.user.id;
              const isLastOwner = member.role === 'owner' && owners === 1;
              return (
                <li className="row" key={member.user_id}>
                  <Avatar name={member.name} userId={member.user_id} extraClass="avatar--lg" />
                  <div className="row__body">
                    <p className="row__title">{member.name}{isMe ? ' (tú)' : ''}</p>
                    <p className="row__meta">{roleLabel(member.role)}</p>
                  </div>
                  <div className="row__actions">
                    {isOwner && !isMe ? (
                      <>
                        <label className="visually-hidden" htmlFor={`role-${member.user_id}`}>Rol de {member.name}</label>
                        <select className="form__select form__select--compact" id={`role-${member.user_id}`} value={member.role} onChange={(event) => changeRoleHandler(member.user_id, event.target.value)}>
                          {['owner', 'editor', 'viewer'].map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
                        </select>
                      </>
                    ) : null}
                    {(isOwner && !isMe) || (isMe && !isLastOwner) ? <button className="btn btn--ghost btn--small" type="button" onClick={() => removeMemberHandler(member)}>{isMe ? 'Salir' : 'Quitar'}</button> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <div className="grid">
          {canEdit ? (
            <section className="card" aria-labelledby="inviteTitle">
              <h3 className="card__title" id="inviteTitle"><Icon name="link" size={18} /> Invitar por enlace</h3>
              <p className="card__text">Los <strong>editores</strong> pueden cambiar el plan y subir fotos. Los <strong>lectores</strong> solo ven, votan y comentan.</p>
              <div className="page-head__actions page-head__actions--top">
                <button className="btn btn--primary btn--small" type="button" onClick={() => createInviteHandler('editor')}>Enlace de editor</button>
                <button className="btn btn--small" type="button" onClick={() => createInviteHandler('viewer')}>Enlace de lector</button>
              </div>
              {invite ? (
                <div className="invite">
                  <p className="form__help">Último enlace ({roleLabel(invite.role).toLowerCase()}, caduca en 14 días):</p>
                  <p className="invite__link">{invite.url}</p>
                  <button className="btn btn--small" type="button" onClick={() => copy(invite.url)}>Copiar de nuevo</button>
                </div>
              ) : null}
              {isOwner ? <button className="link-btn btn--top" type="button" onClick={revokeInvitesHandler}><Icon name="trash" size={14} /> Revocar todos los enlaces</button> : null}
              {store.mode === 'local' ? <p className="form__help form__help--top">Modo local: el enlace solo funciona en este navegador (prueba a entrar con otro nombre). Con Supabase funciona en cualquier dispositivo.</p> : null}
            </section>
          ) : null}
          {isOwner ? (
            <section className="card" aria-labelledby="publicTitle">
              <h3 className="card__title" id="publicTitle"><Icon name="share" size={18} /> Página pública</h3>
              <p className="card__text">Una página de solo lectura con el itinerario y el álbum, sin necesidad de cuenta.</p>
              {publicUrl ? (
                <div className="invite">
                  <p className="invite__link">{publicUrl}</p>
                  <div className="page-head__actions">
                    <button className="btn btn--small" type="button" onClick={() => copy(publicUrl)}>Copiar</button>
                    <a className="btn btn--small" href={publicUrl} target="_blank" rel="noopener noreferrer">Ver</a>
                  </div>
                </div>
              ) : null}
              <button className={`btn btn--small btn--top ${publicUrl ? 'btn--danger' : 'btn--primary'}`} type="button" onClick={togglePublicHandler}>{publicUrl ? 'Desactivar página pública' : 'Activar página pública'}</button>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
