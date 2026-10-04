import { apiFetch, ApiError, getConfig } from '../../offline';
import fxTrips from './fixtures/trips.json';
import fxDetail from './fixtures/trip-detail.json';
import fxStale from './fixtures/stale-changes.json';
import type { LoaderTrip, TripDetail, LoadLine } from './types';

// ---------- in-memory mock server (fixtures mode only) ----------
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const mock = {
  trips: clone(fxTrips) as LoaderTrip[],
  detail: clone(fxDetail) as unknown as TripDetail,
  exceptionOpen: false,
};
const sortLines = (l: LoadLine[]) => l.sort((a, b) => b.stopSeq - a.stopSeq);
const syncSummary = () => {
  const t = mock.trips.find((x) => x.id === mock.detail.trip.id);
  if (t) Object.assign(t, mock.detail.trip);
};

function mockGet(id: string): TripDetail {
  const d = clone(mock.detail);
  if (id !== d.trip.id) {
    const t = mock.trips.find((x) => x.id === id) ?? mock.trips[1];
    d.trip = { ...t, driver: 'Driver on duty', door: 'Door 02' };
    d.lines = d.lines.map((l) => ({ ...l, status: 'pending' as const }));
    d.stale = false;
  }
  d.stale = d.planVersion < d.currentVersion;
  return d;
}

/** Demo helpers: stand in for what the dispatcher does in another browser. */
export function mockDispatcherRepublish() {
  mock.detail.currentVersion = 13;
  mock.detail.changes = fxStale.changes;
}
export function mockDispatcherResolve() {
  mock.exceptionOpen = false;
  if (mock.detail.trip.status === 'held') mock.detail.trip.status = 'loading';
  syncSummary();
}

// ---------- API ----------
const fx = () => getConfig().useFixtures;
const wait = () => new Promise((r) => setTimeout(r, 120));

export async function listTrips(): Promise<LoaderTrip[]> {
  if (fx()) return wait().then(() => clone(mock.trips));
  return apiFetch('/loader/trips');
}

export async function getTrip(id: string): Promise<TripDetail> {
  if (fx()) return wait().then(() => mockGet(id));
  return apiFetch(`/loader/trips/${id}`);
}

export async function confirmLine(lineId: string): Promise<void> {
  if (!fx()) return void (await apiFetch(`/loader/lines/${lineId}/confirm`, { method: 'POST' }));
  const l = mock.detail.lines.find((x) => x.id === lineId);
  if (l) l.status = 'loaded';
  mock.detail.trip.status = mock.exceptionOpen ? 'held' : 'loading';
  syncSummary();
}

export async function shortLine(lineId: string, body: { foundQty: number; reason: string }) {
  if (!fx()) return apiFetch<{ ok: true; exceptionId: string }>(`/loader/lines/${lineId}/short`, { method: 'POST', body: JSON.stringify(body) });
  const l = mock.detail.lines.find((x) => x.id === lineId);
  if (l) l.status = 'short';
  mock.exceptionOpen = true;
  mock.detail.trip.status = 'held';
  syncSummary();
  return { ok: true as const, exceptionId: 'EXC-DEMO' };
}

export async function resync(tripId: string): Promise<void> {
  if (!fx()) return void (await apiFetch(`/loader/trips/${tripId}/resync`, { method: 'POST' }));
  // v13 applies: Ja-Ela moves to stop 1, Kiribathgoda to stop 3, dairy 4->6, case 12->11.
  const d = mock.detail;
  d.planVersion = d.currentVersion;
  d.trip.version = d.currentVersion;
  for (const l of d.lines) {
    if (l.outletName.endsWith('Ja-Ela')) l.stopSeq = 1;
    if (l.outletName.endsWith('Kiribathgoda')) l.stopSeq = 3;
    if (l.id === 'L1') l.qty = 6;
    if (l.id === 'L4') l.qty = 11;
  }
  sortLines(d.lines);
  d.changes = [];
}

export async function releaseTrip(tripId: string): Promise<void> {
  if (!fx()) return void (await apiFetch(`/loader/trips/${tripId}/release`, { method: 'POST' }));
  const d = mock.detail;
  if (d.lines.some((l) => l.status === 'pending') || mock.exceptionOpen)
    throw new ApiError(409, { message: 'Lines are still pending or an exception is open.' });
  d.trip.status = 'released';
  syncSummary();
}
