// IndexedDB-backed queue of field operations. Falls back to memory if IndexedDB is unavailable.
export type OpType = 'arrive' | 'deliver' | 'exception';
export interface QueuedOp {
  opId: string;
  type: OpType;
  stopId: string;
  payload: unknown;
  deviceTime: string;
  createdAt: number;
  status: 'pending' | 'conflict';
  message?: string;
}

const DB_NAME = 'waypoint-offline';
const STORE = 'ops';
const mem = new Map<string, QueuedOp>();
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'opId' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function putOp(op: QueuedOp) {
  mem.set(op.opId, op);
  try {
    await run('readwrite', (s) => s.put(op));
  } catch {
    /* memory copy is enough */
  }
}

export async function allOps(): Promise<QueuedOp[]> {
  let ops: QueuedOp[];
  try {
    ops = await run<QueuedOp[]>('readonly', (s) => s.getAll());
  } catch {
    ops = [...mem.values()];
  }
  return ops.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteOps(ids: string[]) {
  for (const id of ids) {
    mem.delete(id);
    try {
      await run('readwrite', (s) => s.delete(id));
    } catch {
      /* ignore */
    }
  }
}
