/* Documentos del viaje (billetes, reservas, seguros). En la nube van a un bucket privado con URL firmada. */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { confirmDialog, toast, toastError } from '../ui.js';
import { esc, fileSize, timeAgo, uid } from '../utils.js';

const MAX_BYTES = 15 * 1024 * 1024;
const KINDS = { pdf: 'PDF', image: 'Imagen', other: 'Archivo' };

let documents = [];

function kindOf(file) {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  return 'other';
}

function safeName(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').slice(-80);
}

/* ---- Handlers ---- */

async function documentFilesHandler(input, ctx) {
  const files = Array.from(input.files);
  input.value = '';
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      toast(`"${file.name}" pesa más de 15 MB`, { isError: true });
      continue;
    }
    try {
      const stored = await store.uploadFile('documents', `${ctx.tripId}/${uid()}-${safeName(file.name)}`, file);
      await store.insert('documents', {
        trip_id: ctx.tripId,
        name: file.name,
        kind: kindOf(file),
        size: file.size,
        storage_path: stored.path,
        url: stored.url,
        uploaded_by: store.user.id,
        uploader_name: store.user.name
      }, { tripId: ctx.tripId, text: `subió el documento "${file.name}"` });
      toast(`"${file.name}" guardado`);
    } catch (error) {
      toastError(error);
    }
  }
  ctx.refresh();
}

async function openDocumentHandler(button) {
  const doc = documents.find((item) => item.id === button.dataset.id);
  // Se abre la pestaña antes del await para que el navegador no la bloquee
  const tab = window.open('', '_blank');
  try {
    const url = await store.fileUrl('documents', doc.url);
    if (tab) tab.location = url;
    else location.href = url;
  } catch (error) {
    tab?.close();
    toastError(error);
  }
}

async function deleteDocumentHandler(button, event, ctx) {
  const doc = documents.find((item) => item.id === button.dataset.id);
  if (!await confirmDialog(`Se borrará "${doc.name}" para todo el grupo.`)) return;
  try {
    await store.remove('documents', doc.id, { tripId: ctx.tripId, text: `eliminó el documento "${doc.name}"` });
    await store.removeFile('documents', doc.storage_path).catch(() => null);
    ctx.refresh();
  } catch (error) {
    toastError(error);
  }
}

export default {
  async render(ctx) {
    documents = (await store.list('documents', ctx.tripId)).sort((first, second) => (second.created_at || '').localeCompare(first.created_at || ''));
    return `
      <div class="section__head">
        <div>
          <h2>Documentos</h2>
          <p class="section__hint">Billetes, reservas y seguros, siempre a mano.</p>
        </div>
        ${ctx.canEdit ? `
          <label class="btn btn--primary btn--small" for="docInput">${icon('upload', 16)} Subir</label>
          <input class="visually-hidden" id="docInput" type="file" multiple accept=".pdf,image/*,.doc,.docx,.txt" data-input="document-files">` : ''}
      </div>
      <section class="card">
        ${documents.length ? `<ul class="rows">${documents.map((doc) => `
          <li class="row">
            <span class="row__icon">${icon(doc.kind === 'image' ? 'image' : 'file')}</span>
            <div class="row__body">
              <p class="row__title">${esc(doc.name)}</p>
              <p class="row__meta">${KINDS[doc.kind] || 'Archivo'} · ${esc(fileSize(doc.size))} · ${esc(doc.uploader_name || '')} · ${esc(timeAgo(doc.created_at))}</p>
            </div>
            <div class="row__actions">
              <button class="btn btn--small" type="button" data-action="open-document" data-id="${esc(doc.id)}">${icon('eye', 16)} Abrir</button>
              ${ctx.canEdit ? `<button class="btn btn--ghost btn--small btn--icon btn--danger" type="button" data-action="delete-document" data-id="${esc(doc.id)}" aria-label="Eliminar ${esc(doc.name)}">${icon('trash', 16)}</button>` : ''}
            </div>
          </li>`).join('')}</ul>`
          : `<div class="empty empty--flat"><span class="empty__icon">${icon('file', 28)}</span><h3 class="empty__title">Sin documentos</h3><p class="empty__text">Sube los billetes y reservas para tenerlos en el viaje.</p></div>`}
      </section>`;
  },
  actions: {
    'open-document': openDocumentHandler,
    'delete-document': deleteDocumentHandler
  },
  inputs: { 'document-files': documentFilesHandler }
};
