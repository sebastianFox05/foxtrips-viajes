/* Secciones de un viaje: pestañas de escritorio, barra inferior movil y menu "Mas". */
export const SECTIONS = [
  { key: 'resumen', label: 'Inicio', icon: 'home', hint: 'Cuenta atrás, clima y divisas' },
  { key: 'itinerario', label: 'Plan', icon: 'calendar', hint: 'Actividades día a día' },
  { key: 'mapa', label: 'Mapa', icon: 'map', hint: 'Ruta de cada día' },
  { key: 'album', label: 'Álbum', icon: 'image', hint: 'Fotos del grupo' },
  { key: 'recomendaciones', label: 'Top planes', icon: 'star', hint: 'Lo más visitado de la ciudad' },
  { key: 'frases', label: 'Frases', icon: 'translate', hint: 'Inglés para el día a día' },
  { key: 'propuestas', label: 'Votaciones', icon: 'vote', hint: 'Proponer y votar planes' },
  { key: 'diario', label: 'Diario', icon: 'book', hint: 'Notas y resumen final' },
  { key: 'equipaje', label: 'Equipaje', icon: 'bag', hint: 'Qué llevar y quién' },
  { key: 'documentos', label: 'Documentos', icon: 'file', hint: 'Billetes y reservas' },
  { key: 'miembros', label: 'Grupo', icon: 'users', hint: 'Invitar y permisos' },
  { key: 'historial', label: 'Historial', icon: 'clock', hint: 'Quién cambió qué' }
];

export const MOBILE_KEYS = ['resumen', 'itinerario', 'mapa', 'album'];
export const SECTION_KEYS = [...SECTIONS.map((section) => section.key), 'mas'];

export function roleLabel(role) {
  return { owner: 'Organizador', editor: 'Editor', viewer: 'Lector' }[role] || role;
}

export function canEdit(role) {
  return role === 'owner' || role === 'editor';
}
