/*
 * Ficha de un plan del itinerario a pantalla completa (sustituye a la ventana "Historia"):
 * sus fotos (la del plan y las del album enlazadas a el), dia, hora y temperatura de ahora alli,
 * las notas y la historia del lugar de Wikipedia, y abajo "Ver en el mapa".
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../../lib/store/index.js';
import { placeHistory } from '../../lib/place-history.js';
import { currentTemperature } from '../../lib/services.js';
import { formatDay } from '../../lib/utils.js';
import { formatDegrees, formatTime, temperatureUnit } from '../../lib/locale.js';
import { t } from '../../lib/i18n/index.js';
import PlaceSheet from '../../components/PlaceSheet.jsx';

export default function ActivitySheet({ activity, tripId, reelDays, onClose }) {
  const navigate = useNavigate();
  const [extra, setExtra] = useState({ photos: [], history: null, temp: null, isLoadingHistory: false });

  useEffect(() => {
    if (!activity) return undefined;
    let isCurrent = true;
    setExtra({ photos: [], history: null, temp: null, isLoadingHistory: true });
    const update = (patch) => isCurrent && setExtra((current) => ({ ...current, ...patch }));
    store.list('photos', tripId).then((photos) => update({ photos: photos.filter((photo) => photo.activity_id === activity.id) })).catch(() => null);
    placeHistory(activity).then((history) => update({ history, isLoadingHistory: false })).catch(() => update({ isLoadingHistory: false }));
    if (activity.lat != null) currentTemperature(activity.lat, activity.lon).then((temp) => update({ temp })).catch(() => null);
    return () => {
      isCurrent = false;
    };
  }, [activity, tripId]);

  let place = null;
  if (activity) {
    const dayIndex = activity.day ? reelDays.indexOf(activity.day) : -1;
    const images = [...new Set([activity.image_url, ...extra.photos.map((photo) => photo.url)].filter(Boolean))];
    const { history } = extra;
    const historyText = history ? [history.intro, history.history].filter(Boolean).join('\n\n') : '';
    let description = [activity.notes, historyText].filter(Boolean).join('\n\n');
    if (!description) description = extra.isLoadingHistory ? t('Buscando la historia de este lugar…') : '';
    place = {
      title: activity.title,
      location: activity.place || '',
      images,
      stats: [
        { label: t('Día'), value: dayIndex >= 0 ? t('Día {n}', { n: dayIndex + 1 }) : t('Sin día') },
        { label: t('Hora'), value: activity.time ? formatTime(activity.time) : '—' },
        { label: t('Temperatura'), value: extra.temp == null ? '—' : `${formatDegrees(extra.temp)}°${temperatureUnit()}` }
      ],
      description,
      source: history?.url ? { url: history.url, label: t('Fuente: {title} (Wikipedia, CC BY-SA 4.0)', { title: history.title }) } : null,
      footLabel: activity.day ? formatDay(activity.day, { weekday: 'long' }) : t('Ideas sueltas'),
      footValue: activity.day ? formatDay(activity.day, { day: 'numeric', month: 'long' }) : '',
      action: activity.lat != null
        ? { label: t('Ver en el mapa'), icon: 'map', onClick: () => navigate(`/viaje/${tripId}/mapa?foco=${activity.id}`) }
        : null
    };
  }
  return <PlaceSheet place={place} onClose={onClose} />;
}
