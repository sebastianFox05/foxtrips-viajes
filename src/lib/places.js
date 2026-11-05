/*
 * Busqueda de ciudades y lugares para los menus de sugerencias.
 * - Ciudades: lista propia con codigos (CTG, BOG, NYC, CDMX…) + buscador de Open-Meteo (gratis, sin clave,
 *   ordena por relevancia y poblacion: "cartagena" devuelve primero Cartagena de Indias).
 * - Lugares: Photon (OpenStreetMap), pensado para buscar mientras se escribe y con prioridad cerca del destino.
 * Nominatim no se usa aqui porque sus normas prohiben el autocompletado.
 */

const CITY_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const PLACE_URL = 'https://photon.komoot.io/api/';
const MAX_RESULTS = 7;
const SAME_PLACE_KM = 30;
const NEAR_BOX_DEGREES = 0.55;
const ADMIN_PREFIX = /^(departamento|región|region|estado|provincia|comunidad|distrito|condado|prefectura) (de |del |of )?/i;
const PLACE_TYPES = {
  museum: 'Museo', attraction: 'Atracción', viewpoint: 'Mirador', park: 'Parque', garden: 'Jardín', zoo: 'Zoológico',
  aquarium: 'Acuario', theme_park: 'Parque temático', beach: 'Playa', restaurant: 'Restaurante', cafe: 'Cafetería',
  bar: 'Bar', pub: 'Bar', hotel: 'Hotel', hostel: 'Hostal', guest_house: 'Alojamiento', place_of_worship: 'Templo',
  church: 'Iglesia', cathedral: 'Catedral', castle: 'Castillo', monument: 'Monumento', memorial: 'Monumento',
  marketplace: 'Mercado', mall: 'Centro comercial', stadium: 'Estadio', theatre: 'Teatro', square: 'Plaza',
  station: 'Estación', bus_station: 'Estación de buses', aerodrome: 'Aeropuerto', island: 'Isla', peak: 'Montaña',
  city: 'Ciudad', town: 'Pueblo', village: 'Pueblo', suburb: 'Barrio', neighbourhood: 'Barrio'
};

/* Ciudades frecuentes con sus codigos (IATA y abreviaturas habituales) */
const city = (name, region, country, codes, lat, lon) => ({ name, region, country, codes, lat, lon });

