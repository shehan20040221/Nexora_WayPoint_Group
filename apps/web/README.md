# apps/web (Person C: foundation, login, store)

React 18 + Vite + TypeScript + Tailwind. Design tokens: Poppins, cream `#FDFBF0`, navy `#0B3457`, orange `#FF8D56`.

```
npm install
npm run dev        # http://localhost:5173, proxies /api to VITE_API_PROXY (default :4001)
npm run build      # typecheck + production build
```

`.env`: `VITE_USE_FIXTURES=true` runs everything in the browser with no API (default for now).
Set it to `false` once Person A's API is on `main`. That is the only switch.
Demo password for all accounts: `ChangeMe123!` (`<role>@waypoint.demo`).

## How B and D plug in
* **Routes.** Replace your placeholder `src/roles/<role>/index.tsx`; export a default component that renders `<Routes>` (paths are *relative* to `/dispatcher`, `/loader`, `/driver`). Nav links live in `src/layouts/navConfig.ts`.
* **Fixtures.** Put `src/roles/<role>/fixtures.ts` next to your screens and call `registerFixture('GET /plan', ctx => ...)`. It is auto-loaded in fixtures mode (`import.meta.glob`). Pattern syntax: `"POST /plan/assign"`, `"GET /loader/trips/:id"`.
* **API.** `import { api } from '@/api/client'`; `api.get<T>('/plan')`, `api.post('/plan/defer', body)`. Errors are `ApiError` with `.status` and `.data` (so your 409 `needsConfirm` flow reads `e.data`).
* **Auth.** `useAuth()` gives `{ user, logout }` (`user.outletId`, `user.vehicleId`). Role guards and layouts are already applied in `App.tsx`.
* **UI kit.** `import { Card, Button, KpiTile, Chip, StatusChip, Stepper, Timeline, Table, Banner, Modal, Field, useToast } from '@/ui'`.
* **Connectivity.** `useOnline()` and `setSimulatedOffline(bool)` in `src/lib/useOnline.ts`. D's "Simulate offline" toggle should call `setSimulatedOffline`, and every banner (including the top bar chip) reacts. `src/lib/postQueue.ts` is the store's localStorage retry queue; D's IndexedDB queue goes in `src/offline/`.
* **Hooks.** `useAsync(fn, deps, pollMs?)` returns `{ data, error, loading, reload }`.

## Store screens (`src/roles/store`)
Overview, Place order, Track deliveries, Receipts list, Confirm receipt (`/store/receipts/:id`), Issues.
Store writes (`POST /orders`, `POST /receipts`) are saved on the device and replayed automatically when the connection returns.

## Contract notes for the group
1. Receipts have no signature/photo field in the contract, so the store's confirm screen omits the design's proof-of-delivery pad (the driver captures POD).
2. Products have no price in the contract, so Place order shows cases, weight and volume instead of LKR totals.
3. Cutoff is 16:00 (brief, and `dashboard.cutoff`); the design mock showed 12:00.
4. `GET /orders?mine=1` should include `deferralNote` and `deferralReason` for deferred orders (used on Overview/Track).
