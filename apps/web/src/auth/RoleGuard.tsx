import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Role } from '@/types';

export const homeFor = (role: Role) => `/${role}`;

export function RoleGuard({ role }: { role: Role }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="grid h-full place-items-center text-sm text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}
