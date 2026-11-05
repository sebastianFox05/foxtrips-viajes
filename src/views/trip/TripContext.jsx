/*
 * Contexto del viaje abierto: datos, miembros, permisos y refrescos.
 * - refreshKey cambia cuando hay que volver a leer los datos de la pestaña (tiempo real, otra pestaña, volver a estar en linea).
 *   El refresco se aplaza mientras escribes o mientras la vista esta ocupada (subiendo fotos), igual que antes.
 * - reloadTrip() vuelve a leer el viaje y sus miembros (cambios de nombre, portada, roles…).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { store } from '../../lib/store/index.js';
import { debounce, registerAvatars } from '../../lib/utils.js';
import { notifyComments } from '../../components/Comments.jsx';
import { canEdit } from './sections.js';

const REFRESH_DELAY = 350;
const TripContext = createContext(null);

function isTyping() {
  const active = document.activeElement;
  const app = document.getElementById('app');
  return Boolean(active && app?.contains(active) && active.matches('input:not([type=checkbox]):not([type=file]), textarea, select'));
}

export function TripProvider({ tripId, children }) {
  const [state, setState] = useState({ trip: null, members: [], error: null, isLoading: true });
  const [refreshKey, setRefreshKey] = useState(0);
  const busyRef = useRef(false);
  const pendingRef = useRef(false);

  const loadTrip = useCallback(async () => {
    try {
      const [trip, members] = await Promise.all([store.getTrip(tripId), store.listMembers(tripId).catch(() => [])]);
      if (!trip) throw new Error('Este viaje no existe o no tienes acceso.');
      registerAvatars(members.map((member) => ({ id: member.user_id, name: member.name, avatar_url: member.avatar_url })));
      setState({ trip, members, error: null, isLoading: false });
    } catch (error) {
      console.error(error);
      setState((current) => ({ ...current, error, isLoading: false }));
    }
  }, [tripId]);

  useEffect(() => {
    setState({ trip: null, members: [], error: null, isLoading: true });
    loadTrip();
  }, [loadTrip]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  // Refresco por cambios de otras personas: se aplaza si estas escribiendo o la vista esta ocupada
  const refreshSoon = useMemo(() => debounce(() => {
    if (isTyping() || busyRef.current) {
      pendingRef.current = true;
      return;
    }
    pendingRef.current = false;
    setRefreshKey((key) => key + 1);
  }, REFRESH_DELAY), []);

  const reloadSoon = useMemo(() => debounce(loadTrip, REFRESH_DELAY), [loadTrip]);

  // Tiempo real (y otras pestañas en modo local)
  useEffect(() => {
    const unsubscribe = store.subscribe(tripId, (payload) => {
      const table = payload?.table;
      if (table === 'trips' || table === 'trip_members') reloadSoon();
      else {
        if (!table || table === 'comments') notifyComments();
        refreshSoon();
      }
    });
    return () => unsubscribe?.();
  }, [tripId, refreshSoon, reloadSoon]);

  // Al terminar de escribir o al volver la conexion se aplica el refresco pendiente
  useEffect(() => {
    function focusOutHandler() {
      if (pendingRef.current) setTimeout(refreshSoon, 50);
    }
    function onlineHandler() {
      refreshSoon();
    }
    const app = document.getElementById('app');
    app?.addEventListener('focusout', focusOutHandler);
    window.addEventListener('online', onlineHandler);
    return () => {
      app?.removeEventListener('focusout', focusOutHandler);
      window.removeEventListener('online', onlineHandler);
    };
  }, [refreshSoon]);

  /* Una vista avisa de que esta ocupada (subiendo fotos): los refrescos esperan */
  const setBusy = useCallback((isBusy) => {
    busyRef.current = isBusy;
    if (!isBusy && pendingRef.current) refreshSoon();
  }, [refreshSoon]);

  const value = useMemo(() => {
    const { trip, members } = state;
    const role = trip?.role;
    return {
      tripId,
      trip,
      members,
      role,
      canEdit: canEdit(role),
      isOwner: role === 'owner',
      refreshKey,
      refresh,
      reloadTrip: loadTrip,
      setBusy
    };
  }, [state, tripId, refreshKey, refresh, loadTrip, setBusy]);

  return <TripContext.Provider value={{ ...value, error: state.error, isLoading: state.isLoading }}>{children}</TripContext.Provider>;
}

export function useTrip() {
  return useContext(TripContext);
}
