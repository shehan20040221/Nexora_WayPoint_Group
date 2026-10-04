import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resync } from './api';
import { useTrip } from './useTrip';
import { useOffline } from '../../offline';
import { Btn, Card, Chip } from './ui';

export default function StalePlan() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { data, reload } = useTrip(id, 4000);
  const { online } = useOffline();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const preview = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const m = new Map<number, { outlet: string; units: number }>();
    (data?.lines ?? []).forEach((l) => {
      const g = m.get(l.stopSeq) ?? { outlet: l.outletName, units: 0 };
      g.units += l.qty;
      m.set(l.stopSeq, g);
    });
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [data?.lines]);

  if (!data) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  const { trip, planVersion, currentVersion, changes, stale } = data;

  async function doResync() {
    setBusy(true);
    setErr(null);
    try {
      await resync(id);
      await reload();
      nav(`/loader/trip/${id}`);
    } catch {
      setErr('Could not sync. Check the dock Wi-Fi and try again. Loading stays locked.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/loader" className="text-xs font-semibold text-[#C2501B]">← Assigned trips</Link>
          <h1 className="text-2xl font-semibold">{stale ? 'Loading paused · plan changed' : 'Plan is up to date'}</h1>
          <p className="text-sm text-slate-500">Trip {trip.id} · {trip.vehicleId}{trip.door ? ` · ${trip.door}` : ''}</p>
        </div>
        <div className="flex items-center gap-2"><Chip>On tablet: v{planVersion}</Chip>→<Chip tone={stale ? 'orange' : 'green'}>Current: v{currentVersion}</Chip></div>
      </div>

      {stale && (
        <Card tone="orange">
          <h2 className="text-lg font-semibold">Your printed list and tablet are out of date</h2>
          <p className="text-sm">Dispatch changed the stop order or freight after loading began. Do not load or move more items until v{currentVersion} is synced and reviewed.</p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">What changed in v{currentVersion}</h2><Chip tone="orange">{changes.length} changes</Chip></div>
            <ul className="space-y-2">
              {changes.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#FFD3BD] bg-[#FFF3EC] p-3">
                  <span className="text-sm font-semibold">{c.label}</span>
                  <span className="text-sm"><s className="text-slate-500">{c.was}</s> → <b>{c.now}</b></span>
                </li>
              ))}
              {!changes.length && <li className="text-sm text-slate-500">No outstanding changes.</li>}
            </ul>
          </Card>
          <div ref={preview}>
            <Card>
              <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Updated load sequence</h2><Chip tone="blue">{stale ? 'Preview after sync' : 'Current'}</Chip></div>
              <ul className="space-y-2">
                {groups.map(([seq, g]) => (
                  <li key={seq} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                    <span className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#0F1B2D] text-xs font-bold text-white">{String(seq).padStart(2, '0')}</span><span className="text-sm font-semibold">{g.outlet}</span></span>
                    <span className="text-sm text-slate-500">{g.units} units</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">Listed in loading order: last stop first. Quantities shown are the plan you have now; they refresh after sync.</p>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <Card tone="red">
            <h2 className="font-semibold">Risk if you continue</h2>
            <ul className="mt-1 list-disc pl-5 text-sm">
              <li>Freight for the new first stop may be buried at the back.</li>
              <li>Added chilled items could be left on the dock.</li>
              <li>Scanning against v{planVersion} will create false shortfalls.</li>
            </ul>
          </Card>
          <Card>
            <p className="mb-2 text-xs text-slate-500">Network: {online ? 'connected' : 'no connection. Sync will fail until it returns.'}</p>
            {err && <p className="mb-2 text-sm text-[#B93815]">{err}</p>}
            <Btn className="w-full" disabled={busy || !stale || !online} onClick={doResync}>{busy ? 'Syncing…' : 'Re-sync loading plan'}</Btn>
            <Btn variant="ghost" className="mt-2 w-full" onClick={() => preview.current?.scrollIntoView({ behavior: 'smooth' })}>Review updated sequence</Btn>
            <p className="mt-2 text-center text-xs text-slate-500">Loading unlocks after sync.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
