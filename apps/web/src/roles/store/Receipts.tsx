import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, ChevronRight, ClipboardCheck, Minus, Plus } from 'lucide-react';
import { api } from '@/api/client';
import { Banner, Button, Card, Chip, Field, StatusChip, cx, useToast } from '@/ui';
import { useAsync } from '@/lib/useAsync';
import { queuedPost } from '@/lib/postQueue';
import { fmtDate } from '@/lib/format';
import type { Order, OrderDetail } from '@/types';
import { ErrorBox, Loading, StorePage } from './StorePage';
import { awaitingReceipt, win } from './lib';

/** /store/receipts: what needs confirming plus history. */
export function ReceiptsList() {
  const orders = useAsync(() => api.get<Order[]>('/orders?mine=1'), [], 15000);
  const all = orders.data ?? [];
  const due = all.filter(awaitingReceipt);
  const done = all.filter((o) => o.status === 'received' || o.status === 'issue');
  const Row = ({ o, cta }: { o: Order; cta?: boolean }) => (
    <li>
      <Link to={`/store/receipts/${o.id}`} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 hover:bg-brand-tint/50">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-tint text-brand-dark"><ClipboardCheck size={18} /></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{o.ref} · {o.temp === 'chilled' ? 'Chilled' : 'Dry'}</p><p className="text-[11px] text-muted">{o.units} cases · {fmtDate(o.orderDate)}</p></div>
        <StatusChip status={o.status} />{cta && <ChevronRight size={16} className="text-muted" />}
      </Link>
    </li>
  );
  return (
    <StorePage title="Receipts" subtitle="Confirm what arrived, or report a problem" chips={due.length > 0 ? <Chip tone="warn">{due.length} to confirm</Chip> : undefined}>
      {orders.error && <ErrorBox error={orders.error} retry={orders.reload} />}
      {orders.loading && !orders.data ? <Loading /> : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Card title="Waiting for your confirmation" subtitle="Delivered by the driver">
            <ul className="space-y-2.5">{due.map((o) => <Row key={o.id} o={o} cta />)}{due.length === 0 && <p className="py-4 text-sm text-muted">Nothing to confirm right now.</p>}</ul>
          </Card>
          <Card title="History" subtitle="Confirmed or reported">
            <ul className="space-y-2.5">{done.map((o) => <Row key={o.id} o={o} />)}{done.length === 0 && <p className="py-4 text-sm text-muted">No receipts yet.</p>}</ul>
          </Card>
        </div>
      )}
    </StorePage>
  );
}

