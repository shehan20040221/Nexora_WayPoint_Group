// SYNTHETIC STAND-IN data, used ONLY when ./data/*.csv are missing (so the stack runs before the real CSVs are dropped in).
// Same columns as the competition files. Not the competition data.
type Row = Record<string, string>;
const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pad = (n: number, w = 3) => String(n).padStart(w, '0');

export function sampleDataset(): Record<string, Row[]> {
  const R = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const districts = [
    ['Colombo', 'Peliyagoda', 'urban', 22, 12, 6], ['Gampaha', 'Peliyagoda', 'suburban', 37, 27, 9], ['Negombo', 'Peliyagoda', 'highway', 48, 38, 11],
    ['Kalutara', 'Peliyagoda', 'highway', 62, 46, 12], ['Kelaniya', 'Peliyagoda', 'urban', 14, 8, 5], ['Moratuwa', 'Peliyagoda', 'urban', 30, 20, 7],
    ['Kandy', 'Kandy', 'hill', 20, 9, 7], ['Matale', 'Kandy', 'hill', 45, 28, 10], ['Peradeniya', 'Kandy', 'hill', 28, 12, 8],
    ['Kegalle', 'Kandy', 'hill', 52, 34, 11], ['Nuwara Eliya', 'Kandy', 'hill', 75, 42, 14], ['Gampola', 'Kandy', 'hill', 40, 22, 9],
  ] as const;
  const district_travel = districts.map(([d, dep, rc, min, km, inter]) => ({ district: d, depot: dep, road_class: rc, free_flow_kmh: String(Math.round((km / min) * 60)), depot_to_district_km: String(km), depot_to_district_freeflow_min: String(min), inter_stop_km: String(Math.round(inter / 2)), inter_stop_freeflow_min: String(inter) }));
  const service_allowance = [['Fresh', 'rear_dock', 15], ['Fresh', 'street', 16], ['Fresh', 'mall_bay', 18], ['Style', 'rear_dock', 20], ['Style', 'street', 24], ['Style', 'mall_bay', 28], ['Tech', 'rear_dock', 25], ['Tech', 'street', 30], ['Tech', 'mall_bay', 32]]
    .map(([brand, dock_type, m]) => ({ brand: String(brand), dock_type: String(dock_type), service_allowance_min: String(m) }));
  const outlets: Row[] = [];
  const brands = [...Array(80).fill('Fresh'), ...Array(25).fill('Style'), ...Array(15).fill('Tech')];
  brands.forEach((brand, i) => {
    const d = districts[Math.floor(R() * districts.length)];
    const mall = brand === 'Style' && R() < 0.5;
    const vanOnly = brand === 'Fresh' && R() < 0.1;
    outlets.push({
      outlet_id: `OUT${pad(i + 1)}`, brand, district: d[0], depot: d[1],
      dock_type: mall ? 'mall_bay' : pick(['rear_dock', 'rear_dock', 'street']),
      parking_constraint: vanOnly ? 'van_only' : mall ? 'mall_dock' : 'normal',
      mall_window: mall ? '09:00-11:30' : '',
      window_open_time: brand === 'Fresh' ? '04:00' : mall ? '09:00' : '09:00', window_close_time: brand === 'Fresh' ? pick(['07:30', '08:00', '08:00']) : mall ? '11:30' : '17:00',
    });
  });
  const vehicles: Row[] = [];
  for (let i = 1; i <= 60; i++) {
    const reeferTruck = i <= 12, dryTruck = i > 12 && i <= 52, van = i > 52, reeferVan = i > 52 && i <= 56;
    const depot = i % 3 === 0 ? 'Kandy' : 'Peliyagoda';
    vehicles.push({ vehicle_id: `VEH${pad(i)}`, type: van ? 'van' : 'truck', temp: reeferTruck || reeferVan ? 'reefer' : 'ambient',
      weight_cap_kg: String(van ? 900 : reeferTruck ? 5000 : 7000), volume_cap_m3: String(van ? 8 : reeferTruck ? 22 : 30),
      fuel_type: 'diesel', km_per_l: String(van ? 11 : 6), weekly_fuel_quota_l: String(van ? 140 : 320), depot });
    void dryTruck;
  }
  const calendar: Row[] = [];
  const start = new Date(Date.now() - 60 * 86400000);
  for (let i = 0; i < 140; i++) {
    const d = new Date(start.getTime() + i * 86400000), iso = d.toISOString().slice(0, 10), dow = (d.getUTCDay() + 6) % 7;
    const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)), week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getUTCDay() + 1) / 7);
    calendar.push({ date: iso, dow: String(dow), dow_name: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dow], is_weekend: dow >= 5 ? '1' : '0', iso_year: String(d.getUTCFullYear()), iso_week: String(week),
      is_payday: d.getUTCDate() === 25 ? '1' : '0', festival: '', festival_ramp: '0', is_holiday: '0', monsoon: '0', is_operating: dow === 6 ? '0' : '1' });
  }
  return { outlets, vehicles, calendar, district_travel, service_allowance };
}
