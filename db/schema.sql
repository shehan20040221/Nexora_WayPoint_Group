-- Waypoint schema. Idempotent: safe to run on every start.
-- Dates are TEXT 'YYYY-MM-DD', clock times TEXT 'HH:MM' (Asia/Colombo). Numbers are float8 / int.

CREATE TABLE IF NOT EXISTS outlets (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL, district TEXT NOT NULL, depot TEXT NOT NULL,
  dock_type TEXT NOT NULL, parking_constraint TEXT NOT NULL, mall_window TEXT,
  window_open TEXT NOT NULL, window_close TEXT NOT NULL, address TEXT
);
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY, plate TEXT NOT NULL, type TEXT NOT NULL, temp TEXT NOT NULL,
  weight_cap_kg float8 NOT NULL, volume_cap_m3 float8 NOT NULL,
  fuel_type TEXT, km_per_l float8, weekly_fuel_quota_l float8,
  depot TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available'  -- available | in_workshop
);
CREATE TABLE IF NOT EXISTS calendar (
  date TEXT PRIMARY KEY, dow INT, iso_year INT, iso_week INT, is_payday INT, festival TEXT,
  festival_ramp float8, is_holiday INT, monsoon INT, is_operating INT
);
CREATE TABLE IF NOT EXISTS district_travel (
  district TEXT PRIMARY KEY, depot TEXT, road_class TEXT, free_flow_kmh float8,
  depot_to_district_km float8, depot_to_district_freeflow_min float8, inter_stop_km float8, inter_stop_freeflow_min float8
);
CREATE TABLE IF NOT EXISTS service_allowance (
  brand TEXT NOT NULL, dock_type TEXT NOT NULL, minutes float8 NOT NULL, PRIMARY KEY (brand, dock_type)
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL, brand TEXT NOT NULL DEFAULT 'Fresh',
  temp TEXT NOT NULL, unit TEXT NOT NULL, weight_kg float8 NOT NULL, volume_m3 float8 NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL,
  name TEXT NOT NULL, outlet_id TEXT, vehicle_id TEXT, depot TEXT
);

CREATE SEQUENCE IF NOT EXISTS order_ref_seq START 2048;
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, ref TEXT UNIQUE NOT NULL, outlet_id TEXT NOT NULL REFERENCES outlets(id),
  temp TEXT NOT NULL, units INT NOT NULL, weight_kg float8 NOT NULL, volume_m3 float8 NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed', order_date TEXT NOT NULL,
  window_open TEXT NOT NULL, window_close TEXT NOT NULL,
  deferred_yesterday BOOLEAN NOT NULL DEFAULT FALSE, days_since_last_served INT NOT NULL DEFAULT 0,
  trip_id TEXT, vehicle_id TEXT, seq INT, eta_planned TEXT,
  deferral_reason TEXT, deferral_note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_outlet_idx ON orders(outlet_id);
CREATE INDEX IF NOT EXISTS orders_trip_idx ON orders(trip_id);
CREATE TABLE IF NOT EXISTS order_lines (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id), qty INT NOT NULL, weight_kg float8 NOT NULL, volume_m3 float8 NOT NULL
);
CREATE TABLE IF NOT EXISTS order_events (
  id SERIAL PRIMARY KEY, order_id TEXT NOT NULL, status TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Planning tables: written by Person B (planning.ts), read by A's publish/loader/driver code.
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY, date TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'draft', version INT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  vehicle_id TEXT NOT NULL, trip_no INT NOT NULL, brand TEXT NOT NULL, district TEXT NOT NULL,
  -- A-owned columns (set by publish / loader):
  status TEXT NOT NULL DEFAULT 'draft',          -- draft | ready | loading | held | released
  minutes INT, departure_planned TEXT,
  plan_version INT NOT NULL DEFAULT 0, acked_version INT NOT NULL DEFAULT 0,
  snapshot JSONB, acked_snapshot JSONB,
  UNIQUE (plan_id, vehicle_id, trip_no)
);
CREATE TABLE IF NOT EXISTS plan_decisions (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL, reason_code TEXT NOT NULL, note TEXT, option TEXT,
  starvation_confirmed BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS load_lines (
  id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL, stop_seq INT NOT NULL, outlet_name TEXT NOT NULL,
  item TEXT NOT NULL, sku TEXT NOT NULL, qty INT NOT NULL, unit TEXT NOT NULL, zone TEXT NOT NULL, temp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', found_qty INT, short_reason TEXT
);
CREATE TABLE IF NOT EXISTS exceptions (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, severity TEXT NOT NULL, trip_id TEXT, order_ref TEXT,
  line_id TEXT, detail TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
  resolved_action TEXT, note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY, trip_id TEXT UNIQUE NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  vehicle_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled' -- scheduled | active | complete
);
CREATE TABLE IF NOT EXISTS stops (
  id TEXT PRIMARY KEY, route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  seq INT NOT NULL, order_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'upcoming', eta TEXT, instructions TEXT,
  arrived_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ,
  delivered_qty INT, recipient TEXT, signature TEXT, photo TEXT, note TEXT, UNIQUE (route_id, order_id)
);
CREATE TABLE IF NOT EXISTS sync_ops (
  op_id TEXT PRIMARY KEY, stop_id TEXT, type TEXT, device_time TEXT, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL, confirmed_qty INT NOT NULL, status TEXT NOT NULL, note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, outlet_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
