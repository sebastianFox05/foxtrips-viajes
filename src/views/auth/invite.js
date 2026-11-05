/* Invitacion pendiente: si abres un enlace #/unirse/:codigo sin sesion, se usa al entrar. */
const PENDING_INVITE_KEY = 'foxtrips:pending-invite';

export function rememberInvite(code) {
  sessionStorage.setItem(PENDING_INVITE_KEY, code);
}

export function takePendingInvite() {
  const code = sessionStorage.getItem(PENDING_INVITE_KEY);
  sessionStorage.removeItem(PENDING_INVITE_KEY);
  return code;
}
