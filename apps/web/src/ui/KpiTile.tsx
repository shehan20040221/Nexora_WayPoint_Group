import { ReactNode } from 'react';
import { cx } from './cx';

export function KpiTile({ label, value, hint, hintTone = 'muted', className }: {
  label: string; value: ReactNode; hint?: ReactNode; hintTone?: 'muted' | 'ok' | 'warn' | 'bad' | 'brand' | 'info'; className?: string;
}) {
  const tone = { muted: 'text-muted', ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', brand: 'text-brand-dark', info: 'text-info' }[hintTone];
  return (
    <div className={cx('wp-tint p-4', className)}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold leading-tight sm:text-2xl">{value}</p>
      {hint && <p className={cx('mt-1 text-xs font-medium', tone)}>{hint}</p>}
    </div>
  );
}
