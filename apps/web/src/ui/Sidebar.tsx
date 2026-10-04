import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cx } from './cx';

export interface NavItem { to: string; label: string; icon?: LucideIcon; end?: boolean }

/** Left nav for desktop roles (dispatcher, loader on terminal). */
export function Sidebar({ items }: { items: NavItem[] }) {
  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 lg:flex">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition', isActive ? 'bg-brand-tint text-brand-dark' : 'text-ink/70 hover:bg-black/5')}>
          {Icon && <Icon size={17} />}{label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Pill tabs under the page title (store design). */
export function PillTabs({ items }: { items: NavItem[] }) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Sections">
      {items.map(({ to, label, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition', isActive ? 'border-brand-line bg-brand-tint text-brand-dark' : 'border-gray-200 bg-white hover:bg-black/5')}>{label}</NavLink>
      ))}
    </nav>
  );
}

/** Phone bottom navigation (driver, loader). */
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-xl">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', isActive ? 'text-brand-dark' : 'text-muted')}>
            {Icon && <Icon size={20} />}{label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
