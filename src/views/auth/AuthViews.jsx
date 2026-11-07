/*
 * Acceso y registro (pantalla oscura con imagen animada), contraseña nueva (al volver del correo),
 * perfil (foto y nombre) y union a un viaje por invitacion.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../../lib/store/index.js';
import { cleanupAvatars, photoProvider, uploadAvatar } from '../../lib/media.js';
import { formToObject } from '../../lib/utils.js';
import Icon from '../../components/Icon.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { useBusy, useUi } from '../../ui/UiContext.jsx';
import { useSession } from '../../session/SessionContext.jsx';
import AuthVisual from './AuthVisual.jsx';
import { takePendingInvite } from './invite.js';

const HAS_ACCOUNT_KEY = 'foxtrips:has-account';
const AUTH_ERRORS = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/already registered|already been registered|user already exists/i, 'Ya existe una cuenta con ese correo. Pulsa «Inicia sesión».'],
  [/password should be at least|weak password/i, 'La contraseña es demasiado débil: usa al menos 6 caracteres.'],
  [/email not confirmed/i, 'Confirma tu correo antes de entrar (revisa tu bandeja de entrada).'],
  [/rate limit|too many requests|security purposes/i, 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.'],
  [/same password|different from the old/i, 'La nueva contraseña debe ser distinta de la anterior.'],
  // La base de datos rechaza correos sin dominio completo (regla validate_user_email)
  [/invalid_email_domain|database error saving new user/i, 'Escribe un correo completo, por ejemplo nombre@gmail.com.'],
  [/invalid email|unable to validate email/i, 'Ese correo no es válido.'],
  [/failed to fetch|network/i, 'Sin conexión. Revisa tu internet e inténtalo de nuevo.']
];

// Si ya entraste alguna vez en este dispositivo se muestra primero "Inicia sesión"
let rememberedSignUp = localStorage.getItem(HAS_ACCOUNT_KEY) !== '1';

function authErrorMessage(error) {
  const text = error?.message || String(error || '');
  const match = AUTH_ERRORS.find(([pattern]) => pattern.test(text));
  return match ? match[1] : text || 'No se pudo completar. Inténtalo de nuevo.';
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function AuthField({ id, name, type = 'text', label, iconName, autoComplete, ...attrs }) {
  return (
    <label className="auth-field" htmlFor={id}>
      <span className="auth-field__icon"><Icon name={iconName} size={16} /></span>
      <span className="visually-hidden">{label}</span>
      <input className="auth-field__input" id={id} name={name} type={type} placeholder={label} autoComplete={autoComplete} required {...attrs} />
    </label>
  );
}

function AuthError({ message }) {
  return <p className="auth-panel__error" id="authError" role="alert" hidden={!message}>{message}</p>;
}

/*
 * Correo completo: usuario, @ y un dominio con punto y terminacion de 2 letras o mas
 * (gmail.com, empresa.co, uni.edu.co). El navegador por si solo acepta "nombre@gmail".
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;
const EMAIL_MESSAGE = 'Escribe un correo completo, por ejemplo nombre@gmail.com.';

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || '').trim());
}

/* Primer campo invalido del formulario y su mensaje (la validacion nativa esta desactivada con noValidate) */
function firstInvalid(form) {
  const invalid = [...form.elements].find((element) => element.willValidate
    && (!element.checkValidity() || (element.type === 'email' && !isValidEmail(element.value))));
  if (!invalid) return null;
  let message = 'Completa todos los campos.';
  if (invalid.type === 'email') message = invalid.value.trim() ? EMAIL_MESSAGE : 'Escribe tu correo electrónico.';
  else if (invalid.name === 'password' || invalid.name === 'confirm') message = 'La contraseña necesita al menos 6 caracteres.';
  return { element: invalid, message };
}

