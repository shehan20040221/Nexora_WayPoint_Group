import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { queueOp } from '../../offline';
import { useRunCtx } from './useRun';
import { Btn } from '../loader/ui';
import type { ExceptionPayload } from './types';

const REASONS = ['Outlet closed', 'No access for vehicle', 'Wrong or missing goods', 'Refused by store', 'Vehicle problem'];
const ACTIONS = ['Retry later today', 'Skip and return tomorrow', 'Call me'];

export default function ReportProblem() {
  const { stopId = '' } = useParams();
  const nav = useNavigate();
  const { stops } = useRunCtx();
  const stop = stops.find((s) => s.id === stopId);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [action, setAction] = useState(ACTIONS[0]);
  if (!stop) return <p className="p-4 text-sm">Stop not found.</p>;

  return (
    <div className="space-y-4 p-4">
      <Link to={`/driver/stop/${stop.id}`} className="text-xs font-semibold text-[#C2501B]">← Stop details</Link>
      <div><h1 className="text-xl font-semibold">Report a problem</h1><p className="text-sm text-slate-500">{stop.outletName} · {stop.orderId}</p></div>
      <label className="block text-xs font-semibold">What happened
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-base">{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
      </label>
      <label className="block text-xs font-semibold">Details
        <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-base" />
      </label>
      <label className="block text-xs font-semibold">What should dispatch do
        <select value={action} onChange={(e) => setAction(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-base">{ACTIONS.map((r) => <option key={r}>{r}</option>)}</select>
      </label>
      <Btn variant="primary" className="w-full" onClick={async () => {
        const p: ExceptionPayload = { reason, details: details.trim(), requestedAction: action };
        await queueOp('exception', stop.id, p);
        nav('/driver');
      }}>Send to dispatch</Btn>
      <p className="text-xs text-slate-500">If you are offline this is saved on your phone and sent automatically.</p>
    </div>
  );
}
