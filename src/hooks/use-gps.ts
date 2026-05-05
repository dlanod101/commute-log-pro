import { useEffect, useRef, useState } from "react";
import type { GpsPoint } from "@/lib/types";

export type GpsStatus = "idle" | "requesting" | "active" | "denied" | "unavailable";

export function useGps(active: boolean, onPoint: (p: GpsPoint) => void) {
  const [status, setStatus] = useState<GpsStatus>("idle");
  const [last, setLast] = useState<GpsPoint | null>(null);
  const watchId = useRef<number | null>(null);
  const cb = useRef(onPoint);
  cb.current = onPoint;

  useEffect(() => {
    if (!active) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      return;
    }
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("requesting");
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus("active");
        const p: GpsPoint = {
          ts: Date.now(),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
        };
        setLast(p);
        cb.current(p);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else setStatus("unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    };
  }, [active]);

  return { status, last };
}
