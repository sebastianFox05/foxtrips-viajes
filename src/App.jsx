/*
 * App: cabecera, banner, contenido segun la ruta, barra inferior y pie.
 * Rutas (por hash, iguales que antes): #/  #/planes  #/perfil  #/unirse/:code  #/publico/:token
 * #/viaje/:id/:seccion  #/acceso  #/bienvenida. Sin sesion: bienvenida (una vez) y acceso.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { store } from './lib/store/index.js';
import Icon from './components/Icon.jsx';
import { Avatar } from './components/Avatar.jsx';
import { useSession } from './session/SessionContext.jsx';
import { useUi } from './ui/UiContext.jsx';
import { useLightbox } from './ui/LightboxContext.jsx';
import { SECTIONS, MOBILE_KEYS, SECTION_KEYS } from './views/trip/sections.js';
import TripLayout, { MoreView } from './views/trip/TripLayout.jsx';
import { useTripActions } from './views/trips/TripForm.jsx';
import TripsView from './views/trips/TripsView.jsx';
import { rememberInvite } from './views/auth/invite.js';
import { hasSeenWelcome } from './views/welcome/welcomeState.js';
import * as views from './views/index.js';

const TRIP_VIEWS = {
  resumen: views.SummaryView,
  itinerario: views.ItineraryView,
  mapa: views.MapView,
  album: views.AlbumView,
  recomendaciones: views.RecommendationsView,
  frases: views.PhrasesView,
  propuestas: views.ProposalsView,
  diario: views.DiaryView,
  equipaje: views.PackingView,
  documentos: views.DocumentsView,
  miembros: views.MembersView,
  historial: views.HistoryView,
  mas: MoreView
};

/* Equivale a resolveRoute() de la version anterior */
function resolveRoute(pathname, user) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'publico' && parts[1]) return { name: 'public', params: { token: parts[1] }, isPublic: true };
  if (!user) {
    // Las invitaciones van directas al acceso para no hacer esperar a quien te invitan
    if (parts[0] === 'unirse' && parts[1]) return { name: 'login', params: { inviteCode: parts[1] }, isPublic: true };
    const isWelcome = parts[0] === 'bienvenida' || (parts[0] !== 'acceso' && !hasSeenWelcome());
    if (isWelcome) return { name: 'welcome', params: {}, isPublic: true };
    return { name: 'login', params: {}, isPublic: true };
  }
  if (parts[0] === 'acceso' || parts[0] === 'bienvenida') return { name: 'home', params: {} };
  // Volviendo del correo de recuperacion: primero se pide la contraseña nueva
  if (store.isRecovery) return { name: 'login', params: { isRecovery: true } };
  if (parts[0] === 'unirse' && parts[1]) return { name: 'join', params: { code: parts[1] } };
  if (parts[0] === 'perfil') return { name: 'perfil', params: {} };
  if (parts[0] === 'planes') return { name: 'planes', params: {} };
  if (parts[0] === 'viaje' && parts[1]) {
    const section = SECTION_KEYS.includes(parts[2]) ? parts[2] : 'resumen';
    return { name: 'trip', params: { id: parts[1], section } };
  }
  return { name: 'home', params: {} };
}

