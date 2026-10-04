import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, CheckCircle2, Minus, Package, Plus, Search, Send, Snowflake, Timer, Save } from 'lucide-react';
import { api } from '@/api/client';
import { Banner, Button, Card, Chip, StatusChip, cx, useToast } from '@/ui';
import { useAsync } from '@/lib/useAsync';
import { queuedPost } from '@/lib/postQueue';
import { CUTOFF, fmtCountdown, fmtDate, msUntilCutoff, num } from '@/lib/format';
import type { Order, Product } from '@/types';
import { ErrorBox, Loading, StorePage } from './StorePage';

const DRAFT = 'waypoint.store.draft';
const nextOperatingDay = () => { const d = new Date(Date.now() + 864e5); if (d.getDay() === 0) d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }; // Mon-Sat only

export default function PlaceOrder() {
  const toast = useToast();
  const products = useAsync(() => api.get<Product[]>('/products'), []);
  const [qty, setQty] = useState<Record<string, number>>(() => { try { return JSON.parse(localStorage.getItem(DRAFT) || '{}'); } catch { return {}; } });
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<Order[] | 'queued' | null>(null);
  const [ms, setMs] = useState(msUntilCutoff());
  const [saved, setSaved] = useState(false);

  useEffect(() => { const t = setInterval(() => setMs(msUntilCutoff()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { try { localStorage.setItem(DRAFT, JSON.stringify(qty)); setSaved(true); } catch { /* ignore */ } }, [qty]);

  const list = products.data ?? [];
  const cats = useMemo(() => ['All', 'Chilled', 'Ambient', ...Array.from(new Set(list.map((p) => p.category).filter(Boolean) as string[]))], [list]);
  const shown = list.filter((p) =>
    (cat === 'All' || (cat === 'Chilled' && p.temp === 'chilled') || (cat === 'Ambient' && p.temp === 'ambient') || p.category === cat) &&
    `${p.name} ${p.sku} ${p.category ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  const lines = list.filter((p) => (qty[p.id] || 0) > 0);
  const tot = lines.reduce((a, p) => { const n = qty[p.id]; return { cases: a.cases + n, kg: a.kg + n * p.weightKg, m3: a.m3 + n * p.volumeM3, chilled: a.chilled + (p.temp === 'chilled' ? n : 0) }; }, { cases: 0, kg: 0, m3: 0, chilled: 0 });
  const ambient = tot.cases - tot.chilled;
  const set = (id: string, n: number) => setQty((s) => ({ ...s, [id]: Math.max(0, Math.min(999, n)) }));
  const closed = ms <= 0;
  const delivery = nextOperatingDay();

  const submit = async () => {
    setBusy(true);
    try {
      const r = await queuedPost<Order[]>('/orders', { items: lines.map((p) => ({ productId: p.id, qty: qty[p.id] })) }, `Order · ${tot.cases} cases`);
      localStorage.removeItem(DRAFT); setQty({});
      setPlaced(r.queued ? 'queued' : r.data);
      if (r.queued) toast('No connection. Order saved and will send automatically.', 'bad');
    } catch (e: any) { toast(e.message || 'Could not place the order', 'bad'); }
    finally { setBusy(false); }
  };

  if (placed) {
    return (
      <StorePage title="Order placed" subtitle="Your order is in the dispatcher’s queue">
        <Card className="mx-auto max-w-xl text-center">
          <span className={cx('mx-auto grid h-14 w-14 place-items-center rounded-full', placed === 'queued' ? 'bg-warn-tint text-warn' : 'bg-ok-tint text-ok')}><CheckCircle2 size={28} /></span>
          {placed === 'queued' ? (
            <><h2 className="mt-4 text-xl font-semibold">Saved on this device</h2><p className="mt-1 text-sm text-muted">You are offline. We will send the order the moment the connection returns. You will see it confirmed on the overview.</p></>
          ) : (
            <>
              <h2 className="mt-4 text-xl font-semibold">{placed.length > 1 ? `${placed.length} orders confirmed` : 'Order confirmed'}</h2>
              <p className="mt-1 text-sm text-muted">Chilled and dry goods ship on separate vehicles, so they are separate orders.{closed && ' Placed after the cutoff, so it waits for the following run.'}</p>
              <ul className="mt-4 space-y-2 text-left">
                {placed.map((o) => (
                  <li key={o.id} className="wp-tint flex items-center justify-between gap-3 p-3.5"><div><p className="text-sm font-semibold">{o.ref}</p><p className="text-xs text-muted">{o.temp === 'chilled' ? 'Chilled' : 'Dry'} · {o.units} cases · {fmtDate(o.orderDate)}</p></div><StatusChip status={o.status} /></li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2"><Link to="/store/track"><Button>Track deliveries</Button></Link><Button variant="outline" onClick={() => setPlaced(null)}>Place another</Button></div>
        </Card>
      </StorePage>
    );
  }

  return (
    <StorePage title="Build your next order" subtitle={`Replenish before the ${CUTOFF} cutoff`}
      chips={<><Chip tone="ok">{saved ? 'Draft autosaved' : 'Draft'}</Chip><Chip tone={closed ? 'bad' : 'brand'}>{closed ? 'Cutoff passed' : `Closes in ${fmtCountdown(ms)}`}</Chip></>}>
      <Banner tone="dark" icon={<Timer size={22} />} title={`Delivery ${fmtDate(delivery)} · before 08:00`} action={<Chip tone="brand">{tot.cases} cases selected</Chip>}>
        Order by {CUTOFF} · chilled and dry goods ship separately
      </Banner>
      {closed && <Banner tone="warn" title="The cutoff has passed">You can still order. It will join the following run, not tomorrow’s.</Banner>}

      <div className="grid items-start gap-5 lg:grid-cols-[1.7fr_1fr]">
        <Card title="Browse products" subtitle="Choose cases per product" right={<Chip>{list.length} products</Chip>}>
          <div className="relative mb-3"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input className="wp-input pl-10" placeholder="Search product, SKU or category" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={cx('whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium', cat === c ? 'border-brand-line bg-brand-tint text-brand-dark' : 'border-gray-200 bg-white')}>{c}</button>)}
          </div>
          {products.loading ? <Loading /> : products.error ? <ErrorBox error={products.error} retry={products.reload} /> : (
            <ul className="space-y-2.5">
              {shown.map((p) => {
                const n = qty[p.id] || 0;
                return (
                  <li key={p.id} className={cx('flex flex-wrap items-center gap-3 rounded-2xl border p-3', n > 0 ? 'border-brand-line bg-brand-tint' : 'border-gray-100 bg-white')}>
                    <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl', p.temp === 'chilled' ? 'bg-info-tint text-info' : 'bg-brand-tint text-brand-dark')}>{p.temp === 'chilled' ? <Snowflake size={18} /> : <Package size={18} />}</span>
                    <div className="min-w-0 flex-1 basis-40"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-[11px] text-muted">{p.sku} · {p.unit}</p></div>
                    <Chip tone={p.temp === 'chilled' ? 'info' : 'neutral'}>{p.temp === 'chilled' ? 'Chilled' : 'Ambient'}</Chip>
                    <div className="flex items-center rounded-xl border border-brand-line bg-white">
                      <button aria-label={`Fewer ${p.name}`} className="p-2.5 text-brand-dark" onClick={() => set(p.id, n - 1)}><Minus size={15} /></button>
                      <input aria-label={`${p.name} quantity`} inputMode="numeric" className="w-12 border-0 bg-transparent text-center text-sm font-semibold outline-none" value={n} onChange={(e) => set(p.id, parseInt(e.target.value.replace(/\D/g, '') || '0', 10))} />
                      <button aria-label={`More ${p.name}`} className="p-2.5 text-brand-dark" onClick={() => set(p.id, n + 1)}><Plus size={15} /></button>
                    </div>
                  </li>
                );
              })}
              {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">No products match.</p>}
            </ul>
          )}
        </Card>

        <div className="space-y-5 lg:sticky lg:top-4">
          <Card title="Order summary" right={<Chip tone="warn">Draft</Chip>}>
            <div className="grid grid-cols-2 gap-3"><div className="wp-tint p-3"><p className="text-[10px] uppercase text-muted">Cases</p><p className="text-2xl font-semibold">{tot.cases}</p></div><div className="wp-tint p-3"><p className="text-[10px] uppercase text-muted">Lines</p><p className="text-2xl font-semibold">{lines.length}</p></div></div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Dry cases</dt><dd>{ambient}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Chilled cases</dt><dd>{tot.chilled}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Weight</dt><dd>{num(tot.kg, 1)} kg</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Volume</dt><dd>{num(tot.m3, 2)} m³</dd></div>
            </dl>
            {tot.chilled > 0 && ambient > 0 && <p className="mt-3 flex items-start gap-2 rounded-xl bg-info-tint p-3 text-xs text-info"><Box size={14} className="mt-0.5 shrink-0" />This will be placed as 2 orders: one chilled, one dry.</p>}
          </Card>
          <Card title="Delivery timing" subtitle="Fresh deliveries arrive before the store opens">
            <div className="wp-tint p-3.5"><p className="text-sm font-semibold">{fmtDate(delivery)}</p><p className="text-xs text-muted">Before 08:00 · Monday to Saturday only</p></div>
            <Button size="lg" block className="mt-4" icon={<Send size={16} />} loading={busy} disabled={tot.cases === 0} onClick={submit}>Submit order · {tot.cases} cases</Button>
            <Button variant="outline" block className="mt-2" icon={<Save size={15} />} onClick={() => { localStorage.setItem(DRAFT, JSON.stringify(qty)); toast('Draft saved on this device'); }}>Save draft</Button>
            <p className="mt-3 text-center text-[11px] text-muted">Your draft is kept on this device until you submit.</p>
          </Card>
        </div>
      </div>
    </StorePage>
  );
}
