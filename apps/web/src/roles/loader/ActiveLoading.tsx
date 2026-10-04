import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../offline';
import { confirmLine, mockDispatcherRepublish, mockDispatcherResolve, releaseTrip, shortLine } from './api';
import { useTrip } from './useTrip';
import { Btn, Card, Chip, Kpi } from './ui';
import { getConfig } from '../../offline';
import type { LoadLine } from './types';

const REASONS = ['Missing at pick face', 'Damaged', 'Wrong item', 'Other'];

export default function ActiveLoading() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { data, setData, error, reload } = useTrip(id);
  const [shortFor, setShortFor] = useState<LoadLine | null>(null);
  const [found, setFound] = useState(0);
  const [reason, setReason] = useState(REASONS[0]);
  const [msg, setMsg] = useState<string | null>(null);

  // A republished plan locks loading and sends the loader to the stale-plan screen.
  useEffect(() => {
    if (data?.stale) nav(`/loader/trip/${id}/stale`, { replace: true });
  }, [data?.stale, id, nav]);

  const groups = useMemo(() => {
    const m = new Map<number, { outlet: string; lines: LoadLine[] }>();
    (data?.lines ?? []).forEach((l) => {
      if (!m.has(l.stopSeq)) m.set(l.stopSeq, { outlet: l.outletName, lines: [] });
      m.get(l.stopSeq)!.lines.push(l);
    });
    return [...m.entries()].sort((a, b) => b[0] - a[0]); // last stop first
  }, [data?.lines]);

  if (!data) return <div className="p-6 text-sm text-slate-500">{error ?? 'Loading trip…'}</div>;

  const { trip, lines } = data;
  const sum = (s: LoadLine['status']) => lines.filter((l) => l.status === s).reduce((a, l) => a + l.qty, 0);
  const total = lines.reduce((a, l) => a + l.qty, 0);
  const loaded = sum('loaded');
  const pendingLines = lines.filter((l) => l.status === 'pending').length;
  const shortLines = lines.filter((l) => l.status === 'short');
  const held = trip.status === 'held';
  const canRelease = pendingLines === 0 && !held && trip.status !== 'released';

  async function confirm(l: LoadLine) {
    setMsg(null);
    setData({ ...data!, lines: data!.lines.map((x) => (x.id === l.id ? { ...x, status: 'loaded' } : x)) });
    try {
      await confirmLine(l.id);
    } catch (e) {
      setMsg((e as Error).message);
    }
    void reload();
  }

  async function submitShort() {
    if (!shortFor) return;
    try {
      await shortLine(shortFor.id, { foundQty: found, reason });
      setShortFor(null);
    } catch (e) {
      setMsg((e as Error).message);
    }
    void reload();
  }

  async function release() {
    try {
      await releaseTrip(id);
      nav('/loader');
    } catch (e) {
      setMsg(e instanceof ApiError && e.status === 409 ? 'Cannot release yet: finish all lines and clear the exception.' : (e as Error).message);
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/loader" className="text-xs font-semibold text-[#C2501B]">← Assigned trips</Link>
          <h1 className="text-2xl font-semibold">Load trip {trip.id}</h1>
          <p className="text-sm text-slate-500">Reverse stop order · load last stop first</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone={held ? 'red' : 'orange'}>{held ? 'Held' : 'Active loading'}</Chip>
          {trip.door && <Chip>{trip.door}</Chip>}
          {shortLines.length > 0 && <Chip tone="red">{shortLines.length} exception</Chip>}
        </div>
      </div>

      {(error || msg) && <Card tone="orange" className="text-sm">{msg ?? error}</Card>}

      <Card className="grid gap-4 md:grid-cols-4">
        <div><div className="text-xs text-slate-500">Vehicle</div><div className="font-semibold">{trip.vehicleId} · {trip.plate}</div>{trip.driver && <div className="text-xs text-slate-500">Driver: {trip.driver}</div>}</div>
        <div><div className="text-xs text-slate-500">Planned departure</div><div className="text-xl font-semibold">{trip.departurePlanned}</div></div>
        <div><div className="text-xs text-slate-500">Route</div><div className="font-semibold">{trip.stops} stops · {total} units</div></div>
        <div>
          <div className="flex justify-between text-xs text-slate-500"><span>Vehicle capacity</span><b className="text-[#C2501B]">{trip.fillPct}%</b></div>
          <div className="mt-2 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-[#FF8D56]" style={{ width: `${trip.fillPct}%` }} /></div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Loading sequence</h2>
            <Chip tone="orange">{total - loaded} units remaining</Chip>
          </div>
          <div className="space-y-4">
            {groups.map(([seq, g]) => (
              <section key={seq}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#FF8D56] text-xs font-bold text-white">{String(seq).padStart(2, '0')}</span>
                  <span className="text-sm font-semibold">{g.outlet}</span>
                </div>
                <ul className="space-y-2">
                  {g.lines.map((l) => (
                    <li key={l.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${l.status === 'short' ? 'border-[#F7C6B8] bg-[#FDECE7]' : l.status === 'loaded' ? 'border-slate-200 bg-white' : 'border-[#FFD3BD] bg-[#FFF8F3]'}`}>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{l.item} <span className="text-xs font-normal text-slate-500">SKU {l.sku}</span></div>
                        <div className="text-xs text-slate-500">{l.zone}{l.temp === 'chilled' && <span className="ml-2 text-[#1F63B5]">❄ chilled</span>}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <b className="text-sm">{l.qty} {l.unit}</b>
                        {l.status === 'loaded' && <Chip tone="green">Loaded</Chip>}
                        {l.status === 'short' && <Chip tone="red">Short</Chip>}
                        {l.status === 'pending' && (
                          <>
                            <Btn onClick={() => confirm(l)}>Confirm load</Btn>
                            <Btn variant="danger" onClick={() => { setShortFor(l); setFound(Math.max(0, l.qty - 1)); }}>Short</Btn>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">Load progress</h2><Chip tone="green">{total ? Math.round((loaded / total) * 100) : 0}% complete</Chip></div>
            <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-[#1B8A6B]" style={{ width: `${total ? (loaded / total) * 100 : 0}%` }} /></div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Kpi label="Loaded" value={loaded} tone="green" />
              <Kpi label="Remaining" value={sum('pending')} tone="orange" />
              <Kpi label="Short" value={shortLines.length} sub="lines" tone="red" />
            </div>
          </Card>

          {shortFor && (
            <Card tone="red">
              <h2 className="font-semibold">Report a short unit</h2>
              <p className="text-xs text-slate-600">{shortFor.item} · expected {shortFor.qty} {shortFor.unit}</p>
              <label className="mt-3 block text-xs font-semibold">Quantity found
                <input type="number" min={0} max={shortFor.qty - 1} value={found} onChange={(e) => setFound(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-base" />
              </label>
              <label className="mt-3 block text-xs font-semibold">Reason
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-base">
                  {REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
              <div className="mt-3 flex gap-2"><Btn onClick={submitShort}>Notify dispatch</Btn><Btn variant="ghost" onClick={() => setShortFor(null)}>Cancel</Btn></div>
            </Card>
          )}

          {shortLines.length > 0 && !shortFor && (
            <Card tone="red">
              <h2 className="font-semibold">{shortLines.length} unit short · action needed</h2>
              {shortLines.map((l) => <p key={l.id} className="text-sm">{l.item} · {l.outletName}</p>)}
              <p className="mt-2 text-xs text-[#8F2A0F]">{held ? 'Departure stays blocked until dispatch accepts the short load or a replacement is scanned.' : 'Dispatch has resolved this. You can release once all lines are done.'}</p>
            </Card>
          )}

          <Card>
            <div className="mb-2 font-semibold">Ready to depart?</div>
            <Btn variant={canRelease ? 'primary' : 'ghost'} className="w-full" disabled={!canRelease} onClick={release}>
              {canRelease ? 'Release trip' : held ? 'Blocked · exception open' : `Blocked · ${pendingLines} line${pendingLines === 1 ? '' : 's'} pending`}
            </Btn>
          </Card>

          {getConfig().useFixtures && (
            <Card tone="blue" className="text-xs">
              <div className="mb-2 font-semibold">Demo controls (fixtures only)</div>
              <div className="flex flex-wrap gap-2">
                <Btn variant="ghost" className="!min-h-9 !text-xs" onClick={() => { mockDispatcherResolve(); void reload(); }}>Dispatcher accepts short</Btn>
                <Btn variant="ghost" className="!min-h-9 !text-xs" onClick={() => { mockDispatcherRepublish(); void reload(); }}>Dispatcher republishes</Btn>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
