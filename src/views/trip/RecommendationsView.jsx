/*
 * Recomendaciones: top 5 de planes mas visitados segun la ciudad.
 * Tres origenes: el destino del viaje, donde esta la persona ahora (geolocalizacion) o una ciudad buscada.
 * Desde cada plan se puede añadir al itinerario o proponerlo al grupo. Tambien en #/planes (sin viaje).
 */
import { useEffect, useRef, useState } from 'react';
import { store } from '../../lib/store/index.js';
import { CATEGORIES, cityRecommendations, distanceKm, findCity, nearbyRecommendations } from '../../lib/recommendations.js';
import { currentPosition, reverseGeocode } from '../../lib/services.js';
import { bestCity } from '../../lib/places.js';
import { safeUrl } from '../../lib/utils.js';
import Icon from '../../components/Icon.jsx';
import Picture from '../../components/Picture.jsx';
import SuggestInput from '../../components/SuggestInput.jsx';
import { useBusy, useUi } from '../../ui/UiContext.jsx';
import { useTrip } from './TripContext.jsx';

const TOP = 5;
const SOURCES = [
  { key: 'viaje', label: 'Destino del viaje', icon: 'compass' },
  { key: 'aqui', label: 'Donde estoy', icon: 'pin' }
];

// Lo encontrado se recuerda al volver (mismo viaje o la pagina general)
let memory = { contextKey: '' };

async function recommendationsFor({ text, lat, lon }) {
  // Con coordenadas manda la distancia (asi "Cartagena, España" no se confunde con Cartagena de Indias)
  const city = lat != null && lon != null ? findCity({ lat, lon }) : findCity({ text });
  if (city) return { city, items: await cityRecommendations(city), isCurated: true };
  if (lat == null || lon == null) throw new Error('No encontramos esa zona. Prueba con el nombre de la ciudad y el país.');
  return { city: null, items: await nearbyRecommendations(lat, lon), isCurated: false };
}

