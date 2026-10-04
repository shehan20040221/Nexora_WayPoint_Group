import { Router } from 'express';
import type { Db } from '../db';
import { h, requireAuth } from '../auth';
import { HttpError, ORDER_SELECT, colomboHM, createException, createOrder, mapOrder, nextOperatingDate, notify, setOrderStatus, uid } from '../shared';

const TIMELINE: [string, string[]][] = [
  ['Order confirmed', ['confirmed']], ['Planned on a vehicle', ['planned']], ['Loading at depot', ['loading']],
  ['Out for delivery', ['in_transit']], ['Delivered', ['delivered', 'partial', 'unable']], ['Receipt confirmed', ['received', 'issue']],
];

export async function orderDetail(db: Db, id: string) {
  const row = (await db.query(`${ORDER_SELECT} WHERE o.id=$1 OR o.ref=$1`, [id])).rows[0];
  if (!row) throw new HttpError(404, 'Order not found');
  const events = (await db.query('SELECT status, at FROM order_events WHERE order_id=$1 ORDER BY id', [row.id])).rows;
  const timeline = TIMELINE.map(([label, sts]) => {
    const ev = events.find((e: any) => sts.includes(e.status));
    return { label, time: ev ? colomboHM(new Date(ev.at)) : null, done: !!ev };
  });
  const lines = (await db.query(`SELECT p.sku, p.name, ol.qty, ol.weight_kg, p.temp FROM order_lines ol JOIN products p ON p.id=ol.product_id WHERE ol.order_id=$1`, [row.id])).rows
    .map((l: any) => ({ sku: l.sku, name: l.name, qty: l.qty, weightKg: l.weight_kg, handling: l.temp === 'chilled' ? 'Keep chilled (0–4°C)' : 'Ambient' }));
  return { ...mapOrder(row), timeline, lines };
}

export function storeRouter(db: Db) {
  const r = Router();

  r.get('/products', requireAuth('store', 'dispatcher'), h(async (req, res) => {
    let brand: string | null = null;
    if (req.user!.role === 'store') brand = (await db.query('SELECT brand FROM outlets WHERE id=$1', [req.user!.outletId])).rows[0]?.brand ?? null;
    const rows = (await db.query(`SELECT * FROM products ${brand ? 'WHERE brand=$1' : ''} ORDER BY temp, name`, brand ? [brand] : [])).rows;
    res.json(rows.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku, temp: p.temp, unit: p.unit, weightKg: p.weight_kg, volumeM3: p.volume_m3 })));
  }));

  r.post('/orders', requireAuth('store'), h(async (req, res) => {
    const items = req.body?.items;
    if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'items[] required');
    const ids = await db.tx(async (q) => {
      const byTemp: Record<string, { productId: string; qty: number }[]> = { chilled: [], ambient: [] };
      for (const it of items) {
        const p = (await q.query('SELECT temp FROM products WHERE id=$1', [it.productId])).rows[0];
        if (!p) throw new HttpError(400, `unknown product ${it.productId}`);
        byTemp[p.temp].push({ productId: it.productId, qty: it.qty });
      }
      const date = await nextOperatingDate(q);
      const out: string[] = [];
      for (const temp of ['ambient', 'chilled'] as const)
        if (byTemp[temp].length) out.push(await createOrder(q, { outletId: req.user!.outletId!, temp, items: byTemp[temp], orderDate: date }));
      return out;
    });
    const rows = (await db.query(`${ORDER_SELECT} WHERE o.id = ANY($1::text[]) ORDER BY o.ref`, [ids])).rows;
    res.status(201).json(rows.map(mapOrder));
  }));

  // store: ?mine=1 ; dispatcher: ?date=&status=
  r.get('/orders', requireAuth('store', 'dispatcher'), h(async (req, res) => {
    const where: string[] = [], p: any[] = [];
    if (req.user!.role === 'store') { p.push(req.user!.outletId); where.push(`o.outlet_id=$${p.length}`); }
    else if (req.query.mine) throw new HttpError(403, 'mine=1 is for store accounts');
    if (req.query.date) { p.push(req.query.date); where.push(`o.order_date=$${p.length}`); }
    if (req.query.status) { p.push(String(req.query.status).split(',')); where.push(`o.status = ANY($${p.length}::text[])`); }
    const rows = (await db.query(`${ORDER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.created_at DESC, o.ref`, p)).rows;
    res.json(rows.map(mapOrder));
  }));

  r.get('/orders/:id', requireAuth('store', 'dispatcher', 'loader'), h(async (req, res) => {
    const d = await orderDetail(db, req.params.id);
    if (req.user!.role === 'store' && d.outletId !== req.user!.outletId) throw new HttpError(403, 'Not your order');
    res.json(d);
  }));

  r.post('/receipts', requireAuth('store'), h(async (req, res) => {
    const { orderId, confirmedQty, status, note } = req.body ?? {};
    if (!['confirmed', 'issue'].includes(status)) throw new HttpError(400, "status must be 'confirmed' or 'issue'");
    if (!Number.isInteger(confirmedQty) || confirmedQty < 0) throw new HttpError(400, 'confirmedQty must be a non-negative integer');
    await db.tx(async (q) => {
      const o = (await q.query('SELECT * FROM orders WHERE id=$1 OR ref=$1', [orderId])).rows[0];
      if (!o || o.outlet_id !== req.user!.outletId) throw new HttpError(404, 'Order not found');
      if (!['delivered', 'partial'].includes(o.status)) throw new HttpError(409, `Order is ${o.status}; receipt can only be confirmed after delivery`);
      await q.query('INSERT INTO receipts(id,order_id,confirmed_qty,status,note) VALUES($1,$2,$3,$4,$5)', [uid('rcp'), o.id, confirmedQty, status, note ?? null]);
      await setOrderStatus(q, o.id, status === 'issue' ? 'issue' : 'received');
      if (status === 'issue' || confirmedQty < o.units)
        await createException(q, { type: 'receipt_issue', severity: 'medium', orderRef: o.ref, tripId: o.trip_id ?? undefined, detail: `Store confirmed ${confirmedQty}/${o.units} units${note ? ': ' + note : ''}` });
    });
    res.json({ ok: true });
  }));

  r.get('/notifications', requireAuth('store'), h(async (req, res) => {
    const rows = (await db.query('SELECT * FROM notifications WHERE outlet_id=$1 ORDER BY created_at DESC', [req.user!.outletId])).rows;
    res.json(rows.map((n: any) => ({ id: n.id, type: n.type, title: n.title, body: n.body, createdAt: n.created_at })));
  }));
  return r;
}
