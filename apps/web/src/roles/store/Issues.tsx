import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Minus, PackageX, Plus, Ruler, Thermometer, Truck, CheckCircle2 } from 'lucide-react';
import { api } from '@/api/client';
import { Button, Card, Chip, Field, StatusChip, cx, useToast } from '@/ui';
import { useAsync } from '@/lib/useAsync';
import { queuedPost } from '@/lib/postQueue';
import { fmtDate } from '@/lib/format';
import type { Order } from '@/types';
import { Loading, StorePage } from './StorePage';

const TYPES = [
  { id: 'damaged', label: 'Damaged item', icon: PackageX }, { id: 'missing', label: 'Missing quantity', icon: Ruler },
  { id: 'temperature', label: 'Temperature', icon: Thermometer }, { id: 'delivery', label: 'Delivery', icon: Truck },
] as const;

export default function Issues() {
  const [sp] = useSearchParams();
  const toast = useToast();
  const orders = useAsync(() => api.get<Order[]>('/orders?mine=1'), [], 20000);
  const [type, setType] = useState<string>(sp.get('type') || 'damaged');
  const [orderId, setOrderId] = useState<string>(sp.get('order') || '');
  const [qty, setQty] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const all = orders.data ?? [];
  const eligible = all.filter((o) => !['confirmed'].includes(o.status));
  const chosen = all.find((o) => o.id === (orderId || eligible[0]?.id));
  const raised = all.filter((o) => o.status === 'issue');
  const confirmedQty = qty ?? chosen?.units ?? 0;

  const submit = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      const label = TYPES.find((t) => t.id === type)!.label;
      const r = await queuedPost('/receipts', { orderId: chosen.id, confirmedQty, status: 'issue', note: `[${label}] ${note.trim()}` }, `Issue · ${chosen.ref}`);
      toast(r.queued ? 'Offline. Report saved and will sync automatically.' : 'Issue reported to dispatch', r.queued ? 'bad' : 'ok');
      setSent(true); setNote(''); setQty(null); orders.reload();
    } catch (e: any) { toast(e.message || 'Could not send the report', 'bad'); } finally { setBusy(false); }
  };

  return (
    <StorePage title="Issues" subtitle="Report damage, shortages, temperature or access problems" chips={raised.length ? <Chip tone="bad">{raised.length} reported</Chip> : undefined}>
      {orders.loading && !orders.data ? <Loading /> : (
        <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Card title="Report an issue" subtitle="Dispatch sees this immediately. It stays saved if the connection drops.">
            {sent && <p className="mb-4 flex items-center gap-2 rounded-xl bg-ok-tint p-3 text-sm text-ok"><CheckCircle2 size={16} />Report sent. You can raise another.</p>}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {TYPES.map(({ id, label, icon: I }) => <button key={id} type="button" onClick={() => setType(id)} className={cx('flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold', type === id ? 'border-brand bg-brand-tint text-brand-dark' : 'border-gray-200 bg-white')}><I size={18} />{label}</button>)}
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Which order?"><select className="wp-input" value={chosen?.id ?? ''} onChange={(e) => setOrderId(e.target.value)}>{eligible.map((o) => <option key={o.id} value={o.id}>{o.ref} · {o.temp} · {fmtDate(o.orderDate)}</option>)}{eligible.length === 0 && <option value="">No orders to report on yet</option>}</select></Field>
              {(type === 'missing' || type === 'damaged') && chosen && (
                <Field label="Cases actually usable / received" hint={`Ordered ${chosen.units} cases`}>
                  <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white">
                    <button type="button" aria-label="Fewer" className="p-3" onClick={() => setQty(Math.max(0, confirmedQty - 1))}><Minus size={15} /></button>
                    <input aria-label="Cases" inputMode="numeric" className="w-16 border-0 text-center text-sm font-semibold outline-none" value={confirmedQty} onChange={(e) => setQty(parseInt(e.target.value.replace(/\D/g, '') || '0', 10))} />
                    <button type="button" aria-label="More" className="p-3" onClick={() => setQty(confirmedQty + 1)}><Plus size={15} /></button>
                  </div>
                </Field>
              )}
              <Field label="Details"><textarea className="wp-input min-h-[96px]" placeholder="What happened? Add product names or the temperature reading." value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              <Button size="lg" block variant="danger" loading={busy} disabled={!chosen || note.trim().length < 3} onClick={submit}>Send report</Button>
            </div>
          </Card>
          <Card title="Reported issues" subtitle="Orders with an open report">
            <ul className="space-y-2.5">
              {raised.map((o) => <li key={o.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3.5"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{o.ref}</p><p className="text-[11px] text-muted">{o.temp} · {o.units} cases · {fmtDate(o.orderDate)}</p></div><StatusChip status={o.status} /></li>)}
              {raised.length === 0 && <p className="py-4 text-sm text-muted">No issues reported.</p>}
            </ul>
          </Card>
        </div>
      )}
    </StorePage>
  );
}
