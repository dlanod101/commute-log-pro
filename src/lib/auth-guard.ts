import { redirect } from "@tanstack/react-router";
import { loadToken } from "@/lib/api";

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!loadToken();
}

export function requireAuth() {
  if (!isAuthenticated()) {
    throw redirect({ to: "/" });
  }
}

export function redirectIfAuthenticated() {
  if (isAuthenticated()) {
    throw redirect({ to: "/app" });
  }
}
