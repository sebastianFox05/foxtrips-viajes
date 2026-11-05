/* Estructura comun de un viaje: cabecera con foto, pestañas de escritorio y la pestaña activa. */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import Picture from '../../components/Picture.jsx';
import { AvatarStack } from '../../components/Avatar.jsx';
import { daysBetween, formatRange, tripStatus } from '../../lib/utils.js';
import { useTripActions } from '../trips/TripForm.jsx';
import { SECTIONS, MOBILE_KEYS } from './sections.js';
import { TripProvider, useTrip } from './TripContext.jsx';

export const PRINT_FLAG = 'foxtrips:print';

function Hero({ sectionKey }) {
  const navigate = useNavigate();
  const { trip, members, canEdit, reloadTrip } = useTrip();
  const { openEditTrip } = useTripActions();
  const isTall = sectionKey === 'resumen';
  const status = tripStatus(trip);
  const days = trip.start_date && trip.end_date ? daysBetween(trip.start_date, trip.end_date) + 1 : 0;
  const section = SECTIONS.find((item) => item.key === sectionKey);

  function printHandler() {
    if (sectionKey !== 'itinerario') {
      sessionStorage.setItem(PRINT_FLAG, '1');
      navigate(`/viaje/${trip.id}/itinerario`);
      return;
    }
    window.print();
  }

  return (
    <header className={`hero ${isTall ? 'hero--tall' : ''}`}>
      {trip.cover_url ? <Picture url={trip.cover_url} className="hero__media" isLazy={false} width={1600} height={900} /> : null}
      <div className="hero__bar">
        <a className="hero__btn" href="#/" aria-label="Volver a mis viajes"><Icon name="back" /></a>
        <div className="hero__bar-actions">
          {canEdit ? <button className="hero__btn" type="button" aria-label="Editar viaje" onClick={() => openEditTrip(trip, reloadTrip)}><Icon name="edit" /></button> : null}
          <button className="hero__btn" type="button" aria-label="Exportar itinerario a PDF" onClick={printHandler}><Icon name="print" /></button>
        </div>
      </div>
      <div className="hero__content">
        <p className="hero__kicker">{isTall ? formatRange(trip.start_date, trip.end_date) : section?.label || ''}</p>
        <h1 className={`hero__title ${isTall ? '' : 'hero__title--compact'}`}>{trip.name}</h1>
        {trip.destination ? <p className="hero__place"><Icon name="pin" size={16} /> {trip.destination}</p> : null}
        {isTall ? (
          <div className="glass">
            <div className="glass__top">
              <h2 className="glass__title">{trip.destination || trip.name}</h2>
              <span className="badge badge--accent"><Icon name="star" size={14} /> {status.label}</span>
            </div>
            <p className="glass__meta">
              <span><Icon name="calendar" size={16} /> {formatRange(trip.start_date, trip.end_date)}</span>
              {days ? <span><Icon name="clock" size={16} /> {days} días</span> : null}
              <span><AvatarStack people={members} max={4} /> {members.length} viajero{members.length === 1 ? '' : 's'}</span>
            </p>
            {trip.description ? <p className="glass__text">{trip.description}</p> : null}
            <div className="glass__actions">
              <a className="btn btn--white" href={`#/viaje/${trip.id}/mapa`}>Ver en el mapa</a>
              <a className="btn btn--white btn--icon" href={`#/viaje/${trip.id}/itinerario`} aria-label="Ver itinerario"><Icon name="calendar" /></a>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function Tabs({ sectionKey }) {
  const { trip } = useTrip();
  return (
    <nav className="tabs" aria-label="Secciones del viaje">
      <ul className="tabs__list">
        {SECTIONS.map((section) => (
          <li key={section.key}>
            <a className={`tabs__link ${section.key === sectionKey ? 'tabs__link--active' : ''}`} href={`#/viaje/${trip.id}/${section.key}`} aria-current={section.key === sectionKey ? 'page' : undefined}>
              <Icon name={section.icon} size={18} /> {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* Menu "Mas" (solo movil) */
export function MoreView() {
  const { trip } = useTrip();
  return (
    <>
      <h2 className="visually-hidden">Más secciones</h2>
      <ul className="menu-grid">
        {SECTIONS.filter((section) => !MOBILE_KEYS.includes(section.key)).map((section) => (
          <li key={section.key}>
            <a className="menu-grid__link" href={`#/viaje/${trip.id}/${section.key}`}>
              <span className="menu-grid__icon"><Icon name={section.icon} /></span>
              {section.label}
              <span className="menu-grid__hint">{section.hint}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

function TripPage({ sectionKey, views }) {
  const { trip, error, isLoading } = useTrip();
  const View = views[sectionKey] || views.resumen;

  useEffect(() => {
    if (!trip) return;
    const section = SECTIONS.find((item) => item.key === sectionKey);
    document.title = [section?.label, trip.name, 'FoxTrips'].filter(Boolean).join(' · ');
  }, [trip?.name, sectionKey]);

  if (error) {
    return (
      <div className="empty">
        <h1 className="empty__title">No se pudo cargar</h1>
        <p className="empty__text">{error.message || String(error)}</p>
        <a className="btn btn--primary" href="#/">Volver al inicio</a>
      </div>
    );
  }
  if (isLoading || !trip) return <p className="loading">Cargando…</p>;
  return (
    <>
      <Hero sectionKey={sectionKey} />
      <Tabs sectionKey={sectionKey} />
      <section id="tabPanel" aria-live="off">
        <View key={sectionKey} />
      </section>
    </>
  );
}

export default function TripLayout({ tripId, sectionKey, views }) {
  return (
    <TripProvider tripId={tripId}>
      <TripPage sectionKey={sectionKey} views={views} />
    </TripProvider>
  );
}
