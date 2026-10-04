import { Router } from 'express';
import type { Db } from '../db';
import { h, requireAuth } from '../auth';
import { HttpError, createException, setOrderStatus } from '../shared';

const diff = (was: any[] | null, now: any[]) => {
  const out: { label: string; was: string; now: string }[] = [];
  const a = was ?? [];
  for (let i = 0; i < Math.max(a.length, now.length); i++) {
    const x = a[i], y = now[i];
    const f = (s: any) => (s ? `${s.outlet} (${s.ref}) · ETA ${s.eta}` : '—');
    if (f(x) !== f(y)) out.push({ label: `Stop ${i + 1}`, was: f(x), now: f(y) });
  }
  return out;
};

export function loaderRouter(db: Db) {
  const r = Router();
  const auth = requireAuth('loader');

  const tripSummary = async (t: any) => {
    const [agg] = (await db.query(`SELECT COALESCE(sum(qty),0)::int AS units FROM load_lines WHERE trip_id=$1`, [t.id])).rows;
    const [w] = (await db.query(`SELECT COALESCE(sum(weight_kg),0) AS w, COALESCE(sum(volume_m3),0) AS v, count(*)::int AS stops FROM orders WHERE trip_id=$1`, [t.id])).rows;
    const v = (await db.query('SELECT * FROM vehicles WHERE id=$1', [t.vehicle_id])).rows[0];
    return { id: t.id, vehicleId: t.vehicle_id, plate: v.plate, departurePlanned: t.departure_planned, version: t.plan_version, status: t.status,
      units: agg.units, fillPct: Math.min(100, Math.round(Math.max(w.w / v.weight_cap_kg, w.v / v.volume_cap_m3) * 100)), stops: w.stops };
  };

  r.get('/loader/trips', auth, h(async (req, res) => {
    const rows = (await db.query(`SELECT t.* FROM trips t JOIN vehicles v ON v.id=t.vehicle_id
      WHERE t.status IN ('ready','loading','held','released') AND ($1::text IS NULL OR v.depot=$1) ORDER BY t.departure_planned, t.vehicle_id, t.trip_no`, [req.user!.depot ?? null])).rows;
    res.json(await Promise.all(rows.map(tripSummary)));
  }));

  r.get('/loader/trips/:id', auth, h(async (req, res) => {
    const t = (await db.query('SELECT * FROM trips WHERE id=$1', [req.params.id])).rows[0];
    if (!t || t.status === 'draft') throw new HttpError(404, 'Trip not found');
    const lines = (await db.query('SELECT * FROM load_lines WHERE trip_id=$1 ORDER BY stop_seq DESC, temp DESC, id', [t.id])).rows; // last stop first
    const stale = t.plan_version !== t.acked_version;
    res.json({
      trip: await tripSummary(t), planVersion: t.acked_version, currentVersion: t.plan_version, stale,
      changes: stale ? diff(t.acked_snapshot, t.snapshot ?? []) : [],
      lines: lines.map((l: any) => ({ id: l.id, stopSeq: l.stop_seq, outletName: l.outlet_name, item: l.item, sku: l.sku, qty: l.qty, unit: l.unit, zone: l.zone, temp: l.temp, status: l.status })),
    });
  }));

  const loadLine = async (q: any, id: string) => {
    const l = (await q.query('SELECT l.*, t.status AS tstatus, t.plan_version, t.acked_version FROM load_lines l JOIN trips t ON t.id=l.trip_id WHERE l.id=$1', [id])).rows[0];
    if (!l) throw new HttpError(404, 'Line not found');
    if (l.tstatus === 'released') throw new HttpError(409, 'Trip already released');
    if (l.plan_version !== l.acked_version) throw new HttpError(409, 'Plan changed: re-sync before loading', { stale: true });
    return l;
  };
  const startLoading = async (q: any, l: any) => {
    if (l.tstatus === 'ready') {
      await q.query(`UPDATE trips SET status='loading' WHERE id=$1`, [l.trip_id]);
      const os = (await q.query(`SELECT id FROM orders WHERE trip_id=$1 AND status='planned'`, [l.trip_id])).rows;
      for (const o of os) await setOrderStatus(q, o.id, 'loading');
    }
  };

  r.post('/loader/lines/:id/confirm', auth, h(async (req, res) => {
    await db.tx(async (q) => {
      const l = await loadLine(q, req.params.id);
      if (l.status === 'short') throw new HttpError(409, 'Line is flagged short; waiting for dispatcher');
      await startLoading(q, l);
      await q.query(`UPDATE load_lines SET status='loaded', found_qty=qty WHERE id=$1`, [l.id]);
    });
    res.json({ ok: true });
  }));

  r.post('/loader/lines/:id/short', auth, h(async (req, res) => {
    const { foundQty, reason } = req.body ?? {};
    if (!Number.isInteger(foundQty) || foundQty < 0) throw new HttpError(400, 'foundQty must be a non-negative integer');
    if (typeof reason !== 'string' || !reason.trim()) throw new HttpError(400, 'reason required');
    const exceptionId = await db.tx(async (q) => {
      const l = await loadLine(q, req.params.id);
      if (foundQty >= l.qty) throw new HttpError(400, 'foundQty must be below the planned qty; use confirm instead');
      await startLoading(q, l);
      await q.query(`UPDATE load_lines SET status='short', found_qty=$1, short_reason=$2 WHERE id=$3`, [foundQty, reason, l.id]);
      await q.query(`UPDATE trips SET status='held' WHERE id=$1`, [l.trip_id]);
      const ref = (await q.query('SELECT ref FROM orders WHERE id=$1', [l.order_id])).rows[0].ref;
      return createException(q, { type: 'short_unit', severity: 'high', tripId: l.trip_id, orderRef: ref, lineId: l.id,
        detail: `${l.item}: found ${foundQty} of ${l.qty} ${l.unit} for ${l.outlet_name} (${reason})` });
    });
    res.json({ ok: true, exceptionId });
  }));

  r.post('/loader/trips/:id/resync', auth, h(async (req, res) => {
    const n = await db.query(`UPDATE trips SET acked_version=plan_version, acked_snapshot=snapshot WHERE id=$1 AND status <> 'released' RETURNING id`, [req.params.id]);
    if (!n.rows.length) throw new HttpError(404, 'Trip not found or already released');
    res.json({ ok: true });
  }));

  r.post('/loader/trips/:id/release', auth, h(async (req, res) => {
    await db.tx(async (q) => {
      const t = (await q.query('SELECT * FROM trips WHERE id=$1', [req.params.id])).rows[0];
      if (!t) throw new HttpError(404, 'Trip not found');
      if (t.status === 'released') throw new HttpError(409, 'Already released');
      if (t.plan_version !== t.acked_version) throw new HttpError(409, 'Plan changed: re-sync first', { stale: true });
      const pending = (await q.query(`SELECT count(*)::int AS n FROM load_lines WHERE trip_id=$1 AND status='pending'`, [t.id])).rows[0].n;
      const open = (await q.query(`SELECT count(*)::int AS n FROM exceptions WHERE trip_id=$1 AND status='open'`, [t.id])).rows[0].n;
      if (pending) throw new HttpError(409, `${pending} line(s) still pending`, { pending });
      if (open) throw new HttpError(409, 'Open exception: dispatcher must resolve it first', { openExceptions: open });
      await q.query(`UPDATE trips SET status='released' WHERE id=$1`, [t.id]);
      await q.query(`UPDATE routes SET status='active' WHERE trip_id=$1`, [t.id]);
      const os = (await q.query(`SELECT id FROM orders WHERE trip_id=$1 AND status IN ('planned','loading','loaded')`, [t.id])).rows;
      for (const o of os) await setOrderStatus(q, o.id, 'in_transit');
    });
    res.json({ ok: true });
  }));
  return r;
}
