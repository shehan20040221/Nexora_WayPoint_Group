# Allocation engine (Person B)

`packages/engine` is pure TypeScript with no I/O. `apps/api/src/planning.ts` wraps it in the endpoints from CONTRACT 3.4.

## Rules enforced (`evalVehicle`)
| Rule id | Source | Reason code on deferral |
|---|---|---|
| BRAND_DISTRICT | one brand and one district per trip | OTHER |
| HOME_DEPOT | vehicle serves only its depot's outlets | OTHER |
| REFRIGERATION | chilled needs a reefer | NO_REEFER_CAPACITY |
| VAN_ACCESS | `van_only` outlet needs a van | NO_VAN |
| CAPACITY_WEIGHT / CAPACITY_VOLUME | per trip | VOLUME_WEIGHT_LIMIT |
| TIME_BUDGET | Fresh trips ≤ 270 min; Style+Tech trips ≤ 480 min (separate budgets) | TIME_BUDGET |
| TRIP_COUNT | ≤ 2 trips per vehicle | (impossible by construction) |
| FUEL_QUOTA | trip km (2 × depot-to-district + inter-stop × (n-1)) ÷ km/l vs weekly quota remaining | FUEL_QUOTA |
| MALL_WINDOW | arrival after the mall window closes (early arrival waits) | MALL_WINDOW |
| WINDOW | arrival after window close; Fresh also after 08:00 | TIME_BUDGET |
| VEHICLE_STATUS | `in_workshop` vehicles carry nothing | VEHICLE_IN_WORKSHOP |

Trip time = `depot_to_district_freeflow_min + inter_stop_freeflow_min × (n-1) + Σ service_allowance_min(brand, dock_type)`.
Unit tests reproduce the booklet's worked examples (Gampaha trip = 101 min, Colombo trip = 112 min, vehicle total 213 of 270).

Arrival times assume Fresh trips leave at 03:30 (second trip leaves after the first plus its return leg) and Style/Tech at 08:00 (`Config`). ETAs shown to stores are clamped to the window open time. Waiting is not added to trip minutes, matching the booklet formula.

## Priority policy (`sortByPriority`)
1. **Starved outlets first**: skipped yesterday, or unserved for more than 2 days, longest wait first. This is the "no outlet skipped twice" guarantee.
2. **Perishables**: chilled Fresh.
3. Fresh ambient (stores open at 8), then Tech (high value), then Style.
4. Earliest window close, then larger orders first (hardest to place later).

Placement is greedy: join the fullest compatible existing trip (best fit), otherwise open a trip on the largest eligible vehicle. Pass 1 keeps reefers for chilled orders and vans for `van_only` outlets; pass 2 relaxes both for whatever is left. Anything still unplaced is deferred with a reason from `diagnose()` and a human-readable note.

`metrics.bindingResource` is the most frequent deferral reason, labelled for the dispatcher.

## Endpoints (`planning.ts`)
`GET /plan`, `POST /plan/suggest | assign | unassign | defer | publish`, all dispatcher-only, all per-date serialised.
- `assign` re-validates the whole vehicle; violations are returned and nothing is applied.
- `defer` returns **409** `{needsConfirm, starvation, message}` for starved outlets until `confirmStarvation:true`.
- `publish` refuses (409) while orders are neither assigned nor deferred, or any trip has violations. Version bumps on every publish. Editing a published plan returns it to `draft`.

## Store interface (for Person A)
Implement `PlanningStore` from `planning.ts` on Postgres:
- `loadContext(date)` → orders (`confirmed` / `deferred`) with outlet, vehicle (incl. `status`, `fuelUsedL`), district, allowance data.
- `getRecord` / `saveRecord` → one row per date: `planId, status, version, state JSONB` (`state` = `{placements, deferrals}`).
- `recordDeferral` → insert decision row + store notification.
- `onPublish` → create load lines in reverse stop order, the driver run, set order statuses, bump loader trip versions.

## AI disclosure (Person B)
AI-assisted: drafting engine, tests and endpoints in TypeScript. Not AI-assisted: choice of priority policy and rule interpretation (reviewed against the Challenge Booklet). Every behaviour is covered by tests that run offline.
