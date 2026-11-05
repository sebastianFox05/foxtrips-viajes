/* Album del viaje: subida multiple con compresion, filtros por dia y lightbox con comentarios. */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { pictureHtml, uploadPhoto, deletePhotoFile } from '../media.js';
import { openLightbox } from '../lightbox.js';
import { openModal, closeModal, confirmDialog, toast, toastError, withBusy } from '../ui.js';
import { eachDay, esc, formatDay, formToObject } from '../utils.js';

let photos = [];
let visible = [];
let filter = 'all';
let days = [];
let isUploading = false;

function filtered() {
  if (filter === 'all') return photos;
  if (filter === 'places') return photos.filter((photo) => photo.activity_id);
  return photos.filter((photo) => photo.day === filter);
}

function chipsHtml() {
  const options = [{ key: 'all', label: `Todas (${photos.length})` }, { key: 'places', label: 'Sitios del plan' }]
    .concat(days.filter((day) => photos.some((photo) => photo.day === day)).map((day) => ({ key: day, label: `Día ${days.indexOf(day) + 1}` })));
  return options.map((option) => `
    <li><button class="chip chip--plain ${option.key === filter ? 'chip--active' : ''}" type="button" data-action="album-filter" data-filter="${esc(option.key)}" aria-pressed="${option.key === filter}">${esc(option.label)}</button></li>`).join('');
}

function gridHtml(ctx) {
  visible = filtered();
  if (!visible.length) {
    return `
      <div class="empty">
        <span class="empty__icon">${icon('image', 28)}</span>
        <h3 class="empty__title">${photos.length ? 'No hay fotos con este filtro' : 'El álbum está vacío'}</h3>
        <p class="empty__text">Sube las fotos del viaje para que todo el grupo las tenga.</p>
      </div>`;
  }
  return `<ul class="album">${visible.map((photo, index) => `
    <li class="album__item ${index % 5 === 0 || index % 5 === 3 ? 'album__item--tall' : ''}">
      <button class="album__button" type="button" data-action="open-photo" data-index="${index}" aria-label="Ver foto ${index + 1}${photo.caption ? `: ${esc(photo.caption)}` : ''}">
        ${pictureHtml(photo.thumb_url || photo.url, { alt: photo.caption || `Foto ${index + 1} del viaje`, width: 480, height: 480, isLazy: index > 5 })}
        ${photo.caption ? `<span class="album__caption">${esc(photo.caption)}</span>` : ''}
      </button>
      ${photo.activity_id ? `<span class="album__tag">${icon('pin', 12)} Sitio</span>` : ''}
      ${ctx.canEdit ? `<button class="hero__btn album__edit" type="button" data-action="edit-photo" data-id="${esc(photo.id)}" aria-label="Editar foto ${index + 1}">${icon('dots', 18)}</button>` : ''}
    </li>`).join('')}</ul>`;
}

function refreshGrid(ctx) {
  document.getElementById('albumChips').innerHTML = chipsHtml();
  const grid = document.getElementById('albumGrid');
  grid.innerHTML = gridHtml(ctx);
  ctx.hydrate(grid);
}

async function uploadFiles(files, ctx) {
  const images = Array.from(files).filter((file) => file.type.startsWith('image/'));
  if (!images.length || isUploading) return;
  isUploading = true;
  // Se buscan por id en cada paso: si la vista se repintara, no quedarian referencias a nodos borrados
  const progress = () => document.getElementById('uploadProgress');
  const status = () => document.getElementById('uploadStatus');
  if (progress()) Object.assign(progress(), { hidden: false, max: images.length, value: 0 });
  const day = filter !== 'all' && filter !== 'places' ? filter : null;
  let failed = 0;
  for (const [position, file] of images.entries()) {
    if (status()) status().textContent = `Subiendo ${position + 1} de ${images.length}…`;
    try {
      const uploaded = await uploadPhoto(ctx.tripId, file);
      await store.insert('photos', {
        ...uploaded,
        trip_id: ctx.tripId,
        day,
        caption: '',
        uploaded_by: store.user.id,
        uploader_name: store.user.name
      });
    } catch (error) {
      failed += 1;
      console.error(error);
    }
    if (progress()) progress().value = position + 1;
  }
  const done = images.length - failed;
  if (done) await store.insert('activity_log', { trip_id: ctx.tripId, actor_id: store.user.id, actor_name: store.user.name, text: `subió ${done} foto${done === 1 ? '' : 's'} al álbum` });
  isUploading = false;
  toast(failed ? `${done} subidas, ${failed} fallaron` : `${done} foto${done === 1 ? '' : 's'} añadida${done === 1 ? '' : 's'}`, { isError: Boolean(failed) });
  ctx.refresh();
}

/* ---- Handlers ---- */

function albumFilterHandler(button, event, ctx) {
  filter = button.dataset.filter;
  refreshGrid(ctx);
}

function openPhotoHandler(button, event, ctx) {
  openLightbox(visible, Number(button.dataset.index), { tripId: ctx.tripId });
}

function photoInputHandler(input, ctx) {
  uploadFiles(input.files, ctx);
  input.value = '';
}

