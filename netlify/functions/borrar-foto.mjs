/*
 * Funcion de Netlify: borra archivos de Cloudinary.
 * Cloudinary exige una firma con el API Secret, que nunca debe llegar al navegador,
 * por eso el borrado se hace aqui, en el servidor.
 *
 * Dos usos (POST /api/borrar-foto):
 *   { photoId } → borra el archivo de una foto del album.
 *                 Solo si la persona es organizadora o editora del viaje (can_edit)
 *                 y el archivo esta en la carpeta de ese viaje (foxtrips/<id del viaje>/…).
 *   { tripId }  → borra TODA la carpeta foxtrips/<id del viaje>/ (al eliminar un viaje).
 *                 Solo si la persona es la organizadora del viaje (is_owner).
 *   { avatars: true, keep } → borra tus fotos de perfil anteriores (foxtrips/avatars/<tu usuario>/) menos "keep".
 * En ambos casos se usa la sesion de Supabase de quien llama (RLS): la app la llama ANTES de borrar la fila.
 *
 * Variables de entorno (Netlify → Project configuration → Environment variables):
 *   CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET  → las pone el dueño del proyecto.
 */
import { createHash } from 'node:crypto';

const SUPABASE_URL = 'https://mbldzwyzzzizowjgzdso.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jbrnE06EJFRnZVR-vPb39w_4fb_QSSt';
const CLOUD_NAME = 'dlxcei9u';
const CLOUDINARY_API = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ROUNDS = 20;

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

function hasTripRole(rpc, tripId, token) {
  return supabaseRequest(`/rest/v1/rpc/${rpc}`, token, { method: 'POST', body: JSON.stringify({ t: tripId }) });
}

function signature(params, secret) {
  const text = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
  return createHash('sha1').update(text + secret).digest('hex');
}

/* Un archivo: API de subida (destroy) con firma */
async function destroyFile(publicId, keys) {
  const params = { invalidate: 'true', public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)) };
  const body = new URLSearchParams({ ...params, api_key: keys.apiKey, signature: signature(params, keys.apiSecret) });
  const response = await fetch(`${CLOUDINARY_API}/image/destroy`, { method: 'POST', body });
  const data = await response.json().catch(() => ({}));
  return response.ok && ['ok', 'not found'].includes(data.result) ? data.result : null;
}

/* Una carpeta entera: Admin API (autenticacion basica). Borra de 1000 en 1000 mientras queden archivos */
async function destroyFolder(prefix, keys) {
  const auth = `Basic ${Buffer.from(`${keys.apiKey}:${keys.apiSecret}`).toString('base64')}`;
  let deleted = 0;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const url = `${CLOUDINARY_API}/resources/image/upload?prefix=${encodeURIComponent(prefix)}&invalidate=true`;
    const response = await fetch(url, { method: 'DELETE', headers: { Authorization: auth } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    deleted += Object.values(data.deleted || {}).filter((state) => state === 'deleted').length;
    if (!data.partial) break;
  }
  // La carpeta vacia tambien se quita (si no existe, Cloudinary responde 404 y no pasa nada)
  await fetch(`${CLOUDINARY_API}/folders/${prefix.replace(/\/$/, '')}`, { method: 'DELETE', headers: { Authorization: auth } }).catch(() => null);
  return deleted;
}

async function deletePhoto(photoId, token, keys) {
  const rows = await supabaseRequest(`/rest/v1/photos?id=eq.${photoId}&select=trip_id,storage_path,provider`, token);
  const photo = rows?.[0];
  if (!photo) return reply(404, { error: 'La foto no existe o no tienes acceso.' });
  if (photo.provider !== 'cloudinary' || !photo.storage_path?.startsWith(`foxtrips/${photo.trip_id}/`)) {
    return reply(400, { error: 'La foto no está en Cloudinary.' });
  }
  if (await hasTripRole('can_edit', photo.trip_id, token) !== true) {
    return reply(403, { error: 'Solo quien organiza o edita el viaje puede borrar fotos.' });
  }
  const result = await destroyFile(photo.storage_path, keys);
  return result ? reply(200, { result }) : reply(502, { error: 'Cloudinary no pudo borrar la foto.' });
}

/* Usuario de la sesion (Supabase Auth): { id } o null */
async function sessionUser(token) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  return response.ok ? response.json() : null;
}

/* Fotos de perfil: borra las de foxtrips/avatars/<tu usuario>/ menos la actual (keep) */
async function deleteOldAvatars(keep, token, keys) {
  const user = await sessionUser(token);
  if (!UUID.test(user?.id || '')) return reply(401, { error: 'Tu sesión no es válida. Vuelve a entrar.' });
  const prefix = `foxtrips/avatars/${user.id}/`;
  if (keep && !keep.startsWith(prefix)) return reply(400, { error: 'Esa foto no es tuya.' });
  const auth = `Basic ${Buffer.from(`${keys.apiKey}:${keys.apiSecret}`).toString('base64')}`;
  const list = await fetch(`${CLOUDINARY_API}/resources/image/upload?prefix=${encodeURIComponent(prefix)}&max_results=100`, { headers: { Authorization: auth } });
  const data = await list.json().catch(() => ({}));
  if (!list.ok) return reply(502, { error: 'Cloudinary no respondió.' });
  const old = (data.resources || []).map((item) => item.public_id).filter((id) => id !== keep && id.startsWith(prefix));
  if (!old.length) return reply(200, { deleted: 0 });
  const query = old.map((id) => `public_ids[]=${encodeURIComponent(id)}`).join('&');
  const response = await fetch(`${CLOUDINARY_API}/resources/image/upload?${query}&invalidate=true`, { method: 'DELETE', headers: { Authorization: auth } });
  return response.ok ? reply(200, { deleted: old.length }) : reply(502, { error: 'Cloudinary no pudo borrar las fotos anteriores.' });
}

async function deleteTripFolder(tripId, token, keys) {
  if (await hasTripRole('is_owner', tripId, token) !== true) {
    return reply(403, { error: 'Solo quien organiza el viaje puede borrar sus fotos.' });
  }
  const deleted = await destroyFolder(`foxtrips/${tripId}/`, keys);
  return deleted === null ? reply(502, { error: 'Cloudinary no pudo borrar la carpeta.' }) : reply(200, { deleted });
}

export default async (request) => {
  if (request.method !== 'POST') return reply(405, { error: 'Método no permitido.' });
  const keys = { apiKey: process.env.CLOUDINARY_API_KEY, apiSecret: process.env.CLOUDINARY_API_SECRET };
  if (!keys.apiKey || !keys.apiSecret) return reply(501, { error: 'Falta configurar Cloudinary en Netlify.' });

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { photoId, tripId, avatars, keep } = await request.json().catch(() => ({}));
  if (token && UUID.test(photoId || '')) return deletePhoto(photoId, token, keys);
  if (token && UUID.test(tripId || '')) return deleteTripFolder(tripId, token, keys);
  if (token && avatars === true && typeof (keep ?? '') === 'string') return deleteOldAvatars(keep || '', token, keys);
  return reply(400, { error: 'Petición incompleta.' });
};

export const config = { path: '/api/borrar-foto' };
