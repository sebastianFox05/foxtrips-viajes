/* Fotos de la bienvenida y del acceso (Wikimedia Commons) y si ya se vio la bienvenida en esta sesion. */
const WELCOME_SEEN_KEY = 'foxtrips:welcome-seen';
const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/thumb';

/* Fotos libres de Wikimedia Commons (ruta, archivo, autor, licencia) */
export const WELCOME_PHOTOS = {
  road: ['c/c0', 'Breil-Brigels_in_Graub%C3%BCnden._23-09-2022._%28actm.%29_02.jpg', 'Agnes Monkelbaan', 'CC BY-SA 4.0'],
  lake: ['c/c5', 'Moraine_Lake_17092005.jpg', 'Gorgo', 'Dominio público'],
  balloons: ['a/a3', 'Cappadocia_Aerial_View_Landscape.jpg', 'Benh Lieu Song', 'CC BY-SA 4.0'],
  machuPicchu: ['0/02', 'Machu_Picchu%2C_Per%C3%BA%2C_2015-07-30%2C_DD_60.JPG', 'Diego Delso', 'CC BY-SA 4.0'],
  santorini: ['2/27', '1000_Three_domes_of_Oia_in_Santorini_Photo_by_Giles_Laurent.jpg', 'Giles Laurent', 'CC BY-SA 4.0']
};

export function photoSources(key) {
  const [path, file, author, license] = WELCOME_PHOTOS[key];
  return {
    small: `${COMMONS}/${path}/${file}/960px-${file}`,
    large: `${COMMONS}/${path}/${file}/1920px-${file}`,
    credit: `${author} · ${license} · Wikimedia Commons`
  };
}

export function markWelcomeSeen() {
  sessionStorage.setItem(WELCOME_SEEN_KEY, '1');
}

export function hasSeenWelcome() {
  return sessionStorage.getItem(WELCOME_SEEN_KEY) === '1';
}