export function LoginView() {
  const navigate = useNavigate();
  const { refreshUser } = useSession();
  const { toast, toastError } = useUi();
  const [isSignUp, setIsSignUp] = useState(rememberedSignUp);
  const [error, setError] = useState('');
  const [isBusy, runBusy] = useBusy();
  const [isForgotBusy, runForgot] = useBusy();
  const [isGoogleBusy, runGoogle] = useBusy();
  const formRef = useRef(null);
  const isLocal = store.mode === 'local';
  const isFirstModeRef = useRef(true);

  useEffect(() => {
    rememberedSignUp = isSignUp;
    if (isFirstModeRef.current) {
      isFirstModeRef.current = false;
      return;
    }
    formRef.current?.querySelector('input')?.focus();
  }, [isSignUp]);

  async function forgotHandler() {
    const emailInput = document.getElementById('loginEmail');
    const email = emailInput?.value.trim();
    if (!email) {
      setError('Escribe tu correo y vuelve a pulsar «¿Olvidaste tu contraseña?».');
      emailInput?.focus();
      return;
    }
    if (!isValidEmail(email)) {
      setError(EMAIL_MESSAGE);
      emailInput?.focus();
      return;
    }
    try {
      await runForgot(() => store.resetPassword(email));
      toast('Te enviamos un correo para cambiar la contraseña.');
    } catch (forgotError) {
      toastError(forgotError);
    }
  }

  async function googleHandler() {
    try {
      await runGoogle(() => store.signInWithGoogle());
    } catch (googleError) {
      toastError(googleError);
    }
  }

  async function submitHandler(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formToObject(form);
    setError('');
    const invalid = firstInvalid(form);
    if (invalid) {
      setError(invalid.message);
      invalid.element.focus();
      return;
    }
    if (!isLocal && isSignUp && data.password !== data.confirm) {
      setError('Las contraseñas no coinciden.');
      form.elements.confirm.focus();
      return;
    }
    await runBusy(async () => {
      try {
        if (isLocal) await store.signIn({ name: data.name });
        else if (isSignUp) {
          const result = await store.signUp(data);
          if (result?.isPendingConfirmation) {
            toast('Te enviamos un correo para confirmar la cuenta.');
            return;
          }
        } else await store.signIn(data);
      } catch (loginError) {
        setError(authErrorMessage(loginError));
        return;
      }
      if (!isLocal) localStorage.setItem(HAS_ACCOUNT_KEY, '1');
      const invite = takePendingInvite();
      refreshUser();
      navigate(invite ? `/unirse/${invite}` : '/');
    });
  }

  let title = isSignUp ? 'Crea tu cuenta' : 'Inicia sesión';
  let lead = isSignUp ? 'Empieza a planear tu próximo viaje en grupo.' : 'Qué bien verte de nuevo.';
  if (isLocal) {
    title = 'Empieza a viajar';
    lead = 'Dinos tu nombre para que el grupo sepa quién añade cada plan.';
  }
  const primaryText = isLocal ? 'Continuar' : isSignUp ? 'Continuar con correo' : 'Entrar con correo';

  return (
    <div className="auth-screen">
      <div className="auth-screen__grid">
        <AuthVisual />
        <section className="auth-panel" aria-labelledby="authTitle">
          <h1 className="auth-panel__title" id="authTitle">{title}</h1>
          <p className="auth-panel__lead">{lead}</p>
          <form className="auth-panel__form" noValidate onSubmit={submitHandler} ref={formRef} key={isSignUp ? 'signup' : 'signin'}>
            {isLocal ? <AuthField id="loginName" name="name" label="Tu nombre" iconName="user" autoComplete="name" maxLength={40} /> : (
              <>
                {isSignUp ? <AuthField id="loginName" name="name" label="Tu nombre" iconName="user" autoComplete="name" maxLength={40} /> : null}
                <AuthField id="loginEmail" name="email" type="email" label="Correo electrónico" iconName="mail" autoComplete="email" />
                <AuthField id="loginPassword" name="password" type="password" label="Contraseña" iconName="lock" autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={6} />
                {isSignUp
                  ? <AuthField id="loginConfirm" name="confirm" type="password" label="Confirmar contraseña" iconName="lock" autoComplete="new-password" minLength={6} />
                  : <button className="auth-panel__link auth-panel__link--end" type="button" onClick={forgotHandler} disabled={isForgotBusy}>{isForgotBusy ? 'Guardando…' : '¿Olvidaste tu contraseña?'}</button>}
              </>
            )}
            <AuthError message={error} />
            <button className="auth-btn auth-btn--primary" type="submit" disabled={isBusy}>{isBusy ? 'Guardando…' : primaryText}</button>
          </form>
          {isLocal ? null : (
            <>
              <div className="auth-panel__divider"><span>o</span></div>
              <button className="auth-btn auth-btn--outline" type="button" onClick={googleHandler} disabled={isGoogleBusy}>{isGoogleBusy ? 'Guardando…' : <><GoogleIcon /> Continuar con Google</>}</button>
              <p className="auth-panel__switch">
                {isSignUp ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}{' '}
                <button className="auth-panel__link auth-panel__link--accent" type="button" onClick={() => { setError(''); setIsSignUp(!isSignUp); }}>{isSignUp ? 'Inicia sesión' : 'Crea una'}</button>
              </p>
            </>
          )}
          {isLocal ? <p className="auth-panel__note">Modo local: los datos se guardan solo en este navegador. Para compartir viajes con tu grupo, configura Supabase (README.md).</p> : null}
          <a className="auth-panel__back" href="#/bienvenida"><Icon name="back" size={14} /> Ver la bienvenida</a>
        </section>
      </div>
    </div>
  );
}

