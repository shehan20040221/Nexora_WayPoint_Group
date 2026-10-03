// Allocation rules from the challenge booklet. Pure functions, no I/O.
export type Brand = 'Fresh' | 'Style' | 'Tech';
export interface Vehicle { id: string; type: 'truck' | 'van'; temp: 'reefer' | 'ambient'; weightCap: number; volumeCap: number; depot: string }
export interface Order { ref: string; outletId: string; brand: Brand; district: string; depot: string; temp: 'chilled' | 'ambient'; weight: number; volume: number; dock: string; parking: 'normal' | 'van_only' | 'mall_dock' }
export interface District { outboundMin: number; interStopMin: number }
export interface Trip { vehicleId: string; tripNo: 1 | 2; orders: Order[] }
export interface Violation { rule: string; trip?: string; message: string }
export type Districts = Record<string, District>;
export type Allowance = Record<string, number>; // key: `${brand}|${dock}`

export const BUDGET = { Fresh: 270, StyleTech: 480 } as const;

/** trip minutes = outbound + inter-stop x (n-1) + handling. Return leg excluded. */
export function tripMinutes(t: Trip, d: Districts, a: Allowance): number {
  if (!t.orders.length) return 0;
  const dist = d[t.orders[0].district];
  const handling = t.orders.reduce((s, o) => s + (a[`${o.brand}|${o.dock}`] ?? 0), 0);
  return dist.outboundMin + dist.interStopMin * (t.orders.length - 1) + handling;
}

export function validate(trips: Trip[], vehicles: Vehicle[], d: Districts, a: Allowance): Violation[] {
  const v: Violation[] = []; const veh = new Map(vehicles.map(x => [x.id, x]));
  const seen = new Set<string>(); const perVehicle = new Map<string, Trip[]>();
  for (const t of trips) {
    const id = `${t.vehicleId}/T${t.tripNo}`; const ve = veh.get(t.vehicleId);
    const bad = (rule: string, message: string) => v.push({ rule, trip: id, message });
    if (!ve) { bad('VEHICLE', `Unknown vehicle ${t.vehicleId}`); continue; }
    perVehicle.set(t.vehicleId, [...(perVehicle.get(t.vehicleId) ?? []), t]);
    if (new Set(t.orders.map(o => `${o.brand}|${o.district}`)).size > 1) bad('BRAND_DISTRICT', 'A trip must serve one brand and one district');
    let w = 0, vol = 0;
    for (const o of t.orders) {
      if (seen.has(o.ref)) bad('WHOLE_ORDER', `${o.ref} is assigned more than once`); seen.add(o.ref);
      if (o.temp === 'chilled' && ve.temp !== 'reefer') bad('REFRIGERATION', `${o.ref} is chilled but ${ve.id} is not refrigerated`);
      if (o.parking === 'van_only' && ve.type !== 'van') bad('VAN_ACCESS', `${o.ref} is van-only but ${ve.id} is a truck`);
      if (o.depot !== ve.depot) bad('HOME_DEPOT', `${o.ref} belongs to ${o.depot}, ${ve.id} to ${ve.depot}`);
      w += o.weight; vol += o.volume;
    }
    if (w > ve.weightCap) bad('CAPACITY_WEIGHT', `${w} kg exceeds ${ve.weightCap} kg`);
    if (vol > ve.volumeCap) bad('CAPACITY_VOLUME', `${vol.toFixed(2)} m3 exceeds ${ve.volumeCap} m3`);
  }
  for (const [vid, ts] of perVehicle) {
    if (ts.length > 2) v.push({ rule: 'MAX_TRIPS', message: `${vid} has ${ts.length} trips (max 2)` });
    const fresh = ts.filter(t => t.orders[0]?.brand === 'Fresh').reduce((s, t) => s + tripMinutes(t, d, a), 0);
    const st = ts.filter(t => t.orders[0]?.brand !== 'Fresh').reduce((s, t) => s + tripMinutes(t, d, a), 0);
    if (fresh > BUDGET.Fresh) v.push({ rule: 'TIME_BUDGET', message: `${vid} Fresh trips use ${fresh} of ${BUDGET.Fresh} min` });
    if (st > BUDGET.StyleTech) v.push({ rule: 'TIME_BUDGET', message: `${vid} Style/Tech trips use ${st} of ${BUDGET.StyleTech} min` });
  }
  return v;
}
