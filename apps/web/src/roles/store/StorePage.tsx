import { ReactNode } from 'react';
import { PillTabs } from '@/ui';
import { STORE_NAV } from '@/layouts/navConfig';

/** Page title block + pill tabs, as in the store designs. */
export function StorePage({ title, subtitle, chips, children }: { title: string; subtitle?: string; chips?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}</div>
        {chips && <div className="flex flex-wrap gap-2">{chips}</div>}
      </div>
      <PillTabs items={STORE_NAV} />
      {children}
    </div>
  );
}

export const Loading = ({ what = 'Loading…' }: { what?: string }) => <p className="py-10 text-center text-sm text-muted">{what}</p>;
export const ErrorBox = ({ error, retry }: { error: Error; retry?: () => void }) => (
  <div className="rounded-xl bg-bad-tint p-4 text-sm text-bad">{error.message}{retry && <button onClick={retry} className="ml-3 font-semibold underline">Retry</button>}</div>
);
