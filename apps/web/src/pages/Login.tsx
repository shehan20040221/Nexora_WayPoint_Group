import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Box, Lock, Mail, Radio, ShieldCheck, Truck, LucideIcon } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/RoleGuard';
import { Logo, cx } from '@/ui';
import type { Role } from '@/types';

const ROLES: { id: Role; label: string; desc: string; icon: LucideIcon }[] = [
  { id: 'dispatcher', label: 'Dispatcher', desc: 'Planning, allocation, and live route handoff', icon: Radio },
  { id: 'driver', label: 'Driver', desc: 'Trip execution, arrivals, and live status', icon: Truck },
  { id: 'loader', label: 'Loader', desc: 'Dock readiness, parcel staging, and handoff', icon: Box },
  { id: 'store', label: 'Store Manager', desc: 'Orders, deferrals, and receipt confirmation', icon: BarChart3 },
];
const DEMO_PASSWORD = 'ChangeMe123!';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [role, setRole] = useState<Role>('dispatcher');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const pick = (r: Role) => { setRole(r); setError(''); if (!email || /@waypoint\.demo$/.test(email)) setEmail(`${r}@waypoint.demo`); };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const u = await login({ email: email.trim(), password, role, remember });
      const from = loc.state?.from;
      nav(from && from.startsWith(`/${u.role}`) ? from : homeFor(u.role), { replace: true });
    } catch (err: any) {
      setError(err?.status === 0 ? 'No connection. Connect to the network to sign in.' : err?.message || 'Sign in failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-full place-items-center bg-[#E9E9E6] p-3 sm:p-8">
      <div className="grid w-full max-w-[1180px] overflow-hidden rounded-[28px] bg-white shadow-xl lg:grid-cols-[1fr_1.1fr]">
        <aside className="hidden flex-col justify-between bg-[#FDFAEC] p-10 lg:flex">
          <Logo size="lg" />
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3 py-1.5 text-[11px] font-semibold tracking-wide text-brand-dark"><span className="h-1.5 w-1.5 rounded-full bg-brand" />LIVE OPERATIONS</span>
            <h1 className="mt-5 text-[40px] font-bold leading-[1.1] tracking-tight">Every route, handoff, and decision in one place.</h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">Coordinate the day from dispatch to delivery with a shared operational view built for every role.</p>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted"><ShieldCheck size={15} />Secure access · Session activity is monitored</p>
        </aside>

        <form onSubmit={submit} className="p-6 sm:p-10">
          <div className="mb-6 lg:hidden"><Logo /></div>
          <h2 className="text-2xl font-semibold">Welcome back</h2>
          <p className="mt-1 text-sm text-muted">Sign in to your account to explore the features.</p>

          <h3 className="mt-7 text-base font-semibold">Choose your role</h3>
          <p className="mb-3 text-xs text-muted">Choose your role to sign in.</p>
          <div role="radiogroup" aria-label="Role" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ROLES.map(({ id, label, desc, icon: Icon }) => {
              const sel = role === id;
              return (
                <button type="button" key={id} role="radio" aria-checked={sel} onClick={() => pick(id)}
                  className={cx('rounded-2xl border p-4 text-left transition', sel ? 'border-brand-line bg-brand-tint' : 'border-gray-200 bg-white hover:border-brand-line')}>
                  <div className="flex items-center justify-between">
                    <span className={cx('grid h-9 w-9 place-items-center rounded-xl', sel ? 'bg-brand text-white' : 'bg-info-tint text-info')}><Icon size={17} /></span>
                    {sel ? <span className="rounded-full border border-brand-line bg-white px-2.5 py-0.5 text-[10px] font-semibold text-brand-dark">Selected</span> : <span className="h-4 w-4 rounded-full border border-gray-300" />}
                  </div>
                  <p className="mt-3 text-sm font-semibold">{label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">{desc}</p>
                </button>
              );
            })}
          </div>

          <div className="my-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400"><span className="h-px flex-1 bg-gray-200" />Account sign-in<span className="h-px flex-1 bg-gray-200" /></div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-sm font-semibold">Work email</span>
              <span className="relative block"><Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input className="wp-input pl-10" type="email" autoComplete="username" required placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></span></label>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold">Password</span>
              <span className="relative block"><Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input className="wp-input pl-10 pr-16" type={show ? 'text' : 'password'} autoComplete="current-password" required placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-info">{show ? 'Hide' : 'Show'}</button></span></label>
          </div>

          {error && <p role="alert" className="mt-4 rounded-xl bg-bad-tint px-4 py-3 text-sm text-bad">{error}</p>}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-brand" />Keep me signed in</label>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-night disabled:opacity-60">
              {busy ? 'Signing in…' : 'Sign in securely'}<ArrowRight size={16} />
            </button>
          </div>

          <button type="button" onClick={() => { setEmail(`${role}@waypoint.demo`); setPassword(DEMO_PASSWORD); }} className="mt-5 text-xs font-medium text-brand-dark underline-offset-2 hover:underline">
            Judge demo: fill {role} credentials
          </button>
        </form>
      </div>
    </div>
  );
}
