import { Link } from 'react-router-dom';
import { useRunCtx } from './useRun';
import { Card, Chip, Tone } from '../loader/ui';
import type { StopStatus } from './types';

export const statusChip: Record<StopStatus, { text: string; tone: Tone }> = {
  upcoming: { text: 'Upcoming', tone: 'neutral' },
  next: { text: 'Next stop', tone: 'orange' },
  arrived: { text: 'At stop', tone: 'blue' },
  delivered: { text: 'Delivered', tone: 'green' },
  unable: { text: 'Not delivered', tone: 'red' },
};

export default function StopList() {
  const { stops, run, loading, error } = useRunCtx();
  if (loading) return <p className="p-4 text-sm text-slate-500">Loading your route…</p>;
  if (!run) return <p className="p-4 text-sm text-slate-500">No route assigned yet.</p>;

  const done = stops.filter((s) => s.status === 'delivered' || s.status === 'unable').length;
  const parcelsDone = stops.filter((s) => s.status === 'delivered').reduce((a, s) => a + s.parcels, 0);
  const parcels = stops.reduce((a, s) => a + s.parcels, 0);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">{done === stops.length ? 'Route complete' : 'Your route'}</h1>
        <p className="text-sm text-slate-500">{run.route.name} · {done} of {stops.length} stops · {parcelsDone}/{parcels} parcels</p>
        <div className="mt-2 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-[#FF8D56]" style={{ width: `${stops.length ? (done / stops.length) * 100 : 0}%` }} /></div>
      </div>
      {error && <Card tone="orange" className="text-sm">{error}</Card>}
      <ol className="space-y-3">
        {stops.map((s) => {
          const c = statusChip[s.status];
          const active = s.status === 'next' || s.status === 'arrived';
          return (
            <li key={s.id}>
              <Link to={`stop/${s.id}`} className={`block rounded-2xl border p-4 ${active ? 'border-[#FFD3BD] bg-[#FFF3EC]' : 'border-slate-200 bg-white'} ${s.status === 'delivered' ? 'opacity-70' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${active ? 'bg-[#FF8D56] text-white' : 'bg-slate-100 text-slate-700'}`}>{String(s.seq).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{s.outletName}</div>
                    <div className="text-xs text-slate-500">{s.orderId} · {s.parcels} parcels · window {s.windowOpen}–{s.windowClose}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Chip tone={c.tone}>{c.text}</Chip>
                      {s.temp === 'chilled' && <Chip tone="blue">❄ Cold chain</Chip>}
                      <span className="text-xs text-slate-500">ETA {s.eta}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
