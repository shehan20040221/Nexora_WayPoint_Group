import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import type { Db } from '../db';
import { createOrder, nextOperatingDate } from '../shared';
import { sampleDataset } from './sampleData';

const DATA_DIR = process.env.DATA_DIR ?? resolve(process.cwd(), '../../data');
const FILES = ['outlets', 'vehicles', 'calendar', 'district_travel', 'service_allowance'];
type Row = Record<string, string>;
const num = (s: string | undefined, d = 0) => (s === undefined || s === '' || isNaN(Number(s)) ? d : Number(s));

function loadDataset(): { data: Record<string, Row[]>; source: 'csv' | 'sample' } {
  const missing = FILES.filter((f) => !existsSync(resolve(DATA_DIR, `${f}.csv`)));
  if (!missing.length) return { data: Object.fromEntries(FILES.map((f) => [f, parse(readFileSync(resolve(DATA_DIR, `${f}.csv`)), { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Row[]])), source: 'csv' };
  if (process.env.ALLOW_SAMPLE_DATA === '0') throw new Error(`Missing CSVs in ${DATA_DIR}: ${missing.join(', ')}`);
  console.warn(`[seed] CSVs missing (${missing.join(', ')}) in ${DATA_DIR}: using SYNTHETIC SAMPLE data. Drop the real CSVs in /data and re-seed.`);
  return { data: sampleDataset(), source: 'sample' };
}

const PRODUCTS: [string, string, string, string, string, string, number][] = [
  // id, name, sku, brand, temp, unit, ...  (weight/volume per unit below)
  ['p01', 'Fresh milk 1L (crate of 12)', 'MLK-1L-12', 'Fresh', 'chilled', 'crate', 13.5], ['p02', 'Yoghurt cups (tray of 24)', 'YOG-24', 'Fresh', 'chilled', 'tray', 4.8],
  ['p03', 'Chicken breast 5kg', 'CHK-5KG', 'Fresh', 'chilled', 'box', 5.4], ['p04', 'Beef mince 5kg', 'BEF-5KG', 'Fresh', 'chilled', 'box', 5.4],
  ['p05', 'Cheese blocks (case of 10)', 'CHS-10', 'Fresh', 'chilled', 'case', 6.2], ['p06', 'Fresh produce crate', 'PRD-CRT', 'Fresh', 'chilled', 'crate', 14],
  ['p07', 'Basmati rice 25kg', 'RIC-25', 'Fresh', 'ambient', 'sack', 25.5], ['p08', 'Canned fish (case of 48)', 'FSH-48', 'Fresh', 'ambient', 'case', 12],
  ['p09', 'Cooking oil 5L (case of 4)', 'OIL-5L-4', 'Fresh', 'ambient', 'case', 19], ['p10', 'Tea packets (carton)', 'TEA-CTN', 'Fresh', 'ambient', 'carton', 8],
  ['p11', 'Bottled water (pack of 12)', 'WTR-12', 'Fresh', 'ambient', 'pack', 13], ['p12', 'Biscuits (carton of 40)', 'BIS-40', 'Fresh', 'ambient', 'carton', 9],
  ['p20', 'Hanging garments rail (20 pcs)', 'GRM-RAIL-20', 'Style', 'ambient', 'rail', 18], ['p21', 'Garment carton (mixed)', 'GRM-CTN', 'Style', 'ambient', 'carton', 9],
  ['p30', 'Refrigerator 300L', 'APP-FRG-300', 'Tech', 'ambient', 'unit', 68], ['p31', 'Washing machine 7kg', 'APP-WSH-7', 'Tech', 'ambient', 'unit', 62],
  ['p32', 'LED TV 55"', 'ELE-TV-55', 'Tech', 'ambient', 'unit', 19],
];
const VOL: Record<string, number> = { p01: 0.045, p02: 0.02, p03: 0.016, p04: 0.016, p05: 0.02, p06: 0.07, p07: 0.04, p08: 0.03, p09: 0.035, p10: 0.06, p11: 0.03, p12: 0.05, p20: 0.45, p21: 0.12, p30: 0.9, p31: 0.45, p32: 0.14 };

export async function seed(db: Db) {
  const { data, source } = loadDataset();
  const password = process.env.SEED_PASSWORD ?? 'ChangeMe123!';
  const hash = await bcrypt.hash(password, 10);

  await db.tx(async (q) => {
    for (const t of ['sync_ops', 'stops', 'routes', 'exceptions', 'load_lines', 'receipts', 'notifications', 'plan_decisions', 'order_events', 'order_lines', 'orders', 'trips', 'plans', 'users', 'products', 'service_allowance', 'district_travel', 'calendar', 'vehicles', 'outlets'])
      await q.query(`DELETE FROM ${t}`);

    const dtByDistrict = new Map(data.district_travel.map((d) => [d.district, d]));
    for (const o of data.outlets) {
      const n = o.outlet_id.replace(/\D/g, '');
      await q.query(`INSERT INTO outlets(id,name,brand,district,depot,dock_type,parking_constraint,mall_window,window_open,window_close,address) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [o.outlet_id, `Waypoint ${o.brand} ${o.district} #${n}`, o.brand, o.district, o.depot, o.dock_type, o.parking_constraint, o.mall_window || null, o.window_open_time, o.window_close_time, `${n} Main Street, ${o.district}`]);
    }
    const reeferTrucks = data.vehicles.filter((v) => v.depot === 'Peliyagoda' && v.temp === 'reefer' && v.type === 'truck');
    const workshop = new Set(reeferTrucks.slice(1, 3).map((v) => v.vehicle_id).concat(data.vehicles.filter((v) => v.depot === 'Peliyagoda' && v.temp === 'ambient' && v.type === 'truck').slice(0, 2).map((v) => v.vehicle_id)));
    for (const v of data.vehicles)
      await q.query(`INSERT INTO vehicles(id,plate,type,temp,weight_cap_kg,volume_cap_m3,fuel_type,km_per_l,weekly_fuel_quota_l,depot,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [v.vehicle_id, `WP-${String(num(v.vehicle_id.replace(/\D/g, '')) * 37 % 10000).padStart(4, '0')}`, v.type, v.temp, num(v.weight_cap_kg), num(v.volume_cap_m3), v.fuel_type || null, num(v.km_per_l), num(v.weekly_fuel_quota_l), v.depot, workshop.has(v.vehicle_id) ? 'in_workshop' : 'available']);
    for (const c of data.calendar)
      await q.query(`INSERT INTO calendar(date,dow,iso_year,iso_week,is_payday,festival,festival_ramp,is_holiday,monsoon,is_operating) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [c.date, num(c.dow), num(c.iso_year), num(c.iso_week), num(c.is_payday), c.festival || null, num(c.festival_ramp), num(c.is_holiday), num(c.monsoon), num(c.is_operating, 1)]);
    for (const d of data.district_travel)
      await q.query(`INSERT INTO district_travel VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [d.district, d.depot, d.road_class, num(d.free_flow_kmh), num(d.depot_to_district_km), num(d.depot_to_district_freeflow_min), num(d.inter_stop_km), num(d.inter_stop_freeflow_min)]);
    for (const s of data.service_allowance) await q.query(`INSERT INTO service_allowance VALUES($1,$2,$3)`, [s.brand, s.dock_type, num(s.service_allowance_min)]);
    for (const [id, name, sku, brand, temp, unit, w] of PRODUCTS) await q.query(`INSERT INTO products(id,name,sku,brand,temp,unit,weight_kg,volume_m3) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id, name, sku, brand, temp, unit, w, VOL[id]]);

    // ---- demo accounts
    const depotOutlets = data.outlets.filter((o) => o.depot === 'Peliyagoda');
    const freshOutlets = depotOutlets.filter((o) => o.brand === 'Fresh');
    const storeOutlet = freshOutlets.find((o) => o.parking_constraint === 'normal') ?? freshOutlets[0];
    const driverVehicle = reeferTrucks.find((v) => !workshop.has(v.vehicle_id)) ?? reeferTrucks[0];
    const users: [string, string, string, string | null, string | null, string | null][] = [
      ['dispatcher@waypoint.demo', 'dispatcher', 'Nimal Perera (Dispatcher)', null, null, 'Peliyagoda'],
      ['loader@waypoint.demo', 'loader', 'Kasun Fernando (Loader)', null, null, 'Peliyagoda'],
      ['driver@waypoint.demo', 'driver', 'Ruwan Silva (Driver)', null, driverVehicle.vehicle_id, 'Peliyagoda'],
      ['store@waypoint.demo', 'store', 'Dilani Jayasuriya (Store manager)', storeOutlet.outlet_id, null, 'Peliyagoda'],
    ];
    for (const [email, role, name, outlet, veh, depot] of users)
      await q.query(`INSERT INTO users(id,email,password_hash,role,name,outlet_id,vehicle_id,depot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [`usr_${role}`, email, hash, role, name, outlet, veh, depot]);

    // ---- demo delivery day where demand EXCEEDS capacity (DEMAND_FACTOR x what the available Peliyagoda fleet can carry)
    const date = process.env.DEMO_DATE ?? (await nextOperatingDate(q));
    const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const avail = data.vehicles.filter((v) => v.depot === 'Peliyagoda' && !workshop.has(v.vehicle_id));
    const targetFresh = avail.filter((v) => v.temp === 'reefer').reduce((a, v) => a + num(v.volume_cap_m3), 0) * 1.6 * num(process.env.DEMAND_FACTOR, 1.3);
    type Spec = { outletId: string; temp: 'chilled' | 'ambient'; items: { productId: string; qty: number }[] };
    const specs: Spec[] = [];
    const prods = (brand: string, temp: string) => PRODUCTS.filter((p) => p[3] === brand && p[4] === temp).map((p) => p[0]);
    const choose = (ids: string[], n: number, base: number) => [...ids].sort(() => rnd() - 0.5).slice(0, n).map((productId) => ({ productId, qty: Math.max(1, Math.round(base * (0.5 + rnd()))) }));
    for (const o of depotOutlets) {
      if (o.brand === 'Fresh') {
        specs.push({ outletId: o.outlet_id, temp: 'ambient', items: choose(prods('Fresh', 'ambient'), 3 + Math.floor(rnd() * 2), 4) });
        if (rnd() < 0.6) specs.push({ outletId: o.outlet_id, temp: 'chilled', items: choose(prods('Fresh', 'chilled'), 3, 5) });
      } else if (o.brand === 'Style' && rnd() < 0.6) specs.push({ outletId: o.outlet_id, temp: 'ambient', items: choose(prods('Style', 'ambient'), 2, 3) });
      else if (o.brand === 'Tech' && rnd() < 0.5) specs.push({ outletId: o.outlet_id, temp: 'ambient', items: choose(prods('Tech', 'ambient'), 1, 1) });
    }
    const vol = (s: Spec[]) => s.reduce((a, x) => a + x.items.reduce((b, i) => b + i.qty * VOL[i.productId], 0), 0);
    const fresh = specs.filter((s) => PRODUCTS.find((p) => p[0] === s.items[0].productId)![3] === 'Fresh');
    const scale = vol(fresh) ? targetFresh / vol(fresh) : 1;
    for (const s of fresh) for (const i of s.items) i.qty = Math.max(1, Math.round(i.qty * scale));
    const skipped = new Set(freshOutlets.filter(() => rnd() < 0.08).map((o) => o.outlet_id));
    for (const s of specs)
      await createOrder(q, { ...s, orderDate: date, deferredYesterday: skipped.has(s.outletId), daysSinceLastServed: skipped.has(s.outletId) ? 2 + Math.floor(rnd() * 3) : Math.floor(rnd() * 2) });
    console.log(`[seed] source=${source} date=${date} orders=${specs.length} freshDemand=${vol(fresh).toFixed(1)}m3 vs target≈${targetFresh.toFixed(1)}m3; store=${storeOutlet.outlet_id} driverVehicle=${driverVehicle.vehicle_id} workshop=${[...workshop].join(',')}`);
    void dtByDistrict;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { openDb, migrate } = await import('../db');
  const db = await openDb(process.env.DATABASE_URL ?? 'pglite://./.pgdata');
  await migrate(db);
  await seed(db);
  await db.close();
}
