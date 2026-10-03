# Waypoint Delivery Orchestration (Hackathon build)

## Run
    cp .env.example .env && docker compose up      # Postgres + API on :4000; check http://localhost:4000/api/health
    npm install && npm run typecheck && npm test                        # engine rules + booklet examples

## Seeded accounts (password = SEED_PASSWORD)
dispatcher@, loader@, driver@, store@ `waypoint.demo` (pick the matching role at login)

## Status
Done: engine rules 1-8 + trip time, role login, validate endpoint.
Next (see Continuation Guide, Section 9): Postgres + Prisma + seed CSVs, allocate(), UI, offline sync.

## Departures from Designathon design
(log here)