export const CITY_CODES = [
  // Colombia
  city('Bogotá', 'Bogotá D.C.', 'Colombia', ['BOG'], 4.711, -74.072),
  city('Medellín', 'Antioquia', 'Colombia', ['MDE', 'MED'], 6.244, -75.581),
  city('Cali', 'Valle del Cauca', 'Colombia', ['CLO', 'CAL'], 3.452, -76.532),
  city('Cartagena de Indias', 'Bolívar', 'Colombia', ['CTG', 'CTGENA'], 10.391, -75.479),
  city('Barranquilla', 'Atlántico', 'Colombia', ['BAQ', 'BQUILLA'], 10.964, -74.796),
  city('Santa Marta', 'Magdalena', 'Colombia', ['SMR', 'SMA'], 11.241, -74.199),
  city('San Andrés', 'San Andrés y Providencia', 'Colombia', ['ADZ', 'SAI'], 12.584, -81.701),
  city('Bucaramanga', 'Santander', 'Colombia', ['BGA'], 7.119, -73.123),
  city('Pereira', 'Risaralda', 'Colombia', ['PEI'], 4.813, -75.696),
  city('Manizales', 'Caldas', 'Colombia', ['MZL'], 5.070, -75.517),
  city('Armenia', 'Quindío', 'Colombia', ['AXM'], 4.534, -75.681),
  city('Cúcuta', 'Norte de Santander', 'Colombia', ['CUC'], 7.894, -72.504),
  city('Villavicencio', 'Meta', 'Colombia', ['VVC'], 4.142, -73.627),
  city('Leticia', 'Amazonas', 'Colombia', ['LET'], -4.215, -69.941),
  city('Valledupar', 'Cesar', 'Colombia', ['VUP'], 10.463, -73.253),
  city('Pasto', 'Nariño', 'Colombia', ['PSO'], 1.214, -77.281),
  city('Popayán', 'Cauca', 'Colombia', ['PPN'], 2.444, -76.615),
  city('Montería', 'Córdoba', 'Colombia', ['MTR'], 8.748, -75.881),
  city('Ibagué', 'Tolima', 'Colombia', ['IBE'], 4.439, -75.232),
  city('Neiva', 'Huila', 'Colombia', ['NVA'], 2.927, -75.282),
  city('Riohacha', 'La Guajira', 'Colombia', ['RCH'], 11.544, -72.907),
  // Latinoamerica y Caribe
  city('Ciudad de México', 'CDMX', 'México', ['MEX', 'CDMX', 'DF'], 19.433, -99.133),
  city('Cancún', 'Quintana Roo', 'México', ['CUN'], 21.162, -86.852),
  city('Tulum', 'Quintana Roo', 'México', ['TQO'], 20.211, -87.465),
  city('Guadalajara', 'Jalisco', 'México', ['GDL'], 20.659, -103.349),
  city('Monterrey', 'Nuevo León', 'México', ['MTY'], 25.686, -100.316),
  city('Lima', 'Lima', 'Perú', ['LIM'], -12.046, -77.043),
  city('Cusco', 'Cusco', 'Perú', ['CUZ'], -13.532, -71.967),
  city('Arequipa', 'Arequipa', 'Perú', ['AQP'], -16.409, -71.537),
  city('Quito', 'Pichincha', 'Ecuador', ['UIO'], -0.181, -78.468),
  city('Guayaquil', 'Guayas', 'Ecuador', ['GYE'], -2.171, -79.922),
  city('Santiago', 'Región Metropolitana', 'Chile', ['SCL', 'STGO'], -33.449, -70.669),
  city('Buenos Aires', 'Buenos Aires', 'Argentina', ['BUE', 'EZE', 'BA', 'CABA', 'BSAS'], -34.604, -58.382),
  city('Mendoza', 'Mendoza', 'Argentina', ['MDZ'], -32.890, -68.845),
  city('San Carlos de Bariloche', 'Río Negro', 'Argentina', ['BRC'], -41.134, -71.310),
  city('Montevideo', 'Montevideo', 'Uruguay', ['MVD'], -34.901, -56.164),
  city('Punta del Este', 'Maldonado', 'Uruguay', ['PDP'], -34.962, -54.952),
  city('Río de Janeiro', 'Río de Janeiro', 'Brasil', ['RIO', 'GIG'], -22.907, -43.173),
  city('São Paulo', 'São Paulo', 'Brasil', ['SAO', 'GRU', 'SP'], -23.551, -46.633),
  city('Ciudad de Panamá', 'Panamá', 'Panamá', ['PTY'], 8.983, -79.520),
  city('San José', 'San José', 'Costa Rica', ['SJO'], 9.928, -84.091),
  city('Punta Cana', 'La Altagracia', 'República Dominicana', ['PUJ'], 18.582, -68.405),
  city('Santo Domingo', 'Distrito Nacional', 'República Dominicana', ['SDQ'], 18.486, -69.931),
  city('La Habana', 'La Habana', 'Cuba', ['HAV'], 23.113, -82.366),
  city('San Juan', 'Puerto Rico', 'Estados Unidos', ['SJU'], 18.466, -66.106),
  city('Caracas', 'Distrito Capital', 'Venezuela', ['CCS'], 10.481, -66.904),
  city('La Paz', 'La Paz', 'Bolivia', ['LPB'], -16.490, -68.119),
  city('Ciudad de Guatemala', 'Guatemala', 'Guatemala', ['GUA'], 14.634, -90.507),
  city('Oranjestad', 'Aruba', 'Aruba', ['AUA'], 12.524, -70.027),
  city('Willemstad', 'Curazao', 'Curazao', ['CUR'], 12.108, -68.935),
  // Estados Unidos y Canada
  city('Nueva York', 'Nueva York', 'Estados Unidos', ['NYC', 'NY', 'JFK'], 40.713, -74.006),
  city('Miami', 'Florida', 'Estados Unidos', ['MIA'], 25.762, -80.192),
  city('Orlando', 'Florida', 'Estados Unidos', ['MCO', 'ORL'], 28.538, -81.379),
  city('Los Ángeles', 'California', 'Estados Unidos', ['LAX', 'LA'], 34.052, -118.244),
  city('San Francisco', 'California', 'Estados Unidos', ['SFO', 'SF'], 37.775, -122.419),
  city('Las Vegas', 'Nevada', 'Estados Unidos', ['LAS', 'LV'], 36.170, -115.140),
  city('Chicago', 'Illinois', 'Estados Unidos', ['CHI', 'ORD'], 41.878, -87.630),
  city('Washington D. C.', 'Distrito de Columbia', 'Estados Unidos', ['WAS', 'DC'], 38.907, -77.037),
  city('Boston', 'Massachusetts', 'Estados Unidos', ['BOS'], 42.360, -71.059),
  city('Houston', 'Texas', 'Estados Unidos', ['HOU', 'IAH'], 29.760, -95.370),
  city('Filadelfia', 'Pensilvania', 'Estados Unidos', ['PHL', 'PHILLY'], 39.953, -75.165),
  city('Baltimore', 'Maryland', 'Estados Unidos', ['BWI', 'BAL'], 39.290, -76.612),
  city('Jim Thorpe', 'Pensilvania', 'Estados Unidos', [], 40.876, -75.732),
  city('Blue Mountain', 'Pensilvania', 'Estados Unidos', [], 40.811, -75.519),
  city('Toronto', 'Ontario', 'Canadá', ['YTO', 'YYZ'], 43.653, -79.383),
  city('Vancouver', 'Columbia Británica', 'Canadá', ['YVR'], 49.283, -123.121),
  city('Montreal', 'Quebec', 'Canadá', ['YMQ', 'YUL'], 45.502, -73.567),
  // Europa
  city('Madrid', 'Comunidad de Madrid', 'España', ['MAD'], 40.417, -3.704),
  city('Barcelona', 'Cataluña', 'España', ['BCN'], 41.387, 2.169),
  city('Sevilla', 'Andalucía', 'España', ['SVQ'], 37.389, -5.984),
  city('Valencia', 'Comunidad Valenciana', 'España', ['VLC'], 39.470, -0.376),
  city('París', 'Isla de Francia', 'Francia', ['PAR', 'CDG'], 48.857, 2.352),
  city('Londres', 'Inglaterra', 'Reino Unido', ['LON', 'LHR'], 51.507, -0.128),
  city('Roma', 'Lacio', 'Italia', ['ROM', 'FCO'], 41.903, 12.496),
  city('Milán', 'Lombardía', 'Italia', ['MIL', 'MXP'], 45.464, 9.190),
  city('Venecia', 'Véneto', 'Italia', ['VCE'], 45.441, 12.316),
  city('Florencia', 'Toscana', 'Italia', ['FLR'], 43.770, 11.256),
  city('Ámsterdam', 'Holanda Septentrional', 'Países Bajos', ['AMS'], 52.368, 4.904),
  city('Lisboa', 'Lisboa', 'Portugal', ['LIS'], 38.722, -9.139),
  city('Oporto', 'Oporto', 'Portugal', ['OPO'], 41.158, -8.629),
  city('Berlín', 'Berlín', 'Alemania', ['BER'], 52.520, 13.405),
  city('Múnich', 'Baviera', 'Alemania', ['MUC'], 48.135, 11.582),
  city('Praga', 'Bohemia', 'República Checa', ['PRG'], 50.076, 14.438),
  city('Viena', 'Viena', 'Austria', ['VIE'], 48.208, 16.374),
  city('Atenas', 'Ática', 'Grecia', ['ATH'], 37.984, 23.728),
  city('Estambul', 'Estambul', 'Turquía', ['IST'], 41.008, 28.978),
  city('Dublín', 'Leinster', 'Irlanda', ['DUB'], 53.350, -6.260),
  city('Zúrich', 'Zúrich', 'Suiza', ['ZRH'], 47.377, 8.542),
  city('Bruselas', 'Bruselas', 'Bélgica', ['BRU'], 50.850, 4.352),
  // Asia, Oceania y Africa
  city('Tokio', 'Tokio', 'Japón', ['TYO', 'HND', 'NRT'], 35.676, 139.650),
  city('Kioto', 'Kioto', 'Japón', ['UKY'], 35.012, 135.768),
  city('Seúl', 'Seúl', 'Corea del Sur', ['SEL', 'ICN'], 37.567, 126.978),
  city('Bangkok', 'Bangkok', 'Tailandia', ['BKK'], 13.756, 100.502),
  city('Singapur', 'Singapur', 'Singapur', ['SIN'], 1.352, 103.820),
  city('Dubái', 'Dubái', 'Emiratos Árabes Unidos', ['DXB'], 25.205, 55.271),
  city('Pekín', 'Pekín', 'China', ['BJS', 'PEK'], 39.904, 116.407),
  city('Shanghái', 'Shanghái', 'China', ['SHA', 'PVG'], 31.230, 121.474),
  city('Hong Kong', 'Hong Kong', 'China', ['HKG'], 22.320, 114.169),
  city('Bali (Denpasar)', 'Bali', 'Indonesia', ['DPS', 'BALI'], -8.650, 115.216),
  city('Sídney', 'Nueva Gales del Sur', 'Australia', ['SYD'], -33.869, 151.209),
  city('Melbourne', 'Victoria', 'Australia', ['MEL'], -37.814, 144.963),
  city('El Cairo', 'El Cairo', 'Egipto', ['CAI'], 30.044, 31.236),
  city('Marrakech', 'Marrakech-Safí', 'Marruecos', ['RAK'], 31.630, -7.981),
  city('Ciudad del Cabo', 'Cabo Occidental', 'Sudáfrica', ['CPT'], -33.925, 18.424)
];

