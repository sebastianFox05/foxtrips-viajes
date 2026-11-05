/* Sesion: arranca el almacen (local o Supabase) y expone el usuario actual. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { store } from '../lib/store/index.js';
import { registerAvatars } from '../lib/utils.js';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let isCurrent = true;
    store.init()
      .catch((error) => console.error(error))
      .finally(() => {
        if (!isCurrent) return;
        setUser(store.user ? { ...store.user } : null);
        setIsReady(true);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  /* Tras entrar, salir o cambiar el perfil: vuelve a leer el usuario del almacen */
  const refreshUser = useCallback(() => {
    setUser(store.user ? { ...store.user } : null);
  }, []);

  if (user) registerAvatars([user]);

  const value = useMemo(() => ({ isReady, user, refreshUser }), [isReady, user, refreshUser]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