/* Pantalla que aparece al volver del correo de "¿Olvidaste tu contraseña?" */
export function RecoveryView() {
  const navigate = useNavigate();
  const { refreshUser } = useSession();
  const { toast } = useUi();
  const [error, setError] = useState('');
  const [isBusy, runBusy] = useBusy();

  async function submitHandler(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formToObject(form);
    setError('');
    if ((data.password || '').length < 6) {
      setError('La contraseña necesita al menos 6 caracteres.');
      form.elements.password.focus();
      return;
    }
    if (data.password !== data.confirm) {
      setError('Las contraseñas no coinciden.');
      form.elements.confirm.focus();
      return;
    }
    await runBusy(async () => {
      try {
        await store.updatePassword(data.password);
      } catch (updateError) {
        setError(authErrorMessage(updateError));
        return;
      }
      toast('Contraseña actualizada. ¡Ya estás dentro!');
      refreshUser();
      navigate('/');
    });
  }

  return (
    <div className="auth-screen">
      <div className="auth-screen__grid">
        <AuthVisual />
        <section className="auth-panel" aria-labelledby="authTitle">
          <h1 className="auth-panel__title" id="authTitle">Nueva contraseña</h1>
          <p className="auth-panel__lead">Escribe la contraseña que usarás a partir de ahora.</p>
          <form className="auth-panel__form" noValidate onSubmit={submitHandler}>
            <AuthField id="newPassword" name="password" type="password" label="Nueva contraseña" iconName="lock" autoComplete="new-password" minLength={6} />
            <AuthField id="newConfirm" name="confirm" type="password" label="Repite la contraseña" iconName="lock" autoComplete="new-password" minLength={6} />
            <AuthError message={error} />
            <button className="auth-btn auth-btn--primary" type="submit" disabled={isBusy}>{isBusy ? 'Guardando…' : 'Guardar contraseña'}</button>
          </form>
        </section>
      </div>
    </div>
  );
}

