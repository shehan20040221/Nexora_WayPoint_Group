import { registerFixture } from './fixtures';
import { ApiError } from './client';
import type { Role, User } from '@/types';

const USERS: Record<string, User> = {
  'dispatcher@waypoint.demo': { email: 'dispatcher@waypoint.demo', role: 'dispatcher', name: 'Nimal Fernando' },
  'loader@waypoint.demo': { email: 'loader@waypoint.demo', role: 'loader', name: 'Kasun Jayasinghe' },
  'driver@waypoint.demo': { email: 'driver@waypoint.demo', role: 'driver', name: 'Ruwan Silva', vehicleId: 'VEH014' },
  'store@waypoint.demo': { email: 'store@waypoint.demo', role: 'store', name: 'Chandana Perera', outletId: 'OUT007' },
};
export const FIXTURE_PASSWORD = 'ChangeMe123!';

registerFixture('POST /auth/login', ({ body }) => {
  const u = USERS[String(body.email || '').toLowerCase()];
  if (!u || body.password !== FIXTURE_PASSWORD) throw new ApiError(401, 'Incorrect email or password');
  if (u.role !== (body.role as Role)) throw new ApiError(403, `This account is a ${u.role}, not a ${body.role}`);
  return { token: `fixture.${u.email}`, user: u };
});
registerFixture('GET /me', ({ token }) => {
  const u = USERS[(token || '').replace('fixture.', '')];
  if (!u) throw new ApiError(401, 'Unauthorized');
  return u;
});
