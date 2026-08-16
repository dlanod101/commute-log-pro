# API Analyses — Commute Log Pro ("Dey Go")

> **Scope:** Every outbound API call in the project, the endpoint hit, and the exact data sent.
> **Method:** All network I/O flows through a single module, `src/lib/api.ts` (`API_BASE`). UI components call the wrapper functions; there are no other `fetch`/`axios`/`WebSocket`/`sendBeacon` calls anywhere in `src/`.

## Base URL

```
https://data-collection-backend-chi.vercel.app
```

Defined as `API_BASE` in `src/lib/api.ts` (line 4). All endpoints are relative to this.

## Auth model

- On successful `login`, the returned `access_token` is stored in `localStorage` under key `transit_auth_token_v1` (`saveToken`/`loadToken` in `src/lib/api.ts`).
- Every authenticated call sends it as an `Authorization: Bearer <token>` header.
- Local (non-network) storage also uses `transit_trips_v1` (saved trips) and `transit_active_trip_v1` (in-progress trip) in `src/lib/storage.ts`.

---

## Endpoint inventory

| # | Method | Endpoint | Function | Wired? | Caller(s) |
|---|--------|----------|----------|--------|-----------|
| 1 | POST | `/api/v1/auth/register` | `register()` | ✅ | `AuthPanel.tsx` (sign-up form) |
| 2 | POST | `/api/v1/auth/login` | `login()` | ✅ | `AuthPanel.tsx` (sign-in form) |
| 3 | GET | `/api/v1/auth/me` | `getMe()` | ✅ | `AuthPanel.tsx`, `routes/app.tsx` (mount) |
| 4 | GET | `/api/v1/data/trips` | `fetchRemoteTrips()` | ✅ | `MyDataSheet.tsx` (open/refresh) |
| 5 | GET | `/api/v1/data/vehicle-types` | `fetchVehicleTypes()` | ✅ | `routes/app.tsx` (mount, when online) |
| 6 | POST | `/api/v1/data/trip/end` | `endTrip()` | ⚠️ Defined, **not currently called** | — |
| 7 | GET | `/api/v1/data/process/{tripId}` | `downloadTripProcessZip()` | ✅ | `MyDataSheet.tsx` ("CSV ZIP") |
| 8 | GET | `/api/v1/data/process/{tripId}/shapefile` | `downloadTripShapefileZip()` | ✅ | `MyDataSheet.tsx` ("Shapefile") |
| 9 | POST | `/api/v1/data/upload` | `uploadTrips()` | ✅ | `routes/app.tsx` ("Upload to web") |

---

## 1. Register — `POST /api/v1/data/auth/register`

- **Function:** `register()` — `src/lib/api.ts` (line 58)
- **Called from:** `src/components/AuthPanel.tsx` → `handleRegister` (line 61), i.e. the "Create account" form submit.
- **Headers:** `Content-Type: application/json` (no auth token).
- **Body (JSON):**
  ```json
  {
    "email": "you@example.com",   // trimmed form email
    "name": "Your Name",          // trimmed form name, or null if left empty
    "password": "secret"          // raw password from the form
  }
  ```
- **Data origin:** raw user input from the register form state (`regEmail`, `regName`, `regPassword`).
- **Response:** `User` — `{ email?, name?, id, unit_id }` (used implicitly; after this the app immediately calls `login` + `getMe`).

---

## 2. Login — `POST /api/v1/auth/login`

- **Function:** `login()` — `src/lib/api.ts` (line 72)
- **Called from:** `src/components/AuthPanel.tsx` → `goToApp` (line 25), invoked by both `handleLogin` (line 28) and after register (`handleRegister`, line 61).
- **Headers:** `Content-Type: application/x-www-form-urlencoded`.
- **Body (URL-encoded form — OAuth2 password-style):**
  ```
  username=<email>&password=<password>
  ```
  - `username` = the trimmed email.
  - `password` = the raw password.
- **Data origin:** raw user input from the sign-in form (`loginEmail`, `loginPassword`).
- **Response:** `Token` — `{ access_token, token_type }`. The token is stored via `saveToken()` and reused for all authenticated calls.
- **Note:** the plaintext password leaves the device over HTTPS to this endpoint.

---

## 3. Get current user — `GET /api/v1/auth/me`

- **Function:** `getMe()` — `src/lib/api.ts` (line 86)
- **Called from:**
  - `src/components/AuthPanel.tsx` → `goToApp` (line 28) — validates token right after login.
  - `src/routes/app.tsx` (line 104) — on `/app` mount, to load the profile banner ("Signed in as … · Unit …").
