/* Secciones de un viaje: pestañas de escritorio, barra inferior movil y menu "Mas". Los textos se traducen al pintarlos con t(). */
import { m, t } from '../../lib/i18n/index.js';

export const SECTIONS = [
  { key: 'resumen', label: m('Inicio'), icon: 'home', hint: m('Cuenta atrás, clima y divisas') },
  { key: 'itinerario', label: m('Plan'), icon: 'calendar', hint: m('Actividades día a día') },
  { key: 'mapa', label: m('Mapa'), icon: 'map', hint: m('Ruta de cada día') },
  { key: 'album', label: m('Álbum'), icon: 'image', hint: m('Fotos del grupo') },
  { key: 'recomendaciones', label: m('Top planes'), icon: 'star', hint: m('Lo más visitado de la ciudad') },
  { key: 'frases', label: m('Frases'), icon: 'translate', hint: m('Para hablar en el destino') },
  { key: 'propuestas', label: m('Votaciones'), icon: 'vote', hint: m('Proponer y votar planes') },
  { key: 'diario', label: m('Diario'), icon: 'book', hint: m('Notas y resumen final') },
  { key: 'equipaje', label: m('Equipaje'), icon: 'bag', hint: m('Qué llevar y quién') },
  { key: 'documentos', label: m('Documentos'), icon: 'file', hint: m('Billetes y reservas') },
  { key: 'miembros', label: m('Grupo'), icon: 'users', hint: m('Invitar y permisos') },
  { key: 'historial', label: m('Historial'), icon: 'clock', hint: m('Quién cambió qué') }
];

export const MOBILE_KEYS = ['resumen', 'itinerario', 'mapa', 'album'];
export const SECTION_KEYS = [...SECTIONS.map((section) => section.key), 'mas'];

export function roleLabel(role) {
  return { owner: t('Organizador'), editor: t('Editor'), viewer: t('Lector') }[role] || role;
}

export function canEdit(role) {
  return role === 'owner' || role === 'editor';
}
