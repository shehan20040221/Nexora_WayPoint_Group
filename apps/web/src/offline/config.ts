import { isOnline } from './network';

export interface SyncOp {
  opId: string;
  type: 'arrive' | 'deliver' | 'exception';
  stopId: string;
  payload: unknown;
  deviceTime: string;
}
export interface SyncResult {
  applied: string[];
  duplicates: string[];
  conflicts: { opId: string; message: string }[];
}
export interface OfflineConfig {
  baseUrl: string;
  getToken: () => string | null;
  useFixtures: boolean;
  /** Fixture-mode stand-in for POST /sync. The driver fixtures register one. */
  fixtureSync?: (ops: SyncOp[]) => SyncResult;
}

const env = ((import.meta as unknown as { env?: Record<string, string> }).env) ?? {};
let cfg: OfflineConfig = {
  baseUrl: env.VITE_API_URL ?? '/api',
  getToken: () => (typeof localStorage === 'undefined' ? null : localStorage.getItem('wp_token')),
  useFixtures: env.VITE_USE_FIXTURES === '1',
};

/** Person C wires the real token getter / fixtures switch here once. */
export const configureOffline = (p: Partial<OfflineConfig>) => {
  cfg = { ...cfg, ...p };
};
export const getConfig = () => cfg;

export class ApiError extends Error {
  constructor(public status: number, public body: any) {
    super(body?.message ?? `HTTP ${status}`);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isOnline()) throw new TypeError('offline');
  const token = cfg.getToken();
  const res = await fetch(cfg.baseUrl + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json() as Promise<T>;
}
