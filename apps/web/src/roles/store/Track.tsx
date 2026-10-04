import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Package, Search, Snowflake, Truck } from 'lucide-react';
import { api } from '@/api/client';
import { Button, Card, Chip, KpiTile, Stepper, StatusChip, cx, useToast } from '@/ui';
import { useAsync } from '@/lib/useAsync';
import { fmtDate, fmtDateTime, todayStr } from '@/lib/format';
import type { Notification, Order, OrderDetail } from '@/types';
import { ErrorBox, Loading, StorePage } from './StorePage';
import { ack, awaitingReceipt, eta, REASON_TEXT, win } from './lib';

const FILTERS = [['all', 'All'], ['arriving', 'Arriving'], ['transit', 'In transit'], ['exceptions', 'Exceptions']] as const;
const inTransit = (o: Order) => ['loading', 'loaded', 'in_transit'].includes(o.status);

export default function Track() {
  const nav = useNavigate();
  const toast = useToast();
  const orders = useAsync(() => api.get<Order[]>('/orders?mine=1'), [], 10000); // poll: the dispatcher/driver change status
  const notes = useAsync(() => api.get<Notification[]>('/notifications'), [], 10000);
  const [sel, setSel] = useState<string | null>(null);
  const [f, setF] = useState<(typeof FILTERS)[number][0]>('all');
  const [q, setQ] = useState('');
  const [acked, setAcked] = useState(ack.get());

  const all = orders.data ?? [];
  const shown = all.filter((o) => {
    const ok = f === 'all' || (f === 'arriving' && ['planned', 'confirmed'].includes(o.status)) || (f === 'transit' && inTransit(o)) || (f === 'exceptions' && ['deferred', 'issue', 'unable', 'partial'].includes(o.status));
    return ok && `${o.ref} ${o.temp} ${o.status}`.toLowerCase().includes(q.toLowerCase());
  });
  useEffect(() => { if (!sel && all.length) setSel(all[0].id); }, [all, sel]);
  const detail = useAsync(() => (sel ? api.get<OrderDetail>(`/orders/${sel}`) : Promise.resolve(null)), [sel, all.find((o) => o.id === sel)?.status], 10000);
  const cur = all.find((o) => o.id === sel);

  const todays = all.filter((o) => o.orderDate === todayStr() && !['received', 'issue'].includes(o.status));
  const next = all.filter((o) => ['planned', 'confirmed'].includes(o.status) && o.etaPlanned).sort((a, b) => a.orderDate.localeCompare(b.orderDate))[0];
  const exceptions = all.filter((o) => o.status === 'deferred' || o.status === 'unable');
  const deferralNote = notes.data?.find((n) => n.type === 'deferral');

  return (
    <StorePage title="Track deliveries" subtitle="Monitor inbound stock and keep receiving staff ready"
      chips={<><Chip tone="brand">{all.filter((o) => !['received', 'issue'].includes(o.status)).length} active shipments</Chip>{all.filter(awaitingReceipt).length > 0 && <Chip tone="warn">{all.filter(awaitingReceipt).length} action{all.filter(awaitingReceipt).length > 1 ? 's' : ''} due</Chip>}</>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Arriving today" value={`${todays.length} deliveries`} hint={`${all.filter(awaitingReceipt).length} receipt outstanding`} hintTone="ok" />
        <KpiTile label="Next arrival" value={next ? `${fmtDate(next.orderDate)} · ${next.etaPlanned}` : 'None scheduled'} hint={next ? `${next.ref} on schedule` : 'Waiting for the plan'} hintTone="brand" />
        <KpiTile label="In transit" value={`${all.filter(inTransit).length} shipments`} hint={`${all.filter(inTransit).reduce((s, o) => s + o.units, 0)} cases`} hintTone="info" />
        <KpiTile label="Exceptions" value={`${exceptions.length} deferred`} hint={exceptions.length ? 'Acknowledgement needed' : 'All clear'} hintTone={exceptions.length ? 'warn' : 'ok'} />
      </div>

      {orders.error && <ErrorBox error={orders.error} retry={orders.reload} />}
      {orders.loading && !orders.data ? <Loading /> : (
        <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_1fr]">
          <Card title="Active shipments" subtitle="Newest first" right={<Chip>{shown.length} shown</Chip>}>
            <div className="relative mb-3"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input className="wp-input pl-10" placeholder="Search order or status" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="mb-3 flex gap-2 overflow-x-auto">{FILTERS.map(([k, l]) => <button key={k} onClick={() => setF(k)} className={cx('whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium', f === k ? 'border-brand-line bg-brand-tint text-brand-dark' : 'border-gray-200 bg-white')}>{l}</button>)}</div>
            <ul className="space-y-2.5">
              {shown.map((o) => (
                <li key={o.id}>
                  <button onClick={() => setSel(o.id)} className={cx('flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition', sel === o.id ? 'border-brand-line bg-brand-tint' : 'border-gray-100 bg-white hover:bg-brand-tint/50')}>
                    <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl', o.temp === 'chilled' ? 'bg-info-tint text-info' : 'bg-brand-tint text-brand-dark')}>{o.temp === 'chilled' ? <Snowflake size={18} /> : <Package size={18} />}</span>
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{o.ref} · {o.temp === 'chilled' ? 'Chilled' : 'Dry'}</p><p className="text-[11px] text-muted">{o.units} cases{o.vehicleId ? ` · ${o.vehicleId}` : ''}</p></div>
                    <div className="hidden text-right sm:block"><p className="text-[10px] uppercase text-muted">Expected</p><p className="text-xs font-semibold">{eta(o)}</p></div>
                    <StatusChip status={o.status} /><ChevronRight size={16} className="text-muted" />
                  </button>
                </li>
              ))}
              {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">No shipments match.</p>}
            </ul>
          </Card>

          <div className="space-y-5">
            {cur && (
              <Card title={`${cur.temp === 'chilled' ? 'Chilled' : 'Dry'} replenishment`} subtitle={`${cur.ref} · ${cur.depot} depot`} right={<StatusChip status={cur.status} />}>
                <div className="grid grid-cols-3 gap-2.5">
                  <KpiTile label="Expected" value={<span className="text-base">{cur.etaPlanned ?? win(cur)}</span>} hint={fmtDate(cur.orderDate)} />
                  <KpiTile label="Load" value={<span className="text-base">{cur.units} cases</span>} hint={`${Math.round(cur.weightKg)} kg`} />
                  <KpiTile label="Receiving" value={<span className="text-base">{cur.temp === 'chilled' ? 'Cold room' : 'Dock'}</span>} hint={win(cur)} />
                </div>
                <div className="my-5">{detail.data ? <Stepper steps={detail.data.timeline} /> : <Loading />}</div>
                <dl className="space-y-2 rounded-xl bg-brand-tint p-3.5 text-xs">
                  <div className="flex justify-between"><dt className="text-muted">Vehicle</dt><dd className="font-semibold">{cur.vehicleId ?? 'Not assigned yet'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Stop number</dt><dd className="font-semibold">{cur.seq != null ? `#${cur.seq}` : 'N/A'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Expected arrival</dt><dd className="font-semibold">{cur.etaPlanned ?? 'Set when the plan is published'}</dd></div>
                </dl>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="outline" icon={<Bell size={15} />} onClick={() => toast('Receiving team notified')}>Notify receiving team</Button>
                  {awaitingReceipt(cur) ? <Button icon={<Truck size={15} />} onClick={() => nav(`/store/receipts/${cur.id}`)}>Confirm receipt</Button> : <Button variant="outline" onClick={() => nav('/store/issues')}>Report issue</Button>}
                </div>
              </Card>
            )}
            {exceptions.filter((o) => !acked.includes(o.id)).map((o) => (
              <Card key={o.id} title="Deferred delivery needs review" subtitle={`${o.ref} · ${o.temp}`} right={<Chip tone="warn">Action needed</Chip>}>
                <div className="rounded-xl border border-warn/25 bg-warn-tint p-3.5">
                  <p className="text-sm font-semibold">Moved to the next run</p>
                  <p className="mt-1 text-xs text-muted">{o.deferralNote || (o.deferralReason && REASON_TEXT[o.deferralReason]) || 'Capacity was short.'}</p>
                  <p className="mt-1 text-xs text-muted">It gets priority so it is not skipped twice in a row.</p>
                </div>
                {deferralNote && <p className="mt-2 text-[11px] text-muted">Notice sent {fmtDateTime(deferralNote.createdAt)}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={() => { ack.add(o.id); setAcked(ack.get()); toast('Acknowledged'); }}>Acknowledge</Button><Button variant="outline" onClick={() => nav(`/store/issues?order=${o.id}&type=delivery`)}>Create issue</Button></div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </StorePage>
  );
}
