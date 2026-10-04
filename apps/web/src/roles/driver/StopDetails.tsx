import { Link, useNavigate, useParams } from 'react-router-dom';
import { queueOp } from '../../offline';
import { useRunCtx } from './useRun';
import { statusChip } from './StopList';
import { Btn, Card, Chip } from '../loader/ui';

export default function StopDetails() {
  const { stopId = '' } = useParams();
  const nav = useNavigate();
  const { stops } = useRunCtx();
  const stop = stops.find((s) => s.id === stopId);
  if (!stop) return <p className="p-4 text-sm text-slate-500">Stop not found. <Link className="underline" to="/driver">Back to route</Link></p>;

  const c = statusChip[stop.status];
  const closed = stop.status === 'delivered' || stop.status === 'unable';

  return (
    <div className="space-y-4 p-4">
      <Link to="/driver" className="text-xs font-semibold text-[#C2501B]">← Route</Link>
      <div>
        <div className="text-xs font-semibold text-[#C2501B]">STOP {stop.seq} · {stop.orderId}</div>
        <h1 className="text-xl font-semibold">{stop.outletName}</h1>
        <p className="text-sm text-slate-500">{stop.address}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip tone={c.tone}>{c.text}</Chip>
        <Chip>{stop.parcels} parcels</Chip>
        {stop.temp === 'chilled' ? <Chip tone="blue">❄ Keep cold</Chip> : <Chip>Ambient</Chip>}
      </div>
      <Card>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-slate-500">Delivery window</dt><dd className="font-semibold">{stop.windowOpen}–{stop.windowClose}</dd></div>
          <div><dt className="text-xs text-slate-500">Expected arrival</dt><dd className="font-semibold">{stop.eta}</dd></div>
        </dl>
      </Card>
      <Card tone="orange">
        <div className="text-xs font-semibold uppercase text-slate-500">Unloading instructions</div>
        <p className="text-sm">{stop.instructions}</p>
      </Card>

      {!closed && (
        <div className="space-y-2">
          <a className="block" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.outletName + ' ' + stop.address)}`} target="_blank" rel="noreferrer">
            <Btn variant="ghost" className="w-full">Open directions</Btn>
          </a>
          {stop.status !== 'arrived' ? (
            <Btn variant="primary" className="w-full" onClick={() => queueOp('arrive', stop.id, { at: new Date().toISOString() })}>I've arrived</Btn>
          ) : (
            <Btn variant="primary" className="w-full" onClick={() => nav(`deliver`)}>Confirm delivery</Btn>
          )}
          <Btn variant="danger" className="w-full" onClick={() => nav('problem')}>Report a problem</Btn>
        </div>
      )}
      {closed && <Card tone={stop.status === 'delivered' ? 'green' : 'red'} className="text-sm">{stop.status === 'delivered' ? 'Delivery recorded. Thank you.' : 'Problem recorded. Dispatch has been notified.'}</Card>}
    </div>
  );
}
