import { ReactNode } from 'react';
import { cx } from './cx';
import type { OrderStatus } from '@/types';

export type Tone = 'brand' | 'ok' | 'warn' | 'bad' | 'info' | 'neutral';
const T: Record<Tone, string> = {
  brand: 'bg-brand-tint text-brand-dark', ok: 'bg-ok-tint text-ok', warn: 'bg-warn-tint text-warn',
  bad: 'bg-bad-tint text-bad', info: 'bg-info-tint text-info', neutral: 'bg-white text-ink border border-gray-200',
};
export function Chip({ tone = 'neutral', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold', T[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  confirmed: { label: 'Confirmed', tone: 'brand' }, planned: { label: 'Scheduled', tone: 'info' },
  loading: { label: 'Loading', tone: 'info' }, loaded: { label: 'Loaded', tone: 'info' },
  in_transit: { label: 'Out for delivery', tone: 'info' }, delivered: { label: 'Arrived', tone: 'ok' },
  partial: { label: 'Partial delivery', tone: 'warn' }, unable: { label: 'Not delivered', tone: 'bad' },
  deferred: { label: 'Deferred', tone: 'warn' }, received: { label: 'Received', tone: 'ok' },
  issue: { label: 'Issue reported', tone: 'bad' },
};
export const statusLabel = (s: OrderStatus) => STATUS[s].label;
export function StatusChip({ status }: { status: OrderStatus }) {
  const s = STATUS[status];
  return <Chip tone={s.tone}>{s.label}</Chip>;
}
