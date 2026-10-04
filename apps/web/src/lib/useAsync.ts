import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

/** Tiny data hook: { data, error, loading, reload }. Optional polling via `interval` (ms). */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList = [], interval?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn); fnRef.current = fn;
  const alive = useRef(true);

  const run = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try { const d = await fnRef.current(); if (alive.current) { setData(d); setError(null); } }
    catch (e: any) { if (alive.current) setError(e); }
    finally { if (alive.current) setLoading(false); }
  }, []);

  useEffect(() => {
    alive.current = true; run();
    const t = interval ? setInterval(() => run(true), interval) : undefined;
    return () => { alive.current = false; if (t) clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: () => run(true), setData };
}
