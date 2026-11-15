import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';

// Runs an async loader on mount / when deps change. Returns { data, loading, error, reload }.
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const run = useCallback(async (silent = false) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      if (id === seq.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (id === seq.current) setState((s) => ({ data: silent ? s.data : null, loading: false, error: errorMessage(e) }));
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}
