# Person A: integration notes for B, C, D

## For B (planning.ts)
`apps/api/src/index.ts` loads `./planning` if it exists and expects:

```ts
export function planningRouter(deps: {
  db: Db;                                  // from ./db: db.query(sql, params), db.tx(async q => ...)
  requireAuth: (...roles: Role[]) => RequestHandler;   // use requireAuth('dispatcher')
  publishPlan: (planId: string) => Promise<{ version: number }>;
}): Router   // mount paths relative to /api: /plan, /plan/suggest, /plan/assign, ...
```
Tables you own/write (see `db/schema.sql`): `plans`, `trips` (only the first 6 columns: id, plan_id, vehicle_id, trip_no, brand, district),
`plan_decisions`, and these columns on `orders`: `trip_id, vehicle_id, seq, status` (`planned`), `deferral_reason, deferral_note`.
Rules:
- Always change order status via `setOrderStatus(q, orderId, status)` and send deferral notices via `notify(q, outletId, 'deferral', title, body)` (both in `src/shared.ts`).
- `POST /plan/publish` = `await deps.publishPlan(planId)`; it computes minutes, departure, ETAs, load lines, driver route and bumps the version. Republishing is safe and marks in-progress loader trips stale.
- Unassign/defer must clear `orders.trip_id/vehicle_id/seq/eta_planned`. `publishPlan` removes empty draft trips.
- Fresh trips start 03:30, Style/Tech 08:00, 30 min reload between a vehicle's trips (only affects ETAs).

## For C and D
- Fixture shapes = Section 3 of the build guide, unchanged. Extra fields in my responses are additive only.
- Error shape: `{ error: string, ...extra }`; 401 bad/expired token, 403 wrong role, 409 business-rule conflict
  (e.g. loader release with pending lines: `{pending}`; stale plan: `{stale:true}`).
- `/sync` returns per-op `applied | duplicates | conflicts`; offline queue should drop applied+duplicates and surface conflicts.
- Signature/photo are required on `deliver` ops (conflict message otherwise).
- Store `GET /orders/:id` returns `timeline` + `lines` + `etaPlanned`.
- Dev without Docker: `cd apps/api && npm i && npm start` (embedded Postgres in `.pgdata`, auto-seeds, API on :4000).
