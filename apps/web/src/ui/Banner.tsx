import { ReactNode } from 'react';
import { cx } from './cx';

type Tone = 'dark' | 'warn' | 'bad' | 'ok' | 'info';
const T: Record<Tone, string> = {
  dark: 'bg-night text-white', warn: 'border border-warn/30 bg-warn-tint text-ink',
  bad: 'border border-bad/30 bg-bad-tint text-ink', ok: 'border border-ok/30 bg-ok-tint text-ink', info: 'border border-info/30 bg-info-tint text-ink',
};
export function Banner({ tone = 'info', icon, title, children, action, className }: {
  tone?: Tone; icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cx('flex flex-wrap items-center gap-4 rounded-xl2 px-5 py-4', T[tone], className)}>
      {icon && <div className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-xl', tone === 'dark' ? 'bg-white/10' : 'bg-white')}>{icon}</div>}
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold leading-snug">{title}</p>
        {children && <div className={cx('mt-0.5 text-xs', tone === 'dark' ? 'text-white/70' : 'text-muted')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
