/* Documentos del viaje (billetes, reservas, seguros). En la nube van a un bucket privado con URL firmada. */
import { store } from '../../lib/store/index.js';
import { fileSize, timeAgo, uid } from '../../lib/utils.js';
import Icon from '../../components/Icon.jsx';
import useLoad from '../../hooks/useLoad.js';
import { useUi } from '../../ui/UiContext.jsx';
import { useTrip } from './TripContext.jsx';

const MAX_BYTES = 15 * 1024 * 1024;
const KINDS = { pdf: 'PDF', image: 'Imagen', other: 'Archivo' };

function kindOf(file) {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  return 'other';
}

function safeName(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').slice(-80);
}

export default function DocumentsView() {
  const { tripId, canEdit, refreshKey, refresh } = useTrip();
  const { toast, toastError, confirm } = useUi();
  const { data } = useLoad(async () => (await store.list('documents', tripId))
    .sort((first, second) => (second.created_at || '').localeCompare(first.created_at || '')), [tripId, refreshKey]);
  if (!data) return null;

  async function filesHandler(event) {
    const files = Array.from(event.target.files);
    event.target.value = '';
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        toast(`"${file.name}" pesa más de 15 MB`, { isError: true });
        continue;
      }
      try {
        const stored = await store.uploadFile('documents', `${tripId}/${uid()}-${safeName(file.name)}`, file);
        await store.insert('documents', {
          trip_id: tripId,
          name: file.name,
          kind: kindOf(file),
          size: file.size,
          storage_path: stored.path,
          url: stored.url,
          uploaded_by: store.user.id,
          uploader_name: store.user.name
        }, { tripId, text: `subió el documento "${file.name}"` });
        toast(`"${file.name}" guardado`);
      } catch (error) {
        toastError(error);
      }
    }
    refresh();
  }

  async function openHandler(doc) {
    // Se abre la pestaña antes del await para que el navegador no la bloquee
    const tab = window.open('', '_blank');
    try {
      const url = await store.fileUrl('documents', doc.url);
      if (tab) {
        tab.opener = null;
        tab.location = url;
      } else location.href = url;
    } catch (error) {
      tab?.close();
      toastError(error);
    }
  }

  async function deleteHandler(doc) {
    if (!await confirm(`Se borrará "${doc.name}" para todo el grupo.`)) return;
    try {
      await store.remove('documents', doc.id, { tripId, text: `eliminó el documento "${doc.name}"` });
      await store.removeFile('documents', doc.storage_path).catch(() => null);
      refresh();
    } catch (error) {
      toastError(error);
    }
  }

  return (
    <>
      <div className="section__head">
        <div>
          <h2>Documentos</h2>
          <p className="section__hint">Billetes, reservas y seguros, siempre a mano.</p>
        </div>
        {canEdit ? (
          <>
            <label className="btn btn--primary btn--small" htmlFor="docInput"><Icon name="upload" size={16} /> Subir</label>
            <input className="visually-hidden" id="docInput" type="file" multiple accept=".pdf,image/*,.doc,.docx,.txt" onChange={filesHandler} />
          </>
        ) : null}
      </div>
      <section className="card">
        {data.length ? (
          <ul className="rows">
            {data.map((doc) => (
              <li className="row" key={doc.id}>
                <span className="row__icon"><Icon name={doc.kind === 'image' ? 'image' : 'file'} /></span>
                <div className="row__body">
                  <p className="row__title">{doc.name}</p>
                  <p className="row__meta">{KINDS[doc.kind] || 'Archivo'} · {fileSize(doc.size)} · {doc.uploader_name || ''} · {timeAgo(doc.created_at)}</p>
                </div>
                <div className="row__actions">
                  <button className="btn btn--small" type="button" onClick={() => openHandler(doc)}><Icon name="eye" size={16} /> Abrir</button>
                  {canEdit ? <button className="btn btn--ghost btn--small btn--icon btn--danger" type="button" aria-label={`Eliminar ${doc.name}`} onClick={() => deleteHandler(doc)}><Icon name="trash" size={16} /></button> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty empty--flat">
            <span className="empty__icon"><Icon name="file" size={28} /></span>
            <h3 className="empty__title">Sin documentos</h3>
            <p className="empty__text">Sube los billetes y reservas para tenerlos en el viaje.</p>
          </div>
        )}
      </section>
    </>
  );
}
