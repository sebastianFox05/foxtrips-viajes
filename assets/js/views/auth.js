/*
 * Acceso y registro (pantalla oscura con imagen animada y halo de luz), perfil y union por invitacion.
 * La imagen de la izquierda va cambiando entre fotos de viaje con un zoom lento.
 */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { cleanupAvatars, photoProvider, uploadAvatar } from '../media.js';
import { confirmDialog, toast, toastError, withBusy } from '../ui.js';
import { avatarHtml, esc, formToObject } from '../utils.js';
import { photoSources } from './welcome.js';

const PENDING_INVITE_KEY = 'foxtrips:pending-invite';
const HAS_ACCOUNT_KEY = 'foxtrips:has-account';
const AUTH_ERRORS = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/already registered|already been registered|user already exists/i, 'Ya existe una cuenta con ese correo. Pulsa «Inicia sesión».'],
  [/password should be at least|weak password/i, 'La contraseña es demasiado débil: usa al menos 6 caracteres.'],
  [/email not confirmed/i, 'Confirma tu correo antes de entrar (revisa tu bandeja de entrada).'],
  [/rate limit|too many requests|security purposes/i, 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.'],
  [/same password|different from the old/i, 'La nueva contraseña debe ser distinta de la anterior.'],
  [/invalid email|unable to validate email/i, 'Ese correo no es válido.'],
  [/failed to fetch|network/i, 'Sin conexión. Revisa tu internet e inténtalo de nuevo.']
];
const VISUAL_PHOTOS = ['santorini', 'lake', 'balloons', 'road', 'machuPicchu'];
const VISUAL_INTERVAL_MS = 7000;
const GOOGLE_ICON = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>';

// Si ya entraste alguna vez en este dispositivo se muestra primero "Inicia sesión"
let isSignUp = localStorage.getItem(HAS_ACCOUNT_KEY) !== '1';
let visualTimer = 0;
let visualIndex = 0;

/* ---- Plantillas ---- */

function fieldHtml({ id, name, type = 'text', label, iconName, autocomplete, attrs = '' }) {
  return `
    <label class="auth-field" for="${id}">
      <span class="auth-field__icon">${icon(iconName, 16)}</span>
      <span class="visually-hidden">${esc(label)}</span>
      <input class="auth-field__input" id="${id}" name="${name}" type="${type}" placeholder="${esc(label)}" autocomplete="${autocomplete}" required ${attrs}>
    </label>`;
}

function formFieldsHtml() {
  if (store.mode === 'local') {
    return fieldHtml({ id: 'loginName', name: 'name', label: 'Tu nombre', iconName: 'user', autocomplete: 'name', attrs: 'maxlength="40"' });
  }
  const fields = [];
  if (isSignUp) fields.push(fieldHtml({ id: 'loginName', name: 'name', label: 'Tu nombre', iconName: 'user', autocomplete: 'name', attrs: 'maxlength="40"' }));
  fields.push(fieldHtml({ id: 'loginEmail', name: 'email', type: 'email', label: 'Correo electrónico', iconName: 'mail', autocomplete: 'email' }));
  fields.push(fieldHtml({
    id: 'loginPassword', name: 'password', type: 'password', label: 'Contraseña', iconName: 'lock',
    autocomplete: isSignUp ? 'new-password' : 'current-password', attrs: 'minlength="6"'
  }));
  if (isSignUp) {
    fields.push(fieldHtml({ id: 'loginConfirm', name: 'confirm', type: 'password', label: 'Confirmar contraseña', iconName: 'lock', autocomplete: 'new-password', attrs: 'minlength="6"' }));
  } else {
    fields.push('<button class="auth-panel__link auth-panel__link--end" type="button" data-action="forgot-password">¿Olvidaste tu contraseña?</button>');
  }
  return fields.join('');
}

function visualHtml() {
  const slides = VISUAL_PHOTOS.map((key, position) => {
    const photo = photoSources(key);
    return `
      <picture class="auth-visual__slide ${position === 0 ? 'auth-visual__slide--active' : ''}" data-credit="${esc(photo.credit)}">
        <source media="(min-width: 900px)" srcset="${esc(photo.large)}">
        <img src="${esc(photo.small)}" alt="" width="960" height="1280" ${position === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
      </picture>`;
  }).join('');
  const first = photoSources(VISUAL_PHOTOS[0]);
  return `
    <div class="auth-visual" style="--glow:url('${esc(first.small)}')">
      <div class="auth-visual__glow" aria-hidden="true"></div>
      <figure class="auth-visual__card">
        ${slides}
        <figcaption class="auth-visual__brand">
          <span class="auth-visual__logo">
            <img src="assets/img/logo.png" alt="" width="30" height="30">
            FoxTrips <span class="auth-visual__badge">Viajes</span>
          </span>
          <span class="auth-visual__tagline">Planead, votad y guardad cada recuerdo con tu gente.</span>
          <span class="auth-visual__credit" id="authCredit">Foto: ${esc(first.credit)}</span>
        </figcaption>
      </figure>
    </div>`;
}

