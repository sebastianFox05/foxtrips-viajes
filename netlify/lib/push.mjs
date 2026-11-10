/*
 * Ayudantes de los avisos push (los usan netlify/functions/avisar.mjs y recordatorios.mjs).
 * Variables de entorno (Netlify → Project configuration → Environment variables):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY → par de claves de los avisos (la publica tambien esta en src/lib/config.js)
 *   VAPID_SUBJECT                       → contacto para los servicios de avisos (la direccion de la web)
 */
import webpush from 'web-push';

export const SUPABASE_URL = 'https://mbldzwyzzzizowjgzdso.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_jbrnE06EJFRnZVR-vPb39w_4fb_QSSt';
const TTL_SECONDS = 12 * 3600;
const GONE_STATUSES = [404, 410];

export function reply(status, body) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function vapidReady() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT || 'https://foxtrips-viajes.netlify.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return true;
}

/* Llama a una funcion SQL de Supabase (con la sesion de quien llama, o sin sesion) */
export async function rpc(name, args, token = null) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token || SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!response.ok) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

/*
 * Envia un aviso a cada dispositivo. Los que el servicio de avisos da por muertos (404/410) se borran.
 * payload(row) → { title, body, url, tag } o null para saltarlo. Devuelve cuantos se enviaron.
 */
export async function sendAll(rows, payload) {
  let sent = 0;
  await Promise.all(rows.map(async (row) => {
    const message = payload(row);
    if (!message) return;
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(message),
        { TTL: TTL_SECONDS, urgency: 'normal' }
      );
      sent += 1;
    } catch (error) {
      if (GONE_STATUSES.includes(error.statusCode)) await rpc('forget_push_subscription', { endpoint_url: row.endpoint });
      else console.error('aviso no enviado', error.statusCode || error.message);
    }
  }));
  return sent;
}

export function clip(text, max) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
