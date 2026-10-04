import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import cors from 'cors';
import express, { Router, type ErrorRequestHandler } from 'express';
import { openDb, migrate, type Db } from './db';
import { authRouter, requireAuth } from './auth';
import { publishPlan } from './publish';
import { HttpError } from './shared';
import { storeRouter } from './routes/store';
import { dispatcherRouter } from './routes/dispatcher';
import { loaderRouter } from './routes/loader';
import { driverRouter } from './routes/driver';

export async function createApp(db: Db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '15mb' })); // signatures/photos arrive as base64 data URLs
  const api = Router();
  api.get('/health', (_q, res) => res.json({ ok: true }));
  api.use(authRouter(db));
  api.use(storeRouter(db));
  api.use(dispatcherRouter(db));
  api.use(loaderRouter(db));
  api.use(driverRouter(db));

  // Person B owns ./planning.ts. Contract: export function planningRouter(deps): Router
  try {
    const spec = './planning'; // optional module owned by Person B
    const mod: any = await import(spec);
    api.use(mod.planningRouter({ db, requireAuth, publishPlan: (planId: string) => publishPlan(db, planId) }));
  } catch (e: any) {
    if (!/Cannot find module|Failed to load url|ERR_MODULE_NOT_FOUND/.test(String(e?.message ?? e))) throw e;
    console.warn('[api] planning.ts not found yet: /plan/* returns 501 until Person B lands it');
    api.use('/plan', (_q, res) => res.status(501).json({ error: 'planning module not installed yet' }));
  }
  app.use('/api', api);

  const web = process.env.WEB_DIST ?? resolve(process.cwd(), '../web/dist');
  if (existsSync(web)) { app.use(express.static(web)); app.get(/^\/(?!api).*/, (_q, res) => res.sendFile(resolve(web, 'index.html'))); }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  };
  app.use(onError);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = await openDb(process.env.DATABASE_URL ?? 'pglite://./.pgdata');
  await migrate(db);
  if (process.env.AUTO_SEED !== '0' && !(await db.query('SELECT 1 FROM users LIMIT 1')).rows.length) {
    const { seed } = await import('./seed/seed');
    await seed(db);
  }
  const port = Number(process.env.PORT ?? 4000);
  (await createApp(db)).listen(port, () => console.log(`[api] listening on :${port}`));
}
