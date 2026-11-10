/*
 * Almacen en la NUBE con Supabase: Postgres + Auth + Realtime + Storage.
 * Las politicas RLS de supabase/schema.sql deciden quien puede leer o editar cada viaje.
 * Guarda en cache las ultimas lecturas para consultar el viaje sin conexion.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { randomCode } from '../utils.js';
import { t } from '../i18n/index.js';
import { connectPushStore, notifyGroup, refreshPushSubscription } from '../push.js';

const CACHE_PREFIX = 'foxtrips:cache:';
const REALTIME_TABLES = ['activities', 'photos', 'comments', 'proposals', 'votes', 'documents', 'checklist_items', 'diary_entries', 'trip_members'];
const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true }
});

let currentUser = null;
let isRecovery = false;

/* ---- Ayudantes ---- */

function isOfflineError(error) {
  return !navigator.onLine || /fetch|network/i.test(error?.message || '');
}

function saveCache(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* cache llena: se ignora */
  }
}

function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PREFIX + key));
  } catch {
    return null;
  }
}

/* Ejecuta una consulta; si no hay red devuelve la ultima copia guardada */
async function cached(key, query) {
  const { data, error } = await query();
  if (error) {
    if (isOfflineError(error)) {
      const copy = readCache(key);
      if (copy) return copy;
    }
    throw new Error(error.message);
  }
  saveCache(key, data);
  return data;
}

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

async function loadProfile(user) {
  // select('*'): si la columna avatar_url aun no existe en la base de datos, todo sigue funcionando
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return { id: user.id, email: user.email, name: data?.display_name || user.email.split('@')[0], avatar_url: data?.avatar_url || null };
}

/*
 * Realtime no permite filtrar los DELETE por viaje y, con RLS, solo envia la clave primaria.
 * Se ignoran los borrados de filas que no estan en la copia local de este viaje.
 */
function isDeleteOfTrip(table, tripId, old) {
  if (old?.trip_id) return old.trip_id === tripId;
  const rows = readCache(`${table}:${tripId}`);
  if (!Array.isArray(rows) || !old?.id) return true; // sin copia local: mejor recargar
  return rows.some((row) => row.id === old.id);
}

/* Tipo de aviso push segun la tabla que cambia (cada persona elige en Perfil cuales recibe) */
const PUSH_KIND = { trips: 'plan', activities: 'plan', proposals: 'votes', votes: 'votes' };

async function addLog(log, table = '') {
  if (!log?.tripId || !log.text) return;
  const { data } = await supabase.from('activity_log')
    .insert({ trip_id: log.tripId, actor_id: currentUser.id, actor_name: currentUser.name, text: log.text })
    .select('id').single();
  // Avisa al resto del grupo en sus dispositivos (si tienen los avisos activados)
  notifyGroup(data?.id, log.tripId, PUSH_KIND[table] || 'group');
}

/* ---- API publica (misma forma que store/local.js) ---- */