function editPhotoHandler(button, event, ctx) {
  const photo = photos.find((item) => item.id === button.dataset.id);
  const options = days.map((day, index) => `<option value="${day}" ${day === photo.day ? 'selected' : ''}>Día ${index + 1} · ${esc(formatDay(day, { day: 'numeric', month: 'short' }))}</option>`).join('');
  // Si el dia quedo fuera de las fechas del viaje se conserva como opcion para no perderlo al guardar
  const outsideOption = photo.day && !days.includes(photo.day) ? `<option value="${esc(photo.day)}" selected>${esc(formatDay(photo.day, { day: 'numeric', month: 'short' }))} (fuera del viaje)</option>` : '';
  openModal('Editar foto', `
    <form class="form" data-form="save-photo" data-id="${esc(photo.id)}">
      <figure class="form__preview">${pictureHtml(photo.thumb_url || photo.url, { alt: '', width: 220, height: 220 })}</figure>
      <div class="form__field">
        <label class="form__label" for="photoCaption">Descripción</label>
        <input class="form__input" id="photoCaption" name="caption" maxlength="140" value="${esc(photo.caption || '')}" placeholder="¿Qué se ve en la foto?">
      </div>
      <div class="form__field">
        <label class="form__label" for="photoDay">Día</label>
        <select class="form__select" id="photoDay" name="day"><option value="">Sin día</option>${outsideOption}${options}</select>
      </div>
      <p class="form__help">Subida por ${esc(photo.uploader_name || 'alguien del grupo')}.</p>
      <div class="form__actions">
        <button class="btn btn--ghost btn--danger" type="button" data-action="delete-photo" data-id="${esc(photo.id)}">Eliminar</button>
        <button class="btn btn--primary" type="submit">Guardar</button>
      </div>
    </form>`);
}

async function savePhotoHandler(form, ctx, submitter) {
  const data = formToObject(form);
  await withBusy(submitter, () => store.update('photos', form.dataset.id, { caption: data.caption, day: data.day || null }));
  closeModal();
  ctx.refresh();
}

async function deletePhotoHandler(button, event, ctx) {
  const photo = photos.find((item) => item.id === button.dataset.id);
  const isConfirmed = await confirmDialog('La foto desaparecerá del álbum para todo el grupo.');
  if (!isConfirmed) return;
  try {
    // Primero el archivo: el servidor comprueba la fila de la foto antes de borrarlo en Cloudinary
    await deletePhotoFile(photo).catch(() => null);
    await store.remove('photos', photo.id, { tripId: ctx.tripId, text: 'eliminó una foto del álbum' });
    // Si la foto era la imagen de una actividad, la actividad deja de apuntar al archivo borrado
    if (photo.activity_id) {
      const activities = await store.list('activities', ctx.tripId);
      const activity = activities.find((item) => item.id === photo.activity_id && item.image_url === photo.url);
      if (activity) await store.update('activities', activity.id, { image_url: null, image_thumb: null, image_credit: null });
    }
    toast('Foto eliminada');
    ctx.refresh();
  } catch (error) {
    toastError(error);
  }
}

export default {
  async render(ctx) {
    photos = (await store.list('photos', ctx.tripId)).sort((first, second) => (second.created_at || '').localeCompare(first.created_at || ''));
    days = eachDay(ctx.trip.start_date, ctx.trip.end_date);
    if (!['all', 'places', ...days].includes(filter)) filter = 'all';
    return `
      <div class="section__head">
        <h2>Álbum</h2>
        <span class="section__hint">${photos.length} fotos</span>
      </div>
      ${ctx.canEdit ? `
      <div class="uploader" id="uploader">
        <span class="row__icon">${icon('upload')}</span>
        <p class="uploader__text" id="uploadStatus">Arrastra fotos aquí o elige varias a la vez. Se comprimen antes de subir.</p>
        <label class="btn btn--primary" for="photoInput">${icon('plus', 18)} Añadir fotos</label>
        <input class="visually-hidden" id="photoInput" type="file" accept="image/*" multiple data-input="photo-files">
        <progress class="progress" id="uploadProgress" hidden></progress>
      </div>` : ''}
      <ul class="chips" id="albumChips">${chipsHtml()}</ul>
      <div id="albumGrid">${gridHtml(ctx)}</div>`;
  },
  mount(ctx, root) {
    const uploader = root.querySelector('#uploader');
    if (!uploader) return;
    const dragOverHandler = (event) => {
      event.preventDefault();
      uploader.classList.add('uploader--active');
    };
    const dragLeaveHandler = () => uploader.classList.remove('uploader--active');
    const dropHandler = (event) => {
      event.preventDefault();
      uploader.classList.remove('uploader--active');
      uploadFiles(event.dataTransfer.files, ctx);
    };
    uploader.addEventListener('dragover', dragOverHandler);
    uploader.addEventListener('dragleave', dragLeaveHandler);
    uploader.addEventListener('drop', dropHandler);
  },
  actions: {
    'album-filter': albumFilterHandler,
    'open-photo': openPhotoHandler,
    'edit-photo': editPhotoHandler,
    'delete-photo': deletePhotoHandler
  },
  isBusy: () => isUploading,
  inputs: { 'photo-files': photoInputHandler },
  forms: { 'save-photo': savePhotoHandler }
};
