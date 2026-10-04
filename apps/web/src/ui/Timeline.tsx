import { Check } from 'lucide-react';
import { cx } from './cx';

export interface Step { label: string; time?: string | null; done: boolean }

/** Horizontal stepper (store tracking, design: Order Received -> Arrived). */
export function Stepper({ steps }: { steps: Step[] }) {
  return (
    <div className="overflow-x-auto"><ol className="flex w-full min-w-[460px] items-start">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex flex-1 flex-col items-start">
          <div className="flex w-full items-center">
            <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full border-2', s.done ? 'border-ok bg-ok text-white' : 'border-gray-200 bg-white text-gray-300')}>
              {s.done ? <Check size={14} strokeWidth={3} /> : <span className="h-1 w-1 rounded-full bg-current" />}
            </span>
            {i < steps.length - 1 && <span className={cx('mx-1 h-0.5 flex-1', s.done && steps[i + 1].done ? 'bg-ok' : 'bg-gray-200')} />}
          </div>
          <p className="mt-2 text-[11px] font-medium leading-tight sm:text-xs">{s.label}</p>
          <p className="text-[10px] text-muted">{s.time || 'N/A'}</p>
        </li>
      ))}
    </ol></div>
  );
}

/** Vertical timeline (activity feeds, order history). */
export function Timeline({ items }: { items: { time: string; title: string; detail?: string }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="grid grid-cols-[64px_1fr] gap-3 text-sm">
          <span className="font-semibold text-brand-dark">{it.time}</span>
          <span><span className="font-medium">{it.title}</span>{it.detail && <span className="block text-xs text-muted">{it.detail}</span>}</span>
        </li>
      ))}
    </ul>
  );
}
