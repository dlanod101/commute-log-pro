import { useEffect, useRef, useState } from "react";
import type { GpsPoint } from "@/lib/types";

export type GpsStatus = "idle" | "requesting" | "active" | "denied" | "unavailable";

export type GpsFix = Pick<GpsPoint, "lat" | "lng" | "accuracy" | "speed">;

export function useGps(active: boolean) {
  const [status, setStatus] = useState<GpsStatus>("idle");
  const [last, setLast] = useState<GpsFix | null>(null);
  const watchId = useRef<number | null>(null);

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
        setLast({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
        });
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
