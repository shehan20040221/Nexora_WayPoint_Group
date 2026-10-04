import { useEffect, useSyncExternalStore } from 'react';

/**
 * Single source of truth for connectivity. Person D's offline layer calls setSimulatedOffline()
 * from the "Simulate offline" toggle so every banner in the app reacts.
 */
let simulated = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const setSimulatedOffline = (v: boolean) => { simulated = v; emit(); };
export const isSimulatedOffline = () => simulated;
export const isOnline = () => navigator.onLine && !simulated;

const subscribe = (cb: () => void) => {
  subs.add(cb);
  window.addEventListener('online', cb); window.addEventListener('offline', cb);
  return () => { subs.delete(cb); window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
};
export function useOnline() {
  useEffect(() => {}, []);
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
