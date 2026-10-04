import { matchFixture } from './fixtures';

export const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === 'true';
const BASE = '/api';

let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };
export const getToken = () => token;

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) { super(message); }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (USE_FIXTURES) {
    const hit = matchFixture(method, path, body, token);
    if (!hit) throw new ApiError(404, `No fixture for ${method} ${path}`);
    await new Promise((r) => setTimeout(r, 120)); // feel like a network call
    try { return structuredClone(await hit.handler(hit.ctx)); }
    catch (e: any) { if (e instanceof ApiError) throw e; throw new ApiError(500, e?.message || 'Fixture error'); }
  }
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Network unavailable');
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (res.status === 401 && path !== '/auth/login') onUnauthorized?.();
  if (!res.ok) throw new ApiError(res.status, data?.message || data?.error || res.statusText, data);
  return data as T;
}
const safeJson = (t: string) => { try { return JSON.parse(t); } catch { return { message: t }; } };

export const api = {
  get: <T = any>(p: string) => request<T>('GET', p),
  post: <T = any>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
};