/* ---- Ayudantes ---- */

export function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function distanceKm(latA, lonA, latB, lonB) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = toRad(latB - latA);
  const deltaLon = toRad(lonB - lonA);
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function cleanRegion(region) {
  return String(region || '').replace(ADMIN_PREFIX, '').trim();
}

function fromLocal(entry, code = '') {
  return {
    name: entry.name,
    detail: [entry.region !== entry.name ? entry.region : '', entry.country].filter(Boolean).join(', '),
    value: `${entry.name}, ${entry.country}`,
    code,
    lat: entry.lat,
    lon: entry.lon
  };
}

function isDuplicate(list, item) {
  return list.some((other) => distanceKm(other.lat, other.lon, item.lat, item.lon) < SAME_PLACE_KM && normalize(other.name).slice(0, 4) === normalize(item.name).slice(0, 4));
}

/* Para lugares: mismo nombre y a menos de 2 km (dos museos distintos de una ciudad no se confunden) */
function isSamePlace(list, item) {
  return list.some((other) => normalize(other.name) === normalize(item.name) && distanceKm(other.lat, other.lon, item.lat, item.lon) < 2);
}

/* ---- Ciudades ---- */

function localCities(query) {
  const text = normalize(query);
  const code = text.replace(/[\s.]/g, '').toUpperCase();
  const byCode = CITY_CODES.filter((entry) => entry.codes.includes(code)).map((entry) => fromLocal(entry, code));
  const byName = text.length < 2 ? [] : CITY_CODES
    .filter((entry) => !entry.codes.includes(code))
    .filter((entry) => normalize(entry.name).split(/[\s(),.-]+/).some((word) => word.startsWith(text)) || normalize(entry.name).startsWith(text))
    .map((entry) => fromLocal(entry));
  return { byCode, byName };
}