function Header({ user, routeName }) {
  const activeRoute = routeName === 'trip' ? 'home' : routeName;
  const links = [
    { key: 'home', href: '#/', short: 'Viajes', long: 'Mis viajes' },
    { key: 'planes', href: '#/planes', short: 'Planes', long: 'Planes recomendados' }
  ];
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="site-header__brand" href="#/" aria-label="FoxTrips, ir a mis viajes">
          <img className="site-header__logo" src="/assets/img/logo.png" alt="" width="32" height="32" />
          <span className="site-header__brand-text">FoxTrips</span>
        </a>
        <nav className="site-header__nav" id="siteNav" aria-label="Principal" hidden={!user}>
          {links.map((link) => (
            <a key={link.key} className={`site-header__link${link.key === activeRoute ? ' site-header__link--active' : ''}`} href={link.href} data-route={link.key} aria-current={link.key === activeRoute ? 'page' : undefined}>
              <span className="site-header__label site-header__label--short">{link.short}</span>
              <span className="site-header__label site-header__label--long">{link.long}</span>
            </a>
          ))}
        </nav>
        <div className="site-header__user" id="userArea">
          {user ? (
            <>
              <span className="site-header__name">{user.name}</span>
              <a href="#/perfil" aria-label="Tu perfil"><Avatar name={user.name} userId={user.id} /></a>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function TripBottomNav({ tripId, sectionKey }) {
  const isMore = !MOBILE_KEYS.includes(sectionKey);
  const links = MOBILE_KEYS.map((key) => SECTIONS.find((section) => section.key === key));
  return (
    <ul className="bottom-nav__list">
      {links.map((section) => (
        <li key={section.key}>
          <a className={`bottom-nav__link ${section.key === sectionKey ? 'bottom-nav__link--active' : ''}`} href={`#/viaje/${tripId}/${section.key}`} aria-current={section.key === sectionKey ? 'page' : undefined}>
            <Icon name={section.icon} size={22} /><span>{section.label}</span>
          </a>
        </li>
      ))}
      <li>
        <a className={`bottom-nav__link ${isMore ? 'bottom-nav__link--active' : ''}`} href={`#/viaje/${tripId}/mas`} aria-current={isMore ? 'page' : undefined}>
          <Icon name="grid" size={22} /><span>Más</span>
        </a>
      </li>
    </ul>
  );
}

function HomeBottomNav({ routeKey }) {
  const { openNewTrip } = useTripActions();
  return (
    <ul className="bottom-nav__list">
      <li><a className={`bottom-nav__link ${routeKey === 'home' ? 'bottom-nav__link--active' : ''}`} href="#/"><Icon name="home" size={22} /><span>Viajes</span></a></li>
      <li><button className="bottom-nav__link" type="button" onClick={openNewTrip}><Icon name="plus" size={22} /><span>Nuevo</span></button></li>
      <li><a className={`bottom-nav__link ${routeKey === 'planes' ? 'bottom-nav__link--active' : ''}`} href="#/planes"><Icon name="star" size={22} /><span>Planes</span></a></li>
      <li><a className={`bottom-nav__link ${routeKey === 'perfil' ? 'bottom-nav__link--active' : ''}`} href="#/perfil"><Icon name="user" size={22} /><span>Perfil</span></a></li>
    </ul>
  );
}

function Content({ route }) {
  switch (route.name) {
    case 'public': return <views.PublicView token={route.params.token} />;
    case 'welcome': return <views.WelcomeView />;
    case 'login': return route.params.isRecovery ? <views.RecoveryView /> : <views.LoginView />;
    case 'join': return <views.JoinView code={route.params.code} />;
    case 'perfil': return <views.ProfileView />;
    case 'planes': return <views.RecommendationsView isStandalone />;
    case 'trip': return <TripLayout key={route.params.id} tripId={route.params.id} sectionKey={route.params.section} views={TRIP_VIEWS} />;
    default: return <TripsView />;
  }
}

export default function App() {
  const location = useLocation();
  const { isReady, user } = useSession();
  const { closeModal } = useUi();
  const { closeLightbox } = useLightbox();
  const mainRef = useRef(null);
  const isFirstRenderRef = useRef(true);
  const route = resolveRoute(location.pathname, user);

  // Enlace de invitacion sin sesion: se recuerda para despues de entrar
  if (route.name === 'login' && route.params.inviteCode) rememberInvite(route.params.inviteCode);

  // Cambiar de ruta cierra el modal y el visor, sube al principio y lleva el foco al contenido
  useEffect(() => {
    closeModal();
    closeLightbox();
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname, location.search, closeModal, closeLightbox]);

  const isAuthScreen = route.name === 'login' || route.name === 'welcome';
  const hasHomeNav = ['home', 'perfil', 'planes'].includes(route.name);
  const hasBottomNav = Boolean(user) && (route.name === 'trip' || hasHomeNav);

  // Clases del body que usa el CSS (barra inferior, viaje, pantallas de acceso)
  useEffect(() => {
    const { classList } = document.body;
    classList.toggle('has-bottom-nav', hasBottomNav);
    classList.toggle('is-trip', route.name === 'trip' || route.name === 'public');
    classList.toggle('is-auth', isAuthScreen);
    if (route.name !== 'trip') document.title = 'FoxTrips · Viajes en grupo';
  }, [hasBottomNav, route.name, isAuthScreen]);

  function skipLinkHandler(event) {
    event.preventDefault();
    mainRef.current?.focus();
  }

  const isBannerHidden = store.mode !== 'local' || route.name === 'public' || isAuthScreen;
  return (
    <>
      <a className="skip-link" href="#app" onClick={skipLinkHandler}>Saltar al contenido</a>
      <Header user={user} routeName={route.name} />
      <p className="banner" id="modeBanner" hidden={isBannerHidden}>Modo local · los datos solo se guardan en este navegador.</p>
      <main className="main" id="app" tabIndex={-1} ref={mainRef}>
        {isReady ? <Content route={route} /> : <p className="loading">Cargando…</p>}
      </main>
      <nav className="bottom-nav" id="bottomNav" aria-label="Navegación inferior" hidden={!hasBottomNav}>
        {hasBottomNav && route.name === 'trip' ? <TripBottomNav tripId={route.params.id} sectionKey={route.params.section} /> : null}
        {hasBottomNav && hasHomeNav ? <HomeBottomNav routeKey={route.name} /> : null}
      </nav>
      <footer className="site-footer">
        <p className="site-footer__text">FoxTrips · Hecho para viajar en grupo. Mapas © colaboradores de OpenStreetMap.</p>
      </footer>
    </>
  );
}
