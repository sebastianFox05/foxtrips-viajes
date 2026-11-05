/*
 * Carga datos asincronos para una vista. Mientras llega la nueva version se sigue mostrando la anterior
 * (como hacia renderPanel(): solo se repintaba al tener los datos) y se descartan respuestas viejas.
 * const { data, error, isLoading, reload } = useLoad(() => store.list('photos', tripId), [tripId, refreshKey]);
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useLoad(loader, deps) {
  const [state, setState] = useState({ data: undefined, error: null, isLoading: true });
  const seqRef = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    const seq = ++seqRef.current;
    setState((current) => ({ ...current, isLoading: true }));
    try {
      const data = await loaderRef.current();
      if (seq === seqRef.current) setState({ data, error: null, isLoading: false });
    } catch (error) {
      if (seq === seqRef.current) setState((current) => ({ ...current, error, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run };
}
