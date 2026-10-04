import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Q { query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>; }
export interface Db extends Q {
  tx<T>(fn: (q: Q) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

/** DATABASE_URL=postgres://...  (production / docker)   or   pglite://memory | pglite://./.pgdata (no Docker needed) */
export async function openDb(url: string): Promise<Db> {
  if (url.startsWith('pglite://')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = url.slice('pglite://'.length);
    const pg = new PGlite(dir && dir !== 'memory' ? dir : undefined);
    await pg.waitReady;
    return {
      query: (s, p) => pg.query(s, p) as any,
      tx: (fn) => pg.transaction((t) => fn({ query: (s, p) => t.query(s, p) as any })),
      exec: async (s) => { await pg.exec(s); },
      close: () => pg.close(),
    };
  }
  const pgmod = await import('pg');
  const { Pool, types } = pgmod.default ?? pgmod;
  types.setTypeParser(20, (v: string) => Number(v));   // int8
  types.setTypeParser(1700, (v: string) => Number(v)); // numeric
  const pool = new Pool({ connectionString: url });
  return {
    query: (s, p) => pool.query(s, p) as any,
    tx: async (fn) => {
      const c = await pool.connect();
      try { await c.query('BEGIN'); const r = await fn({ query: (s, p) => c.query(s, p) as any }); await c.query('COMMIT'); return r; }
      catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    },
    exec: async (s) => { await pool.query(s); },
    close: () => pool.end(),
  };
}

export async function migrate(db: Db) {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = process.env.SCHEMA_PATH ?? resolve(here, '../../../db/schema.sql');
  await db.exec(readFileSync(path, 'utf8'));
}
