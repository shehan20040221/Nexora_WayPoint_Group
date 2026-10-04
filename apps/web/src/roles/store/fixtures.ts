// Store fixtures (Person C). Shapes follow CONTRACT 3.3 / 3.4. Auto-registered by main.tsx.
import { registerFixture } from '@/api/fixtures';
import { ApiError } from '@/api/client';
import type { Notification, Order, OrderDetail, OrderStatus, Product } from '@/types';

// Waypoint operates Monday to Saturday, so fixture dates never land on a Sunday.
const d = (offset = 0) => {
  const t = new Date(Date.now() + offset * 864e5);
  while (t.getDay() === 0) t.setDate(t.getDate() + (offset < 0 ? -1 : 1));
  return t.toISOString().slice(0, 10);
};
const iso = (minAgo: number) => new Date(Date.now() - minAgo * 60000).toISOString();

const P = (id: string, name: string, sku: string, temp: 'chilled' | 'ambient', unit: string, w: number, v: number, category: string): Product =>
  ({ id, name, sku, temp, unit, weightKg: w, volumeM3: v, category });
export const PRODUCTS: Product[] = [
  P('p1', 'Organic whole milk', 'FR-2204', 'chilled', '12 × 1 L case', 12.6, 0.018, 'Dairy'),
  P('p2', 'Free-range large eggs', 'FR-1148', 'chilled', '15 dozen case', 10.8, 0.032, 'Dairy'),
  P('p3', 'Greek yogurt · plain', 'FR-3381', 'chilled', '24 × 170 g case', 4.6, 0.016, 'Dairy'),
  P('p4', 'Chilled chicken breast', 'FR-5120', 'chilled', '10 kg tray', 10.4, 0.022, 'Meat'),
  P('p5', 'Baby spinach', 'PR-0412', 'chilled', '8 × 250 g case', 2.3, 0.014, 'Produce'),
  P('p6', 'Vine tomatoes', 'PR-0618', 'ambient', '6 kg crate', 6.2, 0.02, 'Produce'),
  P('p7', 'Sourdough loaf', 'BK-0907', 'ambient', '10 loaves case', 4.5, 0.045, 'Bakery'),
  P('p8', 'Basmati rice', 'DG-4410', 'ambient', '10 kg sack', 10.1, 0.012, 'Dry goods'),
  P('p9', 'Red lentils (parippu)', 'DG-4425', 'ambient', '12 × 1 kg case', 12.4, 0.015, 'Dry goods'),
  P('p10', 'Coconut oil', 'DG-4602', 'ambient', '6 × 1 L case', 6.6, 0.011, 'Dry goods'),
  P('p11', 'Ceylon black tea', 'BV-2210', 'ambient', '20 × 200 g case', 4.4, 0.02, 'Beverages'),
  P('p12', 'Bottled water 1.5 L', 'BV-3001', 'ambient', '12 × 1.5 L pack', 18.5, 0.027, 'Beverages'),
];

const base = { outletId: 'OUT007', outletName: 'Waypoint Fresh · Kollupitiya', brand: 'Fresh' as const, district: 'Colombo', depot: 'Peliyagoda', windowOpen: '06:00', windowClose: '08:00', deferredYesterday: false, daysSinceLastServed: 1 };
const mk = (n: number, status: OrderStatus, temp: 'chilled' | 'ambient', units: number, extra: Partial<Order> = {}): Order => ({
  id: `o${n}`, ref: `ORD-${n}`, ...base, temp, units, weightKg: units * 9.4, volumeM3: +(units * 0.019).toFixed(2), status, orderDate: d(1), ...extra,
});

