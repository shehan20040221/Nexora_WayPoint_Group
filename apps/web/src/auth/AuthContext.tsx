import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, setToken, setUnauthorizedHandler } from '@/api/client';
import type { Role, User } from '@/types';

const KEY = 'waypoint.session';
interface Ctx {
  user: User | null; ready: boolean;
  login: (a: { email: string; password: string; role: Role; remember: boolean }) => Promise<User>;
  logout: () => void;
}
const AuthCtx = createContext<Ctx>(null as any);
export const useAuth = () => useContext(AuthCtx);

/** Token lives in memory; with "keep me signed in" it is also persisted to localStorage. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setToken(null); setUser(null);
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    let saved: { token: string; user: User } | null = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* ignore */ }
    if (!saved) { setReady(true); return; }
    setToken(saved.token);
    api.get<User>('/me').then(setUser).catch(() => {
      // offline: trust the cached user so field roles can still open the app
      if (!navigator.onLine) setUser(saved!.user); else logout();
    }).finally(() => setReady(true));
  }, [logout]);

  const login: Ctx['login'] = useCallback(async ({ email, password, role, remember }) => {
    const r = await api.post<{ token: string; user: User }>('/auth/login', { email, password, role });
    setToken(r.token); setUser(r.user);
    try { if (remember) localStorage.setItem(KEY, JSON.stringify(r)); else localStorage.removeItem(KEY); } catch { /* ignore */ }
    return r.user;
  }, []);

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready, login, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
