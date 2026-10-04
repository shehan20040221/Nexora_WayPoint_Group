/**
 * Fixture registry. Every UI person registers handlers for the endpoints they build against,
 * from inside their own folder (e.g. roles/store/fixtures.ts). The API client falls back to
 * these when VITE_USE_FIXTURES=true. Switching to the real API = flip the env flag.
 *
 * Pattern syntax: "GET /orders/:id" - ":name" segments match any value; query strings are ignored
 * for matching but passed to the handler.
 */
export interface FixtureCtx {
  params: Record<string, string>;
  query: URLSearchParams;
  body: any;
  token: string | null;
}
export type FixtureHandler = (ctx: FixtureCtx) => any;
type Entry = { method: string; parts: string[]; handler: FixtureHandler };

const entries: Entry[] = [];

export function registerFixture(pattern: string, handler: FixtureHandler) {
  const [method, path] = pattern.split(' ');
  entries.push({ method, parts: path.split('/').filter(Boolean), handler });
}

export function matchFixture(method: string, rawPath: string, body: any, token: string | null) {
  const [path, qs = ''] = rawPath.split('?');
  const segs = path.split('/').filter(Boolean);
  for (const e of entries) {
    if (e.method !== method || e.parts.length !== segs.length) continue;
    const params: Record<string, string> = {};
    const ok = e.parts.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = segs[i]), true) : p === segs[i]));
    if (ok) return { handler: e.handler, ctx: { params, query: new URLSearchParams(qs), body, token } as FixtureCtx };
  }
  return null;
}
