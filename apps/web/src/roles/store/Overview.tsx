import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CloudOff, PackageX, Plus, Thermometer, Timer, Truck, ClipboardCheck, PackageSearch, Ruler } from 'lucide-react';
import { api } from '@/api/client';
import { Banner, Button, Card, Chip, KpiTile, Stepper, StatusChip, Timeline } from '@/ui';
import { useAsync } from '@/lib/useAsync';
import { useStoreQueue } from '@/lib/useQueue';
import { CUTOFF, fmtCountdown, fmtDateTime, msUntilCutoff } from '@/lib/format';
import type { Notification, Order, OrderDetail } from '@/types';
import { ErrorBox, Loading, StorePage } from './StorePage';
import { ack, awaitingReceipt, eta, isActive, win } from './lib';

export default function StoreOverview() {
  const nav = useNavigate();
  const [ms, setMs] = useState(msUntilCutoff());
  useEffect(() => { const t = setInterval(() => setMs(msUntilCutoff()), 1000); return () => clearInterval(t); }, []);
  const [acked, setAcked] = useState(ack.get());

  const orders = useAsync(() => api.get<Order[]>('/orders?mine=1'), [], 20000);
  const notes = useAsync(() => api.get<Notification[]>('/notifications'), [], 20000);
  const queue = useStoreQueue(() => { orders.reload(); notes.reload(); });

  const list = orders.data ?? [];
  const current = list.filter(isActive).filter((o) => o.status !== 'deferred').sort((a, b) => b.orderDate.localeCompare(a.orderDate))[0];
  const detail = useAsync(() => (current ? api.get<OrderDetail>(`/orders/${current.id}`) : Promise.resolve(null)), [current?.id, current?.status]);
  const deferred = list.filter((o) => o.status === 'deferred' && !acked.includes(o.id));
  const tasks = list.filter(awaitingReceipt);
  const dry = list.filter((o) => o.id === current?.id || (current && o.orderDate === current.orderDate && isActive(o))).filter((o) => o.temp === 'ambient').reduce((s, o) => s + o.units, 0);
  const chilled = list.filter((o) => current && o.orderDate === current.orderDate && isActive(o)).filter((o) => o.temp === 'chilled').reduce((s, o) => s + o.units, 0);
  const closed = ms <= 0;

  const activity = [
    ...(notes.data ?? []).map((n) => ({ t: n.createdAt, title: n.title, detail: n.body.split('.')[0] })),
    ...list.filter((o) => ['received', 'delivered', 'issue'].includes(o.status)).map((o) => ({ t: new Date(`${o.orderDate}T00:00:00`).toISOString(), title: `${o.ref} ${o.status === 'issue' ? 'issue reported' : o.status}`, detail: o.temp === 'chilled' ? 'Chilled order' : 'Ambient order' })),
  ].sort((a, b) => b.t.localeCompare(a.t)).slice(0, 5).map((a) => ({ time: new Date(a.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), title: a.title, detail: a.detail }));

  return (
    <StorePage
      title="Today’s overview" subtitle="Orders, deliveries and receipts for your outlet"
      chips={<>{tasks.length > 0 && <Chip tone="neutral">{tasks.length} receipt{tasks.length > 1 ? 's' : ''} due</Chip>}{queue.length > 0 && <Chip tone="warn">{queue.length} queued offline</Chip>}</>}
    >
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Banner tone="dark" icon={<Timer size={22} />} title={closed ? 'Orders for tomorrow are closed' : <>Closes in <span className="tabular-nums">{fmtCountdown(ms)}</span></>}
          action={<Button onClick={() => nav('/store/order')} icon={<ArrowRight size={16} />}>Place order</Button>}>
          {closed ? 'Orders placed now wait for the following run.' : `Cutoff ${CUTOFF} · next-day delivery before stores open at 08:00`}
        </Banner>
        {queue.length > 0 ? (
          <Banner tone="warn" icon={<CloudOff size={22} className="text-warn" />} title={`${queue.length} action${queue.length > 1 ? 's' : ''} queued offline`}
            action={<span className="text-xs font-semibold text-warn">Retrying automatically</span>}>
            {queue[0].label} · saved {fmtDateTime(queue[0].savedAt)}
          </Banner>
        ) : (
          <Banner tone="ok" icon={<Truck size={22} className="text-ok" />} title="All store actions are synced">Orders and receipts are saved on the server.</Banner>
        )}
      </div>

      {orders.error && <ErrorBox error={orders.error} retry={orders.reload} />}
      {orders.loading && !orders.data ? <Loading /> : (
        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-5">
            <Card title="Current order" subtitle={current ? `${current.ref} · ${current.brand} ${current.temp} · ${current.outletName}` : 'No open order yet'} right={current && <StatusChip status={current.status} />}>
              {!current ? (
                <div className="py-6 text-center"><p className="mb-3 text-sm text-muted">Nothing is on order for the next run.</p><Button onClick={() => nav('/store/order')} icon={<Plus size={16} />}>Place an order</Button></div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <KpiTile label="Expected arrival" value={current.etaPlanned ? `${current.etaPlanned}` : win(current)} hint={current.etaPlanned ? `Window ${win(current)}` : 'Not scheduled yet'} hintTone={current.etaPlanned ? 'ok' : 'warn'} />
                    <KpiTile label="Dry items" value={`${dry} cases`} hint="ambient vehicle" hintTone="brand" />
                    <KpiTile label="Chilled items" value={`${chilled} cases`} hint="refrigerated vehicle" hintTone="info" />
                  </div>
                  <div className="my-5">{detail.data ? <Stepper steps={detail.data.timeline} /> : <Loading />}</div>
                  <div className="flex flex-wrap gap-2">
                    <Button icon={<Truck size={16} />} onClick={() => nav('/store/track')}>Track order</Button>
                    <Button variant="outline" onClick={() => nav('/store/track')}>View order details</Button>
                  </div>
                </>
              )}
            </Card>

            <Card title="Delivery & receipt tasks" subtitle="Confirm what arrived so your stock record stays accurate" right={tasks.length > 0 && <Chip tone="brand">{tasks.length} due today</Chip>}>
              {tasks.length === 0 ? <p className="py-3 text-sm text-muted">No receipts waiting. New deliveries show up here once the driver marks them delivered.</p> : (
                <ul className="space-y-3">
                  {tasks.map((o) => (
                    <li key={o.id} className="wp-tint flex items-center gap-3 p-3.5">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-dark">{o.temp === 'chilled' ? <Thermometer size={18} /> : <ClipboardCheck size={18} />}</span>
                      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Confirm {o.temp} delivery receipt</p><p className="text-xs text-muted">{o.ref} · {o.units} cases · arrived</p></div>
                      <Link to={`/store/receipts/${o.id}`} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-dark ring-1 ring-brand-line">Confirm now</Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-5">
            {deferred.map((o) => (
              <Card key={o.id} title="Delivery deferred" subtitle={`${o.ref} · ${o.brand} ${o.temp}`} right={<Chip tone="warn">Action needed</Chip>}>
                <div className="rounded-xl border border-warn/25 bg-warn-tint p-3.5">
                  <p className="text-sm font-semibold">{o.deferralNote ? 'Moved to the next run' : 'Not on today’s run'}</p>
                  <p className="mt-1 text-xs text-muted">{o.deferralNote || 'Capacity was short. Your order is first in line for the next run.'}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button onClick={() => { ack.add(o.id); setAcked(ack.get()); }}>Acknowledge</Button>
                  <Button variant="outline" onClick={() => nav('/store/track')}>View impact</Button>
                </div>
              </Card>
            ))}

            <Card title="Report an issue" subtitle="Damage, shortages, temperature or delivery access">
              <div className="grid grid-cols-2 gap-2.5">
                {[['damaged', 'Damaged item', PackageX], ['missing', 'Missing quantity', Ruler], ['temperature', 'Temperature', Thermometer], ['delivery', 'Delivery', Truck]].map(([k, label, I]: any) => (
                  <Link key={k} to={`/store/issues?type=${k}`} className="flex items-center gap-2 rounded-xl border border-brand-line bg-brand-tint px-3 py-3 text-xs font-semibold hover:bg-white"><I size={15} className="text-brand-dark" />{label}</Link>
                ))}
              </div>
              <Button variant="outline" block className="mt-3" icon={<Plus size={15} />} onClick={() => nav('/store/issues')}>Start issue report</Button>
              <p className="mt-3 text-center text-[11px] text-muted">Reports stay saved on this device if the connection drops.</p>
            </Card>

            <Card title="Recent activity" subtitle="Operational record from this shift">
              {activity.length ? <Timeline items={activity} /> : <p className="flex items-center gap-2 text-sm text-muted"><PackageSearch size={16} />No activity yet.</p>}
            </Card>
          </div>
        </div>
      )}
    </StorePage>
  );
}