function panelHtml() {
  const isLocal = store.mode === 'local';
  let title = isSignUp ? 'Crea tu cuenta' : 'Inicia sesión';
  let lead = isSignUp ? 'Empieza a planear tu próximo viaje en grupo.' : 'Qué bien verte de nuevo.';
  if (isLocal) {
    title = 'Empieza a viajar';
    lead = 'Dinos tu nombre para que el grupo sepa quién añade cada plan.';
  }
  const primaryText = isLocal ? 'Continuar' : isSignUp ? 'Continuar con correo' : 'Entrar con correo';
  const switchHtml = isLocal ? '' : `
    <p class="auth-panel__switch">
      ${isSignUp ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}
      <button class="auth-panel__link auth-panel__link--accent" type="button" data-action="auth-mode" data-mode="${isSignUp ? 'signin' : 'signup'}">${isSignUp ? 'Inicia sesión' : 'Crea una'}</button>
    </p>`;
  return `
    <section class="auth-panel" aria-labelledby="authTitle">
      <h1 class="auth-panel__title" id="authTitle">${title}</h1>
      <p class="auth-panel__lead">${lead}</p>
      <form class="auth-panel__form" data-form="login" novalidate>
        ${formFieldsHtml()}
        <p class="auth-panel__error" id="authError" role="alert" hidden></p>
        <button class="auth-btn auth-btn--primary" type="submit">${primaryText}</button>
      </form>
      ${isLocal ? '' : `
        <div class="auth-panel__divider"><span>o</span></div>
        <button class="auth-btn auth-btn--outline" type="button" data-action="google-login">${GOOGLE_ICON} Continuar con Google</button>`}
      ${switchHtml}
      ${isLocal ? '<p class="auth-panel__note">Modo local: los datos se guardan solo en este navegador. Para compartir viajes con tu grupo, configura Supabase (README.md).</p>' : ''}
      <a class="auth-panel__back" href="#/bienvenida">${icon('back', 14)} Ver la bienvenida</a>
    </section>`;
}

export function rememberInvite(code) {
  sessionStorage.setItem(PENDING_INVITE_KEY, code);
}

export function takePendingInvite() {
  const code = sessionStorage.getItem(PENDING_INVITE_KEY);
  sessionStorage.removeItem(PENDING_INVITE_KEY);
  return code;
}

/* ---- Imagen animada ---- */

function showVisual(position) {
  const slides = document.querySelectorAll('.auth-visual__slide');
  if (!slides.length) return;
  visualIndex = (position + slides.length) % slides.length;
  slides.forEach((slide, current) => slide.classList.toggle('auth-visual__slide--active', current === visualIndex));
  const active = slides[visualIndex];
  const image = active.querySelector('img');
  const visual = document.querySelector('.auth-visual');
  if (visual && image) visual.style.setProperty('--glow', `url('${image.currentSrc || image.src}')`);
  const credit = document.getElementById('authCredit');
  if (credit) credit.textContent = `Foto: ${active.dataset.credit}`;
}

function visualTick() {
  if (!document.hidden) showVisual(visualIndex + 1);
}

function authErrorMessage(error) {
  const text = error?.message || String(error || '');
  const match = AUTH_ERRORS.find(([pattern]) => pattern.test(text));
  return match ? match[1] : text || 'No se pudo completar. Inténtalo de nuevo.';
}

function showError(message) {
  const box = document.getElementById('authError');
  if (!box) return;
  box.textContent = message;
  box.hidden = !message;
}

/* ---- Handlers ---- */

async function authModeHandler(button, event, ctx) {
  isSignUp = button.dataset.mode === 'signup';
  await ctx.refresh();
  document.querySelector('.auth-panel__form input')?.focus();
}

async function forgotPasswordHandler(button) {
  const emailInput = document.getElementById('loginEmail');
  const email = emailInput?.value.trim();
  if (!email) {
    showError('Escribe tu correo y vuelve a pulsar «¿Olvidaste tu contraseña?».');
    emailInput?.focus();
    return;
  }
  try {
    await withBusy(button, () => store.resetPassword(email));
    toast('Te enviamos un correo para cambiar la contraseña.');
  } catch (error) {
    toastError(error);
  }
}

