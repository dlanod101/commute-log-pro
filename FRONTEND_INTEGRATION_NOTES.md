# Dey Go — Backend Changes for Frontend Integration (v0.3.0)

> **For:** Frontend / mobile client teams
> **Backend version:** 0.3.0 (2026-09-03)
> **Companion to:** [`FRONTEND_INTEGRATION_NOTES.md`](./FRONTEND_INTEGRATION_NOTES.md) (v0.2.0, 2026-08-12).
> This file covers **only the v0.3.0 changes** on top of v0.2.0:
> **Route type** (now operator-typed free text) and the **updated CSV export
> columns** (`routes.csv` / `stops.csv`, including two renamed headers). Existing
> endpoints and fields remain backward compatible unless explicitly marked.
>
> **Note:** route type became free text after the initial v0.3.0 release, and two
> export headers were renamed (`dwell` → `dwell_time`, `time` → `travel_time`).

---

## 1. TL;DR — What changed in v0.3.0

| Area | Change |
|------|--------|
| **Route type** | Route type is now **free text** typed by the operator (e.g. `Fixed-Route`, `Charter Service`). No preset options. |
| **Route-types API** | `GET /api/v1/data/route-types` is **no longer used** by the client; `POST` remains available but is optional/unused. |
| **Upload** | Trips may send an optional `routeType` **string** — the trimmed text typed on the **start page**. Blank → empty. |
| **`routes.csv`** | New columns: `route_type`, `travel_time`, `distance`, `no_of_stops`, `fare`. |
| **`stops.csv`** | `dwell_time` is reliably populated (falls back to the signal time) and a new **`is_signal_stop`** column shows `True`/`False`. |
| **Export paths** | Identical new column layout on BOTH the collector download and the admin download. |

---

## 2. Route-types endpoints (no longer used by the client)

Route type is now plain free text typed by the operator — there are **no preset
options**, so the client no longer fetches or displays a picker.

### 2.1 `GET /api/v1/data/route-types`
Retained for backward compatibility only. **Do not call this to build a
dropdown** — the client stores and sends the operator's raw text instead.

### 2.2 `POST /api/v1/data/route-types`
Still available (`{"code": "charter", "name": "Charter"}` → `201`) but optional
and unused by this flow.

---

## 3. Changed endpoint — Upload (`POST /api/v1/data/upload`)

New **optional** top-level field `routeType`: the **raw text typed by the
operator**, trimmed of leading/trailing whitespace. Send `null`/omit the field
when blank. Any string is accepted — the backend stores exactly what you send
(no validation against a list, no slug/code conversion).

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
    "routeType": "Charter Service",
    "gps": [ { "ts": 1779803669208, "lat": 4.981342, "lng": 8.333408, "accuracy": 150, "speed": 8.5 } ],
    "stops": [
      { "type": "regular", "dwellSeconds": 15, "delaySeconds": 3.0,
        "boarding": 3, "alighting": 1, "id": "stop-001",
        "ts": 1779803673554, "lat": 4.981342, "lng": 8.333408 }
    ]
  }
]
```

> **Note:** `routeType` is separate from `vehicleType` (the paratransit vehicle,
> e.g. `small_bus`). It is free text — display back the exact string that was
> uploaded, with no lookup or code mapping.

---

## 4. CSV export — updated columns

The new column layout applies to **both**:
- Collector download: `GET /api/v1/data/process/{trip_id}`
- Admin download: `GET /api/v1/admin/trips/{trip_id}/download`

(An existing legacy difference is untouched: the collector export uses the
placeholder `unit_id`/`route_id`, while the admin export writes real values. The
column set is identical.)

### 4.1 `routes.csv`

| Column | Source | Notes |
|--------|--------|-------|
| `unit_id` / `route_id` / `route_name` / `route_description` / `field_notes` | existing | unchanged |
| `vehicle_type` / `vehicle_capacity` | existing | unchanged (v0.2.0 populated them) |
| `start_capture` / `end_capture` | existing | unchanged |
| **`route_type`** 🆕 | `routeType` | the operator's free text as uploaded; empty when not provided |
| **`travel_time`** 🆕 | `tripDurationSeconds` | trip duration, seconds (numeric). **Renamed from `time`.** |
| **`distance`** 🆕 | `tripDistanceKm` | trip distance, km (numeric) |
| **`no_of_stops`** 🆕 | `regularStopCount + signalizedStopCount` | total stops (integer) |
| **`fare`** 🆕 | `fare` | fare amount; empty when the trip had none |

Example header + row:

```csv
"unit_id","route_id","route_name","route_description","field_notes","vehicle_type","vehicle_capacity","start_capture","end_capture","route_type","travel_time","distance","no_of_stops","fare"
"a1b2c3d4","trip-abc123","Main Street -> Market Square","","5","medium_bus","20","2026:05:07:13:29:32","2026:05:07:13:29:52","Charter Service","26.785","4.5","3","25.0"
```

### 4.2 `stops.csv`

| Column | Source | Notes |
|--------|--------|-------|
| `unit_id` / `route_id` / `stop_id` / `stop_sequence` / `lat` / `lon` | existing | unchanged |
| **`dwell_time`** ⚠️ | `dwellSeconds` | Dwell time, now reliably populated; for **signalized** stops it falls back to `signalDelay` (the signal stop time) when `dwellSeconds` is absent. **Renamed from `dwell`.** |
| `arrival_time` / `departure_time` / `board` / `alight` / `notes` | existing | unchanged |
| **`is_signal_stop`** 🆕 | `stopType` ∈ {`signal`, `signalized`} | `True` / `False` |

Example header + row:

```csv
"unit_id","route_id","stop_id","stop_sequence","lat","lon","dwell_time","arrival_time","departure_time","board","alight","notes","is_signal_stop"
"a1b2c3d4","trip-abc123","stop-002","2","4.981442","8.333508","7.0","2026:05:07:13:29:38","2026:05:07:13:29:38","1","0","","True"
```

---

## 5. Data model & terminology notes

- **Route type** lives on the trip summary as `routeType` — the free-text string
  the operator typed. Display it verbatim; there is no lookup table or code
  mapping in the client.
- **`is_signal_stop`** is derived server-side from the stop's `stopType`
  (`signal` / `signalized` → `True`, `regular` → `False`). No new client input is
  required — keep sending `type: "regular"` / `"signal"` on each stop.
- **Dwell** semantics are unchanged conceptually (time spent at the stop). The
  export now guarantees the column is present and filled, using the signal stop
  time as the fallback value for signalized stops.

---

## 6. Frontend action checklist (v0.3.0)

- [x] **Route-type input (start page):** plain optional text field; no fetch.
- [x] **Upload payload:** send the **trimmed** typed string as `routeType`
      (omit/`null` when blank) alongside `vehicleType`.
- [x] **CSV consumers:** the app downloads/parses no CSVs, so the renames are a
      no-op; any future parser must use `travel_time` (routes) and `dwell_time`
      (stops).

---

## 7. Backward-compatibility guarantees

- `routeType` is **optional** on upload — existing client versions keep working.
- Two v0.3.0 columns were **renamed** (`dwell` → `dwell_time`, `time` →
  `travel_time`); every other column and the column order are unchanged.
- No database reset is required on the client side; the backend auto-migrates
  (Alembic revision `0006` + a guarded startup column add).
- Internal field names (`dwellSeconds`, `signalDelay`, `stopType`) are unchanged.
