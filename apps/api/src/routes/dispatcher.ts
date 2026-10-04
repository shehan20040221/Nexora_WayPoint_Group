import { Router } from 'express';
import type { Db } from '../db';
import { h, requireAuth } from '../auth';
import { HttpError, colomboHM, hm, notify, setOrderStatus } from '../shared';

export function dispatcherRouter(db: Db) {
  const r = Router();
  const auth = requireAuth('dispatcher');

  r.get('/dashboard', auth, h(async (req, res) => {
    const depot = req.user!.depot ?? 'Peliyagoda';
    const n = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows[0].n as number;
    const date = (await db.query('SELECT max(order_date) AS d FROM orders')).rows[0].d;
    const veh = (await db.query(`SELECT * FROM vehicles WHERE depot=$1 AND status='available'`, [depot])).rows;
    const cap = (f: (v: any) => number) => veh.reduce((a: number, v: any) => a + f(v), 0) * 2; // two trips per vehicle
    const planned = (await db.query(`SELECT o.weight_kg, o.volume_m3, o.temp FROM orders o JOIN outlets ou ON ou.id=o.outlet_id
      WHERE o.order_date=$1 AND ou.depot=$2 AND o.trip_id IS NOT NULL AND o.status NOT IN ('deferred')`, [date, depot])).rows;
    const pct = (a: number, b: number) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
    res.json({
      ordersInQueue: await n(`SELECT count(*)::int AS n FROM orders WHERE status='confirmed'`),
      activeRoutes: await n(`SELECT count(*)::int AS n FROM routes WHERE status IN ('scheduled','active')`),
      openExceptions: await n(`SELECT count(*)::int AS n FROM exceptions WHERE status='open'`),
      availableVehicles: veh.length,
      weightPct: pct(planned.reduce((a: number, o: any) => a + o.weight_kg, 0), cap((v) => v.weight_cap_kg)),
      volumePct: pct(planned.reduce((a: number, o: any) => a + o.volume_m3, 0), cap((v) => v.volume_cap_m3)),
      coldChainPct: pct(planned.filter((o: any) => o.temp === 'chilled').reduce((a: number, o: any) => a + o.volume_m3, 0),
        veh.filter((v: any) => v.temp === 'reefer').reduce((a: number, v: any) => a + v.volume_cap_m3, 0) * 2),
      cutoff: '16:00',
    });
  }));

  r.get('/tracking', auth, h(async (_req, res) => {
    const rows = (await db.query(`SELECT t.id, t.vehicle_id, rt.status AS rstatus, t.status AS tstatus, u.name AS driver FROM trips t
      JOIN routes rt ON rt.trip_id=t.id LEFT JOIN users u ON u.vehicle_id=t.vehicle_id AND u.role='driver' ORDER BY t.vehicle_id, t.trip_no`)).rows;
    const out = [];
    for (const t of rows) {
      const stops = (await db.query('SELECT * FROM stops WHERE route_id=$1', [`RT-${t.id}`])).rows;
      const done = stops.filter((s: any) => ['delivered', 'unable'].includes(s.status)).length;
      let delay = 0;
      for (const s of stops) if (s.arrived_at && s.eta) delay = Math.max(delay, hm(colomboHM(new Date(s.arrived_at))) - hm(s.eta));
      const openEx = (await db.query(`SELECT count(*)::int AS n FROM exceptions WHERE trip_id=$1 AND status='open'`, [t.id])).rows[0].n;
      const risk = delay >= 20 || stops.some((s: any) => s.status === 'unable') ? 'critical' : delay > 0 || openEx > 0 ? 'watch' : 'ok';
      const status = t.rstatus === 'complete' ? 'complete' : t.rstatus === 'active' ? 'in_transit' : t.tstatus;
      out.push({ tripId: t.id, vehicleId: t.vehicle_id, driver: t.driver ?? `Driver ${t.vehicle_id}`, status, stopsDone: done, stopsTotal: stops.length, delayMin: delay, risk });
    }
    res.json(out);
  }));

  r.get('/exceptions', auth, h(async (_req, res) => {
    const rows = (await db.query(`SELECT * FROM exceptions ORDER BY (status='open') DESC, created_at DESC`)).rows;
    res.json(rows.map((e: any) => ({ id: e.id, type: e.type, severity: e.severity, tripId: e.trip_id, orderRef: e.order_ref, detail: e.detail, status: e.status })));
  }));

  r.post('/exceptions/:id/resolve', auth, h(async (req, res) => {
    const { action, note } = req.body ?? {};
    if (!['accept_short', 'replace', 'defer'].includes(action)) throw new HttpError(400, "action must be accept_short | replace | defer");
    await db.tx(async (q) => {
      const ex = (await q.query('SELECT * FROM exceptions WHERE id=$1', [req.params.id])).rows[0];
      if (!ex) throw new HttpError(404, 'Exception not found');
      if (ex.status === 'resolved') throw new HttpError(409, 'Already resolved');
      await q.query(`UPDATE exceptions SET status='resolved', resolved_action=$1, note=$2, resolved_at=now() WHERE id=$3`, [action, note ?? null, ex.id]);
      const line = ex.line_id ? (await q.query('SELECT * FROM load_lines WHERE id=$1', [ex.line_id])).rows[0] : null;
      if (line && action === 'replace') await q.query(`UPDATE load_lines SET status='pending', found_qty=NULL, short_reason=NULL WHERE id=$1`, [line.id]);
      if (line && action === 'defer') {
        const o = (await q.query('SELECT * FROM orders WHERE id=$1', [line.order_id])).rows[0];
        await q.query(`DELETE FROM load_lines WHERE order_id=$1`, [o.id]);
        await q.query(`DELETE FROM stops WHERE order_id=$1 AND status IN ('upcoming','next')`, [o.id]);
        await q.query(`UPDATE orders SET trip_id=NULL, vehicle_id=NULL, seq=NULL, eta_planned=NULL, deferral_reason='OTHER', deferral_note=$2 WHERE id=$1`, [o.id, `Loading shortfall: ${line.item}`]);
        await setOrderStatus(q, o.id, 'deferred');
        await notify(q, o.outlet_id, 'deferral', `Order ${o.ref} moved to the next run`, `Part of your order was unavailable at loading (${line.item}). We will deliver it on the next run.`);
      }
      if (ex.trip_id) {
        const open = (await q.query(`SELECT count(*)::int AS n FROM exceptions WHERE trip_id=$1 AND status='open'`, [ex.trip_id])).rows[0].n;
        if (!open) await q.query(`UPDATE trips SET status='loading' WHERE id=$1 AND status='held'`, [ex.trip_id]);
      }
    });
    res.json({ ok: true });
  }));
  return r;
}