- **Headers:** `Authorization: Bearer <token>` (token from `localStorage.transit_auth_token_v1`).
- **Body:** none (no data sent).
- **Response:** `User` — `{ email?, name?, id, unit_id }`.
- **Sensitive data transmitted:** the bearer token (identity credential).

---

## 4. List remote trips — `GET /api/v1/data/trips`

- **Function:** `fetchRemoteTrips()` — `src/lib/api.ts` (line 110)
- **Called from:** `src/components/MyDataSheet.tsx` → `loadTrips` (line 64), runs when the "My data" sheet opens and on "Refresh".
- **Headers:** `Authorization: Bearer <token>`.
- **Body / query:** none (no data sent; `tripId` data is only *received*).
- **Response:** `{ trips: RemoteTrip[] }` where `RemoteTrip = { tripId, originDestination, date }`.

---

## 5. List vehicle types — `GET /api/v1/data/vehicle-types`

- **Function:** `fetchVehicleTypes()` — `src/lib/api.ts` (line 119)
- **Called from:** `src/routes/app.tsx` (line 163) — `useEffect` on mount whenever the app is online; populates the vehicle picker in the "New trip" form.
- **Headers:** `Authorization: Bearer <token>`.
- **Body / query:** none.
- **Response:** `VehicleType[]` — `{ id, code, name, capacity, active? }` (the client stringifies `id`/`code`). These values later flow into uploads as `vehicleType` / `passengerCapacity`.

---

## 6. End trip — `POST /api/v1/data/trip/end`

- **Function:** `endTrip()` — `src/lib/api.ts` (line 140)
- **Status:** ⚠️ **Defined but NOT currently wired.** No component imports or calls it. The `endTrip` defined in `src/routes/app.tsx` (line 220) is a *local-only* function that saves the completed trip to phone storage and never touches the network. This API wrapper appears to be ready for future use (per `FRONTEND_INTEGRATION_NOTES.md` §2.1).
- **Headers (when invoked):** `Content-Type: application/json`, `Authorization: Bearer <token>`.
- **Body (JSON):**
  ```json
  {
    "tripId": "abc12345",
    "speedMps": 0.0,          // current vehicle speed in m/s (always sent)
    "fare": 2.5                // optional — only included if caller passes fare (undefined ⇒ omitted)
  }
  ```
- **Data that would be sent:** trip ID + current GPS speed + optional fare.

---

## 7. Download processed trip ZIP (CSVs) — `GET /api/v1/data/process/{tripId}`

- **Function:** `downloadTripProcessZip()` — `src/lib/api.ts` (line 195), via shared helper `downloadTripAttachment()` (line 164).
- **Called from:** `src/components/MyDataSheet.tsx` → `download(tripId, "csv")` (line 94) — "CSV ZIP" button per remote trip.
- **URL:** `GET /api/v1/data/process/<encodeURIComponent(tripId)>`
- **Headers:** `Authorization: Bearer <token>`.
- **Data sent:** the `tripId` in the URL path (plus bearer token). No request body.
- **Response:** binary ZIP blob; filename taken from `Content-Disposition` (fallback `trip_<id>.zip`), triggered as a browser download.

---

## 8. Download trip shapefile ZIP — `GET /api/v1/data/process/{tripId}/shapefile`

- **Function:** `downloadTripShapefileZip()` — `src/lib/api.ts` (line 204), same helper.
- **Called from:** `src/components/MyDataSheet.tsx` → `download(tripId, "shapefile")` (line 97) — "Shapefile" button per remote trip.
- **URL:** `GET /api/v1/data/process/<encodeURIComponent(tripId)>/shapefile`
- **Headers:** `Authorization: Bearer <token>`.
- **Data sent:** the `tripId` in the URL path (plus bearer token). No request body.
- **Response:** binary ZIP blob; filename from `Content-Disposition` (fallback `trip_<id>_shapefile.zip`). 404 if the trip has no GPS points on the server.

---

## 9. Upload trips — `POST /api/v1/data/upload`

- **Function:** `uploadTrips()` — `src/lib/api.ts` (line 212)
- **Called from:** `src/routes/app.tsx` → `uploadAll` (line 273) — triggered by the "Upload to web" button in the History tab and mobile menu. Uploads only trips where `trip.uploaded !== true`.
- **Headers:** `Authorization: Bearer <token>`. No explicit `Content-Type` (browser sets `multipart/form-data` boundary).
- **Body (multipart/form-data):**
  - Field `file`: a `Blob` (`type: application/json`) containing a **JSON array of trip payloads**, filename `trips.json`.
