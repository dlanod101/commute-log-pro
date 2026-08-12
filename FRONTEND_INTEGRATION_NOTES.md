# Dey Go — Backend Changes for Frontend Integration

> **For:** Frontend / mobile client teams
> **Backend version:** 0.2.0 (2026-08-12)
> **Purpose:** Every API/field/terminology change the frontend must adopt, with
> request/response examples and an action checklist. Existing endpoints and
> fields remain backward compatible unless explicitly marked.

---

## 1. TL;DR — What changed

| Area | Change |
|------|--------|
| **Fare** | Now **optional** everywhere. A trip may be uploaded/completed with or without a fare. Do **not** send a fake `0` to satisfy validation. |
| **Vehicle types** | New selectable paratransit vehicle types with passenger capacity (Small Bus 12, Medium Bus 20, Large Bus 30). |
| **Trip observations** | New persistent text observations tied to a **specific stop visit** (stop event). Multiple observations per stop allowed. |
| **Signal Stop** | User-facing terminology changed from **Dwell** → **Signal Stop**. |
| **Delay Time** | New, **independent** per-stop value. Never combine with Signal Stop. |
| **End Trip** | Backend now **rejects ending a trip while the vehicle is moving**. |
| **CSV export** | `travel` column removed from `stops.csv`; `vehicle_type`/`vehicle_capacity` now populated in `routes.csv`. |
| **Trip status** | Trips carry a lifecycle `status` (`ongoing` / `completed`). |

---

## 2. New endpoints

### 2.1 End a trip — `POST /api/v1/data/trip/end`
Completes a trip. **Backend enforces that the vehicle is stationary.** Do not rely
only on disabling the End Trip button in the UI.

**Request body:**
```json
{
  "tripId": "trip-abc123",
  "fare": 2.50,        // optional — a trip may end without a fare (omit or null)
  "speedMps": 0.0      // current speed m/s; if omitted, backend uses the last uploaded GPS speed
}
```

**Valid cases (HTTP 200):**
```json
{
  "tripId": "trip-abc123",
  "status": "completed",
  "fare": 2.50,
  "completedAt": "2026-08-12T10:00:00.000Z",
  "message": "Trip ended successfully."
}
```
- `fare` omitted + stationary → success, `fare` remains `null` (no default created).

**Invalid cases:**
- `400` vehicle moving → `{"detail": "Vehicle must be stationary before the trip can be ended."}`
- `400` movement state unknown (no speed sent and no GPS on record) → `{"detail": "Unable to determine vehicle movement state; provide the current vehicle speed."}`
- `404` trip not found → `{"detail": "No trip found for trip_id: <id>"}`

> **Frontend:** send the current speed from your GPS/telemetry on every End Trip
> call and handle the `400` message (e.g. toast "Vehicle must be stationary…").

---

### 2.2 Trip detail (clean Route) — `GET /api/v1/data/trips/{trip_id}`
Returns the Route representation **without any Travel-specific data**.

**Response 200:**
```json
{
  "tripId": "trip-abc123",
  "origin": "Main Street",
  "destination": "Market Square",
  "originDestination": "Main Street -> Market Square",
  "fare": 2.50,
  "status": "completed",
  "vehicleType": "medium_bus",
  "passengerCapacity": 20,
  "startedAt": "2026-05-07T13:29:32.888Z",
  "endedAt": "2026-05-07T13:29:32.888Z",
  "distanceMeters": 4500,
  "durationSeconds": 26.8,
  "regularStopCount": 4,
  "signalStopCount": 2,
  "signalStopTime": 8.0,
  "delayTime": 5.0,
  "totalBoarding": 12,
  "totalAlighting": 8
}
```
- `signalStopCount` / `signalStopTime` = the **Signal Stop** concept (was "dwell"/signalized).
- `delayTime` = independent **Delay Time** (new), summed from per-stop `delaySeconds`.

---

### 2.3 Create a stop observation — `POST /api/v1/data/observations`
Records a text observation at a stop **visit**.

**Request body:**
```json
{
  "tripId": "trip-abc123",
  "stopId": "stop-001",
  "stopEventId": 42,            // recommended: the specific stop visit's id
  "text": "Heavy passenger boarding",
  "timestamp": "2026-08-12T08:15:00Z"   // optional; defaults to now
}
```
- `stopEventId` is **recommended** — it ties the observation to one specific visit of the stop. Use the stop-event id your app already has.
- If you only have `stopId`, omit `stopEventId`; the backend resolves the **latest** visit of that stop on the trip.

**Response 201:**
```json
{
  "id": 7,
  "unit_id": "a1b2c3d4",
  "tripId": "trip-abc123",
  "stopId": "stop-001",
  "stopEventId": 42,
  "text": "Heavy passenger boarding",
  "timestamp": "2026-08-12T08:15:00Z",
  "user_id": 1
}
```
- **Multiple observations for the same stop are fully supported.** The same stop
  visited 3× can hold 3 separate observations (one per visit). There is **no**
  unique constraint on trip+stop.

**Error cases:** `422` if neither `stopId` nor `stopEventId` given; `404` if
`stopEventId` doesn't belong to the trip or no visit resolves.

> **Frontend:** capture and send `stopEventId` (the stop visit/event id) so
> repeated visits to the same stop keep their observations separate.

---

### 2.4 List trip observations — `GET /api/v1/data/trips/{trip_id}/observations`
Returns all observations for a trip, ordered by timestamp (ascending).
```json
[
  {
    "id": 7,
    "unit_id": "a1b2c3d4",
    "tripId": "trip-abc123",
    "stopId": "central-market",
    "stopEventId": 42,
    "text": "Heavy passenger boarding",
    "timestamp": "2026-08-12T08:15:00Z",
    "user_id": 1
  }
]
```

