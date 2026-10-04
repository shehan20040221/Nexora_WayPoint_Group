import type { Db, Q } from './db';
import { HttpError, fmt, hm, setOrderStatus, uid } from './shared';

/**
 * Called by Person B's POST /plan/publish. Takes the draft/published plan's trips (trips + orders.trip_id/seq written by B) and:
 *  - bumps plan version, computes trip minutes, departure and per-stop ETAs
 *  - (re)creates loader lines (never touches released trips; keeps confirmed lines; marks in-progress trips stale)
 *  - (re)creates the driver route + stops
 * Safe to call repeatedly (republish).
 */
export async function publishPlan(db: Db, planId: string): Promise<{ version: number }> {
  return db.tx(async (q) => {
    const plan = (await q.query('SELECT * FROM plans WHERE id=$1', [planId])).rows[0];
    if (!plan) throw new HttpError(404, 'plan not found');
    const version = plan.version + 1;
    const trips = (await q.query('SELECT * FROM trips WHERE plan_id=$1 ORDER BY vehicle_id, trip_no', [planId])).rows;
    const clock = new Map<string, number>(); // vehicle+group -> minute when vehicle is free again

    for (const trip of trips) {
      const orders = (await q.query(
        `SELECT o.*, ou.name AS outlet_name, ou.dock_type, ou.address FROM orders o JOIN outlets ou ON ou.id=o.outlet_id
         WHERE o.trip_id=$1 AND o.status NOT IN ('deferred') ORDER BY o.seq NULLS LAST, o.id`, [trip.id])).rows;
      if (trip.status === 'released') continue;
      if (!orders.length) { await q.query('DELETE FROM trips WHERE id=$1 AND status IN (\'draft\',\'ready\')', [trip.id]); continue; }

      // ---- timing (booklet formula: outbound + inter-stop*(n-1) + sum(handling))
      const dt = (await q.query('SELECT * FROM district_travel WHERE district=$1', [trip.district])).rows[0];
      const outbound = dt?.depot_to_district_freeflow_min ?? 30, inter = dt?.inter_stop_freeflow_min ?? 8;
      const handling: number[] = [];
      for (const o of orders) {
        const sa = (await q.query('SELECT minutes FROM service_allowance WHERE brand=$1 AND dock_type=$2', [trip.brand, o.dock_type])).rows[0];
        handling.push(sa?.minutes ?? 15);
      }
      const group = `${trip.vehicle_id}:${trip.brand === 'Fresh' ? 'F' : 'S'}`;
      const depart = clock.get(group) ?? (trip.brand === 'Fresh' ? hm('03:30') : hm('08:00'));
      const minutes = Math.round(outbound + inter * (orders.length - 1) + handling.reduce((a, b) => a + b, 0));
      clock.set(group, depart + minutes + 30); // 30 min reload before the vehicle's next trip
      const etas: number[] = []; let t = depart + outbound;
      orders.forEach((_, i) => { if (i > 0) t += inter; etas.push(t); t += handling[i]; });

      // ---- orders
      for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        await q.query('UPDATE orders SET seq=$1, eta_planned=$2, vehicle_id=$3 WHERE id=$4', [i + 1, fmt(etas[i]), trip.vehicle_id, o.id]);
        if (o.status === 'confirmed') await setOrderStatus(q, o.id, 'planned');
      }

      // ---- load lines
      const keepIds = new Set<string>(orders.map((o: any) => o.id));
      // keep line ids stable across republish (an open loader tablet still holds them): only drop lines of orders that left the trip
      await q.query(`DELETE FROM load_lines WHERE trip_id=$1 AND order_id <> ALL($2::text[])`, [trip.id, [...keepIds]]);
      for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        const items = (await q.query('SELECT ol.qty, p.* FROM order_lines ol JOIN products p ON p.id=ol.product_id WHERE ol.order_id=$1', [o.id])).rows;
        for (const it of items) {
          const ex = (await q.query('SELECT id FROM load_lines WHERE trip_id=$1 AND order_id=$2 AND sku=$3', [trip.id, o.id, it.sku])).rows[0];
          if (ex) { await q.query(`UPDATE load_lines SET stop_seq=$1, outlet_name=$2, qty=CASE WHEN status='pending' THEN $4 ELSE qty END WHERE id=$3`, [i + 1, o.outlet_name, ex.id, it.qty]); continue; }
          const zone = it.temp === 'chilled' ? 'Cold room' : `Dry bay ${(i % 2) ? 'B' : 'A'}`;
          await q.query(`INSERT INTO load_lines(id,trip_id,order_id,stop_seq,outlet_name,item,sku,qty,unit,zone,temp) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [uid('ll'), trip.id, o.id, i + 1, o.outlet_name, it.name, it.sku, it.qty, it.unit, zone, it.temp]);
        }
      }

      // ---- route + stops
      const routeId = `RT-${trip.id}`;
      const rname = `${trip.brand} · ${trip.district} · Trip ${trip.trip_no}`;
      await q.query(`INSERT INTO routes(id,trip_id,vehicle_id,name) VALUES($1,$2,$3,$4) ON CONFLICT (trip_id) DO UPDATE SET vehicle_id=$3, name=$4`, [routeId, trip.id, trip.vehicle_id, rname]);
      await q.query(`DELETE FROM stops WHERE route_id=$1 AND status IN ('upcoming','next') AND order_id <> ALL($2::text[])`, [routeId, [...keepIds]]);
      for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        const instr = o.dock_type === 'rear_dock' ? 'Use the rear loading bay; ask for the receiving clerk.' : o.dock_type === 'mall_bay' ? 'Shared mall bay: deliver inside the mall access window only.' : 'Curbside unloading: hazards on, keep it quick.';
        await q.query(`INSERT INTO stops(id,route_id,seq,order_id,eta,instructions) VALUES($1,$2,$3,$4,$5,$6)
          ON CONFLICT (route_id, order_id) DO UPDATE SET seq=$3, eta=$5`, [uid('stp'), routeId, i + 1, o.id, fmt(etas[i]), instr]);
      }

      // ---- versioning: staleness for loaders already working on an older version
      const snapshot = orders.map((o: any, i: number) => ({ seq: i + 1, outlet: o.outlet_name, ref: o.ref, eta: fmt(etas[i]) }));
      const inProgress = ['loading', 'held'].includes(trip.status);
      await q.query(
        `UPDATE trips SET status=$1, minutes=$2, departure_planned=$3, plan_version=$4, snapshot=$5::jsonb,
           acked_version = CASE WHEN $6 THEN acked_version ELSE $4 END,
           acked_snapshot = CASE WHEN $6 THEN acked_snapshot ELSE $5::jsonb END WHERE id=$7`,
        [inProgress ? trip.status : 'ready', minutes, fmt(depart), version, JSON.stringify(snapshot), inProgress, trip.id]);
    }
    await q.query(`UPDATE plans SET status='published', version=$1 WHERE id=$2`, [version, planId]);
    return { version };
  });
}
