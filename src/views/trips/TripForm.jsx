/*
 * Formulario de crear/editar viaje (modal) y la logica compartida: guardar y eliminar.
 * useTripActions() lo usan el inicio, la barra inferior ("Nuevo") y la cabecera del viaje ("Editar").
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../../lib/store/index.js';
import { uploadPhoto, deleteTripFiles } from '../../lib/media.js';
import { CURRENCIES } from '../../lib/services.js';
import { bestCity } from '../../lib/places.js';
import { formToObject } from '../../lib/utils.js';
import SuggestInput from '../../components/SuggestInput.jsx';
import { useBusy, useUi } from '../../ui/UiContext.jsx';

/* Guarda el viaje desde el formulario; devuelve su id */
export async function saveTrip(form, previous) {
  const data = formToObject(form);
  const coverFile = form.elements.cover.files[0];
  if (data.end_date < data.start_date) throw new Error('La vuelta no puede ser antes de la ida.');
  const patch = {
    name: data.name,
    destination: data.destination,
    start_date: data.start_date,
    end_date: data.end_date,
    currency: data.currency,
    description: data.description
  };
  // Coordenadas: las de la ciudad elegida en el menu; si se escribio sin elegir, la mejor coincidencia
  const pickedLat = parseFloat(data.destination_lat);
  const pickedLon = parseFloat(data.destination_lon);
  if (!data.destination) {
    patch.lat = null;
    patch.lon = null;
  } else if (Number.isFinite(pickedLat) && Number.isFinite(pickedLon)) {
    patch.lat = pickedLat;
    patch.lon = pickedLon;
  } else if (previous?.id && data.destination === previous.destination && previous.lat != null) {
    // Mismo destino que ya tenia: se conservan sus coordenadas
    patch.lat = previous.lat;
    patch.lon = previous.lon;
  } else {
    const place = await bestCity(data.destination);
    patch.lat = place?.lat ?? null;
    patch.lon = place?.lon ?? null;
  }
  if (previous?.id) {
    if (coverFile) patch.cover_url = (await uploadPhoto(previous.id, coverFile)).url;
    await store.updateTrip(previous.id, patch, { tripId: previous.id, text: 'editó los datos del viaje' });
    return previous.id;
  }
  // La portada se sube despues de crear el viaje: la ruta de almacenamiento empieza por su id
  const trip = await store.createTrip(patch);
  if (coverFile) {
    const cover = await uploadPhoto(trip.id, coverFile);
    await store.updateTrip(trip.id, { cover_url: cover.url });
  }
  return trip.id;
}

function TripForm({ trip = {}, onSubmit, onCancel, onDelete }) {
  const [isBusy, runBusy] = useBusy();
  const { toastError } = useUi();

  async function submitHandler(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await runBusy(() => onSubmit(form));
    } catch (error) {
      toastError(error);
    }
  }

  return (
    <form className="form" onSubmit={submitHandler}>
      <div className="form__field">
        <label className="form__label" htmlFor="tripName">Nombre del viaje</label>
        <input className="form__input" id="tripName" name="name" required maxLength={80} defaultValue={trip.name || ''} placeholder="Ej. Vacaciones en Cartagena" />
      </div>
      <div className="form__field suggest-host">
        <label className="form__label" htmlFor="tripDestination">Destino</label>
        <SuggestInput
          id="tripDestination"
          name="destination"
          kind="city"
          maxLength={120}
          defaultValue={trip.destination || ''}
          placeholder="Ciudad o código: Cartagena, CTG, NYC…"
          isOverlay
          withCoords
          defaultCoords={{ lat: trip.lat, lon: trip.lon }}
        />
        <p className="form__help">Elige la ciudad del menú para que el mapa, el clima y las recomendaciones sean del lugar correcto.</p>
      </div>
      <div className="form__row">
        <div className="form__field">
          <label className="form__label" htmlFor="tripStart">Ida</label>
          <input className="form__input" id="tripStart" name="start_date" type="date" required defaultValue={trip.start_date || ''} />
        </div>
        <div className="form__field">
          <label className="form__label" htmlFor="tripEnd">Vuelta</label>
          <input className="form__input" id="tripEnd" name="end_date" type="date" required defaultValue={trip.end_date || ''} />
        </div>
      </div>
      <div className="form__row">
        <div className="form__field">
          <label className="form__label" htmlFor="tripCurrency">Moneda del destino</label>
          <select className="form__select" id="tripCurrency" name="currency" defaultValue={trip.currency || 'USD'}>
            {CURRENCIES.map((code) => <option key={code}>{code}</option>)}
          </select>
        </div>
        <div className="form__field">
          <label className="form__label" htmlFor="tripCover">Foto de portada</label>
          <input className="form__input" id="tripCover" name="cover" type="file" accept="image/*" />
        </div>
      </div>
      <div className="form__field">
        <label className="form__label" htmlFor="tripDescription">Descripción</label>
        <textarea className="form__textarea" id="tripDescription" name="description" maxLength={600} placeholder="¿Qué planes tenéis?" defaultValue={trip.description || ''} />
      </div>
      <div className="form__actions">
        {trip.id && trip.role === 'owner' ? <button className="btn btn--ghost btn--danger" type="button" onClick={onDelete}>Eliminar viaje</button> : null}
        <button className="btn" type="button" onClick={onCancel}>Cancelar</button>
        <button className="btn btn--primary" type="submit" disabled={isBusy}>{isBusy ? 'Guardando…' : trip.id ? 'Guardar cambios' : 'Crear viaje'}</button>
      </div>
    </form>
  );
}

export function useTripActions() {
  const navigate = useNavigate();
  const { openModal, closeModal, toast, toastError, confirm } = useUi();

  const deleteTripFlow = useCallback(async (trip) => {
    const isConfirmed = await confirm(`Se borrará "${trip.name}" con su itinerario, fotos y documentos para todo el grupo.`);
    if (!isConfirmed) return;
    try {
      // Primero las fotos de Cloudinary: el servidor comprueba que el viaje aun existe y que eres quien organiza
      await deleteTripFiles(trip.id).catch(() => null);
      await store.deleteTrip(trip.id);
      toast('Viaje eliminado');
      navigate('/');
    } catch (error) {
      toastError(error);
    }
  }, [confirm, navigate, toast, toastError]);

  const openNewTrip = useCallback(() => {
    async function createHandler(form) {
      const id = await saveTrip(form, null);
      closeModal();
      toast('¡Viaje creado!');
      navigate(`/viaje/${id}`);
    }
    openModal('Nuevo viaje', <TripForm onSubmit={createHandler} onCancel={closeModal} />);
  }, [closeModal, navigate, openModal, toast]);

  const openEditTrip = useCallback((trip, onSaved) => {
    async function editHandler(form) {
      await saveTrip(form, trip);
      closeModal();
      toast('Viaje actualizado');
      onSaved?.();
    }
    openModal('Editar viaje', <TripForm trip={trip} onSubmit={editHandler} onCancel={closeModal} onDelete={() => deleteTripFlow(trip)} />);
  }, [closeModal, deleteTripFlow, openModal, toast]);

  return { openNewTrip, openEditTrip, deleteTripFlow };
}
