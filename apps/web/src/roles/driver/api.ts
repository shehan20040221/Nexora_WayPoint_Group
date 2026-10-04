import { apiFetch, configureOffline, getConfig, SyncOp, SyncResult } from '../../offline';
import fixture from './fixtures/run.json';
import type { Run } from './types';

// ---------- fixtures mode: a tiny stand-in for POST /sync and GET /driver/run ----------
const mock: Run = JSON.parse(JSON.stringify(fixture));
const seen = new Set<string>();

function markNext() {
  let found = false;
  for (const s of mock.stops) {
    if (s.status === 'arrived' || s.status === 'delivered' || s.status === 'unable') continue;
    s.status = found ? 'upcoming' : 'next';
    found = true;
  }
}

function fixtureSync(ops: SyncOp[]): SyncResult {
  const r: SyncResult = { applied: [], duplicates: [], conflicts: [] };
  for (const op of ops) {
    if (seen.has(op.opId)) {
      r.duplicates.push(op.opId);
      continue;
    }
    const stop = mock.stops.find((s) => s.id === op.stopId);
    if (!stop) {
      r.conflicts.push({ opId: op.opId, message: 'That stop is no longer on your route.' });
      continue;
    }
    if (op.type === 'deliver' && stop.status === 'delivered') {
      r.conflicts.push({ opId: op.opId, message: `${stop.outletName} was already marked delivered.` });
      continue;
    }
    stop.status = op.type === 'arrive' ? 'arrived' : op.type === 'deliver' ? 'delivered' : 'unable';
    seen.add(op.opId);
    r.applied.push(op.opId);
  }
  markNext();
  return r;
}
configureOffline({ fixtureSync });

export async function getRun(): Promise<Run> {
  if (getConfig().useFixtures) return JSON.parse(JSON.stringify(mock));
  return apiFetch<Run>('/driver/run');
}
