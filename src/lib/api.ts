import type { Trip } from "./types";

export const API_BASE = "https://data-collection-backend-chi.vercel.app";

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

export async function uploadTrip(trip: Trip, token: string): Promise<void> {
  const form = new FormData();
  const blob = new Blob([JSON.stringify(trip)], { type: "application/json" });
  form.append("file", blob, `trip-${trip.id}.json`);

  const res = await fetch(`${API_BASE}/api/v1/data/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) await fail(res);
}