async function remoteCities(query, signal) {
  if (normalize(query).length < 2) return [];
  const params = new URLSearchParams({ name: query.trim(), count: '8', language: 'es', format: 'json' });
  const response = await fetch(`${CITY_URL}?${params}`, { signal });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.results || []).map((result) => {
    const region = cleanRegion(result.admin1);
    const isAirport = result.feature_code === 'AIRP';
    return {
      name: result.name,
      detail: [isAirport ? 'Aeropuerto' : '', region !== result.name ? region : '', result.country].filter(Boolean).join(', '),
      value: `${result.name}, ${result.country || ''}`.replace(/, $/, ''),
      code: '',
      icon: isAirport ? 'plane' : 'pin',
      lat: result.latitude,
      lon: result.longitude
    };
  });
}

/* Sugerencias de ciudades: codigos exactos, luego ciudades frecuentes propias y despues el buscador mundial */
export async function suggestCities(query, { signal } = {}) {
  const { byCode, byName } = localCities(query);
  const remote = await remoteCities(query, signal).catch((error) => {
    if (error.name === 'AbortError') throw error;
    return [];
  });
  const results = [...byCode];
  for (const item of [...byName, ...remote]) {
    if (!isDuplicate(results, item)) results.push(item);
  }
  return results.slice(0, MAX_RESULTS);
}

