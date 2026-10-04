import { Cloud, CloudOff, Clock, LogOut, UserRound } from 'lucide-react';
import { ReactNode } from 'react';
import { Logo } from './Logo';
import { Chip } from './StatusChip';
import { useOnline } from '@/lib/useOnline';
import { useAuth } from '@/auth/AuthContext';
import { cx } from './cx';

/** Header used by every role. `sub` is the small brand line under the logo (e.g. FRESH). */
export function TopBar({ sub, shift, extra, compact }: { sub?: string; shift?: string; extra?: ReactNode; compact?: boolean }) {
  const online = useOnline();
  const { user, logout } = useAuth();
  return (
    <header className={cx('flex flex-wrap items-center justify-between gap-3', compact ? 'py-2' : 'py-4')}>
      <Logo sub={sub} />
      <div className="flex flex-wrap items-center gap-2">
        {online
          ? <Chip tone="ok"><Cloud size={14} /> Online</Chip>
          : <Chip tone="warn"><CloudOff size={14} /> Offline · changes saved on device</Chip>}
        {shift && <Chip className="hidden sm:inline-flex"><Clock size={13} /> {shift}</Chip>}
        {extra}
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white py-1.5 pl-2 pr-1.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-tint text-brand-dark"><UserRound size={15} /></span>
          <span className="hidden text-xs font-semibold sm:block">{user?.name}</span>
          <button onClick={logout} title="Sign out" aria-label="Sign out" className="rounded-lg p-1.5 text-muted hover:bg-black/5"><LogOut size={15} /></button>
        </div>
      </div>
    </header>
  );
}
