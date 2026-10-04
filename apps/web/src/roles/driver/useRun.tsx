import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useOffline } from '../../offline';
import { getRun } from './api';
import type { Run, Stop } from './types';

const CACHE = 'wp.driver.run';
const readCache = (): Run | null => {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? 'null');
  } catch {
    return null;
  }
};

interface Ctx {
  run: Run | null;
  stops: Stop[];
  nextStop: Stop | undefined;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}
const RunCtx = createContext<Ctx | null>(null);
export const useRunCtx = () => useContext(RunCtx)!;

export function RunProvider({ children }: { children: ReactNode }) {
  const sync = useOffline();
  const [run, setRun] = useState<Run | null>(readCache);
  const [loading, setLoading] = useState(!run);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const r = await getRun();
      setRun(r);
      localStorage.setItem(CACHE, JSON.stringify(r)); // keep the route usable if the app reloads offline
      setError(null);
    } catch {
      setError('Showing your saved route. It will refresh when you are back online.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void reload(), [reload]);

  // After every successful sync, pull the server's truth.
  const lastSync = useRef(sync.lastSyncedAt);
  useEffect(() => {
    if (sync.lastSyncedAt !== lastSync.current && sync.pending === 0) void reload();
    lastSync.current = sync.lastSyncedAt;
  }, [sync.lastSyncedAt, sync.pending, reload]);

  // Overlay saved-but-unsent operations so the UI moves on immediately, online or not.
  const stops = useMemo(() => {
    if (!run) return [];
    const out = run.stops.map((s) => {
      let status = s.status;
      for (const op of sync.queued) {
        if (op.stopId !== s.id || op.status !== 'pending') continue;
        status = op.type === 'arrive' ? 'arrived' : op.type === 'deliver' ? 'delivered' : 'unable';
      }
      return { ...s, status };
    });
    let found = false;
    return out.map((s) => {
      if (['arrived', 'delivered', 'unable'].includes(s.status)) return s;
      const status = found ? 'upcoming' : 'next';
      found = true;
      return { ...s, status } as Stop;
    });
  }, [run, sync.queued]);

  const nextStop = stops.find((s) => s.status === 'arrived') ?? stops.find((s) => s.status === 'next');
  return <RunCtx.Provider value={{ run, stops, nextStop, loading, error, reload }}>{children}</RunCtx.Provider>;
}
