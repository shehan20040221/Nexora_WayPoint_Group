import { randomUUID } from 'node:crypto';
import type { Q } from './db';

export class HttpError extends Error { constructor(public status: number, message: string, public extra: object = {}) { super(message); } }
export const uid = (p: string) => `${p}_${randomUUID().slice(0, 8)}`;
export const hm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
export const fmt = (min: number) => { const m = Math.round(min); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
/** Clock time (HH:MM) of a Date in Asia/Colombo (UTC+05:30, no DST). */
export const colomboHM = (d: Date) => fmt(((d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440));

export const ORDER_SELECT = `SELECT o.*, ou.name AS outlet_name, ou.brand, ou.district, ou.depot FROM orders o JOIN outlets ou ON ou.id = o.outlet_id`;
export const mapOrder = (r: any) => ({
  id: r.id, ref: r.ref, outletId: r.outlet_id, outletName: r.outlet_name, brand: r.brand, district: r.district, depot: r.depot,
  temp: r.temp, units: r.units, weightKg: r.weight_kg, volumeM3: r.volume_m3, status: r.status, orderDate: r.order_date,
  windowOpen: r.window_open, windowClose: r.window_close, deferredYesterday: r.deferred_yesterday, daysSinceLastServed: r.days_since_last_served,
  tripId: r.trip_id ?? undefined, vehicleId: r.vehicle_id ?? undefined, seq: r.seq ?? undefined, etaPlanned: r.eta_planned ?? undefined,
  deferralReason: r.deferral_reason ?? undefined, deferralNote: r.deferral_note ?? undefined,
});

/** Use this (not raw UPDATEs) whenever an order changes status, so the timeline stays right. Person B: use it in planning.ts too. */
export async function setOrderStatus(q: Q, orderId: string, status: string) {
  await q.query('UPDATE orders SET status=$1 WHERE id=$2', [status, orderId]);
  await q.query('INSERT INTO order_events(order_id,status) VALUES($1,$2)', [orderId, status]);
}
/** Store notification (deferral notices etc). Person B: call from /plan/defer. */
export async function notify(q: Q, outletId: string, type: string, title: string, body: string) {
  await q.query('INSERT INTO notifications(id,outlet_id,type,title,body) VALUES($1,$2,$3,$4,$5)', [uid('ntf'), outletId, type, title, body]);
}

export async function createException(q: Q, e: { type: string; severity: string; tripId?: string; orderRef?: string; lineId?: string; detail: string }) {
  const id = uid('exc');
  await q.query('INSERT INTO exceptions(id,type,severity,trip_id,order_ref,line_id,detail) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [id, e.type, e.severity, e.tripId ?? null, e.orderRef ?? null, e.lineId ?? null, e.detail]);
  return id;
}

export async function nextOperatingDate(q: Q, from = new Date()): Promise<string> {
  const base = new Date(from.getTime() + 330 * 60000); // Colombo wall clock
  for (let i = 1; i < 14; i++) {
    const d = new Date(base.getTime() + i * 86400000).toISOString().slice(0, 10);
    const c = (await q.query('SELECT is_operating FROM calendar WHERE date=$1', [d])).rows[0];
    if (c ? c.is_operating === 1 : new Date(d + 'T00:00:00Z').getUTCDay() !== 0) return d;
  }
  throw new Error('no operating date found');
}

/** Creates one order (with lines) for an outlet. Totals are derived from the product list. */
export async function createOrder(q: Q, o: { outletId: string; temp: 'chilled' | 'ambient'; items: { productId: string; qty: number }[]; orderDate: string; deferredYesterday?: boolean; daysSinceLastServed?: number }) {
  const outlet = (await q.query('SELECT * FROM outlets WHERE id=$1', [o.outletId])).rows[0];
  if (!outlet) throw new HttpError(400, `unknown outlet ${o.outletId}`);
  const id = uid('ord');
  const ref = `ORD-${(await q.query(`SELECT nextval('order_ref_seq')::int AS n`)).rows[0].n}`;
  let units = 0, w = 0, v = 0; const lines: any[] = [];
  for (const it of o.items) {
    const p = (await q.query('SELECT * FROM products WHERE id=$1', [it.productId])).rows[0];
    if (!p) throw new HttpError(400, `unknown product ${it.productId}`);
    const qty = Math.floor(it.qty);
    if (!(qty > 0)) throw new HttpError(400, 'qty must be a positive integer');
    units += qty; w += qty * p.weight_kg; v += qty * p.volume_m3;
    lines.push({ p, qty });
  }
  await q.query(`INSERT INTO orders(id,ref,outlet_id,temp,units,weight_kg,volume_m3,status,order_date,window_open,window_close,deferred_yesterday,days_since_last_served)
    VALUES($1,$2,$3,$4,$5,$6,$7,'confirmed',$8,$9,$10,$11,$12)`,
    [id, ref, o.outletId, o.temp, units, +w.toFixed(2), +v.toFixed(3), o.orderDate, outlet.window_open, outlet.window_close, !!o.deferredYesterday, o.daysSinceLastServed ?? 0]);
  for (const l of lines)
    await q.query('INSERT INTO order_lines(id,order_id,product_id,qty,weight_kg,volume_m3) VALUES($1,$2,$3,$4,$5,$6)',
      [uid('ol'), id, l.p.id, l.qty, +(l.qty * l.p.weight_kg).toFixed(2), +(l.qty * l.p.volume_m3).toFixed(3)]);
  await q.query(`INSERT INTO order_events(order_id,status) VALUES($1,'confirmed')`, [id]);
  return id;
}
