/* Pagina publica de solo lectura: itinerario y album, sin cuenta. */
import { store } from '../lib/store/index.js';
import { eachDay, formatDay, formatRange, sortActivities } from '../lib/utils.js';
import Icon from '../components/Icon.jsx';
import Picture from '../components/Picture.jsx';
import useLoad from '../hooks/useLoad.js';
import { useLightbox } from '../ui/LightboxContext.jsx';

export default function PublicView({ token }) {
  const { openLightbox } = useLightbox();
  const { data, isLoading } = useLoad(() => store.getPublicTrip(token).catch(() => null), [token]);
  if (isLoading && data === undefined) return null;
  if (!data?.trip) {
    return <div className="empty"><h1 className="empty__title">Este enlace ya no está disponible</h1><p className="empty__text">Puede que el organizador haya desactivado la página pública.</p></div>;
  }
  const { trip } = data;
  const activities = sortActivities(data.activities || []);
  const photos = data.photos || [];
  const days = eachDay(trip.start_date, trip.end_date);
  // Las actividades sin dia (o fuera de las fechas) se muestran al final como "Ideas sueltas"
  const loose = activities.filter((activity) => !activity.day || !days.includes(activity.day));
  const groups = days.map((day, index) => ({ day, index })).concat(loose.length ? [{ day: null, index: days.length }] : []);

  return (
    <>
      <header className="hero hero--tall">
        {trip.cover_url ? <Picture url={trip.cover_url} className="hero__media" isLazy={false} width={1600} height={900} /> : null}
        <div className="hero__content">
          <p className="hero__kicker">{formatRange(trip.start_date, trip.end_date)}</p>
          <h1 className="hero__title">{trip.name}</h1>
          {trip.destination ? <p className="hero__place"><Icon name="pin" size={16} /> {trip.destination}</p> : null}
          {trip.description ? <div className="glass"><p className="glass__text">{trip.description}</p></div> : null}
        </div>
      </header>
      <p className="public-note badge"><Icon name="eye" size={14} /> Página de solo lectura</p>
      <section className="section" aria-labelledby="publicPlan">
        <h2 id="publicPlan" className="card__title">Itinerario</h2>
        {groups.map(({ day, index }) => {
          const list = day ? activities.filter((activity) => activity.day === day) : loose;
          return (
            <section className="day" key={day || 'sin-dia'}>
              <header className="day__header"><div><span className="day__label">{day ? `Día ${index + 1}` : 'Sin día asignado'}</span><h3 className="day__date">{day ? formatDay(day) : 'Ideas sueltas'}</h3></div></header>
              {list.length ? (
                <ul className="day__list">
                  {list.map((activity) => (
                    <li key={activity.id}>
                      <article className="activity">
                        {activity.image_url ? <figure className="activity__media"><Picture url={activity.image_url} alt={`Foto de ${activity.title}`} width={800} height={500} /></figure> : null}
                        <div className="activity__body">
                          <span className="activity__time">{activity.time || '—'}</span>
                          <div className="activity__info">
                            <h4 className="activity__title">{activity.title}</h4>
                            {activity.place ? <p className="activity__place"><Icon name="pin" size={14} /> {activity.place}</p> : null}
                            {activity.notes ? <p className="activity__notes">{activity.notes}</p> : null}
                          </div>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              ) : <p className="day__empty">Día libre</p>}
            </section>
          );
        })}
      </section>
      {photos.length ? (
        <section className="section" aria-labelledby="publicAlbum">
          <h2 id="publicAlbum" className="card__title">Álbum</h2>
          <ul className="album">
            {photos.map((photo, index) => (
              <li key={photo.id || index} className={`album__item ${index % 5 === 0 || index % 5 === 3 ? 'album__item--tall' : ''}`}>
                <button className="album__button" type="button" aria-label={`Ver foto ${index + 1}`} onClick={() => openLightbox(photos, index, { hasComments: false })}>
                  <Picture url={photo.thumb_url || photo.url} alt={photo.caption || `Foto ${index + 1}`} width={480} height={480} />
                  {photo.caption ? <span className="album__caption">{photo.caption}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
