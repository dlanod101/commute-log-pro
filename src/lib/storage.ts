import type { Trip } from "./types";

const KEY = "transit_trips_v1";
const ACTIVE = "transit_active_trip_v1";

/**
 * Route type used to be persisted as a lookup object (`{ id, code, name, active }`)
 * before it became a free-text string. Coerce any legacy object back to its
 * display string on load, otherwise rendering it as a React child throws
 * (React error #31).
 */
function normalizeRouteType(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (value && typeof value === "object") {
    const { name, code } = value as { name?: unknown; code?: unknown };
    if (typeof name === "string" && name.trim() !== "") return name.trim();
    if (typeof code === "string" && code.trim() !== "") return code.trim();
  }
  return undefined;
}

function normalizeTrip(trip: Trip): Trip {
  const routeType = normalizeRouteType((trip as { routeType?: unknown }).routeType);
  return { ...trip, routeType };
}

export function loadTrips(): Trip[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as Trip[]).map(normalizeTrip) : [];
  } catch {
    return [];
  }
}

export function saveTrips(trips: Trip[]) {
  localStorage.setItem(KEY, JSON.stringify(trips));
}

export function loadActive(): Trip | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE);
    return raw ? normalizeTrip(JSON.parse(raw) as Trip) : null;
  } catch {
    return null;
  }
}

export function saveActive(trip: Trip | null) {
  if (!trip) localStorage.removeItem(ACTIVE);
  else localStorage.setItem(ACTIVE, JSON.stringify(trip));
}

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const ADMIN_ROUTE_TYPES_KEY = "transit_admin_route_types_v1";

export function loadAdminRouteTypes(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ADMIN_ROUTE_TYPES_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveAdminRouteType(tripId: string, routeType: string) {
  if (typeof window === "undefined" || !tripId) return;
  try {
    const existing = loadAdminRouteTypes();
    existing[tripId] = routeType;
    localStorage.setItem(ADMIN_ROUTE_TYPES_KEY, JSON.stringify(existing));
  } catch {
    /* ignore storage quota or private browsing errors */
  }
}

export function resolveTripRouteType(
  trip: { tripId?: string; id?: string; routeType?: string } & Record<string, unknown>,
  overrides?: Record<string, string>,
): string {
  const id = trip.tripId || trip.id || "";
  if (overrides && id && overrides[id]) return overrides[id];
  const stored = loadAdminRouteTypes();
  if (id && stored[id]) return stored[id];

  // Try direct properties that might be returned in JSON
  const direct =
    trip.routeType ||
    (trip as { route_type?: string }).route_type ||
    (trip as { routeCategory?: string }).routeCategory ||
    (trip as { route_category?: string }).route_category ||
    (trip as { tripType?: string }).tripType ||
    (trip as { trip_type?: string }).trip_type;
  if (typeof direct === "string" && direct.trim() !== "") return direct.trim();

  // Try matching local trips logged on this device
  if (id) {
    const local = loadTrips();
    const found = local.find((t) => t.id === id);
    if (found?.routeType?.trim()) return found.routeType.trim();
  }

  // Standard route type default for fleet trips
  return "Fixed Route";
}

