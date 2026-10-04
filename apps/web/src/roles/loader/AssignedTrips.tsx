import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTrips } from './api';
import { Btn, Card, Chip, Kpi, Tone } from './ui';
import type { LoaderTrip, TripStatus } from './types';

const label: Record<TripStatus, { text: string; tone: Tone }> = {
  ready: { text: 'Ready to load', tone: 'green' },
  loading: { text: 'Loading', tone: 'orange' },
  held: { text: 'Held · exception', tone: 'red' },
  released: { text: 'Released', tone: 'neutral' },
};
const filters: { key: 'all' | TripStatus; text: string }[] = [
  { key: 'all', text: 'All' },
  { key: 'ready', text: 'Ready' },
  { key: 'loading', text: 'Loading' },
  { key: 'held', text: 'Held' },
];

export default function AssignedTrips() {
  const [trips, setTrips] = useState<LoaderTrip[]>([]);
  const [filter, setFilter] = useState<'all' | TripStatus>('all');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const load = () => listTrips().then(setTrips).catch(() => setErr('No connection. Showing the last loaded list.'));
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const active = trips.filter((t) => t.status !== 'released');
  const count = (s: TripStatus) => trips.filter((t) => t.status === s).length;
  const shown = (filter === 'all' ? trips : trips.filter((t) => t.status === filter)).sort((a, b) =>
    a.departurePlanned.localeCompare(b.departurePlanned),
  );
  const next = active.find((t) => t.status === 'ready' || t.status === 'loading');

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Assigned trips</h1>
        <p className="text-sm text-slate-500">Peliyagoda dock · ordered by planned departure</p>
      </header>
      {err && <Card tone="orange" className="text-sm">{err}</Card>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Assigned" value={`${trips.length} trips`} sub={`${trips.reduce((a, t) => a + t.units, 0)} total units`} />
        <Kpi label="Ready" value={count('ready')} sub="waiting for the dock" tone="green" />
        <Kpi label="Loading" value={count('loading')} sub="in progress" tone="orange" />
        <Kpi label="Attention" value={count('held')} sub="held by an exception" tone="red" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-3 flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`min-h-9 rounded-full border px-4 text-sm font-medium ${
                  filter === f.key ? 'border-[#FFD3BD] bg-[#FFF0E8] text-[#C2501B]' : 'border-slate-200 bg-white'
                }`}
              >
                {f.text}
              </button>
            ))}
          </div>
          <ul className="space-y-2">
            {shown.map((t) => {
              const l = label[t.status];
              return (
                <li key={t.id}>
                  <Link
                    to={`trip/${t.id}`}
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition hover:shadow-sm ${
                      t.status === 'held' ? 'border-[#F7C6B8] bg-[#FDECE7]' : t.status === 'loading' ? 'border-[#FFD3BD] bg-[#FFF3EC]' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{t.id} · {t.vehicleId}</div>
                      <div className="text-xs text-slate-500">{t.departurePlanned} · {t.plate} · {t.stops} stops</div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="text-sm font-semibold">{t.units} units · {t.fillPct}%</span>
                      <Chip tone={l.tone}>{l.text}</Chip>
                    </div>
                  </Link>
                </li>
              );
            })}
            {!shown.length && <li className="py-6 text-center text-sm text-slate-500">No trips in this view.</li>}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="text-lg font-semibold">Next action</div>
            {next ? (
              <>
                <p className="mb-3 text-sm text-slate-500">{next.id} departs at {next.departurePlanned}.</p>
                <Link to={`trip/${next.id}`}><Btn className="w-full">Open {next.id}</Btn></Link>
              </>
            ) : (
              <p className="text-sm text-slate-500">Nothing waiting. All trips are released.</p>
            )}
          </Card>
          <Card tone="orange">
            <div className="font-semibold">Load order</div>
            <p className="text-sm">Load the last stop first so the first stop comes off the truck first.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
