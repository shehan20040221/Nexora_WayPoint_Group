/**
 * Person B â€” planning endpoints (CONTRACT 3.4 "Dispatcher: planning").
 *   GET  /plan?date=        POST /plan/suggest     POST /plan/assign
 *   POST /plan/unassign     POST /plan/defer       POST /plan/publish
 *
 * Storage-agnostic: everything goes through PlanningStore. Person A implements it on Postgres
 * (see docs/allocation-engine.md, "Store interface"); InMemoryPlanningStore is the dev/test fixture.
 * Mount with:  app.use('/api', createPlanningRouter({ store, requireDispatcher }))
 */
import { Router, Request, Response, NextFunction, json } from 'express';
import {
  allocate, assignOrder, deferOrder, evaluatePlan, unassignOrder, emptyState,
  Context, Deferral, Order, Plan, PlanState, ReasonCode,
} from './engine';

export interface PlanRecord { planId: string; date: string; status: 'draft' | 'published'; version: number; state: PlanState }
export interface PlanResponse extends Plan { planId: string; status: 'draft' | 'published'; version: number }

export interface PlanningStore {
  /** Orders (status confirmed/deferred) + reference data for the dispatcher's depot on that date. */
  loadContext(date: string): Promise<Context>;
  getRecord(date: string): Promise<PlanRecord | null>;
  saveRecord(rec: PlanRecord): Promise<void>;
  /** Persist the decision and notify the store manager (contract: "Writes a decision and a store notification"). */
  recordDeferral(a: { date: string; order: Order; deferral: Deferral; actor: string; starvationOverride: boolean }): Promise<void>;
  /** Called on publish: create load lines + driver run, set order statuses, bump loader trip versions. */
  onPublish(a: { date: string; plan: Plan; version: number; state: PlanState }): Promise<void>;
}

const REASONS: ReasonCode[] = ['NO_REEFER_CAPACITY', 'VOLUME_WEIGHT_LIMIT', 'TIME_BUDGET', 'FUEL_QUOTA', 'MALL_WINDOW', 'NO_VAN', 'VEHICLE_IN_WORKSHOP', 'OTHER'];

export class PlanningService {
  private locks = new Map<string, Promise<unknown>>();
  constructor(private store: PlanningStore) {}

  /** serialise read-modify-write per date so two clicks cannot interleave */
  private async exclusive<T>(date: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(date) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    this.locks.set(date, run.catch(() => undefined));
    return run;
  }
  private async load(date: string) {
    const [ctx, rec] = await Promise.all([this.store.loadContext(date), this.store.getRecord(date)]);
    const record: PlanRecord = rec ?? { planId: `plan-${date}`, date, status: 'draft', version: 0, state: emptyState() };
    return { ctx, record };
  }
  private view(ctx: Context, r: PlanRecord): PlanResponse {
    return { ...evaluatePlan(ctx, r.state), planId: r.planId, status: r.status, version: r.version };
  }
  /** an edit after publish makes the plan a draft again; version only moves on publish */
  private async commit(ctx: Context, r: PlanRecord, state: PlanState) {
    const next: PlanRecord = { ...r, state, status: 'draft' };
    await this.store.saveRecord(next);
    return this.view(ctx, next);
  }

  get = (date: string) => this.exclusive(date, async () => { const { ctx, record } = await this.load(date); return this.view(ctx, record); });

  suggest = (date: string) => this.exclusive(date, async () => {
    const { ctx, record } = await this.load(date);
    return this.commit(ctx, record, allocate(ctx).state);
  });

  assign = (date: string, b: { orderId: string; vehicleId: string; tripNo: 1 | 2 }) => this.exclusive(date, async () => {
    const { ctx, record } = await this.load(date);
    const r = assignOrder(ctx, record.state, b.orderId, b.vehicleId, Number(b.tripNo) as 1 | 2);
    if (!r.ok) return { ok: false, violations: r.violations, plan: this.view(ctx, record) };
    return { ok: true, violations: [], plan: await this.commit(ctx, record, r.state) };
  });

  unassign = (date: string, orderId: string) => this.exclusive(date, async () => {
    const { ctx, record } = await this.load(date);
    return this.commit(ctx, record, unassignOrder(record.state, orderId));
  });

  defer = (date: string, actor: string, b: { orderId: string; reasonCode: ReasonCode; note?: string; option?: string; confirmStarvation?: boolean }) =>
    this.exclusive(date, async () => {
      const { ctx, record } = await this.load(date);
      const order = ctx.orders.find(o => o.id === b.orderId);
      if (!order) throw new HttpError(404, `Order ${b.orderId} not found`);
      if (!REASONS.includes(b.reasonCode)) throw new HttpError(400, `reasonCode must be one of ${REASONS.join(', ')}`);
      const deferral: Deferral = { reasonCode: b.reasonCode, note: b.note, option: b.option };
      const r = deferOrder(ctx, record.state, b.orderId, deferral, !!b.confirmStarvation);
      if (r.needsConfirm) throw new HttpError(409, r.message!, { needsConfirm: true, starvation: true, message: r.message });
      if (!r.ok) throw new HttpError(400, r.message ?? 'Cannot defer');
      await this.store.recordDeferral({ date, order, deferral, actor, starvationOverride: !!b.confirmStarvation });
      return this.commit(ctx, record, r.state);
    });

