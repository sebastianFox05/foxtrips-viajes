/* Historial de cambios del viaje: quien hizo que y cuando. */
import { store } from '../../lib/store/index.js';
import { formatDateTime, timeAgo } from '../../lib/utils.js';
import { Avatar } from '../../components/Avatar.jsx';
import useLoad from '../../hooks/useLoad.js';
import { useTrip } from './TripContext.jsx';
import { t, tn } from '../../lib/i18n/index.js';

const MAX_ITEMS = 150;

/*
 * Cada cambio se guarda escrito en el idioma de quien lo hizo. Los dos que escribe la base de datos
 * (siempre en español) se traducen aqui al mostrarlos.
 */
function logText(text) {
  if (text === 'se unió al viaje') return t('se unió al viaje');
  const created = /^creó el viaje "(.*)"$/.exec(text || '');
  return created ? t('creó el viaje "{name}"', { name: created[1] }) : text;
}

export default function HistoryView() {
  const { tripId, refreshKey } = useTrip();
  const { data } = useLoad(async () => (await store.list('activity_log', tripId))
    .sort((first, second) => second.created_at.localeCompare(first.created_at))
    .slice(0, MAX_ITEMS), [tripId, refreshKey]);
  if (!data) return null;
  return (
    <>
      <div className="section__head"><h2>{t('Historial')}</h2><span className="section__hint">{tn(data.length, 'Último cambio', 'Últimos {n} cambios')}</span></div>
      <section className="card">
        {data.length ? (
          <ol className="timeline">
            {data.map((entry) => (
              <li className="timeline__item" key={entry.id}>
                <Avatar name={entry.actor_name} userId={entry.actor_id} />
                <div className="timeline__body">
                  <p><strong>{entry.actor_name || t('Alguien')}</strong> {logText(entry.text)}</p>
                  <time className="timeline__time" dateTime={entry.created_at} title={formatDateTime(entry.created_at)}>{timeAgo(entry.created_at)}</time>
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="card__text">{t('Todavía no hay cambios.')}</p>}
      </section>
    </>
  );
}
