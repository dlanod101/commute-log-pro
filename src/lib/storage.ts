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