async function googleLoginHandler(button) {
  try {
    await withBusy(button, () => store.signInWithGoogle());
  } catch (error) {
    toastError(error);
  }
}

async function loginHandler(form, ctx, submitter) {
  const data = formToObject(form);
  showError('');
  const invalid = [...form.elements].find((element) => element.willValidate && !element.checkValidity());
  if (invalid) {
    showError(invalid.type === 'email' ? 'Escribe un correo válido.' : invalid.name === 'password' || invalid.name === 'confirm'
      ? 'La contraseña necesita al menos 6 caracteres.' : 'Completa todos los campos.');
    invalid.focus();
    return;
  }
  if (store.mode !== 'local' && isSignUp && data.password !== data.confirm) {
    showError('Las contraseñas no coinciden.');
    form.elements.confirm.focus();
    return;
  }
  await withBusy(submitter, async () => {
    try {
      if (store.mode === 'local') await store.signIn({ name: data.name });
      else if (isSignUp) {
        const result = await store.signUp(data);
        if (result?.isPendingConfirmation) {
          toast('Te enviamos un correo para confirmar la cuenta.');
          return;
        }
      } else await store.signIn(data);
    } catch (error) {
      showError(authErrorMessage(error));
      return;
    }
    if (store.mode !== 'local') localStorage.setItem(HAS_ACCOUNT_KEY, '1');
    const invite = takePendingInvite();
    location.hash = invite ? `#/unirse/${invite}` : '#/';
    ctx.reloadApp();
  });
}

async function newPasswordHandler(form, ctx, submitter) {
  const data = formToObject(form);
  showError('');
  if ((data.password || '').length < 6) {
    showError('La contraseña necesita al menos 6 caracteres.');
    form.elements.password.focus();
    return;
  }
  if (data.password !== data.confirm) {
    showError('Las contraseñas no coinciden.');
    form.elements.confirm.focus();
    return;
  }
  await withBusy(submitter, async () => {
    try {
      await store.updatePassword(data.password);
    } catch (error) {
      showError(authErrorMessage(error));
      return;
    }
    toast('Contraseña actualizada. ¡Ya estás dentro!');
    location.hash = '#/';
    ctx.reloadApp();
  });
}

async function saveProfileHandler(form, ctx, submitter) {
  const { name } = formToObject(form);
  await withBusy(submitter, () => store.updateName(name));
  toast('Nombre actualizado');
  ctx.reloadApp();
}

/* Foto de perfil: se sube, se guarda en el perfil y despues se borran las anteriores de Cloudinary */
async function avatarFileHandler(input, ctx) {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const labelText = document.querySelector('[data-avatar-label] span');
  if (labelText) labelText.textContent = ' Subiendo…';
  try {
    const { url, publicId } = await uploadAvatar(store.user.id, file);
    await store.updateAvatar(url);
    cleanupAvatars(publicId).catch(() => null);
    toast('Foto de perfil actualizada');
  } catch (error) {
    toastError(new Error(/avatar_url/.test(error.message)
      ? 'La base de datos aún no tiene el campo de foto de perfil: hay que ejecutar el SQL actualizado en Supabase.'
      : error.message));
  }
  ctx.reloadApp();
}

async function removeAvatarHandler(button, event, ctx) {
  const isConfirmed = await confirmDialog('Se quitará tu foto de perfil y volverán a verse tus iniciales.');
  if (!isConfirmed) return;
  await withBusy(button, () => store.updateAvatar(null));
  cleanupAvatars().catch(() => null);
  toast('Foto de perfil quitada');
  ctx.reloadApp();
}

async function signOutHandler(button, event, ctx) {
  await store.signOut();
  location.hash = '#/acceso';
  ctx.reloadApp();
}

/* ---- Vistas ---- */

export const loginView = {
  async render() {
    return `
      <div class="auth-screen">
        <div class="auth-screen__grid">
          ${visualHtml()}
          ${panelHtml()}
        </div>
      </div>`;
  },
  mount() {
    clearInterval(visualTimer);
    visualIndex = 0;
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isReducedMotion) visualTimer = setInterval(visualTick, VISUAL_INTERVAL_MS);
  },
  unmount() {
    clearInterval(visualTimer);
  },
  actions: {
    'auth-mode': authModeHandler,
    'forgot-password': forgotPasswordHandler,
    'google-login': googleLoginHandler
  },
  forms: { login: loginHandler }
};