/** /store/receipts/:id: the "Confirm receipt" screen. */
export function ConfirmReceipt() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const order = useAsync(() => api.get<OrderDetail>(`/orders/${id}`), [id]);
  const [counted, setCounted] = useState<number | null>(null);
  const [condOk, setCondOk] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (order.loading) return <StorePage title="Confirm receipt"><Loading /></StorePage>;
  if (order.error || !order.data) return <StorePage title="Confirm receipt"><ErrorBox error={order.error ?? new Error('Order not found')} /></StorePage>;
  const o = order.data;
  const qty = counted ?? o.units;
  const short = qty !== o.units;
  const hasIssue = short || !condOk;
  const already = o.status === 'received' || o.status === 'issue';
  const needNote = hasIssue && note.trim().length < 3;

  const submit = async () => {
    setBusy(true);
    try {
      const r = await queuedPost('/receipts', { orderId: o.id, confirmedQty: qty, status: hasIssue ? 'issue' : 'confirmed', note: note.trim() || undefined }, `Receipt · ${o.ref}`);
      toast(r.queued ? 'Offline. Receipt saved and will sync automatically.' : hasIssue ? 'Issue reported to dispatch' : 'Receipt confirmed', r.queued ? 'bad' : 'ok');
      nav('/store/receipts');
    } catch (e: any) { toast(e.message || 'Could not save the receipt', 'bad'); }
    finally { setBusy(false); }
  };

  const Check = ({ on, onToggle, title, sub, children }: any) => (
    <div className={cx('rounded-2xl border p-4', on ? 'border-ok/30 bg-ok-tint/60' : 'border-brand-line bg-brand-tint')}>
      <button type="button" onClick={onToggle} disabled={already} className="flex w-full items-start gap-3 text-left" aria-pressed={on}>
        <span className={cx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2', on ? 'border-ok bg-ok text-white' : 'border-brand-dark bg-white')}>{on && <CheckCircle2 size={14} />}</span>
        <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted">{sub}</span></span>
      </button>{children}
    </div>
  );

  return (
    <StorePage title="Confirm receipt" subtitle={`${o.ref} · ${o.brand} ${o.temp} · ${o.etaPlanned ? `planned ${o.etaPlanned}` : fmtDate(o.orderDate)}`} chips={<><Chip tone="warn">Receiving · {o.temp === 'chilled' ? 'cold room' : 'dock'}</Chip><StatusChip status={o.status} /></>}>
      {already && <Banner tone="ok" title="This receipt is already recorded">You can review it below. Use Issues to raise a new problem.</Banner>}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card title="Receipt checklist">
            <div className="space-y-3">
              <Check on={!short} onToggle={() => setCounted(short ? o.units : o.units - 1)} title="Count handling units" sub={`${o.units} expected · ${qty} received`}>
                <div className="mt-3 flex items-center gap-3 pl-9">
                  <div className="flex items-center rounded-xl border border-brand-line bg-white">
                    <button aria-label="Fewer" className="p-2.5" disabled={already} onClick={() => setCounted(Math.max(0, qty - 1))}><Minus size={15} /></button>
                    <input aria-label="Cases received" inputMode="numeric" disabled={already} className="w-14 border-0 bg-transparent text-center text-sm font-semibold outline-none" value={qty} onChange={(e) => setCounted(parseInt(e.target.value.replace(/\D/g, '') || '0', 10))} />
                    <button aria-label="More" className="p-2.5" disabled={already} onClick={() => setCounted(qty + 1)}><Plus size={15} /></button>
                  </div><span className="text-xs text-muted">cases received</span>
                </div>
              </Check>
              <Check on={condOk} onToggle={() => setCondOk(!condOk)} title="Check visible condition" sub={o.temp === 'chilled' ? 'No damage, and goods arrived cold (0–5 °C)' : 'No damaged cartons or crates'} />
            </div>
            {hasIssue && (
              <div className="mt-4"><Field label="What went wrong?" hint="Required. Dispatch sees this straight away."><textarea className="wp-input min-h-[88px]" disabled={already} placeholder={short ? `Expected ${o.units}, received ${qty}…` : 'Describe the damage or temperature problem…'} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
            )}
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={() => nav('/store/receipts')}>Back</Button>
            <Button size="lg" variant={hasIssue ? 'danger' : 'primary'} loading={busy} disabled={already || needNote} onClick={submit}>{hasIssue ? 'Report issue' : 'Confirm receipt'}</Button>
          </div>
        </div>
        <div className="space-y-5">
          <Card title="Delivery summary">
            <dl className="space-y-3 text-sm">
              {[['Order', o.ref], ['Outlet', o.outletName], ['Cases', `${o.units}`], ['Weight', `${Math.round(o.weightKg)} kg`], ['Vehicle', o.vehicleId ?? 'N/A'], ['Window', win(o)], ['Arrival', o.etaPlanned ?? 'N/A']].map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}
            </dl>
          </Card>
          {o.lines && (
            <Card title="What was ordered">
              <ul className="space-y-2 text-sm">{o.lines.map((l) => <li key={l.sku} className="flex justify-between"><span>{l.name}<span className="block text-[11px] text-muted">{l.sku} · {l.handling}</span></span><span className="font-semibold">× {l.qty}</span></li>)}</ul>
            </Card>
          )}
        </div>
      </div>
    </StorePage>
  );
}
