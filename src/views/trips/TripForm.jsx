/*
 * Formulario de crear/editar viaje (modal) y la logica compartida: guardar y eliminar.
 * useTripActions() lo usan el inicio, la barra inferior ("Nuevo") y la cabecera del viaje ("Editar").
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../../lib/store/index.js';
import { uploadPhoto, deleteTripFiles } from '../../lib/media.js';
import { currencyForCountry, currencyOptions, homeCurrency } from '../../lib/currencies.js';
import { bestCity } from '../../lib/places.js';
import { formToObject } from '../../lib/utils.js';
import SuggestInput from '../../components/SuggestInput.jsx';
import { useBusy, useUi } from '../../ui/UiContext.jsx';
import { t } from '../../lib/i18n/index.js';

/* Guarda el viaje desde el formulario; devuelve su id */
export async function saveTrip(form, previous) {
  const data = formToObject(form);
  const coverFile = form.elements.cover.files[0];
  if (data.end_date < data.start_date) throw new Error(t('La vuelta no puede ser antes de la ida.'));
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
    await store.updateTrip(previous.id, patch, { tripId: previous.id, text: t('editó los datos del viaje') });
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
  // Viaje nuevo: la moneda empieza en la de casa y cambia sola a la del pais al elegir el destino
  const [currency, setCurrency] = useState(trip.currency || homeCurrency());

  function destinationHandler(item) {
    const suggested = currencyForCountry(item.countryCode);
    if (suggested) setCurrency(suggested);
  }

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
        <label className="form__label" htmlFor="tripName">{t('Nombre del viaje')}</label>
        <input className="form__input" id="tripName" name="name" required maxLength={80} defaultValue={trip.name || ''} placeholder={t('Ej. Vacaciones en Cartagena')} />
      </div>
      <div className="form__field suggest-host">
        <label className="form__label" htmlFor="tripDestination">{t('Destino')}</label>
        <SuggestInput
          id="tripDestination"
          name="destination"
          kind="city"
          maxLength={120}
          defaultValue={trip.destination || ''}
          placeholder={t('Ciudad o código: Cartagena, CTG, NYC…')}
          isOverlay
          withCoords
          defaultCoords={{ lat: trip.lat, lon: trip.lon }}
          onSelect={destinationHandler}
        />
        <p className="form__help">{t('Elige la ciudad del menú para que el mapa, el clima y las recomendaciones sean del lugar correcto.')}</p>
      </div>
      <div className="form__row">
        <div className="form__field">
          <label className="form__label" htmlFor="tripStart">{t('Ida')}</label>
          <input className="form__input" id="tripStart" name="start_date" type="date" required defaultValue={trip.start_date || ''} />
        </div>
        <div className="form__field">
          <label className="form__label" htmlFor="tripEnd">{t('Vuelta')}</label>
          <input className="form__input" id="tripEnd" name="end_date" type="date" required defaultValue={trip.end_date || ''} />
        </div>
      </div>
      <div className="form__row">
        <div className="form__field">
          <label className="form__label" htmlFor="tripCurrency">{t('Moneda del destino')}</label>
          <select className="form__select" id="tripCurrency" name="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {currencyOptions(currency).map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
          </select>
        </div>
        <div className="form__field">
          <label className="form__label" htmlFor="tripCover">{t('Foto de portada')}</label>
          <input className="form__input" id="tripCover" name="cover" type="file" accept="image/*" />
        </div>
      </div>
      <div className="form__field">
        <label className="form__label" htmlFor="tripDescription">{t('Descripción')}</label>
        <textarea className="form__textarea" id="tripDescription" name="description" maxLength={600} placeholder={t('¿Qué planes tenéis?')} defaultValue={trip.description || ''} />
      </div>
      <div className="form__actions">
        {trip.id && trip.role === 'owner' ? <button className="btn btn--ghost btn--danger" type="button" onClick={onDelete}>{t('Eliminar viaje')}</button> : null}
        <button className="btn" type="button" onClick={onCancel}>{t('Cancelar')}</button>
        <button className="btn btn--primary" type="submit" disabled={isBusy}>{isBusy ? t('Guardando…') : trip.id ? t('Guardar cambios') : t('Crear viaje')}</button>
      </div>
    </form>
  );
}

export function useTripActions() {
  const navigate = useNavigate();
  const { openModal, closeModal, toast, toastError, confirm } = useUi();

  const deleteTripFlow = useCallback(async (trip) => {
    const isConfirmed = await confirm(t('Se borrará "{name}" con su itinerario, fotos y documentos para todo el grupo.', { name: trip.name }));
    if (!isConfirmed) return;
    try {
      // Primero las fotos de Cloudinary: el servidor comprueba que el viaje aun existe y que eres quien organiza
      await deleteTripFiles(trip.id).catch(() => null);
      await store.deleteTrip(trip.id);
      toast(t('Viaje eliminado'));
      navigate('/');
    } catch (error) {
      toastError(error);
    }
  }, [confirm, navigate, toast, toastError]);

  const openNewTrip = useCallback(() => {
    async function createHandler(form) {
      const id = await saveTrip(form, null);
      closeModal();
      toast(t('¡Viaje creado!'));
      navigate(`/viaje/${id}`);
    }
    openModal(t('Nuevo viaje'), <TripForm onSubmit={createHandler} onCancel={closeModal} />);
  }, [closeModal, navigate, openModal, toast]);

  const openEditTrip = useCallback((trip, onSaved) => {
    async function editHandler(form) {
      await saveTrip(form, trip);
      closeModal();
      toast(t('Viaje actualizado'));
      onSaved?.();
    }
    openModal(t('Editar viaje'), <TripForm trip={trip} onSubmit={editHandler} onCancel={closeModal} onDelete={() => deleteTripFlow(trip)} />);
  }, [closeModal, deleteTripFlow, openModal, toast]);

  return { openNewTrip, openEditTrip, deleteTripFlow };
}