let orders: Order[] = [
  mk(2048, 'planned', 'ambient', 118, { etaPlanned: '06:40', tripId: 'T-014-1', vehicleId: 'VEH014', seq: 3 }),
  mk(2049, 'planned', 'chilled', 42, { etaPlanned: '06:40', tripId: 'T-021-1', vehicleId: 'VEH021', seq: 2 }),
  mk(2031, 'delivered', 'ambient', 64, { orderDate: d(0), etaPlanned: '06:25', tripId: 'T-014-1', vehicleId: 'VEH014' }),
  mk(2020, 'deferred', 'chilled', 36, { orderDate: d(0), deferralReason: 'NO_REEFER_CAPACITY', deferralNote: 'Refrigerated capacity ran out. Moved to the next run.', deferredYesterday: true, daysSinceLastServed: 2, etaPlanned: undefined }),
  mk(1990, 'received', 'ambient', 70, { orderDate: d(-2), etaPlanned: '06:30' }),
  mk(1991, 'issue', 'chilled', 30, { orderDate: d(-3), etaPlanned: '06:10' }),
];
let notifications: Notification[] = [
  { id: 'n1', type: 'deferral', title: 'Delivery deferred · ORD-2020', body: 'Refrigerated capacity ran out for today’s run. Your chilled order moves to the next run and is first in line. Plan for stock to arrive the next operating day.', createdAt: iso(55) },
  { id: 'n2', type: 'planned', title: 'Order scheduled · ORD-2048', body: 'Your ambient order is on a planned route. Expected arrival 06:40.', createdAt: iso(180) },
];

const STEPS = ['Order received', 'Confirmed', 'Scheduled', 'Out for delivery', 'Arrived', 'Received'];
const DONE: Record<OrderStatus, number> = { confirmed: 2, planned: 3, loading: 3, loaded: 3, in_transit: 4, delivered: 5, partial: 5, unable: 4, deferred: 2, received: 6, issue: 5 };
const detail = (o: Order): OrderDetail => ({
  ...o,
  timeline: STEPS.map((label, i) => ({ label, done: i < DONE[o.status], time: i < DONE[o.status] ? ['05:42', '16:05', '17:30', '06:05', '06:38', '07:10'][i] : null })),
  lines: PRODUCTS.filter((p) => p.temp === o.temp).slice(0, 3).map((p) => ({ sku: p.sku, name: p.name, qty: Math.round(o.units / 3), weightKg: p.weightKg, handling: p.temp === 'chilled' ? '0–5 °C' : 'Ambient' })),
});

registerFixture('GET /products', () => PRODUCTS);
registerFixture('GET /orders', () => orders);
registerFixture('GET /orders/:id', ({ params }) => {
  const o = orders.find((x) => x.id === params.id); if (!o) throw new ApiError(404, 'Order not found'); return detail(o);
});
registerFixture('POST /orders', ({ body }) => {
  const items: { productId: string; qty: number }[] = body.items || [];
  if (!items.length) throw new ApiError(400, 'Add at least one item');
  const out: Order[] = [];
  (['ambient', 'chilled'] as const).forEach((temp) => {
    const lines = items.filter((i) => PRODUCTS.find((p) => p.id === i.productId)?.temp === temp);
    if (!lines.length) return;
    const ps = lines.map((l) => ({ p: PRODUCTS.find((p) => p.id === l.productId)!, q: l.qty }));
    const n = 2100 + orders.length;
    const o = mk(n, 'confirmed', temp, ps.reduce((s, x) => s + x.q, 0), {
      weightKg: +ps.reduce((s, x) => s + x.p.weightKg * x.q, 0).toFixed(1), volumeM3: +ps.reduce((s, x) => s + x.p.volumeM3 * x.q, 0).toFixed(3),
      orderDate: new Date(Date.now() + 864e5).toISOString().slice(0, 10), daysSinceLastServed: 1,
    });
    orders = [o, ...orders]; out.push(o);
  });
  return out;
});
registerFixture('POST /receipts', ({ body }) => {
  const o = orders.find((x) => x.id === body.orderId); if (!o) throw new ApiError(404, 'Order not found');
  o.status = body.status === 'issue' ? 'issue' : 'received';
  return { ok: true };
});
registerFixture('GET /notifications', () => notifications);
// POST /receipts also lets the store acknowledge nothing else; acknowledgement is local-only (see StoreOverview).
export const _resetStoreFixtures = () => { notifications = notifications.slice(); };
