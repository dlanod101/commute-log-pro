import { useEffect, useRef, useState } from "react";
import type { GpsPoint } from "@/lib/types";

export type GpsStatus = "idle" | "requesting" | "active" | "denied" | "unavailable";

export type GpsFix = Pick<GpsPoint, "lat" | "lng" | "accuracy" | "speed">;

/** Fixes with an accuracy worse than this are treated as low quality. */
export const GPS_ACCURACY_THRESHOLD_M = 50;

/** Window (ms) over which the most accurate fix is selected for recording. */
export const GPS_BEST_FIX_WINDOW_MS = 3000;

type TimedFix = GpsFix & { ts: number };

export function useGps(active: boolean) {
  const [status, setStatus] = useState<GpsStatus>("idle");
  // Latest raw fix — always kept; drives vehicle motion detection (speed).
  const [last, setLast] = useState<GpsFix | null>(null);
  // Most accurate fix within the recent window — used for recorded points.
  const [best, setBest] = useState<GpsFix | null>(null);
  const watchId = useRef<number | null>(null);
  const bestRef = useRef<TimedFix | null>(null);
  const lastRef = useRef<GpsFix | null>(null);

  useEffect(() => {
    if (!active) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      bestRef.current = null;
      lastRef.current = null;
      setLast(null);
      setBest(null);
      return;
    }
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("requesting");
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: GpsFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
        };
        const ts = Date.now();

        // Always track the freshest fix (for motion detection + fallback).
        lastRef.current = fix;
        setLast(fix);

        // Track the most accurate fix within the recent window. Replace when
        // there is none yet, when the current best has gone stale, or when the
        // new fix is more accurate than it. This avoids recording a low-quality
        // fix when a good one from the last few seconds is available.
        const cur = bestRef.current;
        const curFresh = cur && ts - cur.ts <= GPS_BEST_FIX_WINDOW_MS;
        if (!cur || !curFresh || fix.accuracy < cur.accuracy) {
          bestRef.current = { ...fix, ts };
        }
        setBest(bestRef.current);

        setStatus("active");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else setStatus("unavailable");
      },
      // maximumAge: 0 forces a fresh fix instead of a cached (often much less
      // accurate) position; enableHighAccuracy requests GPS-grade fixes.
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    };
  }, [active]);

  const accuracy = best?.accuracy ?? last?.accuracy ?? null;

  return { status, last, best, accuracy };
}