### 2.5 Delete an observation — `DELETE /api/v1/data/observations/{observation_id}`
`200` `{"message": "Observation deleted."}` · `404` if not found.

---

### 2.6 List vehicle types — `GET /api/v1/data/vehicle-types`
Selectable paratransit vehicle types with passenger capacity. **Use this to drive
your vehicle-type picker.**
```json
[
  {"id": 1, "code": "small_bus", "name": "Small Bus", "capacity": 12, "active": true},
  {"id": 2, "code": "medium_bus", "name": "Medium Bus", "capacity": 20, "active": true},
  {"id": 3, "code": "large_bus", "name": "Large Bus", "capacity": 30, "active": true}
]
```

### 2.7 Create a vehicle type (admin) — `POST /api/v1/data/vehicle-types`
Body: `{"code": "mini_van", "name": "Mini Van", "capacity": 8}` → `201`.

---

## 3. Changed endpoints (existing, still compatible)

### 3.1 Upload — `POST /api/v1/data/upload`
Fields now **optional**:
- `fare` — optional (omit or `null`; no default). Previously defaulted to `0`.
- `vehicleType` — optional. Use the `code` from `GET /data/vehicle-types`.
- `passengerCapacity` — optional; **auto-derived** from `vehicleType` if omitted. You may still send it to override.
- `status` — optional (`"ongoing"` / `"completed"`). If omitted, defaults to `"completed"` when `endedAt` is present (existing behaviour preserved).
- Per stop: `delaySeconds` — optional, new **Delay Time** value (independent of `dwellSeconds` / signal stop).

```json
[
  {
    "id": "trip-abc123",
    "origin": "Main Street",
    "destination": "Market Square",
    "fare": 2.50,
    "initialPassengers": 5,
    "startedAt": 1779803665202,
    "distanceMeters": 4500,
    "endedAt": 1779803691987,
    "endStopId": "stop-004",
    "uploaded": true,
    "vehicleType": "medium_bus",
    "gps": [ { "ts": 1779803669208, "lat": 4.981342, "lng": 8.333408, "accuracy": 150, "speed": 8.5 } ],
    "stops": [
      { "type": "regular", "dwellSeconds": 15, "delaySeconds": 3.0,
        "boarding": 3, "alighting": 1, "id": "stop-001",
        "ts": 1779803673554, "lat": 4.981342, "lng": 8.333408 }
    ]
  }
]
```

### 3.2 Trip list — `GET /api/v1/data/trips`
Each item now also includes (new keys, existing ones unchanged):
```json
{
  "tripId": "trip-abc123",
  "originDestination": "Main Street -> Market Square",
  "date": "2026-05-07T13:29:32.888Z",
  "vehicleType": "medium_bus",
  "passengerCapacity": 20,
  "status": "completed"
}
```

### 3.3 CSV export — `GET /api/v1/data/process/{trip_id}` (and `.../shapefile`)
- `stops.csv` — the **`travel` column is removed**.
- `routes.csv` — `vehicle_type` and `vehicle_capacity` are now **populated** from the trip (previously empty).

---

## 4. Terminology & data model notes

| Concept | Before | Now |
|---------|--------|-----|
| Signal Stop time (signalized stop dwell) | `dwell` / `signalDelay` | **Signal Stop** — exposed as `signalStopTime`, count `signalStopCount` |
| Delay Time | (none) | New independent per-stop `delaySeconds`; aggregated as `delayTime` |
| Fare on completion | effectively required | **Optional** (`null` allowed) |
| Trip lifecycle | (none) | `status`: `ongoing` / `completed`, plus `completedAt` |
| Vehicle | none | `vehicleType` (code) + `passengerCapacity` |

**Do NOT** combine Signal Stop and Delay Time into one metric/field — the backend
stores and returns them separately. Keep internal DB names (`signalDelay`,
`dwellSeconds`, `stopType` values `signalized`/`signal`) if you see them in raw
exports — they are unchanged for compatibility; the API exposes the correct
concept names above.

---

## 5. Frontend action checklist

- [ ] **Vehicle picker:** call `GET /api/v1/data/vehicle-types`; display `name` (+ capacity). Send the chosen `code` as `vehicleType` on upload.
- [ ] **End Trip:** call `POST /api/v1/data/trip/end` with `tripId`, current `speedMps` from GPS, and optional `fare`. Handle `400` (vehicle moving / unknown motion) with the returned message. Fare can be `null`/omitted.
- [ ] **Fare optional:** remove any hard requirement/fake-`0` fallback for fare on upload and completion.
- [ ] **Observations:** add text-observation capture at each stop visit; send `stopEventId` (the stop event/visit id) + `text` (+ optional `timestamp`). Support multiple observations per stop. Render via `GET /data/trips/{trip_id}/observations`.
- [ ] **Signal Stop label:** change UI labels from "Dwell" to "Signal Stop".
- [ ] **Delay Time:** add a separate per-stop Delay Time input and send it as `delaySeconds` — keep it independent of signal stop/dwell.
- [ ] **Trip detail/list:** consume new fields `vehicleType`, `passengerCapacity`, `status`, `signalStopCount`, `signalStopTime`, `delayTime` from `GET /data/trips/{trip_id}` and `GET /data/trips`.
- [ ] **CSV consumers:** note `travel` column removed from `stops.csv`; `vehicle_type`/`vehicle_capacity` now populated in `routes.csv`.

---

## 6. Backward-compatibility guarantees

- All pre-existing endpoints, request shapes, and response keys still work.
- Old uploads sending `fare: 0` still validate (stored as `0`).
- Internal column names for dwell/signal data are unchanged; only API-level
  terminology/output was updated.
- No destructive database migration was performed — existing trips, routes,
  stops, and vehicles are intact.