const supabaseStore = {
  mode: 'cloud',
  isPasswordAuth: true,

  async init() {
    const { data } = await supabase.auth.getSession();
    const params = new URLSearchParams(location.search);
    // Al volver del correo de "olvidé mi contraseña" la URL trae ?recuperar=1&code=…
    if (params.has('recuperar') && data.session) isRecovery = true;
    if (params.has('code') || params.has('recuperar')) history.replaceState(null, '', location.pathname + location.hash);
    currentUser = data.session ? await loadProfile(data.session.user) : null;
    if (currentUser) refreshPushSubscription();
    return currentUser;
  },

  get user() {
    return currentUser;
  },

  get isRecovery() {
    return isRecovery;
  },

  async signIn({ email, password }) {
    const data = check(await supabase.auth.signInWithPassword({ email, password }));
    currentUser = await loadProfile(data.user);
    return currentUser;
  },

  async signUp({ email, password, name }) {
    const data = check(await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name }, emailRedirectTo: location.origin + location.pathname }
    }));
    if (!data.session) return { isPendingConfirmation: true };
    currentUser = await loadProfile(data.user);
    return currentUser;
  },

  /* Requiere activar el proveedor Google en Supabase → Authentication → Providers (ver README) */
  async signInWithGoogle() {
    check(await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }));
  },

  async resetPassword(email) {
    check(await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}?recuperar=1` }));
  },

  async updatePassword(password) {
    check(await supabase.auth.updateUser({ password }));
    isRecovery = false;
  },

  /* Token de la sesion, para las funciones de servidor (borrar fotos de Cloudinary) */
  async accessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  },

  /* Foto de perfil: URL https o null para quitarla */
  async updateAvatar(url) {
    check(await supabase.from('profiles').update({ avatar_url: url }).eq('id', currentUser.id));
    currentUser = { ...currentUser, avatar_url: url };
  },

  /* Avisos push: guarda o quita este dispositivo (ver src/lib/push.js) */
  async savePushSubscription(subscription) {
    check(await supabase.rpc('save_push_subscription', { sub: subscription }));
  },

  async forgetPushSubscription(endpoint) {
    check(await supabase.rpc('forget_push_subscription', { endpoint_url: endpoint }));
  },

  async signOut() {
    // El dispositivo deja de recibir los avisos de esta cuenta
    const registration = await navigator.serviceWorker?.getRegistration?.().catch(() => null);
    const subscription = await registration?.pushManager?.getSubscription().catch(() => null);
    if (subscription) {
      await this.forgetPushSubscription(subscription.endpoint).catch(() => null);
      await subscription.unsubscribe().catch(() => null);
    }
    await supabase.auth.signOut();
    currentUser = null;
  },

  async updateName(name) {
    check(await supabase.from('profiles').update({ display_name: name }).eq('id', currentUser.id));
    currentUser = { ...currentUser, name };
  },

  async listTrips() {
    const rows = await cached(`trips:${currentUser.id}`, () =>
      supabase.from('trip_members').select('role, trips(*)').eq('user_id', currentUser.id));
    return rows.filter((row) => row.trips).map((row) => ({ ...row.trips, role: row.role }));
  },

  async createTrip(data) {
    const trip = check(await supabase.rpc('create_trip', { trip: data }));
    return { ...trip, role: 'owner' };
  },

  async getTrip(id) {
    const [trip, member] = await Promise.all([
      cached(`trip:${id}`, () => supabase.from('trips').select('*').eq('id', id).maybeSingle()),
      cached(`role:${id}`, () => supabase.from('trip_members').select('role').eq('trip_id', id).eq('user_id', currentUser.id).maybeSingle())
    ]);
    return trip && member ? { ...trip, role: member.role } : null;
  },

  async updateTrip(id, patch, log) {
    const trip = check(await supabase.from('trips').update(patch).eq('id', id).select().single());
    await addLog(log, 'trips');
    return trip;
  },

  async deleteTrip(id) {
    check(await supabase.from('trips').delete().eq('id', id));
  },

  async list(table, tripId) {
    return cached(`${table}:${tripId}`, () =>
      supabase.from(table).select('*').eq('trip_id', tripId).order('created_at', { ascending: true }));
  },

  async insert(table, row, log) {
    const saved = check(await supabase.from(table).insert(row).select().single());
    // Una linea del historial escrita a mano (por ejemplo "subió 5 fotos") tambien se avisa
    if (table === 'activity_log') notifyGroup(saved.id, saved.trip_id, 'group');
    await addLog(log, table);
    return saved;
  },

  async update(table, id, patch, log) {
    const saved = check(await supabase.from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single());
    await addLog(log, table);
    return saved;
  },

  async remove(table, id, log) {
    check(await supabase.from(table).delete().eq('id', id));
    await addLog(log, table);
  },

  async listMembers(tripId) {
    const rows = await cached(`members:${tripId}`, () =>
      supabase.from('trip_members').select('user_id, role, profiles(*)').eq('trip_id', tripId));
    return rows.map((row) => ({ user_id: row.user_id, role: row.role, name: row.profiles?.display_name || 'Viajero', avatar_url: row.profiles?.avatar_url || null }));
  },

  async setMemberRole(tripId, userId, role) {
    check(await supabase.from('trip_members').update({ role }).eq('trip_id', tripId).eq('user_id', userId));
  },

  async removeMember(tripId, userId) {
    check(await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId));
  },

  async createInvite(tripId, role) {
    const code = randomCode();
    check(await supabase.from('invites').insert({ code, trip_id: tripId, role, created_by: currentUser.id }));
    return code;
  },

  async revokeInvites(tripId) {
    check(await supabase.from('invites').delete().eq('trip_id', tripId));
    await addLog({ tripId, text: t('revocó los enlaces de invitación') });
  },

  async joinTrip(code) {
    return check(await supabase.rpc('join_trip', { invite_code: code }));
  },

  async setPublic(tripId, isPublic) {
    const token = isPublic ? randomCode(16) : null;
    await this.updateTrip(tripId, { public_token: token }, { tripId, text: isPublic ? t('activó la página pública') : t('desactivó la página pública') });
    return token;
  },

  async getPublicTrip(token) {
    return check(await supabase.rpc('get_public_trip', { token }));
  },

  subscribe(tripId, callback) {
    const realtime = supabase.channel(`trip-${tripId}`);
    for (const table of REALTIME_TABLES) {
      realtime.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `trip_id=eq.${tripId}` }, callback);
      realtime.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `trip_id=eq.${tripId}` }, callback);
      // Los DELETE no admiten filtro en Realtime: se filtran aqui con la copia local
      realtime.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (payload) => {
        if (isDeleteOfTrip(table, tripId, payload.old)) callback(payload);
      });
    }
    realtime.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, callback);
    realtime.subscribe();
    return () => supabase.removeChannel(realtime);
  },

  /* Archivos: "documents" es privado (URL firmada), "photos" es publico */
  async uploadFile(bucket, path, blob) {
    check(await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: false }));
    if (bucket === 'documents') return { path, url: path };
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { path, url: data.publicUrl };
  },

  async fileUrl(bucket, value) {
    if (bucket !== 'documents' || /^https?:/.test(value)) return value;
    const data = check(await supabase.storage.from(bucket).createSignedUrl(value, 3600));
    return data.signedUrl;
  },

  async removeFile(bucket, path) {
    if (path) await supabase.storage.from(bucket).remove([path]);
  }
};

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') currentUser = null;
  if (event === 'PASSWORD_RECOVERY') isRecovery = true;
});

connectPushStore(supabaseStore);

export default supabaseStore;
