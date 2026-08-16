import type { Trip, VehicleType } from "@/lib/types";
import { prepareTripsForUpload } from "@/lib/tripGps";

export const API_BASE = "https://data-collection-backend-chi.vercel.app";
import type { Trip, VehicleType } from "@/lib/types";
import { prepareTripsForUpload } from "@/lib/tripGps";


const TOKEN_KEY = "transit_auth_token_v1";

export type Token = {
  access_token: string;
  token_type: string;
};

export type User = {
  email?: string | null;
  name?: string | null;
  id: number;
  unit_id: string;
};

export function loadToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fail(res: Response): Promise<never> {
  let message = res.statusText || "Request failed";
  try {
    const data = await res.json();
    if (Array.isArray(data.detail)) {
      message = data.detail.map((d: { msg: string }) => d.msg).join(", ");
    } else if (typeof data.detail === "string") {
      message = data.detail;
    }
  } catch {
    /* ignore */
  }
  throw new ApiError(message, res.status);
}

export async function register(
  email: string,
  name: string,
  password: string,
): Promise<User> {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name: name || null, password }),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function login(email: string, password: string): Promise<Token> {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function getMe(token: string): Promise<User> {
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export type UploadResult = {
  repaired: Trip[];
  skippedStops: number;
  filled: number;
};

export type RemoteTrip = {
  tripId: string;
  originDestination: string;
  date: string;
};

export type RemoteTripsResponse = {
  trips: RemoteTrip[];
};

export async function fetchRemoteTrips(token: string): Promise<RemoteTrip[]> {
  const res = await fetch(`${API_BASE}/api/v1/data/trips`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) await fail(res);
  const data = (await res.json()) as RemoteTripsResponse;
  return data.trips ?? [];
}

export async function fetchVehicleTypes(token: string): Promise<VehicleType[]> {
  const res = await fetch(`${API_BASE}/api/v1/data/vehicle-types`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) await fail(res);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((item) => ({
    ...item,
    id: String(item.id),
    code: String(item.code),
  })) as VehicleType[];
}

export type EndTripResult = {
  tripId: string;
  status: "completed";
  fare: number | null;
  completedAt: string;
  message: string;
};

export async function endTrip(
  tripId: string,
  token: string,
  speedMps: number,
  fare?: number | null,
): Promise<EndTripResult> {
  const body: Record<string, unknown> = {
    tripId,
    speedMps,
  };
  if (fare !== undefined) {
    body.fare = fare;
  }

  const res = await fetch(`${API_BASE}/api/v1/data/trip/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename\*?=(?:UTF-8''|")?([^";\n]+)"?/i);
  return match?.[1]?.trim() ?? fallback;
}

async function downloadTripAttachment(
  path: string,
  token: string,
  fallbackFilename: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) await fail(res);

  const blob = await res.blob();
  const filename = filenameFromDisposition(
    res.headers.get("content-disposition"),
    fallbackFilename,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download processed trip data (ZIP of CSVs) from the backend. */
export function downloadTripProcessZip(tripId: string, token: string): Promise<void> {
  return downloadTripAttachment(
    `/api/v1/data/process/${encodeURIComponent(tripId)}`,
    token,
    `trip_${tripId}.zip`,
  );
}

/** Download trip shapefile ZIP. Fails with 404 if the trip has no GPS points on the server. */
export function downloadTripShapefileZip(tripId: string, token: string): Promise<void> {
  return downloadTripAttachment(
    `/api/v1/data/process/${encodeURIComponent(tripId)}/shapefile`,
    token,
    `trip_${tripId}_shapefile.zip`,
  );
}

export async function uploadTrips(
  trips: Trip[],
  token: string,
): Promise<UploadResult> {
  const { payloads, repaired, skippedStops, filled } = prepareTripsForUpload(trips);
  const form = new FormData();
  const blob = new Blob([JSON.stringify(payloads)], {
    type: "application/json",
  });
  form.append("file", blob, "trips.json");

  const res = await fetch(`${API_BASE}/api/v1/data/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) await fail(res);
  return { repaired, skippedStops, filled };
}
