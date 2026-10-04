export type TripStatus = 'ready' | 'loading' | 'held' | 'released';
export type LineStatus = 'pending' | 'loaded' | 'short';
export type Temp = 'chilled' | 'ambient';

export interface LoaderTrip {
  id: string;
  vehicleId: string;
  plate: string;
  departurePlanned: string;
  version: number;
  status: TripStatus;
  units: number;
  fillPct: number;
  stops: number;
  driver?: string; // assumed optional extras on GET /loader/trips/:id; confirm with Person A
  door?: string;
}
export interface LoadLine {
  id: string;
  stopSeq: number;
  outletName: string;
  item: string;
  sku: string;
  qty: number;
  unit: string;
  zone: string;
  temp: Temp;
  status: LineStatus;
}
export interface TripChange {
  label: string;
  was: string;
  now: string;
}
export interface TripDetail {
  trip: LoaderTrip;
  planVersion: number;
  currentVersion: number;
  stale: boolean;
  changes: TripChange[];
  lines: LoadLine[];
}
