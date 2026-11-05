/*
 * Viaje de ejemplo a Nueva York con fotos libres de Wikimedia Commons.
 * Cada foto guarda su autor y licencia (se muestran en el album y en el itinerario).
 */
import { store } from './store/index.js';
import { parseDay, toDay } from './utils.js';

const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/thumb';
const FILE_PAGE = 'https://commons.wikimedia.org/wiki/File:';

const PHOTOS = {
  skyline: ['1/15', 'Lower_Manhattan_from_Jersey_City_November_2016_002.jpg', 'King of Hearts', 'CC BY-SA 4.0', 'Skyline del Lower Manhattan desde Jersey City'],
  grandCentral: ['3/30', 'Grand_Central_Terminal_Main_Concourse_2019-10-03_20-02.jpg', 'Axel Tschentscher', 'CC BY-SA 4.0', 'Vestíbulo principal de Grand Central'],
  bowBridge: ['1/14', 'Bow_Bridge_with_the_Central_Park_South_skyline%2C_Central_Park%2C_Manhattan%2C_New_York.jpg', 'Christian David', 'CC BY-SA 4.0', 'Bow Bridge en Central Park'],
  timesSquare: ['2/26', 'Times_Square_nachts-20120518-RM-015143.jpg', 'Ermell', 'CC BY-SA 4.0', 'Times Square de noche'],
  liberty: ['6/6e', 'Statue_of_Liberty_frontal_2.jpg', 'Daniel Schwen', 'Dominio público', 'Estatua de la Libertad'],
  brooklynBridge: ['7/7c', 'Brooklyn_Bridge_August_2017.jpg', 'Arild Vågen', 'CC BY-SA 4.0', 'Puente de Brooklyn'],
  dumbo: ['5/53', 'Manhattan_Bridge_from_Washington_Street%2C_Dumbo%2C_Brooklyn%2C_New_York.jpg', 'Christian David', 'CC BY-SA 4.0', 'Manhattan Bridge desde Washington Street, DUMBO'],
  highLine: ['e/eb', 'High_Line_New_York_August_2013.jpg', 'King of Hearts', 'CC BY-SA 4.0', 'Paseo por el High Line'],
  topOfTheRock: ['0/05', 'View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu.jpg', 'Dllu', 'CC BY-SA 4.0', 'Empire State desde Top of the Rock'],
  nightView: ['0/09', 'NYC_TotR_night.jpg', 'Daniel Schwen', 'CC BY-SA 4.0', 'Manhattan de noche desde el Rockefeller Center'],
  bowPanorama: ['9/91', 'Bow_Bridge_panorama_Central_Park_%2886746p%29.jpg', 'Rhododendrites', 'CC BY-SA 4.0', 'Panorámica del lago de Central Park'],
  pebbleBeach: ['f/f0', 'Brooklyn_Bridge_and_the_Lower_Manhattan_skyline_from_Pebble_Beach%2C_New_York.jpg', 'Christian David', 'CC BY-SA 4.0', 'Brooklyn Bridge desde Pebble Beach']
};

const PLAN = [
  [0, '09:30', 'Grand Central Terminal', 'Grand Central Terminal, 89 E 42nd St', 'Mirar el techo de constelaciones y probar la galería de los susurros.', 40.7527, -73.9772, 'grandCentral'],
  [0, '13:00', 'Paseo por Central Park', 'Bow Bridge, Central Park', 'Entrar por la 72 y caminar hasta Bow Bridge. Picnic si hace buen tiempo.', 40.7756, -73.9714, 'bowBridge'],
  [0, '20:00', 'Times Square de noche', 'Times Square, Manhattan', 'Ver las pantallas y cenar por Hell’s Kitchen.', 40.758, -73.9855, 'timesSquare'],
  [1, '09:00', 'Estatua de la Libertad', 'Liberty Island', 'Ferry desde Battery Park. Reservar con antelación el acceso al pedestal.', 40.6892, -74.0445, 'liberty'],
  [1, '17:00', 'Cruzar el Puente de Brooklyn', 'Brooklyn Bridge', 'Empezar en Manhattan para llegar a Brooklyn con el atardecer de frente.', 40.7061, -73.9969, 'brooklynBridge'],
  [1, '19:00', 'Foto en DUMBO', 'Washington Street, DUMBO, Brooklyn', 'La foto clásica del Manhattan Bridge y pizza en Front Street.', 40.7033, -73.9894, 'dumbo'],
  [2, '10:00', 'High Line y Chelsea Market', 'High Line, Gansevoort Street', 'Recorrer el parque elevado de sur a norte y comer en Chelsea Market.', 40.748, -74.0048, 'highLine'],
  [2, '18:30', 'Atardecer en Top of the Rock', 'Top of the Rock, Rockefeller Center', 'Las mejores vistas del Empire State. Entradas para la hora dorada.', 40.7593, -73.9794, 'topOfTheRock'],
  [3, '11:00', 'Brunch en el West Village', 'West Village, Manhattan', 'Día tranquilo: brunch, tiendas y Washington Square Park.', 40.7358, -74.0036, null]
];

const FRIENDS = ['Andrea', 'Camilo', 'Valentina'];

