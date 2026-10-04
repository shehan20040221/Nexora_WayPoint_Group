/**
 * End-to-end smoke test of the whole Waypoint loop against an in-memory Postgres (PGlite). Run: npm run smoke
 * Person B's planner is not needed: the test writes a draft plan straight into the planning tables, then uses A's publishPlan().
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { openDb, migrate } from './db';
import { createApp } from './index';
import { seed } from './seed/seed';
import { publishPlan } from './publish';

process.env.SEED_PASSWORD = 'ChangeMe123!';
const db = await openDb('pglite://memory');
await migrate(db);
await seed(db);
const server = (await createApp(db)).listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

type Res = { status: number; body: any };
const call = async (method: string, path: string, token?: string, body?: any): Promise<Res> => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const ok = async (p: Promise<Res>, msg: string) => { const r = await p; assert.ok(r.status < 300, `${msg}: ${r.status} ${JSON.stringify(r.body)}`); console.log('  ✓', msg); return r.body; };
const login = async (role: string) => (await ok(call('POST', '/auth/login', undefined, { email: `${role}@waypoint.demo`, password: 'ChangeMe123!', role }), `login ${role}`)).token as string;

const [D, L, V, S] = [await login('dispatcher'), await login('loader'), await login('driver'), await login('store')];
assert.equal((await call('POST', '/auth/login', undefined, { email: 'store@waypoint.demo', password: 'nope' })).status, 401);
assert.equal((await call('GET', '/dashboard', S)).status, 403, 'store must not see dispatcher data');

console.log('STORE');
const products = await ok(call('GET', '/products', S), 'products');
const placed = await ok(call('POST', '/orders', S, { items: [{ productId: products.find((p: any) => p.temp === 'chilled').id, qty: 3 }, { productId: products.find((p: any) => p.temp === 'ambient').id, qty: 2 }] }), 'place order (splits chilled/ambient)');
assert.equal(placed.length, 2);
const mine = await ok(call('GET', '/orders?mine=1', S), 'list my orders');
assert.ok(mine.length >= 3);

console.log('DISPATCHER');
const dash = await ok(call('GET', '/dashboard', D), 'dashboard');
assert.ok(dash.ordersInQueue > 10 && dash.availableVehicles > 0);
console.log('   dashboard:', JSON.stringify(dash));

// --- stand-in for Person B: draft plan with a trip on the driver's vehicle
const store = (await db.query(`SELECT * FROM users WHERE role='store'`)).rows[0];
const drv = (await db.query(`SELECT * FROM users WHERE role='driver'`)).rows[0];
const outlet = (await db.query('SELECT * FROM outlets WHERE id=$1', [store.outlet_id])).rows[0];
const date = placed[0].orderDate;
await db.query(`INSERT INTO plans(id,date) VALUES('plan1',$1)`, [date]);
await db.query(`INSERT INTO trips(id,plan_id,vehicle_id,trip_no,brand,district) VALUES('trip1','plan1',$1,1,'Fresh',$2)`, [drv.vehicle_id, outlet.district]);
const extra = (await db.query(`SELECT o.id FROM orders o JOIN outlets ou ON ou.id=o.outlet_id WHERE ou.district=$1 AND ou.brand='Fresh' AND o.order_date=$2 AND o.outlet_id<>$3 LIMIT 2`, [outlet.district, date, store.outlet_id])).rows;
const ids = [...placed.map((o: any) => o.id), ...extra.map((o: any) => o.id)];
for (let i = 0; i < ids.length; i++) await db.query(`UPDATE orders SET trip_id='trip1', vehicle_id=$1, seq=$2 WHERE id=$3`, [drv.vehicle_id, i + 1, ids[i]]);
const { version } = await publishPlan(db, 'plan1');
assert.equal(version, 1); console.log(`  ✓ publishPlan v${version} with ${ids.length} orders`);
const tl = await ok(call('GET', `/orders/${placed[0].id}`, S), 'store order timeline');
assert.ok(tl.timeline.find((t: any) => t.label.startsWith('Planned')).done && tl.etaPlanned, 'store sees ETA after publish');
console.log('   ETA for store:', tl.etaPlanned);

console.log('LOADER');
const trips = await ok(call('GET', '/loader/trips', L), 'assigned trips');
assert.equal(trips[0].status, 'ready');
let det = await ok(call('GET', '/loader/trips/trip1', L), 'trip detail');
assert.ok(det.lines.length > 3 && det.stale === false);
assert.ok(det.lines[0].stopSeq >= det.lines[det.lines.length - 1].stopSeq, 'lines come last-stop-first');
const [first, second, ...rest] = det.lines;
await ok(call('POST', `/loader/lines/${first.id}/confirm`, L), 'confirm line');
// plan changes under the loader's feet -> stale
await db.query(`UPDATE orders SET seq = 99 WHERE id=$1`, [ids[0]]); await db.query(`UPDATE orders SET seq = 1 WHERE id=$1`, [ids[1]]); await db.query(`UPDATE orders SET seq = 2 WHERE id=$1`, [ids[0]]);
await publishPlan(db, 'plan1');
det = await ok(call('GET', '/loader/trips/trip1', L), 'trip detail after republish');
assert.equal(det.stale, true); assert.ok(det.changes.length > 0); console.log('   stale changes:', JSON.stringify(det.changes[0]));
assert.equal((await call('POST', `/loader/lines/${second.id}/confirm`, L)).status, 409, 'cannot load against a stale plan');
await ok(call('POST', '/loader/trips/trip1/resync', L), 're-sync');
det = await ok(call('GET', '/loader/trips/trip1', L), 'trip detail after re-sync'); assert.equal(det.stale, false);
const short = det.lines.find((l: any) => l.status === 'pending' && l.qty > 1);
const shortRes = await ok(call('POST', `/loader/lines/${short.id}/short`, L, { foundQty: 0, reason: 'Damaged crate' }), 'report short unit');
for (const l of det.lines.filter((l: any) => l.status === 'pending' && l.id !== short.id)) await ok(call('POST', `/loader/lines/${l.id}/confirm`, L), `confirm ${l.item.slice(0, 18)}`);
const rel1 = await call('POST', '/loader/trips/trip1/release', L); assert.equal(rel1.status, 409); console.log('  ✓ release blocked while exception open:', rel1.body.error);

console.log('DISPATCHER resolves');
const exs = await ok(call('GET', '/exceptions', D), 'exception inbox'); assert.equal(exs.filter((e: any) => e.status === 'open').length, 1);
await ok(call('POST', `/exceptions/${shortRes.exceptionId}/resolve`, D, { action: 'accept_short', note: 'Ship the rest' }), 'accept short');
await ok(call('POST', '/loader/trips/trip1/release', L), 'release trip');

console.log('DRIVER');
const run = await ok(call('GET', '/driver/run', V), 'driver run');
assert.equal(run.route.status, 'active'); assert.equal(run.stops[0].status, 'next'); assert.equal(run.stops.length, ids.length);
const sig = 'data:image/png;base64,iVBORw0KGgo=', photo = 'data:image/jpeg;base64,/9j/4AAQ';
const s0 = run.stops[0], s1 = run.stops[1];
const ops1 = [
  { opId: 'op-1', type: 'arrive', stopId: s0.id, payload: {}, deviceTime: '2026-10-04T03:50:00Z' },
  { opId: 'op-2', type: 'deliver', stopId: s0.id, payload: { deliveredQty: s0.parcels, recipient: 'A. Perera', signature: sig, photo, note: '' }, deviceTime: '2026-10-04T03:58:00Z' },
  { opId: 'op-3', type: 'deliver', stopId: s1.id, payload: { deliveredQty: 1, recipient: 'B. Silva', signature: sig }, deviceTime: '2026-10-04T04:10:00Z' },
];
let sync = await ok(call('POST', '/sync', V, { ops: ops1 }), 'sync offline queue (2 stops)');
assert.deepEqual(sync.applied, ['op-1', 'op-2']); assert.equal(sync.conflicts.length, 1); console.log('   conflict:', sync.conflicts[0].message);
sync = await ok(call('POST', '/sync', V, { ops: ops1.slice(0, 2) }), 'retry same ops (idempotent)'); assert.deepEqual(sync.duplicates, ['op-1', 'op-2']);
for (const [i, s] of run.stops.slice(1).entries())
  await ok(call('POST', '/sync', V, { ops: [{ opId: `op-d${i}`, type: 'deliver', stopId: s.id, payload: { deliveredQty: s.parcels, recipient: 'X', signature: sig, photo }, deviceTime: `2026-10-04T04:${20 + i}:00Z` }] }), `deliver stop ${s.seq}`);
const run2 = await ok(call('GET', '/driver/run', V), 'driver run after'); assert.equal(run2.route.status, 'complete');

console.log('STORE receipt');
const after = await ok(call('GET', `/orders/${placed[0].id}`, S), 'order after delivery'); assert.equal(after.status, 'delivered');
await ok(call('POST', '/receipts', S, { orderId: placed[0].id, confirmedQty: placed[0].units, status: 'confirmed' }), 'confirm receipt');
await ok(call('POST', '/receipts', S, { orderId: placed[1].id, confirmedQty: placed[1].units - 1, status: 'issue', note: 'One crate crushed' }), 'report receipt issue');
const fin = await ok(call('GET', `/orders/${placed[0].id}`, S), 'final order'); assert.equal(fin.status, 'received'); assert.ok(fin.timeline.every((t: any) => t.done));

console.log('DISPATCHER final');
console.log('   tracking:', JSON.stringify(await ok(call('GET', '/tracking', D), 'tracking')));
const exFinal = await ok(call('GET', '/exceptions', D), 'exceptions'); console.log('   exceptions:', exFinal.map((e: any) => `${e.type}/${e.status}`).join(', '));
console.log('\nSMOKE OK: store → dispatcher → loader → driver → store loop works');
server.close(); await db.close(); process.exit(0);
