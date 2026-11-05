/* Historial de cambios del viaje: quien hizo que y cuando. */
import { store } from '../../lib/store/index.js';
import { formatDateTime, timeAgo } from '../../lib/utils.js';
import { Avatar } from '../../components/Avatar.jsx';
import useLoad from '../../hooks/useLoad.js';
import { useTrip } from './TripContext.jsx';

const MAX_ITEMS = 150;

export default function HistoryView() {
  const { tripId, refreshKey } = useTrip();
  const { data } = useLoad(async () => (await store.list('activity_log', tripId))
    .sort((first, second) => second.created_at.localeCompare(first.created_at))
    .slice(0, MAX_ITEMS), [tripId, refreshKey]);
  if (!data) return null;
  return (
    <>
      <div className="section__head"><h2>Historial</h2><span className="section__hint">Últimos {data.length} cambios</span></div>
      <section className="card">
        {data.length ? (
          <ol className="timeline">
            {data.map((entry) => (
              <li className="timeline__item" key={entry.id}>
                <Avatar name={entry.actor_name} userId={entry.actor_id} />
                <div className="timeline__body">
                  <p><strong>{entry.actor_name || 'Alguien'}</strong> {entry.text}</p>
                  <time className="timeline__time" dateTime={entry.created_at} title={formatDateTime(entry.created_at)}>{timeAgo(entry.created_at)}</time>
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="card__text">Todavía no hay cambios.</p>}
      </section>
    </>
  );
}
