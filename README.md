# Waypoint: delivery orchestration (Tech-Triathlon 2026)

Store orders → Dispatcher plans/defers/publishes → Loader loads and flags shorts → Driver delivers (offline-capable) → Store confirms receipt.

## Run
```bash
cp .env.example .env
docker compose up --build        # Postgres + API (+ web build if apps/web/dist exists) → http://localhost:4001
```
Without Docker: `cd apps/api && npm install && npm start` (embedded Postgres via PGlite, auto-seeds, http://localhost:4000).
Smoke test of the whole loop: `cd apps/api && npm run smoke`.

## Data
Drop the five competition CSVs (`outlets, vehicles, calendar, district_travel, service_allowance`) in `/data` and restart.
Until then the seed uses clearly-labelled synthetic stand-ins (`ALLOW_SAMPLE_DATA=0` makes missing CSVs a hard error).
The seed also creates a demo delivery day (next operating date) where Fresh demand ≈ 1.3× fleet capacity, workshop vehicles, and outlets skipped yesterday.

## Seeded accounts (password `SEED_PASSWORD`, default `ChangeMe123!`)
dispatcher@waypoint.demo · loader@waypoint.demo · driver@waypoint.demo · store@waypoint.demo

## Layout
`apps/api` API · `db/schema.sql` schema · `docs/` integration notes · `data/` CSVs · `docker-compose.yml`
Judge walkthrough, architecture diagram and AI disclosure: TODO at the end game (Person A).
