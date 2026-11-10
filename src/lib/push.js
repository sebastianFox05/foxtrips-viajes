/*
 * Avisos push en este dispositivo.
 * - Activar: pide permiso al navegador, se suscribe con la clave publica VAPID y guarda el dispositivo en Supabase
 *   (con el idioma, la zona horaria y que avisos quiere).
 * - Al guardar un cambio con historial, el almacen llama a notifyGroup(): la funcion /api/avisar avisa al resto del grupo.
 * Solo funciona en modo nube, con funciones de servidor (Netlify) y en navegadores con Push API.
 * En iPhone y iPad hace falta instalar la app en la pantalla de inicio (iOS 16.4 o posterior).
 */
import { config } from './config.js';
import { getLanguage } from './i18n/index.js';

const NOTIFY_ENDPOINT = '/api/avisar';
const PREFS_KEY = 'foxtrips:push-prefs';
const HAS_SERVER_FUNCTIONS = import.meta.env.VITE_SERVER_FUNCTIONS !== 'off';

export const PUSH_TOPICS = ['plan', 'votes', 'group', 'reminders'];

let cloudStore = null;

/* El almacen en la nube se registra aqui al cargar (asi este modulo no depende de el) */
export function connectPushStore(store) {
  cloudStore = store;
}

export function isPushSupported() {
  return Boolean(cloudStore && HAS_SERVER_FUNCTIONS && config.vapidPublicKey
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
}

/* iPhone o iPad abiertos en Safari (sin instalar): alli los avisos solo funcionan con la app instalada */
export function needsInstallForPush() {
  const isApple = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return isApple && !isInstalled;
}

export function readPushPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    return Object.fromEntries(PUSH_TOPICS.map((topic) => [topic, saved[topic] !== false]));
  } catch {
    return Object.fromEntries(PUSH_TOPICS.map((topic) => [topic, true]));
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* sin almacenamiento */
  }
}

function base64ToBytes(value) {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function bytesToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function registration() {
  // Espera al service worker de la PWA (se registra en main.jsx)
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve, reject) => setTimeout(() => reject(new Error('sw')), 10000))
  ]);
}

async function currentSubscription() {
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

/* 'unsupported' | 'denied' | 'off' | 'on' */
export async function pushStatus() {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const subscription = await currentSubscription();
    return subscription && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'unsupported';
  }
}

async function saveSubscription(subscription, prefs) {
  const json = subscription.toJSON();
  await cloudStore.savePushSubscription({
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh || bytesToBase64(subscription.getKey('p256dh')),
    auth: json.keys?.auth || bytesToBase64(subscription.getKey('auth')),
    lang: getLanguage(),
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    prefs
  });
}

/* Activa los avisos. Devuelve el estado final ('on' o 'denied'); lanza un error si algo falla */
export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const reg = await registration();
  const subscription = await reg.pushManager.getSubscription()
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(config.vapidPublicKey) });
  await saveSubscription(subscription, readPushPrefs());
  return 'on';
}

export async function disablePush() {
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return;
  await cloudStore.forgetPushSubscription(subscription.endpoint).catch(() => null);
  await subscription.unsubscribe().catch(() => null);
}

/* Cambia que avisos se reciben en este dispositivo */
export async function updatePushPrefs(prefs) {
  savePrefs(prefs);
  const subscription = await currentSubscription().catch(() => null);
  if (subscription) await saveSubscription(subscription, prefs);
}

/* Al entrar: si el dispositivo ya tenia avisos, se actualizan idioma y zona horaria (por si cambiaron) */
export async function refreshPushSubscription() {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  const subscription = await currentSubscription().catch(() => null);
  if (subscription) await saveSubscription(subscription, readPushPrefs()).catch(() => null);
}

/* Muestra un aviso de prueba en este dispositivo (comprueba permiso y ajustes del sistema, sin pasar por el servidor) */
export async function testPushHere(title, body) {
  const reg = await registration();
  await reg.showNotification(title, {
    body,
    tag: 'foxtrips-prueba',
    icon: new URL('assets/img/icono-192.png', reg.scope).href,
    data: { url: reg.scope }
  });
}

/* Avisa al resto del grupo de un cambio recien guardado (sin esperar ni molestar si falla) */
export function notifyGroup(logId, tripId, kind) {
  if (!cloudStore || !HAS_SERVER_FUNCTIONS || !logId) return;
  cloudStore.accessToken().then((token) => {
    if (!token) return;
    fetch(NOTIFY_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId, tripId, kind }),
      keepalive: true
    }).catch(() => null);
  }).catch(() => null);
}
