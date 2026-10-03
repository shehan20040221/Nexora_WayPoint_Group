import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { validate } from '@waypoint/engine';
import { dbOk } from './db.js';

type Role = 'dispatcher' | 'loader' | 'driver' | 'store';
const pass = process.env.SEED_PASSWORD ?? 'ChangeMe123!';
// TODO(P1): move to Postgres users table with bcrypt hashes.
const users = [
  { email: 'dispatcher@waypoint.demo', role: 'dispatcher', name: 'Kusal Perera' },
  { email: 'loader@waypoint.demo', role: 'loader', name: 'J. Miller' },
  { email: 'driver@waypoint.demo', role: 'driver', name: 'Roshan Bandara' },
  { email: 'store@waypoint.demo', role: 'store', name: 'Chandana Perera' },
] as { email: string; role: Role; name: string }[];

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-change-me' });

const auth = (roles?: Role[]) => async (req: any, reply: any) => {
  try { await req.jwtVerify(); } catch { return reply.code(401).send({ error: 'unauthorized' }); }
  if (roles && !roles.includes(req.user.role)) return reply.code(403).send({ error: 'forbidden' });
};

app.get('/api/health', async (_req, reply) => {
  const db = await dbOk();
  return reply.code(db ? 200 : 503).send({ ok: db, db });
});
app.post('/api/auth/login', async (req: any, reply) => {
  const { email, password, role } = req.body ?? {};
  const u = users.find(x => x.email === email && x.role === role);
  if (!u || password !== pass) return reply.code(401).send({ error: 'invalid credentials' });
  return { token: app.jwt.sign({ email: u.email, role: u.role, name: u.name }, { expiresIn: '12h' }), user: u };
});
app.get('/api/me', { preHandler: auth() }, async (req: any) => req.user);
// Validate a draft allocation (used by the planning screen on every drop).
app.post('/api/plans/validate', { preHandler: auth(['dispatcher']) }, async (req: any) => {
  const { trips, vehicles, districts, allowance } = req.body;
  const violations = validate(trips, vehicles, districts, allowance);
  return { ok: violations.length === 0, violations };
});

await app.listen({ port: Number(process.env.PORT ?? 4000), host: '0.0.0.0' });
