/*
 * Recomendaciones: top de planes mas visitados por ciudad.
 * - Ciudades conocidas: lista ordenada de las atracciones mas visitadas (wiki = titulo en es.wikipedia).
 *   Foto, resumen y coordenadas se cargan de la API de Wikipedia.
 * - Cualquier otra zona: se buscan en Wikidata los lugares turisticos cercanos y se ordenan por popularidad
 *   (en cuantas Wikipedias del mundo aparecen).
 */

const WIKI_API_URL = 'https://es.wikipedia.org/w/api.php';
const SPARQL_URL = 'https://query.wikidata.org/sparql?format=json&query=';
const CACHE_PREFIX = 'foxtrips:reco:';
const CACHE_TTL = 30 * 86400000;
const NEAR_KM = 45;
const SPARQL_TIMEOUT_MS = 20000;
const TOURIST_WORDS = /museo|parque|plaza|catedral|iglesia|bas[ií]lica|santuario|templo|monumento|mirador|teatro|zool[oó]gico|acuario|jard[ií]n|playa|castillo|fuerte|fortaleza|cerro|monta[nñ]a|volc[aá]n|cascada|lago|laguna|puente|estadio|mercado|malec[oó]n|sitio arqueol|ruinas|palacio|torre|faro|reserva natural|centro hist[oó]rico|barrio hist[oó]rico/i;
const EXCLUDED_WORDS = /estaci[oó]n de|aeropuerto|universidad|colegio|escuela|hospital|empresa|club de f[uú]tbol|equipo|municipio|corregimiento|comuna|localidad|distrito electoral/i;
const PLACE_TYPES = ['Q570116', 'Q33506', 'Q207694', 'Q22698', 'Q22746', 'Q11303', 'Q4989906', 'Q179700', 'Q12280', 'Q16970',
  'Q2977', 'Q174782', 'Q1440300', 'Q2319498', 'Q16560', 'Q23413', 'Q43501', 'Q167346', 'Q24354', 'Q40080', 'Q1081138',
  'Q194195', 'Q2281788', 'Q12518', 'Q44539', 'Q32815', 'Q163687', 'Q1107656', 'Q860861', 'Q5003624', 'Q46169', 'Q8502'];

export const CATEGORIES = {
  monumento: { label: 'Monumento', icon: 'star' },
  museo: { label: 'Museo', icon: 'image' },
  parque: { label: 'Parque', icon: 'sun' },
  mirador: { label: 'Mirador', icon: 'eye' },
  barrio: { label: 'Barrio', icon: 'pin' },
  playa: { label: 'Playa', icon: 'sun' },
  excursion: { label: 'Excursión', icon: 'compass' },
  ocio: { label: 'Ocio', icon: 'heart' },
  lugar: { label: 'Lugar de interés', icon: 'pin' }
};

const place = (wiki, name, category, tip) => ({ wiki, name, category, tip });