/* Pantalla que aparece al volver del correo de "¿Olvidaste tu contraseña?" */
export const recoveryView = {
  async render() {
    return `
      <div class="auth-screen">
        <div class="auth-screen__grid">
          ${visualHtml()}
          <section class="auth-panel" aria-labelledby="authTitle">
            <h1 class="auth-panel__title" id="authTitle">Nueva contraseña</h1>
            <p class="auth-panel__lead">Escribe la contraseña que usarás a partir de ahora.</p>
            <form class="auth-panel__form" data-form="new-password" novalidate>
              ${fieldHtml({ id: 'newPassword', name: 'password', type: 'password', label: 'Nueva contraseña', iconName: 'lock', autocomplete: 'new-password', attrs: 'minlength="6"' })}
              ${fieldHtml({ id: 'newConfirm', name: 'confirm', type: 'password', label: 'Repite la contraseña', iconName: 'lock', autocomplete: 'new-password', attrs: 'minlength="6"' })}
              <p class="auth-panel__error" id="authError" role="alert" hidden></p>
              <button class="auth-btn auth-btn--primary" type="submit">Guardar contraseña</button>
            </form>
          </section>
        </div>
      </div>`;
  },
  mount: loginView.mount,
  unmount: loginView.unmount,
  forms: { 'new-password': newPasswordHandler }
};

export const profileView = {
  async render() {
    const user = store.user;
    const storageText = {
      local: 'Este navegador (modo local)',
      supabase: 'Supabase Storage',
      cloudinary: 'Cloudinary'
    }[photoProvider];
    return `
      <div class="page-head">
        <div class="home-head">
          ${avatarHtml(user.name, 'avatar--lg', user.id)}
          <div>
            <h1>${esc(user.name)}</h1>
            ${user.email ? `<p class="page-head__subtitle">${esc(user.email)}</p>` : ''}
          </div>
        </div>
      </div>
      <div class="grid grid--2">
        <section class="card" aria-labelledby="avatarTitle">
          <h2 class="card__title" id="avatarTitle">Tu foto de perfil</h2>
          <p class="card__text">Así el grupo te reconoce en los viajes, los comentarios y el historial.</p>
          <div class="profile-photo">
            ${avatarHtml(user.name, 'avatar--xl', user.id)}
            <div class="profile-photo__actions">
              <input class="visually-hidden" id="avatarFile" type="file" accept="image/*" data-input="avatar-file">
              <label class="btn btn--primary" for="avatarFile" data-avatar-label>${icon('upload', 18)}<span> ${user.avatar_url ? 'Cambiar foto' : 'Subir foto'}</span></label>
              ${user.avatar_url ? `<button class="btn" type="button" data-action="remove-avatar">${icon('trash', 18)} Quitar foto</button>` : ''}
            </div>
          </div>
          <p class="form__help">Se recorta en cuadrado y se reduce antes de subirla.</p>
        </section>
        <section class="card">
          <h2 class="card__title">Tu nombre</h2>
          <form class="form" data-form="save-profile">
            <div class="form__field">
              <label class="form__label" for="profileName">Nombre visible para el grupo</label>
              <input class="form__input" id="profileName" name="name" required maxlength="40" value="${esc(user.name)}">
            </div>
            <div class="form__actions"><button class="btn btn--primary" type="submit">Guardar</button></div>
          </form>
        </section>
        <section class="card">
          <h2 class="card__title">Almacenamiento</h2>
          <ul class="rows">
            <li class="row"><span class="row__icon">${icon('users')}</span><div class="row__body"><p class="row__title">Datos</p><p class="row__meta">${store.mode === 'local' ? 'Este navegador (modo local)' : 'Supabase'}</p></div></li>
            <li class="row"><span class="row__icon">${icon('image')}</span><div class="row__body"><p class="row__title">Fotos</p><p class="row__meta">${storageText}</p></div></li>
          </ul>
          <button class="btn btn--block btn--top" type="button" data-action="sign-out">${icon('logout')} Cerrar sesión</button>
        </section>
      </div>`;
  },
  actions: { 'sign-out': signOutHandler, 'remove-avatar': removeAvatarHandler },
  inputs: { 'avatar-file': avatarFileHandler },
  forms: { 'save-profile': saveProfileHandler }
};

export const joinView = {
  async render(ctx) {
    try {
      const tripId = await store.joinTrip(ctx.params.code);
      toast('¡Te has unido al viaje!');
      location.replace(`#/viaje/${tripId}`);
      return '<p class="loading">Entrando al viaje…</p>';
    } catch (error) {
      return `
        <div class="empty">
          <h1 class="empty__title">No pudimos unirte al viaje</h1>
          <p class="empty__text">${esc(error.message)}</p>
          <a class="btn btn--primary" href="#/">Ir a mis viajes</a>
        </div>`;
    }
  }
};
