import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  AUTH_EXPIRED_EVENT,
  AUTH_TOKEN_CHANGED_EVENT,
  TOKEN_KEY,
  getTokenExpirationMs,
  loadToken,
  saveToken,
} from "@/lib/api";

const MAX_TIMEOUT_MS = 2_147_483_647;

function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

/**
 * Watches the auth token across tabs, visibility changes, 401 responses, and
 * JWT expiration timestamps so expired sessions are immediately redirected to `/`.
 */
export function AuthSessionWatcher() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const kickToLogin = () => {
      if (localStorage.getItem(TOKEN_KEY)) {
        saveToken(null);
      }
      if (pathname !== "/") {
        navigate({ to: "/", replace: true });
      }
    };

    const scheduleOrKick = () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }

      const token = loadToken();
      if (!token) {
        if (isProtectedPath(pathname)) {
          navigate({ to: "/", replace: true });
        }
        return;
      }

      const expMs = getTokenExpirationMs(token);
      if (expMs === null) return;

      const remaining = expMs - Date.now();
      if (remaining <= 0) {
        kickToLogin();
        return;
      }

      timer = setTimeout(scheduleOrKick, Math.min(remaining, MAX_TIMEOUT_MS));
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "hidden") return;
      scheduleOrKick();
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY || e.key === null) {
        scheduleOrKick();
      }
    };

    scheduleOrKick();

    window.addEventListener(AUTH_EXPIRED_EVENT, kickToLogin);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, scheduleOrKick);
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("storage", handleStorage);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(AUTH_EXPIRED_EVENT, kickToLogin);
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, scheduleOrKick);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("storage", handleStorage);
    };
  }, [navigate, pathname]);

  return null;
}