- **Payload construction** (`prepareTripsForUpload` / `prepareTripForUpload` in `src/lib/tripGps.ts`):
  - Pre-processing before upload:
    1. `backfillTripStops` fills any stop missing `lat`/`lng` from the nearest GPS point by timestamp.
    2. Stops that still lack coordinates are **dropped** (counted in `skippedStops`).
    3. GPS points are normalized so each has `record_type: "gps_point"`.
    4. The local `uploaded` flag and full `vehicle` object are stripped; flattened as `vehicleType` (code) + `passengerCapacity`.
    5. `status` = `"completed"` if the trip has `endedAt`, else `"ongoing"`.
  - **Per-trip JSON payload shape:**
    ```json
    {
      "id": "abc12345",                       // client-generated id
      "origin": "Central Station",            // ≤ 80 chars
      "destination": "Airport",               // ≤ 80 chars
      "fare": 2.5,                            // number | null (optional; null if never set)
      "initialPassengers": 5,
      "startedAt": 1779803665202,             // epoch ms
      "endedAt": 1779803691987,               // epoch ms, only if completed
      "endStopId": "stop-004",                // only if completed
      "distanceMeters": 4500,
      "status": "completed",                  // "ongoing" | "completed"
      "vehicleType": "medium_bus",            // vehicle.code, optional
      "passengerCapacity": 20,                // vehicle.capacity, optional
      "gps": [
        {
          "record_type": "gps_point",
          "ts": 1779803669208,                // epoch ms
          "lat": 4.981342,
          "lng": 8.333408,
          "accuracy": 150,                    // optional
          "speed": 8.5                        // optional, m/s | null
        }
      ],
      "stops": [
        {
          "id": "stop-001",
          "ts": 1779803673554,
          "lat": 4.981342,
          "lng": 8.333408,
          "type": "signalized",               // "regular" | "signalized"
          "signalDelay": "short",             // optional: "none" | "short" | "long"
          "boarding": 3,
          "alighting": 1,
          "dwellSeconds": 15,                 // optional (Signal Stop time)
          "delaySeconds": 3.0,                // optional (Delay Time)
          "intersectionName": "Main St",      // optional
          "notes": "Heavy boarding"           // optional, ≤ 500 chars (observation text)
        }
      ]
    }
    ```
- **Data origin:** everything in the payload was captured locally — trip metadata from `NewTripForm`, GPS points sampled every 3s via `navigator.geolocation.watchPosition` (`use-gps.ts`) + `appendGpsPoint`, and stop data (boarding/alighting/dwell/delay/notes) from `StopDialog`.
- **Response:** the server body is *not* read; the function returns locally-computed `{ repaired, skippedStops, filled }` used only for UI messaging.

---

## Non-API outbound traffic (for completeness)

| Activity | Mechanism | Data sent |
|----------|-----------|-----------|
| PWA service worker | `navigator.serviceWorker.register("/sw.js", { scope: "/" })` (`src/hooks/use-pwa.ts`), plus periodic `reg.update()` | GET to own origin only |
| Service-worker fetch handler | `public/sw.js` `fetch` event | Only same-origin `GET` requests (app static assets) are network-fetched/cached. Cross-origin API calls and all non-GET requests are passed straight through untouched. No data is forwarded anywhere. |
| GPS collection | `navigator.geolocation.watchPosition(...)` (`src/hooks/use-gps.ts`) | Location fixes stay in memory/localStorage — they are only transmitted to the backend as part of a trip upload (endpoint #9). |

---

## Summary of sensitive data leaving the device

1. **Credentials:** email + plaintext password → `/api/v1/auth/login` and `/api/v1/auth/register`.
2. **Bearer token** (identity credential) → every authenticated endpoint (`/me`, `/data/trips`, `/data/vehicle-types`, `/data/upload`, `/data/process/…`).
3. **Trip data** (GPS tracks = precise location history, stop coordinates, passenger counts, fares, dwell/delay times, free-text observations) → `/api/v1/data/upload`.
4. **Trip id + GPS speed + optional fare** → `/api/v1/data/trip/end` (wrapper present, not yet invoked).
5. **Trip id** (in URL) + token → download endpoints `/api/v1/data/process/…`.