export const CITIES = [
  {
    key: 'nueva-york', name: 'Nueva York', country: 'Estados Unidos', lat: 40.7128, lon: -74.006,
    aliases: ['new york', 'nyc', 'manhattan', 'brooklyn'],
    places: [
      place('Central Park', 'Central Park', 'parque', 'Alquila una bici o recorre a pie desde la calle 59 hasta Bow Bridge.'),
      place('Times Square', 'Times Square', 'barrio', 'Ve de noche, cuando se encienden todas las pantallas.'),
      place('Estatua de la Libertad', 'Estatua de la Libertad', 'monumento', 'Reserva el ferry con antelación; el gratuito a Staten Island también la ve de cerca.'),
      place('Puente de Brooklyn', 'Puente de Brooklyn', 'mirador', 'Crúzalo de Brooklyn a Manhattan para tener el skyline de frente.'),
      place('Empire State Building', 'Empire State Building', 'mirador', 'Al atardecer hay más cola, pero las vistas valen la pena.'),
      place('Museo Metropolitano de Arte', 'Museo Metropolitano de Arte (MET)', 'museo', 'Calcula al menos tres horas; la azotea abre en verano.'),
      place('High Line (Nueva York)', 'High Line', 'parque', 'Termina en Hudson Yards y el mirador The Edge.'),
      place('National September 11 Memorial & Museum', 'Memorial del 11-S', 'monumento', 'El memorial exterior es gratuito.')
    ]
  },
  {
    key: 'paris', name: 'París', country: 'Francia', lat: 48.8566, lon: 2.3522, aliases: ['paris'],
    places: [
      place('Torre Eiffel', 'Torre Eiffel', 'mirador', 'Compra la entrada online y sube al atardecer.'),
      place('Museo del Louvre', 'Museo del Louvre', 'museo', 'Reserva hora; los miércoles y viernes abre hasta tarde.'),
      place('Catedral de Notre Dame de París', 'Catedral de Notre Dame', 'monumento', 'Reabrió en 2024; la entrada es gratuita con reserva.'),
      place('Basílica del Sacré Cœur', 'Sacré-Cœur y Montmartre', 'mirador', 'Sube a pie por las escaleras y pierde tiempo por Montmartre.'),
      place('Arco de Triunfo de París', 'Arco de Triunfo', 'monumento', 'Desde arriba se ven los Campos Elíseos y la Torre Eiffel.'),
      place('Museo de Orsay', 'Museo de Orsay', 'museo', 'La mayor colección impresionista del mundo.'),
      place('Palacio de Versalles', 'Palacio de Versalles', 'excursion', 'Media jornada en tren RER C; evita los lunes (cerrado).')
    ]
  },
  {
    key: 'londres', name: 'Londres', country: 'Reino Unido', lat: 51.5074, lon: -0.1278, aliases: ['london'],
    places: [
      place('Museo Británico', 'Museo Británico', 'museo', 'Gratis; no te pierdas la piedra de Rosetta.'),
      place('Torre de Londres', 'Torre de Londres', 'monumento', 'Las joyas de la Corona se ven mejor a primera hora.'),
      place('Palacio de Westminster', 'Big Ben y Parlamento', 'monumento', 'Cruza el puente de Westminster para la mejor foto.'),
      place('London Eye', 'London Eye', 'mirador', 'Compra la entrada con hora para evitar la cola.'),
      place('Palacio de Buckingham', 'Palacio de Buckingham', 'monumento', 'Consulta los días del cambio de guardia.'),
      place('Tower Bridge', 'Tower Bridge', 'mirador', 'La pasarela superior tiene suelo de cristal.'),
      place('National Gallery', 'National Gallery', 'museo', 'Gratis, en plena Trafalgar Square.')
    ]
  },
  {
    key: 'roma', name: 'Roma', country: 'Italia', lat: 41.9028, lon: 12.4964, aliases: ['rome'],
    places: [
      place('Coliseo', 'Coliseo', 'monumento', 'La entrada incluye el Foro Romano y el Palatino.'),
      place('Fontana de Trevi', 'Fontana de Trevi', 'monumento', 'Ve muy temprano o muy tarde para evitar multitudes.'),
      place('Panteón de Agripa', 'Panteón', 'monumento', 'Fíjate en la luz que entra por el óculo a mediodía.'),
      place('Museos Vaticanos', 'Museos Vaticanos y Capilla Sixtina', 'museo', 'Reserva online; el último domingo del mes es gratis.'),
      place('Basílica de San Pedro', 'Basílica de San Pedro', 'monumento', 'Se pide hombros y rodillas cubiertos.'),
      place('Plaza Navona', 'Plaza Navona', 'barrio', 'Ideal para un helado al atardecer.')
    ]
  },
  {
    key: 'madrid', name: 'Madrid', country: 'España', lat: 40.4168, lon: -3.7038, aliases: [],
    places: [
      place('Museo del Prado', 'Museo del Prado', 'museo', 'Gratis las dos últimas horas de cada día.'),
      place('Palacio Real de Madrid', 'Palacio Real', 'monumento', 'Junto a los jardines de Sabatini y la catedral de la Almudena.'),
      place('Parque del Buen Retiro', 'Parque del Retiro', 'parque', 'Alquila una barca en el estanque grande.'),
      place('Plaza Mayor (Madrid)', 'Plaza Mayor', 'barrio', 'Prueba el bocadillo de calamares en las calles cercanas.'),
      place('Museo Nacional Centro de Arte Reina Sofía', 'Museo Reina Sofía', 'museo', 'Aquí está el Guernica de Picasso.'),
      place('Estadio Santiago Bernabéu', 'Estadio Santiago Bernabéu', 'ocio', 'El tour incluye vestuarios y museo del club.')
    ]
  },
  {
    key: 'barcelona', name: 'Barcelona', country: 'España', lat: 41.3874, lon: 2.1686, aliases: [],
    places: [
      place('Templo Expiatorio de la Sagrada Familia', 'Sagrada Familia', 'monumento', 'Reserva con semanas de antelación.'),
      place('Parque Güell', 'Park Güell', 'parque', 'La zona monumental necesita entrada con hora.'),
      place('Casa Batlló', 'Casa Batlló', 'monumento', 'De noche hay visitas con música en la azotea.'),
      place('La Rambla', 'La Rambla y La Boqueria', 'barrio', 'Cuida tus pertenencias; entra al mercado de La Boqueria.'),
      place('Barrio Gótico (Barcelona)', 'Barrio Gótico', 'barrio', 'Piérdete por sus callejuelas hasta la catedral.'),
      place('Casa Milà', 'La Pedrera', 'monumento', 'La azotea con chimeneas es lo más especial.')
    ]
  },
  {
    key: 'ciudad-de-mexico', name: 'Ciudad de México', country: 'México', lat: 19.4326, lon: -99.1332, aliases: ['cdmx', 'mexico df', 'df'],
    places: [
      place('Museo Nacional de Antropología (México)', 'Museo Nacional de Antropología', 'museo', 'No te pierdas la Piedra del Sol.'),
      place('Plaza de la Constitución (Ciudad de México)', 'Zócalo y Centro Histórico', 'barrio', 'Junto a la Catedral y el Templo Mayor.'),
      place('Palacio de Bellas Artes (Ciudad de México)', 'Palacio de Bellas Artes', 'monumento', 'Las mejores vistas desde la terraza de Sears enfrente.'),
      place('Bosque de Chapultepec', 'Bosque de Chapultepec', 'parque', 'Sube al Castillo de Chapultepec.'),
      place('Teotihuacán', 'Teotihuacán', 'excursion', 'Sal temprano para subir a las pirámides con menos calor.'),
      place('Museo Frida Kahlo', 'Casa Azul de Frida Kahlo', 'museo', 'Compra la entrada online, se agota.'),
      place('Xochimilco', 'Xochimilco', 'ocio', 'Comparte trajinera con tu grupo; mejor un fin de semana.')
    ]
  },
  {
    key: 'cancun', name: 'Cancún', country: 'México', lat: 21.1619, lon: -86.8515, aliases: ['cancun', 'riviera maya', 'playa del carmen'],
    places: [
      place('Chichén Itzá', 'Chichén Itzá', 'excursion', 'Unas 2,5 horas en coche; llega a la apertura.'),
      place('Isla Mujeres', 'Isla Mujeres', 'playa', 'Ferry desde Puerto Juárez; alquila un carrito de golf.'),
      place('Tulum', 'Ruinas de Tulum', 'excursion', 'Ruinas mayas frente al mar Caribe.'),
      place('Xcaret', 'Parque Xcaret', 'ocio', 'Quédate al espectáculo de la noche.'),
      place('Museo Subacuático de Arte', 'Museo Subacuático de Arte', 'excursion', 'Se visita con snorkel o buceo.')
    ]
  },
  {
    key: 'bogota', name: 'Bogotá', country: 'Colombia', lat: 4.711, lon: -74.0721, aliases: ['bogota'],
    places: [
      place('Museo del Oro', 'Museo del Oro', 'museo', 'Los domingos la entrada es gratis.'),
      place('Cerro de Monserrate', 'Cerro de Monserrate', 'mirador', 'Sube en teleférico y baja en funicular.'),
      place('La Candelaria', 'La Candelaria', 'barrio', 'Haz el tour de grafiti y prueba un chocolate santafereño.'),
      place('Museo Botero', 'Museo Botero', 'museo', 'Gratis, en pleno centro histórico.'),
      place('Catedral de Sal', 'Catedral de Sal de Zipaquirá', 'excursion', 'A una hora; el Tren de la Sabana va los fines de semana.'),
      place('Plaza de Bolívar (Bogotá)', 'Plaza de Bolívar', 'monumento', 'Rodeada por la Catedral y el Capitolio.')
    ]
  },
  {
    key: 'medellin', name: 'Medellín', country: 'Colombia', lat: 6.2442, lon: -75.5812, aliases: ['medellin'],
    places: [
      place('Comuna 13 (Medellín)', 'Comuna 13', 'barrio', 'Haz el graffitour con un guía local.'),
      place('Plaza Botero', 'Plaza Botero', 'monumento', 'Junto al Museo de Antioquia.'),
      place('Parque Arví', 'Parque Arví', 'parque', 'Se llega en el Metrocable línea L.'),
      place('Metrocable de Medellín', 'Metrocable', 'mirador', 'Las mejores vistas del valle por el precio de un pasaje.'),
      place('Piedra del Peñol', 'Piedra del Peñol y Guatapé', 'excursion', 'Son unos 740 escalones; combínalo con Guatapé.')
    ]
  },
  {
    key: 'cali', name: 'Cali', country: 'Colombia', lat: 3.4516, lon: -76.532, aliases: ['santiago de cali'],
    places: [
      place('Monumento a Cristo Rey (Cali)', 'Cristo Rey', 'mirador', 'Sube al atardecer para ver toda la ciudad iluminarse.'),
      place('Barrio San Antonio (Cali)', 'Barrio San Antonio', 'barrio', 'Casas coloniales, cafés y el mirador de la colina.'),
      place('Zoológico de Cali', 'Zoológico de Cali', 'parque', 'Uno de los mejores zoológicos de Latinoamérica.'),
      place('Cerro de las Tres Cruces', 'Cerro de las Tres Cruces', 'excursion', 'Caminata temprano por la mañana, muy popular los fines de semana.'),
      place('Iglesia la Ermita (Cali)', 'Iglesia La Ermita', 'monumento', 'Junto al Bulevar del Río; de noche luce iluminada.'),
      place('Museo La Tertulia', 'Museo La Tertulia', 'museo', 'Arte moderno junto al río Cali.')
    ]
  },
  {
    key: 'cartagena', name: 'Cartagena', country: 'Colombia', lat: 10.391, lon: -75.4794, aliases: ['cartagena de indias'],
    places: [
      place('Puerto, fortalezas y conjunto monumental de Cartagena', 'Ciudad amurallada', 'barrio', 'Camina sobre la muralla al atardecer y cena en el vecino barrio de Getsemaní.'),
      place('Castillo San Felipe de Barajas', 'Castillo San Felipe de Barajas', 'monumento', 'Ve temprano: no hay casi sombra.'),
      place('Cerro de La Popa', 'Cerro de La Popa', 'mirador', 'Las mejores vistas de la ciudad; sube en taxi.'),
      place('Islas del Rosario', 'Islas del Rosario', 'playa', 'Excursión de día completo en lancha.'),
      place('Torre del Reloj (Cartagena de Indias)', 'Torre del Reloj', 'monumento', 'La entrada principal a la ciudad amurallada.')
    ]
  },
  {
    key: 'santa-marta', name: 'Santa Marta', country: 'Colombia', lat: 11.2408, lon: -74.199, aliases: ['tayrona'],
    places: [
      place('Parque nacional natural Tayrona', 'Parque Tayrona', 'playa', 'Cierra unos días al año; consulta antes de ir.'),
      place('Ciudad Perdida', 'Ciudad Perdida', 'excursion', 'Trekking de 4 a 5 días con guía.'),
      place('Minca', 'Minca', 'excursion', 'Pueblo en la Sierra Nevada con cascadas y café.'),
      place('Quinta de San Pedro Alejandrino', 'Quinta de San Pedro Alejandrino', 'museo', 'Donde murió Simón Bolívar.'),
      place('Taganga', 'Taganga', 'playa', 'Buen lugar para bucear o ver el atardecer.')
    ]
  },
  {
    key: 'buenos-aires', name: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lon: -58.3816, aliases: ['caba'],
    places: [
      place('Caminito', 'Caminito (La Boca)', 'barrio', 'Ve de día; cerca está La Bombonera.'),
      place('Cementerio de la Recoleta', 'Cementerio de la Recoleta', 'monumento', 'Aquí está la tumba de Evita.'),
      place('Teatro Colón', 'Teatro Colón', 'monumento', 'Hay visitas guiadas en español todo el día.'),
      place('Obelisco de Buenos Aires', 'Obelisco', 'monumento', 'En la avenida 9 de Julio.'),
      place('Plaza de Mayo', 'Plaza de Mayo y Casa Rosada', 'barrio', 'La Casa Rosada abre los fines de semana con reserva.'),
      place('Puerto Madero', 'Puerto Madero', 'barrio', 'Paseo junto al río y el Puente de la Mujer.')
    ]
  },
  {
    key: 'lima', name: 'Lima', country: 'Perú', lat: -12.0464, lon: -77.0428, aliases: [],
    places: [
      place('Centro histórico de Lima', 'Centro histórico', 'barrio', 'Plaza de Armas, catedral y catacumbas de San Francisco.'),
      place('Distrito de Miraflores (Lima)', 'Miraflores y el Malecón', 'barrio', 'Pasea por el Parque del Amor frente al Pacífico.'),
      place('Huaca Pucllana', 'Huaca Pucllana', 'monumento', 'Pirámide preinca en medio de Miraflores.'),
      place('Museo Larco', 'Museo Larco', 'museo', 'Su restaurante en el jardín es muy recomendable.'),
      place('Distrito de Barranco', 'Barranco', 'barrio', 'Cruza el Puente de los Suspiros y ve el atardecer.')
    ]
  },
  {
    key: 'cusco', name: 'Cusco', country: 'Perú', lat: -13.532, lon: -71.9675, aliases: ['cuzco', 'machu picchu'],
    places: [
      place('Machu Picchu', 'Machu Picchu', 'excursion', 'Las entradas tienen cupo diario: compra con meses de antelación.'),
      place('Valle Sagrado de los Incas', 'Valle Sagrado', 'excursion', 'Pisac, Ollantaytambo y Moray en un día.'),
      place('Sacsayhuamán', 'Sacsayhuamán', 'monumento', 'A pocos minutos del centro; ideal para aclimatarse.'),
      place('Vinicunca', 'Montaña de Siete Colores', 'excursion', 'Está a más de 5000 m: aclimátate antes.'),
      place('Coricancha', 'Qorikancha', 'monumento', 'El templo inca bajo el convento de Santo Domingo.')
    ]
  },
  {
    key: 'santiago', name: 'Santiago de Chile', country: 'Chile', lat: -33.4489, lon: -70.6693, aliases: ['santiago'],
    places: [
      place('Cerro San Cristóbal (Chile)', 'Cerro San Cristóbal', 'mirador', 'Sube en funicular y baja en teleférico.'),
      place('Plaza de Armas de Santiago', 'Plaza de Armas', 'barrio', 'Junto a la Catedral y el Museo Histórico Nacional.'),
      place('Palacio de La Moneda', 'Palacio de La Moneda', 'monumento', 'Consulta los horarios del cambio de guardia.'),
      place('Gran Torre Santiago', 'Sky Costanera', 'mirador', 'El mirador más alto de Sudamérica.'),
      place('Cerro Santa Lucía', 'Cerro Santa Lucía', 'parque', 'Gratis, en pleno centro.')
    ]
  },
  {
    key: 'rio', name: 'Río de Janeiro', country: 'Brasil', lat: -22.9068, lon: -43.1729, aliases: ['rio de janeiro', 'rio'],
    places: [
      place('Cristo Redentor', 'Cristo Redentor', 'mirador', 'Sube en el tren del Corcovado a primera hora.'),
      place('Pan de Azúcar (Brasil)', 'Pan de Azúcar', 'mirador', 'Ve al atardecer en el teleférico.'),
      place('Copacabana (Río de Janeiro)', 'Playa de Copacabana', 'playa', 'Pasea por su famoso paseo marítimo ondulado.'),
      place('Escalera de Selarón', 'Escalera Selarón', 'monumento', 'Entre los barrios de Lapa y Santa Teresa.'),
      place('Estadio Maracaná', 'Estadio Maracaná', 'ocio', 'Hay tours guiados cuando no hay partido.')
    ]
  },
  {
    key: 'miami', name: 'Miami', country: 'Estados Unidos', lat: 25.7617, lon: -80.1918, aliases: ['miami beach'],
    places: [
      place('Miami Beach', 'Miami Beach y South Beach', 'playa', 'Ocean Drive por la noche y playa por la mañana.'),
      place('Distrito histórico arquitectónico de Miami Beach', 'Distrito Art Déco', 'barrio', 'Hay tours a pie por los edificios de colores.'),
      place('Wynwood', 'Wynwood Walls', 'barrio', 'El mayor museo de grafiti al aire libre.'),
      place('Pequeña Habana', 'Little Havana', 'barrio', 'Calle Ocho, dominó y café cubano.'),
      place('Parque nacional de los Everglades', 'Everglades', 'excursion', 'Paseo en hidrodeslizador para ver caimanes.')
    ]
  },
  {
    key: 'orlando', name: 'Orlando', country: 'Estados Unidos', lat: 28.5383, lon: -81.3792, aliases: ['disney world', 'walt disney world'],
    places: [
      place('Magic Kingdom', 'Magic Kingdom', 'ocio', 'Llega a la apertura y quédate a los fuegos artificiales.'),
      place('Universal Studios Florida', 'Universal Studios', 'ocio', 'El mundo de Harry Potter conecta con Islands of Adventure.'),
      place('Epcot', 'EPCOT', 'ocio', 'El World Showcase es ideal para cenar.'),
      place("Disney's Animal Kingdom", 'Animal Kingdom', 'ocio', 'Haz el safari temprano, cuando los animales están activos.'),
      place('Centro espacial John F. Kennedy', 'Kennedy Space Center', 'excursion', 'A una hora; consulta si hay lanzamientos.')
    ]
  },
  {
    key: 'los-angeles', name: 'Los Ángeles', country: 'Estados Unidos', lat: 34.0522, lon: -118.2437, aliases: ['los angeles', 'la', 'hollywood'],
    places: [
      place('Paseo de la Fama de Hollywood', 'Paseo de la Fama', 'barrio', 'Junto al TCL Chinese Theatre.'),
      place('Letrero de Hollywood', 'Letrero de Hollywood', 'mirador', 'La mejor vista es desde el Observatorio Griffith.'),
      place('Observatorio Griffith', 'Observatorio Griffith', 'mirador', 'Gratis; ve al atardecer.'),
      place('Muelle de Santa Mónica', 'Muelle de Santa Mónica', 'playa', 'Sigue a pie hasta Venice Beach.'),
      place('Universal Studios Hollywood', 'Universal Studios Hollywood', 'ocio', 'El Studio Tour es lo imprescindible.')
    ]
  },
  {
    key: 'las-vegas', name: 'Las Vegas', country: 'Estados Unidos', lat: 36.1699, lon: -115.1398, aliases: ['vegas'],
    places: [
      place('Las Vegas Strip', 'The Strip', 'barrio', 'Recórrelo de noche; las fuentes del Bellagio son gratis.'),
      place('Fremont Street Experience', 'Fremont Street', 'ocio', 'El techo de luces y la tirolina SlotZilla.'),
      place('Gran Cañón del Colorado', 'Gran Cañón', 'excursion', 'Excursión de día completo o en helicóptero.'),
      place('Presa Hoover', 'Presa Hoover', 'excursion', 'A 45 minutos; combínala con el Gran Cañón.'),
      place('Esfera en The Venetian Resort', 'Sphere', 'ocio', 'Espectáculos inmersivos en la esfera gigante.')
    ]
  },
  {
    key: 'san-francisco', name: 'San Francisco', country: 'Estados Unidos', lat: 37.7749, lon: -122.4194, aliases: [],
    places: [
      place('Puente Golden Gate', 'Golden Gate', 'mirador', 'Crúzalo en bici y vuelve en ferry desde Sausalito.'),
      place('Isla de Alcatraz', 'Alcatraz', 'excursion', 'Reserva el ferry con semanas de antelación.'),
      place("Fisherman's Wharf", "Fisherman's Wharf y Pier 39", 'barrio', 'Ve a los leones marinos del Pier 39.'),
      place('Funicular de San Francisco', 'Cable car', 'ocio', 'La línea Powell-Hyde tiene las mejores vistas.'),
      place('Lombard Street (San Francisco)', 'Lombard Street', 'barrio', 'La calle más sinuosa del mundo.')
    ]
  },
  {
    key: 'tokio', name: 'Tokio', country: 'Japón', lat: 35.6762, lon: 139.6503, aliases: ['tokyo'],
    places: [
      place('Sensō-ji', 'Templo Sensō-ji (Asakusa)', 'monumento', 'Ve temprano y recorre la calle Nakamise.'),
      place('Cruce de Shibuya', 'Cruce de Shibuya', 'barrio', 'Míralo desde el mirador Shibuya Sky.'),
      place('Tokyo Skytree', 'Tokyo Skytree', 'mirador', 'En días claros se ve el monte Fuji.'),
      place('Santuario Meiji', 'Santuario Meiji', 'monumento', 'Junto al barrio de Harajuku.'),
      place('Mercado de pescado de Tsukiji', 'Mercado de Tsukiji', 'ocio', 'El mercado exterior es perfecto para desayunar sushi.')
    ]
  },
  {
    key: 'amsterdam', name: 'Ámsterdam', country: 'Países Bajos', lat: 52.3676, lon: 4.9041, aliases: ['amsterdam'],
    places: [
      place('Rijksmuseum', 'Rijksmuseum', 'museo', 'La ronda de noche de Rembrandt está aquí.'),
      place('Museo Van Gogh', 'Museo Van Gogh', 'museo', 'Solo con entrada online y hora.'),
      place('Casa de Ana Frank', 'Casa de Ana Frank', 'museo', 'Las entradas salen 6 semanas antes y se agotan.'),
      place('Canales de Ámsterdam', 'Canales de Ámsterdam', 'barrio', 'Un paseo en barco es la mejor forma de verlos.'),
      place('Vondelpark', 'Vondelpark', 'parque', 'Alquila una bici como un local.')
    ]
  },
  {
    key: 'lisboa', name: 'Lisboa', country: 'Portugal', lat: 38.7223, lon: -9.1393, aliases: ['lisbon'],
    places: [
      place('Torre de Belém', 'Torre de Belém', 'monumento', 'Prueba los pasteles de Belém justo al lado.'),
      place('Monasterio de los Jerónimos de Belém', 'Monasterio de los Jerónimos', 'monumento', 'Cerca de la Torre de Belém.'),
      place('Alfama', 'Alfama', 'barrio', 'Sube en el tranvía 28 y escucha fado por la noche.'),
      place('Castillo de San Jorge (Lisboa)', 'Castillo de San Jorge', 'mirador', 'Las mejores vistas de la ciudad.'),
      place('Plaza del Comercio', 'Plaza del Comercio', 'barrio', 'Frente al río Tajo.')
    ]
  },
  {
    key: 'berlin', name: 'Berlín', country: 'Alemania', lat: 52.52, lon: 13.405, aliases: ['berlin'],
    places: [
      place('Puerta de Brandeburgo', 'Puerta de Brandeburgo', 'monumento', 'Junto al Memorial del Holocausto.'),
      place('Edificio del Reichstag', 'Reichstag', 'mirador', 'La cúpula es gratis con reserva previa.'),
      place('Isla de los Museos', 'Isla de los Museos', 'museo', 'El Museo de Pérgamo y el busto de Nefertiti.'),
      place('East Side Gallery', 'East Side Gallery (Muro de Berlín)', 'monumento', 'El tramo más largo del muro, lleno de murales.'),
      place('Checkpoint Charlie', 'Checkpoint Charlie', 'monumento', 'Visítalo con el museo del Muro.')
    ]
  },
  {
    key: 'praga', name: 'Praga', country: 'República Checa', lat: 50.0755, lon: 14.4378, aliases: ['prague'],
    places: [
      place('Puente de Carlos', 'Puente de Carlos', 'monumento', 'Crúzalo al amanecer para tenerlo casi vacío.'),
      place('Castillo de Praga', 'Castillo de Praga', 'monumento', 'El mayor castillo antiguo del mundo.'),
      place('Reloj astronómico de Praga', 'Reloj astronómico', 'monumento', 'Cada hora en punto se mueven los apóstoles.'),
      place('Plaza de la Ciudad Vieja', 'Plaza de la Ciudad Vieja', 'barrio', 'Sube a la torre del Ayuntamiento para las vistas.'),
      place('Josefov', 'Barrio judío (Josefov)', 'barrio', 'Sinagogas y el antiguo cementerio judío.')
    ]
  },
  {
    key: 'estambul', name: 'Estambul', country: 'Turquía', lat: 41.0082, lon: 28.9784, aliases: ['istanbul'],
    places: [
      place('Santa Sofía', 'Santa Sofía', 'monumento', 'Es mezquita: respeta los horarios de oración.'),
      place('Mezquita del Sultán Ahmed', 'Mezquita Azul', 'monumento', 'Entrada gratuita; lleva pañuelo y ropa larga.'),
      place('Palacio de Topkapı', 'Palacio de Topkapı', 'museo', 'Reserva medio día; el harén se paga aparte.'),
      place('Gran Bazar (Estambul)', 'Gran Bazar', 'ocio', 'Regatear forma parte de la experiencia.'),
      place('Cisterna Basílica', 'Cisterna Basílica', 'monumento', 'Busca las cabezas de Medusa.')
    ]
  },
  {
    key: 'dubai', name: 'Dubái', country: 'Emiratos Árabes Unidos', lat: 25.2048, lon: 55.2708, aliases: ['dubai'],
    places: [
      place('Burj Khalifa', 'Burj Khalifa', 'mirador', 'Reserva la subida al atardecer.'),
      place('Dubai Mall', 'Dubai Mall', 'ocio', 'Con acuario y pista de patinaje.'),
      place('Fuente de Dubái', 'Fuente de Dubái', 'ocio', 'Espectáculo gratuito cada noche.'),
      place('Burj Al Arab', 'Burj Al Arab', 'monumento', 'La mejor foto es desde la playa de Jumeirah.'),
      place('Palm Jumeirah', 'Palm Jumeirah', 'barrio', 'Vista aérea desde The View at The Palm.')
    ]
  },
  {
    key: 'quito', name: 'Quito', country: 'Ecuador', lat: -0.1807, lon: -78.4678, aliases: [],
    places: [
      place('Centro histórico de Quito', 'Centro histórico', 'barrio', 'Uno de los centros coloniales mejor conservados.'),
      place('Ciudad Mitad del Mundo', 'Mitad del Mundo', 'monumento', 'Ponte con un pie en cada hemisferio.'),
      place('Basílica del Voto Nacional', 'Basílica del Voto Nacional', 'mirador', 'Sube a sus torres neogóticas.'),
      place('TelefériQo', 'TelefériQo', 'mirador', 'Sube hasta casi 4000 m sobre el volcán Pichincha.'),
      place('El Panecillo', 'El Panecillo', 'mirador', 'La Virgen de Quito domina la ciudad.')
    ]
  }
];

