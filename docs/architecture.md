# Waypoint Delivery Orchestration — Architecture & Data Model

## 1. System Architecture

The Waypoint Delivery Orchestration system is structured as a full-stack, domain-driven operational platform serving four interconnected roles: Store Manager, Dispatcher, Warehouse Loader, and Delivery Driver.
+-----------------------------------------------------------------------------------+
|                                  USER CLIENTS                                     |
|                                                                                   |
|  +--------------------+  +----------------------+  +---------------------------+  |
|  | Store Manager (Web)|  | Dispatcher Hub (Web) |  | Loader Dock (Tablet / Web)|  |
|  +---------+----------+  +----------+-----------+  +-------------+-------------+  |
|            |                        |                            |                |
|            |                        |              +-------------+-------------+  |
|            |                        |              | Driver (Mobile Web / PWA) |  |
|            |                        |              | - IndexedDB Offline Queue |  |
|            |                        |              | - Signature & Proof Pad   |  |
|            |                        |              +-------------+-------------+  |
+------------+------------------------+----------------------------+----------------+
|                        |                            |
|  HTTPS / REST JSON API | (Bearer JWT Auth)          | POST /sync
+------------------------+----------------------------+
|
+-------------------------------------v---------------------------------------------+
|                               EXPRESS REST API                                    |
|                                                                                   |
|  +------------------+  +----------------------+  +-----------------------------+  |
|  |   Auth Service   |  |   Orders & Store     |  |   Loader & Reverse Loading  |  |
|  |  (bcrypt + JWT)  |  |   - Ambient/Chilled  |  |   - Short Unit Flagging     |  |
|  +------------------+  +----------------------+  +-----------------------------+  |
|  +--------------------------------------------+  +-----------------------------+  |
|  |       Planning & Allocation Engine         |  |   Driver Sync & Offline     |  |
|  |   - Priority Queuing & Starvation Logic    |  |   - Idempotent Op Reconcile |  |
|  |   - Multi-compartment Reefer / Van Limits  |  |   - Conflict Resolution     |  |
|  +--------------------------------------------+  +-----------------------------+  |
+-------------------------------------+---------------------------------------------+
|
| Connection Pooling (pg)
+-------------------------------------v---------------------------------------------+
|                         POSTGRESQL RELATIONAL DATABASE                            |
|                                                                                   |
|  - Outlets (120 stores, delivery windows, dock types, parking constraints)        |
|  - Vehicles (60 fleet units: Reefer/Ambient, Truck/Van, Fuel quotas)             |
|  - Orders & Order Lines (Ambient / Chilled split, Status tracking)                |
|  - Daily Plans & Trips (Stop sequences, time budgets, capacity validation)        |
|  - Load Lines & Loading Verification (Reverse stop order sequence)                |
|  - Exceptions & Delivery Confirmations (Signatures, short units, timestamps)      |
+-----------------------------------------------------------------------------------+


---

## 2. Core Operational Constraints & Engine Rules

The allocation and planning engine enforces the constraints defined in the Waypoint operating model:

1. **Capacity Limits**: Total volume ($m^3$) and weight ($kg$) per trip cannot exceed vehicle capacities.
2. **Temperature Integrity**:
   - Chilled goods require refrigerated (`reefer`) vehicles.
   - Refrigerated vehicles may carry ambient cargo, but ambient vehicles cannot carry chilled items.
3. **Physical Outlet Access**: Outlets designated as `van_only` strictly reject heavy trucks and require van units.
4. **Time Budgets**:
   - **Fresh trips**: Must complete within morning operating window before 8:00 AM (270 minutes max).
   - **Style / Tech trips**: Trading day window (480 minutes max).
   - Maximum 2 trips per vehicle per operational day.
5. **Starvation Protection**:
   - Orders deferred yesterday receive top scheduling priority.
   - Any order deferred for consecutive runs or $>2$ days requires explicit starvation override verification (`HTTP 409 Conflict`).

---

## 3. Relational Data Model (Schema ERD)

+--------------------+           +----------------------+
|      outlets       |           |       vehicles       |
+--------------------+           +----------------------+
| id (PK)            |<----+     | id (PK)              |<----+
| name               |     |     | type (truck/van)     |     |
| brand              |     |     | temp (reefer/ambient)|     |
| district           |     |     | weight_cap_kg        |     |
| depot              |     |     | volume_cap_m3        |     |
| dock_type          |     |     | weekly_fuel_quota_l  |     |
| parking_constraint |     |     | depot                |     |
| window_open        |     |     +----------------------+     |
| window_close       |     |                 |                |
+--------------------+     |                 | 1..*           |
|                 |                |
+--------------------+     |     +-----------v----------+     |
|       orders       |     |     |        trips         |     |
+--------------------+     |     +----------------------+     |
| id (PK)            |     |     | id (PK)              |     |
| ref                |     |     | vehicle_id (FK)      |-----+
| outlet_id (FK)     |-----+     | trip_no (1 or 2)     |
| brand              |           | brand                |
| temp               |           | district             |
| units              |           | minutes              |
| weight_kg          |           | budget_minutes       |
| volume_m3          |           | status               |
| status             |           +----------------------+
| trip_id (FK)       |----+                  |
| seq                |    |                  | 1..*
+--------------------+    |                  |
|      +-----------v----------+
+----->|      load_lines      |
+----------------------+
| id (PK)              |
| trip_id (FK)         |
| order_id (FK)        |
| stop_seq (Reverse)   |
| sku / item           |
| planned_qty          |
| loaded_qty           |
| status (loaded/short)|
+----------------------+


---

## 4. Offline Synchronization Architecture (Driver App)

For remote areas with unreliable network coverage:
- The Driver UI persists operations (`arrive`, `deliver`, `exception`) locally in browser **IndexedDB** with client-generated UUIDs (`opId`).
- An idempotent synchronization queue sends batches via `POST /sync`.
- The backend evaluates `opId` deduplication: duplicate messages are safely ignored, and conflicting state transitions report explicit resolutions without blocking subsequent stops.
