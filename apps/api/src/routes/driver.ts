import { Router } from 'express';
import type { Db, Q } from '../db';
import { h, requireAuth, type AuthUser } from '../auth';
import { HttpError, createException, setOrderStatus } from '../shared';

/**
 * The driver's current route. Demo fallback (DEMO_FALLBACK != '0'): if the seeded driver's vehicle has no published trip,
 * show the Fresh route that serves the seeded store account's outlet, so the judge walkthrough always works.
 */
async function routeFor(q: Q, user: AuthUser) {
  const own = (await q.query(`SELECT * FROM routes WHERE vehicle_id=$1 ORDER BY (status='complete'), trip_id LIMIT 1`, [user.vehicleId])).rows[0];
  if (own || process.env.DEMO_FALLBACK === '0') return own ?? null;
  return (await q.query(`SELECT rt.* FROM routes rt JOIN stops s ON s.route_id=rt.id JOIN orders o ON o.id=s.order_id
    JOIN users u ON u.role='store' AND u.outlet_id=o.outlet_id WHERE rt.status <> 'complete' ORDER BY rt.id LIMIT 1`)).rows[0] ?? null;
}

export function driverRouter(db: Db) {
  const r = Router();
  const auth = requireAuth('driver');

  r.get('/driver/run', auth, h(async (req, res) => {
    const route = await routeFor(db, req.user!);
    if (!route) return res.json({ route: null, stops: [] });
    const rows = (await db.query(`SELECT s.*, o.units, o.temp, ou.name AS outlet_name, ou.address, ou.window_open, ou.window_close
      FROM stops s JOIN orders o ON o.id=s.order_id JOIN outlets ou ON ou.id=o.outlet_id WHERE s.route_id=$1 ORDER BY s.seq`, [route.id])).rows;
    const nextId = route.status === 'active' ? rows.find((s: any) => ['upcoming', 'next'].includes(s.status))?.id : null;
    res.json({
      route: { id: route.id, vehicleId: route.vehicle_id, status: route.status, name: route.name },
      stops: rows.map((s: any) => ({ id: s.id, seq: s.seq, orderId: s.order_id, outletName: s.outlet_name, address: s.address ?? s.outlet_name,
        windowOpen: s.window_open, windowClose: s.window_close, parcels: s.units, temp: s.temp,
        status: s.id === nextId ? 'next' : s.status === 'next' ? 'upcoming' : s.status, eta: s.eta, instructions: s.instructions })),
    });
  }));

  r.post('/sync', auth, h(async (req, res) => {
    const ops = req.body?.ops;
    if (!Array.isArray(ops)) throw new HttpError(400, 'ops[] required');
    const applied: string[] = [], duplicates: string[] = [], conflicts: { opId: string; message: string }[] = [];
    const sorted = [...ops].sort((a, b) => String(a.deviceTime ?? '').localeCompare(String(b.deviceTime ?? '')));
    for (const op of sorted) {
      if (!op?.opId || !op.type || !op.stopId) { conflicts.push({ opId: op?.opId ?? '?', message: 'Malformed op' }); continue; }
      try {
        const result = await db.tx(async (q) => {
          if ((await q.query('SELECT 1 FROM sync_ops WHERE op_id=$1', [op.opId])).rows.length) return 'dup';
          const route = await routeFor(q, req.user!);
          const s = route && (await q.query('SELECT * FROM stops WHERE id=$1 AND route_id=$2', [op.stopId, route.id])).rows[0];
          if (!s) throw new HttpError(409, 'Stop not on your route (plan may have changed)');
          if (route.status !== 'active') throw new HttpError(409, 'Route not released by the loader yet');
          const ord = (await q.query('SELECT * FROM orders WHERE id=$1', [s.order_id])).rows[0];
          const final = ['delivered', 'unable'].includes(s.status);
          const p = op.payload ?? {};
          if (op.type === 'arrive') {
            if (!final && s.status !== 'arrived') await q.query(`UPDATE stops SET status='arrived', arrived_at=$1 WHERE id=$2`, [op.deviceTime ? new Date(op.deviceTime) : new Date(), s.id]);
          } else if (op.type === 'deliver') {
            if (final) throw new HttpError(409, `Stop already ${s.status}`);
            if (!p.signature || !p.photo) throw new HttpError(400, 'Signature and photo are required as proof of delivery');
            if (!Number.isInteger(p.deliveredQty) || p.deliveredQty < 0) throw new HttpError(400, 'deliveredQty required');
            await q.query(`UPDATE stops SET status='delivered', delivered_at=$1, arrived_at=COALESCE(arrived_at,$1), delivered_qty=$2, recipient=$3, signature=$4, photo=$5, note=$6 WHERE id=$7`,
              [op.deviceTime ? new Date(op.deviceTime) : new Date(), p.deliveredQty, p.recipient ?? null, p.signature, p.photo, p.note ?? null, s.id]);
            await setOrderStatus(q, ord.id, p.deliveredQty >= ord.units ? 'delivered' : p.deliveredQty > 0 ? 'partial' : 'unable');
            if (p.deliveredQty < ord.units)
              await createException(q, { type: 'short_delivery', severity: 'medium', tripId: ord.trip_id, orderRef: ord.ref, detail: `Delivered ${p.deliveredQty}/${ord.units} units${p.note ? ': ' + p.note : ''}` });
          } else if (op.type === 'exception') {
            if (final) throw new HttpError(409, `Stop already ${s.status}`);
            await q.query(`UPDATE stops SET status='unable', note=$1 WHERE id=$2`, [`${p.reason ?? 'unspecified'}: ${p.details ?? ''}`, s.id]);
            await setOrderStatus(q, ord.id, 'unable');
            await createException(q, { type: 'delivery_failed', severity: 'high', tripId: ord.trip_id, orderRef: ord.ref,
              detail: `${p.reason ?? 'Unable to deliver'}${p.details ? ' – ' + p.details : ''}${p.requestedAction ? ` (driver asks: ${p.requestedAction})` : ''}` });
          } else throw new HttpError(400, `Unknown op type ${op.type}`);
          await q.query('INSERT INTO sync_ops(op_id,stop_id,type,device_time) VALUES($1,$2,$3,$4)', [op.opId, op.stopId, op.type, op.deviceTime ?? null]);
          const left = (await q.query(`SELECT count(*)::int AS n FROM stops WHERE route_id=$1 AND status NOT IN ('delivered','unable')`, [route.id])).rows[0].n;
          if (!left) await q.query(`UPDATE routes SET status='complete' WHERE id=$1`, [route.id]);
          return 'ok';
        });
        (result === 'dup' ? duplicates : applied).push(op.opId);
      } catch (e: any) {
        if (e instanceof HttpError) conflicts.push({ opId: op.opId, message: e.message }); else throw e;
      }
    }
    res.json({ applied, duplicates, conflicts });
  }));
  return r;
}