/* ---- Ayudantes ---- */

function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export function distanceKm(latA, lonA, latB, lonB) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = toRad(latB - latA);
  const deltaLon = toRad(lonB - lonA);
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function readCache(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_PREFIX + key));
    return saved && Date.now() - saved.at < CACHE_TTL ? saved.value : null;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* cache llena */
  }
}

/* Busca la ciudad conocida por nombre (o alias) o por cercania a unas coordenadas */
export function findCity({ text, lat, lon } = {}) {
  const query = normalize(text);
  if (query) {
    const byName = CITIES.find((city) => [city.name, ...city.aliases].some((name) => {
      const value = normalize(name);
      return query === value || query.startsWith(`${value},`) || query.startsWith(`${value} `) || query.includes(value) && value.length > 4;
    }));
    if (byName) return byName;
  }
  if (lat != null && lon != null) {
    const nearest = CITIES
      .map((city) => ({ city, km: distanceKm(lat, lon, city.lat, city.lon) }))
      .sort((first, second) => first.km - second.km)[0];
    if (nearest && nearest.km <= NEAR_KM) return nearest.city;
  }
  return null;
}

/*
 * Resumenes de Wikipedia de varios lugares en UNA sola peticion (foto, extracto, coordenadas y enlace).
 * Devuelve un Map titulo pedido → resumen.
 */