/* La mejor coincidencia sin menu (por si se escribe la ciudad y se guarda sin elegir) */
export async function bestCity(query) {
  const [first] = await suggestCities(query).catch(() => []);
  return first || null;
}

/* ---- Lugares (museos, restaurantes, calles…) ---- */

function toPlace(feature) {
  const props = feature.properties || {};
  const [lon, lat] = feature.geometry?.coordinates || [];
  const type = PLACE_TYPES[props.osm_value] || '';
  const street = [props.street, props.housenumber].filter(Boolean).join(' ');
  const area = props.city || props.town || props.village || props.county || props.state || '';
  const name = props.name || street || area;
  return {
    name,
    detail: [type, street && street !== name ? street : '', area && area !== name ? area : '', props.country].filter(Boolean).join(' · '),
    value: [name, area && area !== name ? area : ''].filter(Boolean).join(', '),
    code: '',
    icon: props.osm_key === 'aeroway' ? 'plane' : 'compass',
    lat,
    lon
  };
}

async function photon(params, signal) {
  const response = await fetch(`${PLACE_URL}?${params}`, { signal });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.features || []).map(toPlace).filter((item) => item.name && item.lat != null);
}

/*
 * Lugares: si el viaje tiene destino, primero se busca DENTRO de su zona (unos 60 km)
 * y despues en el resto del mundo. Asi "museo de arte moderno" en un viaje a Nueva York
 * sugiere el MoMA y no el de Ciudad de Mexico.
 */
export async function suggestPlaces(query, { near, signal } = {}) {
  if (normalize(query).length < 3) return [];
  const text = query.trim();
  const hasNear = near?.lat != null && near?.lon != null;
  let nearby = [];
  if (hasNear) {
    const latSpan = NEAR_BOX_DEGREES;
    const lonSpan = NEAR_BOX_DEGREES / Math.max(0.2, Math.cos((near.lat * Math.PI) / 180));
    const box = [near.lon - lonSpan, near.lat - latSpan, near.lon + lonSpan, near.lat + latSpan].map((value) => value.toFixed(4)).join(',');
    nearby = await photon(new URLSearchParams({ q: text, limit: '6', bbox: box }), signal);
  }
  if (nearby.length >= 5) return nearby.slice(0, MAX_RESULTS);
  const worldParams = new URLSearchParams({ q: text, limit: '7' });
  if (hasNear) {
    worldParams.set('lat', near.lat);
    worldParams.set('lon', near.lon);
  }
  const world = await photon(worldParams, signal);
  const results = [...nearby];
  for (const item of world) {
    if (!isSamePlace(results, item)) results.push(item);
  }
  return results.slice(0, MAX_RESULTS);
}

/* Ciudad conocida mas cercana (para poner nombre a un punto del mapa) */
export function nearestCityName(lat, lon, maxKm = 40) {
  let best = null;
  let bestKm = Infinity;
  for (const entry of CITY_CODES) {
    const km = distanceKm(lat, lon, entry.lat, entry.lon);
    if (km < bestKm) {
      best = entry;
      bestKm = km;
    }
  }
  return best && bestKm <= maxKm ? best.name : '';
}