export function ProfileView() {
  const navigate = useNavigate();
  const { user, refreshUser } = useSession();
  const { toast, toastError, confirm } = useUi();
  const [isNameBusy, runName] = useBusy();
  const [isRemoveBusy, runRemove] = useBusy();
  const [isUploading, setIsUploading] = useState(false);
  const storageText = { local: 'Este navegador (modo local)', supabase: 'Supabase Storage', cloudinary: 'Cloudinary' }[photoProvider];

  async function saveNameHandler(event) {
    event.preventDefault();
    const { name } = formToObject(event.currentTarget);
    try {
      await runName(() => store.updateName(name));
      toast('Nombre actualizado');
      refreshUser();
    } catch (error) {
      toastError(error);
    }
  }

  /* Foto de perfil: se sube, se guarda en el perfil y despues se borran las anteriores de Cloudinary */
  async function avatarFileHandler(event) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setIsUploading(true);
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
    setIsUploading(false);
    refreshUser();
  }

  async function removeAvatarHandler() {
    const isConfirmed = await confirm('Se quitará tu foto de perfil y volverán a verse tus iniciales.');
    if (!isConfirmed) return;
    try {
      await runRemove(() => store.updateAvatar(null));
      cleanupAvatars().catch(() => null);
      toast('Foto de perfil quitada');
      refreshUser();
    } catch (error) {
      toastError(error);
    }
  }

  async function signOutHandler() {
    await store.signOut();
    refreshUser();
    navigate('/acceso');
  }

  return (
    <>
      <div className="page-head">
        <div className="home-head">
          <Avatar name={user.name} userId={user.id} extraClass="avatar--lg" />
          <div>
            <h1>{user.name}</h1>
            {user.email ? <p className="page-head__subtitle">{user.email}</p> : null}
          </div>
        </div>
      </div>
      <div className="grid grid--2">
        <section className="card" aria-labelledby="avatarTitle">
          <h2 className="card__title" id="avatarTitle">Tu foto de perfil</h2>
          <p className="card__text">Así el grupo te reconoce en los viajes, los comentarios y el historial.</p>
          <div className="profile-photo">
            <Avatar name={user.name} userId={user.id} extraClass="avatar--xl" />
            <div className="profile-photo__actions">
              <input className="visually-hidden" id="avatarFile" type="file" accept="image/*" onChange={avatarFileHandler} />
              <label className="btn btn--primary" htmlFor="avatarFile" data-avatar-label="">
                <Icon name="upload" size={18} /><span> {isUploading ? 'Subiendo…' : user.avatar_url ? 'Cambiar foto' : 'Subir foto'}</span>
              </label>
              {user.avatar_url ? (
                <button className="btn" type="button" onClick={removeAvatarHandler} disabled={isRemoveBusy}>
                  {isRemoveBusy ? 'Guardando…' : <><Icon name="trash" size={18} /> Quitar foto</>}
                </button>
              ) : null}
            </div>
          </div>
          <p className="form__help">Se recorta en cuadrado y se reduce antes de subirla.</p>
        </section>
        <section className="card">
          <h2 className="card__title">Tu nombre</h2>
          <form className="form" onSubmit={saveNameHandler}>
            <div className="form__field">
              <label className="form__label" htmlFor="profileName">Nombre visible para el grupo</label>
              <input className="form__input" id="profileName" name="name" required maxLength={40} defaultValue={user.name} key={user.name} />
            </div>
            <div className="form__actions"><button className="btn btn--primary" type="submit" disabled={isNameBusy}>{isNameBusy ? 'Guardando…' : 'Guardar'}</button></div>
          </form>
        </section>
        <section className="card">
          <h2 className="card__title">Almacenamiento</h2>
          <ul className="rows">
            <li className="row"><span className="row__icon"><Icon name="users" /></span><div className="row__body"><p className="row__title">Datos</p><p className="row__meta">{store.mode === 'local' ? 'Este navegador (modo local)' : 'Supabase'}</p></div></li>
            <li className="row"><span className="row__icon"><Icon name="image" /></span><div className="row__body"><p className="row__title">Fotos</p><p className="row__meta">{storageText}</p></div></li>
          </ul>
          <button className="btn btn--block btn--top" type="button" onClick={signOutHandler}><Icon name="logout" /> Cerrar sesión</button>
        </section>
      </div>
    </>
  );
}

export function JoinView({ code }) {
  const navigate = useNavigate();
  const { toast } = useUi();
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCurrent = true;
    store.joinTrip(code).then((tripId) => {
      if (!isCurrent) return;
      toast('¡Te has unido al viaje!');
      navigate(`/viaje/${tripId}`, { replace: true });
    }).catch((joinError) => {
      if (isCurrent) setError(joinError);
    });
    return () => {
      isCurrent = false;
    };
  }, [code, navigate, toast]);

  if (!error) return <p className="loading">Entrando al viaje…</p>;
  return (
    <div className="empty">
      <h1 className="empty__title">No pudimos unirte al viaje</h1>
      <p className="empty__text">{error.message}</p>
      <a className="btn btn--primary" href="#/">Ir a mis viajes</a>
    </div>
  );
}
