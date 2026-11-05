/*
 * Almacen LOCAL: datos en localStorage y archivos en IndexedDB.
 * Simula varios usuarios en el mismo navegador (cerrar sesion y entrar con otro nombre)
 * y sincroniza pestañas abiertas con BroadcastChannel.
 */
import { uid, randomCode } from '../utils.js';

const DB_KEY = 'foxtrips:db';
const USER_KEY = 'foxtrips:user';
const FILE_DB = 'foxtrips-files';
const FILE_STORE = 'files';
const TABLES = ['profiles', 'trips', 'trip_members', 'invites', 'activities', 'photos', 'comments', 'proposals', 'votes', 'documents', 'checklist_items', 'diary_entries', 'activity_log'];
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('foxtrips') : null;
const listeners = new Set();
const urlCache = new Map();

let currentUser = null;
let fileDbPromise = null;

/* ---- Persistencia ---- */

function readDb() {
  let db = {};
  try {
    db = JSON.parse(localStorage.getItem(DB_KEY)) || {};
  } catch {
    db = {};
  }
  for (const table of TABLES) db[table] ||= [];
  return db;
}

function writeDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  notify();
}

/* Avisa a las OTRAS pestañas; la pestaña que hizo el cambio ya repinta por su cuenta */
function notify() {
  channel?.postMessage('change');
}

function stamp(row) {
  return { id: uid(), created_at: new Date().toISOString(), ...row };
}

function addLog(db, log) {
  if (!log?.tripId || !log.text) return;
  db.activity_log.push(stamp({ trip_id: log.tripId, actor_id: currentUser?.id, actor_name: currentUser?.name, text: log.text }));
}

function roleOf(db, tripId) {
  return db.trip_members.find((member) => member.trip_id === tripId && member.user_id === currentUser?.id)?.role || null;
}

/* ---- Archivos en IndexedDB ---- */

function openFileDb() {
  fileDbPromise ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(FILE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return fileDbPromise;
}

async function fileTx(mode, action) {
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, mode);
    const request = action(tx.objectStore(FILE_STORE));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
  });
}

/* ---- API publica ---- */