function RecoCard({ item, place, canAdd, canPropose, isPlanned, onAdd, onPropose }) {
  const [isAdding, runAdd] = useBusy();
  const category = CATEGORIES[item.category] || CATEGORIES.lugar;
  let distance = '';
  if (place?.isHere && item.lat != null) {
    const km = distanceKm(place.lat, place.lon, item.lat, item.lon);
    distance = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  }
  const mapsUrl = item.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lon}` : '';
  const wikiUrl = safeUrl(item.url || '');
  const image = safeUrl(item.image || '');
  return (
    <li>
      <article className="reco">
        <div className={`reco__media photo-card ${item.rank === 1 ? 'photo-card--tall' : ''}`}>
          {image ? <Picture url={image} alt={item.name} className="photo-card__media" width={960} height={640} isLazy={item.rank > 2} /> : null}
          <span className="reco__rank" aria-label={`Puesto ${item.rank}`}>#{item.rank}</span>
          <div className="photo-card__overlay">
            <p className="photo-card__kicker"><Icon name={category.icon} size={12} /> {category.label}{distance ? ` · a ${distance}` : ''}</p>
            <h3 className="photo-card__title">{item.name}</h3>
            {item.description ? <p className="photo-card__place">{item.description}</p> : null}
          </div>
        </div>
        <div className="reco__body">
          {item.tip ? <p className="reco__tip"><Icon name="star" size={14} /> {item.tip}</p> : null}
          {item.extract ? <p className="reco__extract">{item.extract}</p> : null}
          <div className="reco__actions">
            {canAdd ? (isPlanned
              ? <span className="badge badge--success"><Icon name="check" size={14} /> En tu plan</span>
              : <button className="btn btn--primary btn--small" type="button" disabled={isAdding} onClick={() => runAdd(() => onAdd(item))}>{isAdding ? 'Guardando…' : <><Icon name="plus" size={16} /> Añadir al plan</>}</button>) : null}
            {canPropose ? <button className="btn btn--small" type="button" onClick={() => onPropose(item)}><Icon name="vote" size={16} /> Proponer</button> : null}
            {mapsUrl ? <a className="btn btn--ghost btn--small" href={mapsUrl} target="_blank" rel="noopener noreferrer"><Icon name="map" size={16} /> Cómo llegar</a> : null}
            {wikiUrl ? <a className="btn btn--ghost btn--small" href={wikiUrl} target="_blank" rel="noopener noreferrer">Saber más</a> : null}
          </div>
          {item.credit ? <p className="reco__credit">Foto e información: {item.credit}</p> : null}
        </div>
      </article>
    </li>
  );
}

export default function RecommendationsView({ isStandalone = false }) {
  const tripCtx = useTrip();
  const trip = isStandalone ? null : tripCtx?.trip;
  const tripId = trip?.id || null;
  const canEdit = Boolean(trip && tripCtx?.canEdit);
  const { toast, toastError } = useUi();
  const [isSearchBusy, runSearch] = useBusy();
  const contextKey = tripId || 'general';
  if (memory.contextKey !== contextKey) {
    memory = { contextKey, source: trip ? 'viaje' : 'aqui', place: null, results: [], errorMessage: '', loadedKey: '', isShowingAll: false };
  }
  const [source, setSource] = useState(memory.source);
  const [place, setPlace] = useState(memory.place);
  const [results, setResults] = useState(memory.results);
  const [errorMessage, setErrorMessage] = useState(memory.errorMessage);
  const [isLoading, setIsLoading] = useState(false);
  const [isShowingAll, setIsShowingAll] = useState(memory.isShowingAll);
  const [plannedTitles, setPlannedTitles] = useState(new Set());
  const seqRef = useRef(0);
  const queryRef = useRef(null);
  Object.assign(memory, { source, place, results, errorMessage, isShowingAll });

  // Planes ya en el itinerario (para marcar "En tu plan")
  useEffect(() => {
    if (!tripId) return;
    store.list('activities', tripId).catch(() => []).then((activities) => {
      setPlannedTitles(new Set(activities.map((activity) => activity.title.toLowerCase())));
    });
  }, [tripId, tripCtx?.refreshKey]);

  async function load(nextSource, searchedPlace = null) {
    const seq = ++seqRef.current;
    setIsLoading(true);
    setErrorMessage('');
    try {
      let resolved = searchedPlace;
      if (nextSource === 'viaje') {
        if (!trip?.destination && trip?.lat == null) throw new Error('Añade un destino al viaje para ver sus recomendaciones.');
        resolved = { label: trip.destination || trip.name, text: trip.destination, lat: trip.lat, lon: trip.lon };
      } else if (nextSource === 'aqui') {
        const position = await currentPosition();
        const named = await reverseGeocode(position.lat, position.lon).catch(() => null);
        resolved = { label: named?.label || 'Tu ubicación', text: named?.city || '', ...position, isHere: true };
      }
      const data = await recommendationsFor(resolved);
      if (seq !== seqRef.current) return;
      setPlace({ ...resolved, cityName: data.city?.name, isCurated: data.isCurated });
      setResults(data.items);
      memory.loadedKey = `${nextSource}:${resolved.label}`;
      if (!data.items.length) setErrorMessage('No encontramos planes populares en esta zona. Prueba con la ciudad más cercana.');
    } catch (error) {
      if (seq !== seqRef.current) return;
      setResults([]);
      setErrorMessage(error.message);
    }
    if (seq === seqRef.current) setIsLoading(false);
  }

  // Al entrar: el destino del viaje se carga solo; "Donde estoy" espera a que pulses (pide permiso)
  useEffect(() => {
    const key = `viaje:${trip?.destination || trip?.name}`;
    if (source === 'viaje' && key !== memory.loadedKey) load('viaje');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sourceHandler(key) {
    setSource(key);
    setIsShowingAll(false);
    load(key);
  }

  async function searchHandler(event, picked = null) {
    event?.preventDefault();
    const input = queryRef.current;
    const query = (picked?.value ?? input?.value ?? '').trim();
    if (!query) return;
    await runSearch(async () => {
      // Se muestra "cargando" desde ya: localizar la zona puede tardar un segundo
      setIsLoading(true);
      setErrorMessage('');
      // Ciudad elegida en el menu de sugerencias o, si no se eligio, la mejor coincidencia
      const pickedLat = parseFloat(picked?.lat ?? input?.form?.elements.query_lat?.value);
      const pickedLon = parseFloat(picked?.lon ?? input?.form?.elements.query_lon?.value);
      const isPicked = Number.isFinite(pickedLat) && Number.isFinite(pickedLon);
      const best = isPicked ? null : await bestCity(query);
      setSource('buscar');
      setIsShowingAll(false);
      await load('buscar', {
        label: isPicked ? query : best?.value || query,
        text: isPicked || best ? '' : query,
        lat: isPicked ? pickedLat : best?.lat ?? null,
        lon: isPicked ? pickedLon : best?.lon ?? null
      });
    });
  }

  async function addHandler(item) {
    try {
      const saved = await store.insert('activities', {
        trip_id: tripId,
        day: null,
        time: null,
        title: item.name,
        place: item.name,
        notes: [item.tip, item.extract].filter(Boolean).join('\n\n'),
        lat: item.lat,
        lon: item.lon,
        image_url: item.image || null,
        image_thumb: item.thumb || null,
        image_credit: item.credit || null,
        created_by: store.user.id,
        created_by_name: store.user.name
      }, { tripId, text: `añadió "${item.name}" desde Recomendaciones` });
      if (item.image) {
        await store.insert('photos', {
          url: item.image, thumb_url: item.thumb, caption: item.name, credit: item.credit, source_url: item.url,
          provider: 'wikimedia', trip_id: tripId, activity_id: saved.id, day: null,
          uploaded_by: store.user.id, uploader_name: store.user.name
        });
      }
      setPlannedTitles((current) => new Set([...current, item.name.toLowerCase()]));
      toast(`"${item.name}" está en Ideas sueltas del itinerario`);
    } catch (error) {
      toastError(error);
    }
  }

  async function proposeHandler(item) {
    try {
      await store.insert('proposals', {
        trip_id: tripId,
        title: item.name,
        description: [item.tip, item.description].filter(Boolean).join(' · '),
        day: null,
        status: 'open',
        author_id: store.user.id,
        author_name: store.user.name
      }, { tripId, text: `propuso "${item.name}"` });
      toast('Propuesta enviada al grupo para votar');
    } catch (error) {
      toastError(error);
    }
  }

  let resultsContent = null;
  if (isLoading) {
    resultsContent = <p className="loading" role="status">{source === 'aqui' ? 'Buscando dónde estás…' : 'Buscando los planes más populares…'}</p>;
  } else if (errorMessage) {
    resultsContent = (
      <div className="empty">
        <span className="empty__icon"><Icon name="compass" size={28} /></span>
        <p className="empty__text">{errorMessage}</p>
        <button className="btn" type="button" onClick={() => (source === 'buscar' ? load('buscar', place) : load(source))}>Intentar de nuevo</button>
      </div>
    );
  } else if (results.length && place) {
    const visible = isShowingAll ? results : results.slice(0, TOP);
    const where = place.cityName || place.label;
    const basis = place.isCurated
      ? 'Ordenado según las atracciones más visitadas de la ciudad.'
      : 'Zona sin top propio: lugares turísticos cercanos ordenados según su popularidad en Wikipedia.';
    resultsContent = (
      <>
        <div className="section__head">
          <div>
            <h3>Top {visible.length} en {where}</h3>
            <p className="section__hint">{basis}{place.isHere ? ' Distancias desde tu ubicación actual.' : ''}</p>
          </div>
        </div>
        <ol className="reco-list">
          {visible.map((item) => (
            <RecoCard key={`${item.rank}-${item.name}`} item={item} place={place} canAdd={canEdit} canPropose={Boolean(trip)} isPlanned={plannedTitles.has(item.name.toLowerCase())} onAdd={addHandler} onPropose={proposeHandler} />
          ))}
        </ol>
        {results.length > TOP ? (
          <p className="section__hint section__hint--center">
            <button className="btn" type="button" onClick={() => setIsShowingAll(!isShowingAll)}>{isShowingAll ? 'Ver solo el top 5' : `Ver ${results.length - TOP} ${results.length - TOP === 1 ? 'plan' : 'planes'} más`}</button>
          </p>
        ) : null}
      </>
    );
  } else if (source === 'aqui') {
    resultsContent = (
      <div className="empty">
        <span className="empty__icon"><Icon name="pin" size={28} /></span>
        <h3 className="empty__title">¿Dónde estás?</h3>
        <p className="empty__text">Usa tu ubicación para ver el top 5 de la ciudad en la que te encuentras, o busca una ciudad arriba.</p>
        <button className="btn btn--primary" type="button" onClick={() => sourceHandler('aqui')}><Icon name="pin" size={18} /> Usar mi ubicación</button>
      </div>
    );
  }

  return (
    <>
      <div className="section__head">
        <div>
          {trip ? <h2>Recomendaciones</h2> : <h1 className="home-head__title">Planes recomendados</h1>}
          <p className="section__hint">El top 5 de lo que más visita la gente, sin buscar en Google ni en redes.</p>
        </div>
      </div>
      <div className="reco-controls">
        <div className="segmented" role="group" aria-label="Recomendaciones para">
          {SOURCES.filter((option) => option.key !== 'viaje' || trip).map((option) => (
            <button key={option.key} className={`segmented__btn ${option.key === source ? 'segmented__btn--active' : ''}`} type="button" aria-pressed={option.key === source} onClick={() => sourceHandler(option.key)}>
              <Icon name={option.icon} size={16} /> {option.label}
            </button>
          ))}
        </div>
        <form className="search search--form suggest-host" role="search" onSubmit={searchHandler}>
          <Icon name="search" />
          <label className="visually-hidden" htmlFor="recoQuery">Buscar otra ciudad o zona</label>
          <SuggestInput
            ref={queryRef}
            id="recoQuery"
            name="query"
            className="search__input"
            kind="city"
            type="search"
            placeholder="Ciudad o código: Roma, MDE, CTG…"
            withCoords
            // Al elegir una ciudad del menu se busca al momento
            onSelect={(item) => searchHandler(null, item)}
          />
          <button className="btn btn--primary btn--small" type="submit" disabled={isSearchBusy}>{isSearchBusy ? 'Guardando…' : 'Buscar'}</button>
        </form>
      </div>
      <section id="recoResults" aria-live="polite">{resultsContent}</section>
    </>
  );
}
