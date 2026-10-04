# Waypoint: delivery orchestration

Waypoint coordinates store orders, dispatcher planning, warehouse loading, driver deliveries, and store receipt confirmation.

## Setup and local configuration

Requirements: Docker Desktop (or Docker Engine) with the Docker Compose v2 plugin.

1. Copy `.env.example` to `.env`:

   ```powershell
   Copy-Item .env.example .env
   ```

   On macOS or Linux, use `cp .env.example .env`.
2. For local use, the example values work as-is. Before exposing the service beyond a local demo, set unique values for `POSTGRES_PASSWORD`, `JWT_SECRET`, and `SEED_PASSWORD` in `.env`.
3. From the repository root, build and start the complete stack:

   ```sh
   docker compose up --build
   ```

   Compose starts PostgreSQL and the API, which applies the schema and seeds the database on first startup. The API serves the built web app at <http://localhost:4001>; its health endpoint is <http://localhost:4001/api/health>. PostgreSQL is available on host port `5433`.
4. Stop the services with `docker compose down`. The database volume is retained; to remove it and start with a fresh seed, run `docker compose down -v`.

The checked-in CSVs are copied into the API image and used for the reference data. The seed creates four demo accounts and demo orders for the next operating date. If required CSVs are absent, `ALLOW_SAMPLE_DATA=1` uses clearly identified synthetic reference data; set it to `0` to make missing CSVs a startup error.

For API-only development without Docker, run `npm install` and `npm start` in `apps/api`. It uses embedded PGlite by default and listens on <http://localhost:4000>. Run `npm run smoke` in `apps/api` for the API smoke test.

## Seeded judge accounts

All four accounts use the password set by `SEED_PASSWORD` (default: `ChangeMe123!`):

| Role | Email |
| --- | --- |
| Dispatcher | `dispatcher@waypoint.demo` |
| Loader | `loader@waypoint.demo` |
| Driver | `driver@waypoint.demo` |
| Store manager | `store@waypoint.demo` |

## Numbered judge walkthrough

1. **Store orders:** Sign in as `store@waypoint.demo`, open **Place order**, submit an order, and review its status in the store order views.
2. **Dispatcher plans, defers, and publishes:** Sign in as `dispatcher@waypoint.demo`, open route planning for the seeded operating date, generate or adjust the plan, defer orders that cannot be served, and publish once every order is assigned or deferred and the trips satisfy the constraints. Confirm starvation warnings when prompted.
3. **Loader checks and reports shorts:** Sign in as `loader@waypoint.demo`, open the published trip, verify the reverse-stop loading sequence, record loaded quantities, and flag any short units before handing off the trip.
4. **Driver delivers offline and syncs:** Sign in as `driver@waypoint.demo`, open the assigned run, enable the offline simulation, record arrival and delivery (or a delivery issue), then reconnect and sync the queued operations.
5. **Store confirms receipt:** Sign back in as `store@waypoint.demo`, open receipts, review the delivery and any exceptions, and confirm receipt.

## Implementation notes and design departures

The Day 5 design materials are not included in this repository, so a direct design-to-implementation comparison cannot be verified here. The following implementation decisions should be checked against the team's Day 5 design before final submission:

- Docker Compose runs PostgreSQL and the API as one deployable service; the API serves the web build from the same origin. Local API-only development instead uses embedded PGlite by default.
- The seed uses the checked-in CSV reference data where available and creates deterministic demo orders, including demand/deferment cases, to support the judge walkthrough. Synthetic reference data is an explicit fallback controlled by `ALLOW_SAMPLE_DATA`.

See [docs/architecture.md](docs/architecture.md) for the system architecture, data model, and operating constraints, and [docs/ai-disclosure.md](docs/ai-disclosure.md) for the AI-use disclosure.
