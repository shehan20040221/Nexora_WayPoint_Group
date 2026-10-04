import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import type { Db } from './db';
import { HttpError } from './shared';

export type Role = 'dispatcher' | 'loader' | 'driver' | 'store';
export interface AuthUser { id: string; email: string; role: Role; name: string; outletId?: string; vehicleId?: string; depot?: string }
declare module 'express-serve-static-core' { interface Request { user?: AuthUser } }

const secret = () => process.env.JWT_SECRET ?? 'dev-secret-change-me';
export const h = (fn: (req: Request, res: Response) => Promise<any>): RequestHandler => (req, res, next) => { fn(req, res).catch(next); };

const publicUser = (u: AuthUser) => ({ email: u.email, role: u.role, name: u.name, outletId: u.outletId, vehicleId: u.vehicleId });
const fromRow = (r: any): AuthUser => ({ id: r.id, email: r.email, role: r.role, name: r.name, outletId: r.outlet_id ?? undefined, vehicleId: r.vehicle_id ?? undefined, depot: r.depot ?? undefined });

/** Exported so Person B can protect planning routes: `requireAuth('dispatcher')`. */
export const requireAuth = (...roles: Role[]): RequestHandler => (req: Request, _res: Response, next: NextFunction) => {
  const m = /^Bearer (.+)$/.exec(req.header('authorization') ?? '');
  if (!m) return next(new HttpError(401, 'Missing bearer token'));
  try { req.user = jwt.verify(m[1], secret()) as AuthUser; } catch { return next(new HttpError(401, 'Invalid or expired token')); }
  if (roles.length && !roles.includes(req.user.role)) return next(new HttpError(403, `Requires role: ${roles.join(' or ')}`));
  next();
};

export function authRouter(db: Db) {
  const r = Router();
  r.post('/auth/login', h(async (req, res) => {
    const { email, password, role } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') throw new HttpError(400, 'email and password required');
    const row = (await db.query('SELECT * FROM users WHERE lower(email)=lower($1)', [email])).rows[0];
    if (!row || !(await bcrypt.compare(password, row.password_hash))) throw new HttpError(401, 'Invalid email or password');
    if (role && role !== row.role) throw new HttpError(401, `This account is a ${row.role} account, not ${role}`);
    const user = fromRow(row);
    const token = jwt.sign(user, secret(), { expiresIn: '12h' });
    res.json({ token, user: publicUser(user) });
  }));
  r.get('/me', requireAuth(), h(async (req, res) => { res.json(publicUser(req.user!)); }));
  return r;
}
