import { apiFetch, getConfig, SyncOp, SyncResult } from './config';
import { isOnline, isSimulatingOffline, subscribeNetwork } from './network';
import { allOps, deleteOps, putOp, QueuedOp, OpType } from './queue';

export interface SyncState {
  online: boolean;
  simulate: boolean;
  queued: QueuedOp[]; // pending + conflicts, oldest first
  pending: number;
  conflicts: QueuedOp[];
  syncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

let state: SyncState = {
  online: isOnline(),
  simulate: isSimulatingOffline(),
  queued: [],
  pending: 0,
  conflicts: [],
  syncing: false,
  lastSyncedAt: null,
  lastError: null,
};
const subs = new Set<() => void>();
const set = (p: Partial<SyncState>) => {
  state = { ...state, ...p };
  subs.forEach((f) => f());
};
export const getSyncState = () => state;
export const subscribeSync = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

async function refresh() {
  const queued = await allOps();
  set({
    queued,
    pending: queued.filter((o) => o.status === 'pending').length,
    conflicts: queued.filter((o) => o.status === 'conflict'),
  });
}

async function postSync(ops: SyncOp[]): Promise<SyncResult> {
  const cfg = getConfig();
  if (cfg.useFixtures) {
    return (
      cfg.fixtureSync?.(ops) ?? { applied: ops.map((o) => o.opId), duplicates: [], conflicts: [] }
    );
  }
  return apiFetch<SyncResult>('/sync', { method: 'POST', body: JSON.stringify({ ops }) });
}

let timer: ReturnType<typeof setTimeout> | undefined;
let attempt = 0;

export async function flush(): Promise<void> {
  if (state.syncing || !isOnline()) return;
  const ops = (await allOps()).filter((o) => o.status === 'pending');
  if (!ops.length) return;
  set({ syncing: true, lastError: null });
  try {
    const body: SyncOp[] = ops.map(({ opId, type, stopId, payload, deviceTime }) => ({
      opId,
      type,
      stopId,
      payload,
      deviceTime,
    }));
    const r = await postSync(body);
    await deleteOps([...r.applied, ...r.duplicates]);
    for (const c of r.conflicts) {
      const op = ops.find((o) => o.opId === c.opId);
      if (op) await putOp({ ...op, status: 'conflict', message: c.message });
    }
    attempt = 0;
    set({ lastSyncedAt: new Date().toISOString() });
  } catch (e) {
    attempt += 1;
    set({ lastError: e instanceof Error ? e.message : 'Sync failed' });
    clearTimeout(timer);
    timer = setTimeout(flush, Math.min(30000, 1000 * 2 ** attempt)); // exponential backoff, max 30s
  } finally {
    set({ syncing: false });
    await refresh();
  }
}

/** Save an operation on the device first, then try to send it. Never blocks on the network. */
export async function queueOp(type: OpType, stopId: string, payload: unknown) {
  const op: QueuedOp = {
    opId: uuid(),
    type,
    stopId,
    payload,
    deviceTime: new Date().toISOString(),
    createdAt: Date.now(),
    status: 'pending',
  };
  await putOp(op);
  await refresh();
  void flush();
  return op;
}

export async function dismissConflict(opId: string) {
  await deleteOps([opId]);
  await refresh();
}

let started = false;
export function initOffline() {
  if (started || typeof window === 'undefined') return;
  started = true;
  subscribeNetwork(() => {
    set({ online: isOnline(), simulate: isSimulatingOffline() });
    if (isOnline()) void flush();
  });
  void refresh().then(flush);
  setInterval(() => {
    if (state.pending > 0) void flush();
  }, 20000);
}
initOffline();