const localStore = {
  mode: 'local',
  isPasswordAuth: false,

  async init() {
    try {
      currentUser = JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      currentUser = null;
    }
    return currentUser;
  },

  get user() {
    return currentUser;
  },

  get isRecovery() {
    return false;
  },

  async signIn({ name }) {
    const db = readDb();
    const cleanName = name.trim();
    let profile = db.profiles.find((item) => item.display_name.toLowerCase() === cleanName.toLowerCase());
    if (!profile) {
      profile = { id: uid(), display_name: cleanName };
      db.profiles.push(profile);
      writeDb(db);
    }
    currentUser = { id: profile.id, name: profile.display_name, avatar_url: profile.avatar_url || null };
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    return currentUser;
  },

  async signInWithGoogle() {
    throw new Error('El acceso con Google necesita el modo nube (Supabase).');
  },

  async resetPassword() {
    throw new Error('En modo local no hay contraseñas: basta con tu nombre.');
  },

  async signOut() {
    currentUser = null;
    localStorage.removeItem(USER_KEY);
  },

  /* Foto de perfil (en modo local es una imagen pequeña en linea) o null para quitarla */
  async updateAvatar(url) {
    const db = readDb();
    const profile = db.profiles.find((item) => item.id === currentUser.id);
    if (profile) profile.avatar_url = url;
    writeDb(db);
    currentUser = { ...currentUser, avatar_url: url };
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  },

  async updateName(name) {
    const db = readDb();
    const profile = db.profiles.find((item) => item.id === currentUser.id);
    if (profile) profile.display_name = name;
    writeDb(db);
    currentUser = { ...currentUser, name };
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  },

  async listTrips() {
    const db = readDb();
    return db.trip_members
      .filter((member) => member.user_id === currentUser.id)
      .map((member) => ({ ...db.trips.find((trip) => trip.id === member.trip_id), role: member.role }))
      .filter((trip) => trip.id);
  },

  async createTrip(data) {
    const db = readDb();
    const trip = stamp({ ...data, created_by: currentUser.id, public_token: null });
    db.trips.push(trip);
    db.trip_members.push({ trip_id: trip.id, user_id: currentUser.id, role: 'owner', created_at: trip.created_at });
    addLog(db, { tripId: trip.id, text: `creó el viaje "${trip.name}"` });
    writeDb(db);
    return { ...trip, role: 'owner' };
  },

  async getTrip(id) {
    const db = readDb();
    const trip = db.trips.find((item) => item.id === id);
    const role = roleOf(db, id);
    return trip && role ? { ...trip, role } : null;
  },

  async updateTrip(id, patch, log) {
    const db = readDb();
    const trip = db.trips.find((item) => item.id === id);
    Object.assign(trip, patch);
    addLog(db, log);
    writeDb(db);
    return trip;
  },

  async deleteTrip(id) {
    const db = readDb();
    for (const table of TABLES) {
      if (table === 'trips') db.trips = db.trips.filter((trip) => trip.id !== id);
      else if (table !== 'profiles') db[table] = db[table].filter((row) => row.trip_id !== id);
    }
    writeDb(db);
  },

  async list(table, tripId) {
    const db = readDb();
    return db[table]
      .filter((row) => row.trip_id === tripId)
      .filter((row) => table !== 'checklist_items' || row.is_shared || row.owner_id === currentUser.id);
  },

  async insert(table, row, log) {
    const db = readDb();
    const saved = stamp(row);
    db[table].push(saved);
    addLog(db, log);
    writeDb(db);
    return saved;
  },

  async update(table, id, patch, log) {
    const db = readDb();
    const row = db[table].find((item) => item.id === id);
    if (row) Object.assign(row, patch, { updated_at: new Date().toISOString() });
    addLog(db, log);
    writeDb(db);
    return row;
  },

  async remove(table, id, log) {
    const db = readDb();
    db[table] = db[table].filter((item) => item.id !== id);
    addLog(db, log);
    writeDb(db);
  },

  async listMembers(tripId) {
    const db = readDb();
    return db.trip_members
      .filter((member) => member.trip_id === tripId)
      .map((member) => ({
        user_id: member.user_id,
        role: member.role,
        name: db.profiles.find((profile) => profile.id === member.user_id)?.display_name || 'Viajero',
        avatar_url: db.profiles.find((profile) => profile.id === member.user_id)?.avatar_url || null
      }));
  },

  async setMemberRole(tripId, userId, role) {
    const db = readDb();
    const member = db.trip_members.find((item) => item.trip_id === tripId && item.user_id === userId);
    if (member) member.role = role;
    writeDb(db);
  },

  async removeMember(tripId, userId) {
    const db = readDb();
    db.trip_members = db.trip_members.filter((item) => !(item.trip_id === tripId && item.user_id === userId));
    writeDb(db);
  },

  async createInvite(tripId, role) {
    const db = readDb();
    const code = randomCode();
    const expires = new Date(Date.now() + 14 * 86400000).toISOString();
    db.invites.push({ code, trip_id: tripId, role, created_by: currentUser.id, created_at: new Date().toISOString(), expires_at: expires });
    writeDb(db);
    return code;
  },

  async revokeInvites(tripId) {
    const db = readDb();
    db.invites = db.invites.filter((item) => item.trip_id !== tripId);
    addLog(db, { tripId, text: 'revocó los enlaces de invitación' });
    writeDb(db);
  },

  async joinTrip(code) {
    const db = readDb();
    const isExpired = (item) => item.expires_at && new Date(item.expires_at) < new Date();
    const invite = db.invites.find((item) => item.code === code && !isExpired(item));
    if (!invite) throw new Error('La invitación no existe o ha caducado.');
    const member = db.trip_members.find((item) => item.trip_id === invite.trip_id && item.user_id === currentUser.id);
    if (!member) {
      db.trip_members.push({ trip_id: invite.trip_id, user_id: currentUser.id, role: invite.role, created_at: new Date().toISOString() });
      addLog(db, { tripId: invite.trip_id, text: 'se unió al viaje' });
      writeDb(db);
    }
    return invite.trip_id;
  },

  /* Solo para el viaje de ejemplo: añade una persona simulada al grupo */
  async addDemoMember(tripId, name, role) {
    const db = readDb();
    let profile = db.profiles.find((item) => item.display_name === name);
    if (!profile) {
      profile = { id: uid(), display_name: name };
      db.profiles.push(profile);
    }
    db.trip_members.push({ trip_id: tripId, user_id: profile.id, role, created_at: new Date().toISOString() });
    db.activity_log.push(stamp({ trip_id: tripId, actor_id: profile.id, actor_name: name, text: 'se unió al viaje' }));
    writeDb(db);
    return { id: profile.id, name };
  },

  async setPublic(tripId, isPublic) {
    const token = isPublic ? randomCode(16) : null;
    await this.updateTrip(tripId, { public_token: token }, { tripId, text: isPublic ? 'activó la página pública' : 'desactivó la página pública' });
    return token;
  },

  async getPublicTrip(token) {
    const db = readDb();
    const trip = db.trips.find((item) => item.public_token && item.public_token === token);
    if (!trip) return null;
    return {
      trip,
      activities: db.activities.filter((row) => row.trip_id === trip.id),
      photos: db.photos.filter((row) => row.trip_id === trip.id)
    };
  },

  subscribe(tripId, callback) {
    const channelHandler = () => callback();
    listeners.add(callback);
    channel?.addEventListener('message', channelHandler);
    return () => {
      listeners.delete(callback);
      channel?.removeEventListener('message', channelHandler);
    };
  },

  /* Archivos */
  async uploadFile(bucket, path, blob) {
    const key = `${bucket}/${path}`;
    await fileTx('readwrite', (store) => store.put(blob, key));
    return { path: key, url: `local:${key}` };
  },

  async fileUrl(bucket, value) {
    if (!value?.startsWith('local:')) return value;
    if (urlCache.has(value)) return urlCache.get(value);
    const blob = await fileTx('readonly', (store) => store.get(value.slice(6)));
    const url = blob ? URL.createObjectURL(blob) : '';
    urlCache.set(value, url);
    return url;
  },

  async removeFile(bucket, path) {
    if (path) await fileTx('readwrite', (store) => store.delete(path));
  }
};

/* Plan B para navegadores sin BroadcastChannel */
function storageHandler(event) {
  if (!channel && event.key === DB_KEY) listeners.forEach((callback) => callback());
}

window.addEventListener('storage', storageHandler);

export default localStore;
