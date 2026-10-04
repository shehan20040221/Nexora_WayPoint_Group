import { useCallback, useEffect, useState } from 'react';
import { useOffline } from '../../offline';
import { getTrip } from './api';
import type { TripDetail } from './types';

/** Loads a trip and polls so a stale plan or a resolved exception shows up without a manual refresh. */
export function useTrip(id: string, pollMs = 6000) {
  const { online } = useOffline();
  const [data, setData] = useState<TripDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await getTrip(id));
      setError(null);
    } catch (e) {
      setError(e instanceof TypeError ? 'No connection. Showing the last loaded plan.' : (e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void reload();
    if (!online) return;
    const t = setInterval(reload, pollMs);
    return () => clearInterval(t);
  }, [reload, online, pollMs]);

  return { data, setData, error, reload };
}
