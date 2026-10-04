import { api, ApiError } from '@/api/client';
import { isOnline } from './useOnline';

/**
 * Store-side offline safety net. If a write fails because the network is gone (status 0, or the
 * simulated-offline switch is on) it is saved to localStorage and replayed when connectivity
 * returns, so a store manager never loses an order or a receipt. (Driver/loader use the IndexedDB
 * queue in src/offline, owned by Person D.)
 */
const KEY = 'waypoint.store.queue';
export interface Queued { id: string; path: string; body: unknown; label: string; savedAt: string }

const read = (): Queued[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (q: Queued[]) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* ignore */ } window.dispatchEvent(new Event('wp-queue')); };
export const getQueue = () => read();

export async function queuedPost<T = any>(path: string, body: unknown, label: string): Promise<{ queued: false; data: T } | { queued: true }> {
  if (isOnline()) {
    try { return { queued: false, data: await api.post<T>(path, body) }; }
    catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
  }
  write([...read(), { id: crypto.randomUUID(), path, body, label, savedAt: new Date().toISOString() }]);
  return { queued: true };
}

let flushing = false;
export async function flushQueue(): Promise<number> {
  if (flushing || !isOnline()) return 0;
  flushing = true; let done = 0;
  try {
    for (const item of read()) {
      try { await api.post(item.path, item.body); }
      catch (e) {
        if (e instanceof ApiError && e.status === 0) break;          // still offline, keep it
        if (!(e instanceof ApiError) || e.status < 400 || e.status >= 500) break; // server trouble, retry later
        // 4xx = server rejected it for good: drop so the queue cannot jam
      }
      write(read().filter((q) => q.id !== item.id)); done++;
    }
  } finally { flushing = false; }
  return done;
}
