/*
 * Funcion de Netlify: borra de Cloudinary el archivo de una foto del album.
 * Cloudinary exige una firma con el API Secret, que nunca debe llegar al navegador,
 * por eso el borrado se hace aqui, en el servidor.
 *
 * Seguridad: se usa la sesion de Supabase de quien llama (RLS). Solo borra si
 *   1) la foto existe y la persona es organizadora o editora de ese viaje, y
 *   2) el archivo esta en la carpeta de ese mismo viaje (foxtrips/<id del viaje>/…).
 *
 * Variables de entorno (Netlify → Project configuration → Environment variables):
 *   CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET  → las pone el dueño del proyecto.
 */
import { createHash } from 'node:crypto';

const SUPABASE_URL = 'https://mbldzwyzzzizowjgzdso.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jbrnE06EJFRnZVR-vPb39w_4fb_QSSt';
const CLOUD_NAME = 'dlxcei9u';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(status, body) {
  return Response.json(body, { status });
}

/* Consulta a Supabase con la sesion de la persona: RLS decide que puede ver */
async function supabaseRequest(path, token, init = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  return response.ok ? response.json() : null;
}

function signature(params, secret) {
  const text = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
  return createHash('sha1').update(text + secret).digest('hex');
}

export default async (request) => {
  if (request.method !== 'POST') return reply(405, { error: 'Método no permitido.' });
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiKey || !apiSecret) return reply(501, { error: 'Falta configurar Cloudinary en Netlify.' });

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { photoId } = await request.json().catch(() => ({}));
  if (!token || !UUID.test(photoId || '')) return reply(400, { error: 'Petición incompleta.' });

  const rows = await supabaseRequest(`/rest/v1/photos?id=eq.${photoId}&select=trip_id,storage_path,provider`, token);
  const photo = rows?.[0];
  if (!photo) return reply(404, { error: 'La foto no existe o no tienes acceso.' });
  if (photo.provider !== 'cloudinary' || !photo.storage_path?.startsWith(`foxtrips/${photo.trip_id}/`)) {
    return reply(400, { error: 'La foto no está en Cloudinary.' });
  }

  const canEdit = await supabaseRequest('/rest/v1/rpc/can_edit', token, { method: 'POST', body: JSON.stringify({ t: photo.trip_id }) });
  if (canEdit !== true) return reply(403, { error: 'Solo quien organiza o edita el viaje puede borrar fotos.' });

  const params = { invalidate: 'true', public_id: photo.storage_path, timestamp: String(Math.floor(Date.now() / 1000)) };
  const body = new URLSearchParams({ ...params, api_key: apiKey, signature: signature(params, apiSecret) });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, { method: 'POST', body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !['ok', 'not found'].includes(data.result)) return reply(502, { error: 'Cloudinary no pudo borrar la foto.' });
  return reply(200, { result: data.result });
};

export const config = { path: '/api/borrar-foto' };