function photoUrls(key) {
  const [path, file, author, license, caption] = PHOTOS[key];
  return {
    url: `${COMMONS}/${path}/${file}/1280px-${file}`,
    thumb_url: `${COMMONS}/${path}/${file}/500px-${file}`,
    credit: `${author} · ${license} · Wikimedia Commons`,
    source_url: FILE_PAGE + file,
    caption
  };
}

function addDays(base, days) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return toDay(date);
}

export async function createDemoTrip() {
  const start = addDays(new Date(), 21);
  const day = (offset) => addDays(parseDay(start), offset);
  const cover = photoUrls('skyline');
  const trip = await store.createTrip({
    name: 'Nueva York con amigos',
    destination: 'Nueva York, Estados Unidos',
    description: 'Cinco días entre rascacielos, puentes y parques: Central Park, Brooklyn, la Estatua de la Libertad y las mejores vistas de Manhattan.',
    start_date: start,
    end_date: day(4),
    currency: 'USD',
    lat: 40.7128,
    lon: -74.006,
    cover_url: cover.url
  });
  const tripId = trip.id;
  const me = store.user;

  // Compañeros de viaje (solo en modo local, donde se pueden simular personas)
  const friends = store.addDemoMember
    ? await Promise.all(FRIENDS.map((name, index) => store.addDemoMember(tripId, name, index === 2 ? 'viewer' : 'editor')))
    : [];
  const friend = (index) => friends[index] || { id: me.id, name: me.name };

  const activityIds = {};
  for (const [offset, time, title, place, notes, lat, lon, photoKey] of PLAN) {
    const photo = photoKey ? photoUrls(photoKey) : null;
    const author = friend(offset % 2);
    const saved = await store.insert('activities', {
      trip_id: tripId,
      day: day(offset),
      time,
      title,
      place,
      notes,
      lat,
      lon,
      image_url: photo?.url || null,
      image_thumb: photo?.thumb_url || null,
      image_credit: photo?.credit || null,
      created_by: author.id,
      created_by_name: author.name
    }, { tripId, text: `añadió la actividad "${title}"` });
    activityIds[photoKey || title] = saved.id;
    if (photo) {
      await store.insert('photos', {
        ...photo,
        provider: 'commons',
        trip_id: tripId,
        activity_id: saved.id,
        day: day(offset),
        uploaded_by: author.id,
        uploader_name: author.name
      });
    }
  }

  for (const [key, offset] of [['nightView', 2], ['bowPanorama', 0], ['pebbleBeach', 1]]) {
    await store.insert('photos', { ...photoUrls(key), provider: 'commons', trip_id: tripId, day: day(offset), uploaded_by: friend(1).id, uploader_name: friend(1).name });
  }

  await store.insert('comments', {
    trip_id: tripId, target_type: 'activity', target_id: activityIds.liberty,
    body: '¡Ya miré los ferris! El primero sale a las 8:30, mejor ir temprano.', author_id: friend(0).id, author_name: friend(0).name
  });
  await store.insert('comments', {
    trip_id: tripId, target_type: 'activity', target_id: activityIds.brooklynBridge,
    body: 'Llevo la cámara buena para el atardecer 📷', author_id: friend(1).id, author_name: friend(1).name
  });

  const met = await store.insert('proposals', {
    trip_id: tripId, title: 'Museo Metropolitano (MET)', day: day(3), status: 'open',
    description: 'Entrada general unos 30 USD. Podríamos ir por la mañana antes del brunch.',
    author_id: friend(2).id, author_name: friend(2).name
  }, { tripId, text: 'propuso "Museo Metropolitano (MET)"' });
  const knicks = await store.insert('proposals', {
    trip_id: tripId, title: 'Partido de los Knicks en el Madison Square Garden', day: day(3), status: 'open',
    description: 'Hay partido esa noche. Entradas desde 90 USD.',
    author_id: friend(1).id, author_name: friend(1).name
  });
  await store.insert('votes', { trip_id: tripId, proposal_id: met.id, user_id: me.id, value: 1 });
  for (const [index, proposal, value] of [[0, met, 1], [1, met, 1], [0, knicks, -1], [2, knicks, 1]]) {
    if (friends[index]) await store.insert('votes', { trip_id: tripId, proposal_id: proposal.id, user_id: friends[index].id, value });
  }

  for (const [text, assignee] of [['Adaptador de enchufe tipo A', 'Andrea'], ['Tarjeta OMNY / MetroCard', null], ['Botiquín', 'Camilo'], ['Power bank', null]]) {
    await store.insert('checklist_items', { trip_id: tripId, text, is_shared: true, is_done: assignee === 'Andrea', owner_id: me.id, assignee_name: friends.length ? assignee : null });
  }
  for (const text of ['Pasaporte y ESTA', 'Abrigo y bufanda', 'Zapatillas cómodas']) {
    await store.insert('checklist_items', { trip_id: tripId, text, is_shared: false, is_done: false, owner_id: me.id });
  }

  await store.insert('diary_entries', {
    trip_id: tripId, day: day(0),
    body: 'Llegamos con el jet lag a cuestas, pero Grand Central nos despertó de golpe. Central Park estaba precioso y Times Square de noche es todavía más loco de lo que imaginábamos.',
    author_id: friend(0).id, author_name: friend(0).name
  });
  return tripId;
}
