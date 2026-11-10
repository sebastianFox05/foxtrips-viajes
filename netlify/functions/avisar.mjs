/*
 * Funcion de Netlify: avisa al resto del grupo de un cambio en el viaje (POST /api/avisar).
 * La app la llama justo despues de guardar un cambio con historial: { logId, kind }.
 *   kind: 'plan' (itinerario y datos del viaje) | 'votes' (votaciones) | 'group' (album, diario, documentos, equipaje…)
 * La funcion SQL push_targets comprueba con la sesion de quien llama que el cambio es suyo, reciente
 * y no avisado aun, y devuelve los dispositivos del resto del grupo. Cada persona elige en Perfil que avisos recibe.
 */
import { clip, reply, rpc, sendAll, vapidReady } from '../lib/push.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ['plan', 'votes', 'group'];
const MAX_BODY_BYTES = 512;

export default async (request) => {
  if (request.method !== 'POST') return reply(405, { error: 'Método no permitido' });
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Falta la sesión' });
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return reply(413, { error: 'Petición demasiado grande' });
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return reply(400, { error: 'JSON no válido' });
  }
  if (!UUID.test(data?.logId || '') || !KINDS.includes(data?.kind)) return reply(400, { error: 'Datos no válidos' });
  if (!vapidReady()) return reply(503, { error: 'Avisos sin configurar' });

  const rows = await rpc('push_targets', { log: data.logId }, token);
  if (!rows) return reply(403, { error: 'No se pudo comprobar el cambio' });
  const tripId = /^[0-9a-f-]{36}$/i.test(data.tripId || '') ? data.tripId : '';
  const sent = await sendAll(rows, (row) => {
    if (row.prefs?.[data.kind] === false) return null;
    return {
      title: clip(row.trip_name, 80),
      body: clip(`${row.actor_name || ''} ${row.text}`.trim(), 180),
      url: tripId ? `/#/viaje/${tripId}/${data.kind === 'votes' ? 'propuestas' : data.kind === 'plan' ? 'itinerario' : 'historial'}` : '/',
      // Un aviso por viaje: el nuevo sustituye al anterior en vez de amontonarse
      tag: `viaje-${tripId || 'foxtrips'}`
    };
  });
  return reply(200, { sent });
};

export const config = { path: '/api/avisar' };