async function wikiSummaries(titles) {
  const result = new Map();
  const pending = titles.filter((title) => {
    const cached = readCache(`wiki:${title}`);
    if (cached) result.set(title, cached);
    return !cached;
  });
  if (!pending.length) return result;
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', redirects: '1',
    prop: 'pageimages|coordinates|description|extracts|info',
    piprop: 'thumbnail', pithumbsize: '960', inprop: 'url',
    exintro: '1', explaintext: '1', exsentences: '2', exlimit: 'max', colimit: 'max',
    titles: pending.join('|')
  });
  const response = await fetch(`${WIKI_API_URL}?${params}`);
  if (!response.ok) throw new Error('Wikipedia no respondió. Inténtalo en un momento.');
  const data = await response.json();
  const aliases = new Map();
  for (const item of [...(data.query?.normalized || []), ...(data.query?.redirects || [])]) aliases.set(item.from, item.to);
  const resolve = (title) => {
    let current = title;
    for (let step = 0; step < 3 && aliases.has(current); step += 1) current = aliases.get(current);
    return current;
  };
  const pages = Object.values(data.query?.pages || {});
  for (const title of pending) {
    const page = pages.find((item) => item.title === resolve(title) && item.missing === undefined);
    if (!page) continue;
    const summary = {
      title: page.title,
      description: page.description || '',
      extract: page.extract || '',
      thumb: page.thumbnail?.source || '',
      lat: page.coordinates?.[0]?.lat ?? null,
      lon: page.coordinates?.[0]?.lon ?? null,
      url: page.fullurl || ''
    };
    writeCache(`wiki:${title}`, summary);
    result.set(title, summary);
  }
  return result;
}

