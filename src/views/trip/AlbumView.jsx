/* Album del viaje: subida multiple con compresion, filtros por dia y lightbox con comentarios. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { store } from '../../lib/store/index.js';
import { uploadPhoto, deletePhotoFile } from '../../lib/media.js';
import { eachDay, formatDay, formToObject } from '../../lib/utils.js';
import Icon from '../../components/Icon.jsx';
import Picture from '../../components/Picture.jsx';
import Scroller from '../../components/Scroller.jsx';
import useLoad from '../../hooks/useLoad.js';
import { useBusy, useUi } from '../../ui/UiContext.jsx';
import { useLightbox } from '../../ui/LightboxContext.jsx';
import { useTrip } from './TripContext.jsx';
import { t, tn } from '../../lib/i18n/index.js';

// El filtro se recuerda al volver al album
let rememberedFilter = 'all';

function PhotoForm({ photo, days, onSave, onDelete }) {
  const [isBusy, runBusy] = useBusy();
  const { toastError } = useUi();
  const isOutside = photo.day && !days.includes(photo.day);

  async function submitHandler(event) {
    event.preventDefault();
    const data = formToObject(event.currentTarget);
    try {
      await runBusy(() => onSave(data));
    } catch (error) {
      toastError(error);
    }
  }

  return (
    <form className="form" onSubmit={submitHandler}>
      <figure className="form__preview"><Picture url={photo.thumb_url || photo.url} alt="" width={220} height={220} /></figure>
      <div className="form__field">
        <label className="form__label" htmlFor="photoCaption">{t('Descripción')}</label>
        <input className="form__input" id="photoCaption" name="caption" maxLength={140} defaultValue={photo.caption || ''} placeholder={t('¿Qué se ve en la foto?')} />
      </div>
      <div className="form__field">
        <label className="form__label" htmlFor="photoDay">{t('Día')}</label>
        <select className="form__select" id="photoDay" name="day" defaultValue={photo.day || ''}>
          <option value="">{t('Sin día')}</option>
          {/* Si el dia quedo fuera de las fechas del viaje se conserva como opcion para no perderlo al guardar */}
          {isOutside ? <option value={photo.day}>{t('{day} (fuera del viaje)', { day: formatDay(photo.day, { day: 'numeric', month: 'short' }) })}</option> : null}
          {days.map((day, index) => <option key={day} value={day}>{t('Día {n}', { n: index + 1 })} · {formatDay(day, { day: 'numeric', month: 'short' })}</option>)}
        </select>
      </div>
      <p className="form__help">{t('Subida por {name}.', { name: photo.uploader_name || t('alguien del grupo') })}</p>
      <div className="form__actions">
        <button className="btn btn--ghost btn--danger" type="button" onClick={onDelete}>{t('Eliminar')}</button>
        <button className="btn btn--primary" type="submit" disabled={isBusy}>{isBusy ? t('Guardando…') : t('Guardar')}</button>
      </div>
    </form>
  );
}