  publish = (date: string) => this.exclusive(date, async () => {
    const { ctx, record } = await this.load(date);
    const plan = this.view(ctx, record);
    if (plan.unassigned.length) throw new HttpError(409, `${plan.unassigned.length} orders are neither assigned nor deferred`, { unassigned: plan.unassigned.map(o => o.id) });
    const bad = plan.vehicles.flatMap(v => v.trips).filter(t => t.violations.length);
    if (bad.length) throw new HttpError(409, `${bad.length} trips break operating rules`, { trips: bad.map(t => ({ id: t.id, violations: t.violations })) });
    const version = record.version + 1;
    await this.store.saveRecord({ ...record, status: 'published', version });
    await this.store.onPublish({ date, plan, version, state: record.state });
    return { version };
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public body?: object) { super(message); }
}

export interface RouterDeps {
  store: PlanningStore;
  /** auth middleware that rejects non-dispatchers (A's JWT middleware + role check) */
  requireDispatcher: (req: Request, res: Response, next: NextFunction) => void;
  actorOf?: (req: Request) => string;
  today?: () => string;
}

export function createPlanningRouter(deps: RouterDeps): Router {
  const svc = new PlanningService(deps.store);
  const r = Router();
  const today = deps.today ?? (() => new Date().toISOString().slice(0, 10));
  const actorOf = deps.actorOf ?? ((req: any) => req.user?.email ?? 'dispatcher');
  const dateOf = (req: Request) => {
    const d = String((req.query.date as string) ?? req.body?.date ?? today());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new HttpError(400, 'date must be YYYY-MM-DD');
    return d;
  };
  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).then(out => out !== undefined && res.json(out)).catch(next);

  r.use(json({ limit: '1mb' }));
  r.use('/plan', deps.requireDispatcher);
  r.get('/plan', wrap(async req => svc.get(dateOf(req))));
  r.post('/plan/suggest', wrap(async req => svc.suggest(dateOf(req))));
  r.post('/plan/assign', wrap(async req => {
    const { orderId, vehicleId, tripNo } = req.body ?? {};
    if (!orderId || !vehicleId || !tripNo) throw new HttpError(400, 'orderId, vehicleId and tripNo are required');
    return svc.assign(dateOf(req), { orderId, vehicleId, tripNo });
  }));
  r.post('/plan/unassign', wrap(async req => {
    if (!req.body?.orderId) throw new HttpError(400, 'orderId is required');
    return svc.unassign(dateOf(req), req.body.orderId);
  }));
  r.post('/plan/defer', wrap(async req => {
    if (!req.body?.orderId || !req.body?.reasonCode) throw new HttpError(400, 'orderId and reasonCode are required');
    return svc.defer(dateOf(req), actorOf(req), req.body);
  }));
  r.post('/plan/publish', wrap(async req => svc.publish(dateOf(req))));

  r.use('/plan', (err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.body ?? {}) });
    console.error('[planning]', err);
    res.status(500).json({ error: 'Planning failed' });
  });
  return r;
}

// ---------------- dev / test store ----------------
export class InMemoryPlanningStore implements PlanningStore {
  records = new Map<string, PlanRecord>();
  decisions: { date: string; orderId: string; deferral: Deferral; actor: string; starvationOverride: boolean }[] = [];
  notifications: { orderId: string; outletId: string; title: string; body: string }[] = [];
  published: { date: string; version: number }[] = [];
  constructor(private ctx: Context) {}
  async loadContext() { return structuredClone(this.ctx); }
  async getRecord(date: string) { return this.records.get(date) ?? null; }
  async saveRecord(rec: PlanRecord) { this.records.set(rec.date, structuredClone(rec)); }
  async recordDeferral(a: { date: string; order: Order; deferral: Deferral; actor: string; starvationOverride: boolean }) {
    this.decisions.push({ date: a.date, orderId: a.order.id, deferral: a.deferral, actor: a.actor, starvationOverride: a.starvationOverride });
    this.notifications.push({ orderId: a.order.id, outletId: a.order.outletId, title: `Order ${a.order.ref} deferred`, body: a.deferral.note ?? a.deferral.reasonCode });
  }
  async onPublish(a: { date: string; version: number }) { this.published.push({ date: a.date, version: a.version }); }
}


// Unified compatibility export for Person A index.ts
export function planningRouter(deps: any): Router {
  let store = deps?.store;
  if (!store && typeof InMemoryPlanningStore !== 'undefined') {
    // InMemoryPlanningStore expects a Context
    const emptyCtx: Context = { orders: [], vehicles: [] };
    store = new InMemoryPlanningStore(emptyCtx);
  }
  const routerDeps: any = {
    store,
    requireDispatcher: deps?.requireAuth || ((_req: any, _res: any, next: any) => next()),
    publishPlan: deps?.publishPlan,
  };
  return createPlanningRouter(routerDeps);
}

export default planningRouter;