function resizedImage(url, width) {
  // Wikimedia solo sirve anchos estandar (250, 330, 500, 960, 1280…): otros devuelven error 400
  return url.replace(/\/(\d+)px-/, `/${width}px-`);
}

/* Top de una ciudad conocida, con datos de Wikipedia */
export async function cityRecommendations(city) {
  const summaries = await wikiSummaries(city.places.map((item) => item.wiki)).catch(() => new Map());
  return city.places.map((item, index) => {
    const summary = summaries.get(item.wiki);
    const image = summary?.thumb ? resizedImage(summary.thumb, 960) : '';
    return {
      rank: index + 1,
      name: item.name,
      category: item.category,
      tip: item.tip,
      description: summary?.description || '',
      extract: summary?.extract || '',
      image,
      thumb: summary?.thumb ? resizedImage(summary.thumb, 500) : '',
      lat: summary?.lat ?? null,
      lon: summary?.lon ?? null,
      url: summary?.url || '',
      credit: image ? 'Wikipedia / Wikimedia Commons' : ''
    };
  });
}

/*
 * Plan B si Wikidata no responde: articulos de Wikipedia cercanos que parecen lugares turisticos,
 * ordenados por la extension del articulo (los lugares mas importantes tienen articulos mas largos).
 */
async function wikipediaNearby(lat, lon) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*',
    generator: 'geosearch', ggscoord: `${lat}|${lon}`, ggsradius: '10000', ggslimit: '100',
    prop: 'pageimages|description|info|coordinates', piprop: 'thumbnail', pithumbsize: '960', inprop: 'url'
  });
  const response = await fetch(`${WIKI_API_URL}?${params}`);
  if (!response.ok) throw new Error('No pudimos buscar planes en esta zona ahora mismo. Inténtalo en un momento.');
  const data = await response.json();
  return Object.values(data.query?.pages || {})
    .filter((page) => TOURIST_WORDS.test(`${page.title} ${page.description || ''}`) && !EXCLUDED_WORDS.test(page.description || ''))
    .sort((first, second) => second.length - first.length)
    .slice(0, 10)
    .map((page, index) => {
      const image = page.thumbnail?.source || '';
      return {
        rank: index + 1,
        name: page.title,
        category: 'lugar',
        tip: '',
        description: page.description || '',
        extract: '',
        image,
        thumb: image ? resizedImage(image, 500) : '',
        lat: page.coordinates?.[0]?.lat ?? null,
        lon: page.coordinates?.[0]?.lon ?? null,
        url: page.fullurl || '',
        credit: image ? 'Wikipedia / Wikimedia Commons' : ''
      };
    });
}