export default function AlbumView() {
  const { trip, tripId, canEdit, refreshKey, refresh, setBusy } = useTrip();
  const { openModal, closeModal, confirm, toast, toastError } = useUi();
  const { openLightbox } = useLightbox();
  const days = useMemo(() => eachDay(trip.start_date, trip.end_date), [trip.start_date, trip.end_date]);
  const [filter, setFilter] = useState(() => (['all', 'places', ...days].includes(rememberedFilter) ? rememberedFilter : 'all'));
  const [upload, setUpload] = useState(null); // { total, done, status }
  const [isDragging, setIsDragging] = useState(false);
  const isUploadingRef = useRef(false);
  const { data } = useLoad(() => store.list('photos', tripId), [tripId, refreshKey]);
  rememberedFilter = filter;

  const photos = useMemo(() => (data || []).slice().sort((first, second) => (second.created_at || '').localeCompare(first.created_at || '')), [data]);
  const visible = useMemo(() => {
    if (filter === 'all') return photos;
    if (filter === 'places') return photos.filter((photo) => photo.activity_id);
    return photos.filter((photo) => photo.day === filter);
  }, [photos, filter]);

  // Mientras se sube, los refrescos de tiempo real esperan
  useEffect(() => () => setBusy(false), [setBusy]);

  if (!data) return null;

  async function uploadFiles(files) {
    const images = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!images.length || isUploadingRef.current) return;
    isUploadingRef.current = true;
    setBusy(true);
    const day = filter !== 'all' && filter !== 'places' ? filter : null;
    let failed = 0;
    for (const [position, file] of images.entries()) {
      setUpload({ total: images.length, done: position, status: t('Subiendo {n} de {total}…', { n: position + 1, total: images.length }) });
      try {
        const uploaded = await uploadPhoto(tripId, file);
        await store.insert('photos', {
          ...uploaded,
          trip_id: tripId,
          day,
          caption: '',
          uploaded_by: store.user.id,
          uploader_name: store.user.name
        });
      } catch (error) {
        failed += 1;
        console.error(error);
      }
      setUpload({ total: images.length, done: position + 1, status: t('Subiendo {n} de {total}…', { n: position + 1, total: images.length }) });
    }
    const done = images.length - failed;
    if (done) await store.insert('activity_log', { trip_id: tripId, actor_id: store.user.id, actor_name: store.user.name, text: tn(done, 'subió {n} foto al álbum', 'subió {n} fotos al álbum') }).catch(() => null);
    isUploadingRef.current = false;
    setBusy(false);
    setUpload(null);
    toast(failed ? t('{done} subidas, {failed} fallaron', { done, failed }) : tn(done, '{n} foto añadida', '{n} fotos añadidas'), { isError: Boolean(failed) });
    refresh();
  }

  async function deletePhotoHandler(photo) {
    const isConfirmed = await confirm(t('La foto desaparecerá del álbum para todo el grupo.'));
    if (!isConfirmed) return;
    try {
      // Primero el archivo: el servidor comprueba la fila de la foto antes de borrarlo en Cloudinary
      await deletePhotoFile(photo).catch(() => null);
      await store.remove('photos', photo.id, { tripId, text: t('eliminó una foto del álbum') });
      // Si la foto era la imagen de una actividad, la actividad deja de apuntar al archivo borrado
      if (photo.activity_id) {
        const activities = await store.list('activities', tripId);
        const activity = activities.find((item) => item.id === photo.activity_id && item.image_url === photo.url);
        if (activity) await store.update('activities', activity.id, { image_url: null, image_thumb: null, image_credit: null });
      }
      toast(t('Foto eliminada'));
      refresh();
    } catch (error) {
      toastError(error);
    }
  }

  function editPhotoHandler(photo) {
    async function saveHandler(values) {
      await store.update('photos', photo.id, { caption: values.caption, day: values.day || null });
      closeModal();
      refresh();
    }
    openModal(t('Editar foto'), <PhotoForm photo={photo} days={days} onSave={saveHandler} onDelete={() => deletePhotoHandler(photo)} />);
  }

  const options = [{ key: 'all', label: t('Todas ({n})', { n: photos.length }) }, { key: 'places', label: t('Sitios del plan') }]
    .concat(days.filter((day) => photos.some((photo) => photo.day === day)).map((day) => ({ key: day, label: t('Día {n}', { n: days.indexOf(day) + 1 }) })));

  return (
    <>
      <div className="section__head">
        <h2>{t('Álbum')}</h2>
        <span className="section__hint">{tn(photos.length, '{n} foto', '{n} fotos')}</span>
      </div>
      {canEdit ? (
        <div
          className={`uploader${isDragging ? ' uploader--active' : ''}`}
          id="uploader"
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => { event.preventDefault(); setIsDragging(false); uploadFiles(event.dataTransfer.files); }}
        >
          <span className="row__icon"><Icon name="upload" /></span>
          <p className="uploader__text" id="uploadStatus">{upload ? upload.status : t('Arrastra fotos aquí o elige varias a la vez. Se comprimen antes de subir.')}</p>
          <label className="btn btn--primary" htmlFor="photoInput"><Icon name="plus" size={18} /> {t('Añadir fotos')}</label>
          <input className="visually-hidden" id="photoInput" type="file" accept="image/*" multiple onChange={(event) => { uploadFiles(event.target.files); event.target.value = ''; }} />
          <progress className="progress" id="uploadProgress" hidden={!upload} max={upload?.total || 1} value={upload?.done || 0} />
        </div>
      ) : null}
      <Scroller>
        <ul className="chips" id="albumChips">
          {options.map((option) => (
            <li key={option.key}>
              <button className={`chip chip--plain ${option.key === filter ? 'chip--active' : ''}`} type="button" aria-pressed={option.key === filter} onClick={() => setFilter(option.key)}>{option.label}</button>
            </li>
          ))}
        </ul>
      </Scroller>
      <div id="albumGrid">
        {visible.length ? (
          <ul className="album">
            {visible.map((photo, index) => (
              <li key={photo.id} className={`album__item ${index % 5 === 0 || index % 5 === 3 ? 'album__item--tall' : ''}`}>
                <button className="album__button" type="button" aria-label={`${t('Ver foto {n}', { n: index + 1 })}${photo.caption ? `: ${photo.caption}` : ''}`} onClick={() => openLightbox(visible, index, { tripId })}>
                  <Picture url={photo.thumb_url || photo.url} alt={photo.caption || t('Foto {n} del viaje', { n: index + 1 })} width={480} height={480} isLazy={index > 5} />
                  {photo.caption ? <span className="album__caption">{photo.caption}</span> : null}
                </button>
                {photo.activity_id ? <span className="album__tag"><Icon name="pin" size={12} /> {t('Sitio')}</span> : null}
                {canEdit ? <button className="hero__btn album__edit" type="button" aria-label={t('Editar foto {n}', { n: index + 1 })} onClick={() => editPhotoHandler(photo)}><Icon name="dots" size={18} /></button> : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <span className="empty__icon"><Icon name="image" size={28} /></span>
            <h3 className="empty__title">{photos.length ? t('No hay fotos con este filtro') : t('El álbum está vacío')}</h3>
            <p className="empty__text">{t('Sube las fotos del viaje para que todo el grupo las tenga.')}</p>
          </div>
        )}
      </div>
    </>
  );
}