/* Zona no incluida: lugares turisticos cercanos ordenados por popularidad en Wikidata (o plan B) */
export async function nearbyRecommendations(lat, lon) {
  const key = `near:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = readCache(key);
  if (cached) return cached;
  try {
    const results = await wikidataNearby(lat, lon);
    if (results.length >= 3) {
      writeCache(key, results);
      return results;
    }
  } catch {
    /* se intenta el plan B */
  }
  const fallback = await wikipediaNearby(lat, lon);
  writeCache(key, fallback);
  return fallback;
}

async function wikidataNearby(lat, lon) {
  const query = `SELECT ?item ?itemLabel ?itemDescription (MAX(?l) AS ?links) (SAMPLE(?c) AS ?coord) (SAMPLE(?img) AS ?image) (SAMPLE(?article) AS ?wiki) WHERE {
    SERVICE wikibase:around { ?item wdt:P625 ?c. bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral; bd:serviceParam wikibase:radius "10". }
    ?item wikibase:sitelinks ?l. FILTER(?l > 3)
    MINUS { ?item wdt:P31 wd:Q27686. }
    VALUES ?type { ${PLACE_TYPES.map((id) => `wd:${id}`).join(' ')} }
    ?item wdt:P31/wdt:P279? ?type.
    OPTIONAL { ?item wdt:P18 ?img. }
    OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://es.wikipedia.org/>. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
  } GROUP BY ?item ?itemLabel ?itemDescription ORDER BY DESC(?links) LIMIT 10`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SPARQL_TIMEOUT_MS);
  try {
    const response = await fetch(SPARQL_URL + encodeURIComponent(query), {
      headers: { Accept: 'application/sparql-results+json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error('Wikidata no respondió');
    const data = await response.json();
    const results = data.results.bindings.map((row, index) => {
      const [pointLon, pointLat] = (row.coord?.value.match(/-?[\d.]+/g) || []).map(Number);
      const image = row.image?.value ? `${row.image.value.replace('http://', 'https://')}?width=960` : '';
      return {
        rank: index + 1,
        name: row.itemLabel?.value || 'Lugar de interés',
        category: 'lugar',
        tip: '',
        description: row.itemDescription?.value || '',
        extract: '',
        image,
        thumb: image ? image.replace('width=960', 'width=500') : '',
        lat: pointLat ?? null,
        lon: pointLon ?? null,
        url: row.wiki?.value || row.item.value,
        credit: image ? 'Wikimedia Commons' : ''
      };
    });
    return results;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La búsqueda tardó demasiado. Prueba con una zona más concreta o inténtalo de nuevo.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
