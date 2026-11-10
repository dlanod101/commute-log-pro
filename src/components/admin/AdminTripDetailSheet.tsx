import { useEffect, useState } from "react";
import {
  ApiError,
  downloadAdminTripShapefile,
  downloadAdminTripZip,
  fetchAdminTripDetail,
  fetchAdminTripObservations,
  loadToken,
  type AdminTrip,
  type AdminTripDetail,
  type TripObservation,
} from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  CloudDownload,
  ExternalLink,
  Layers,
  Loader2,
  MapPin,
  Route as RouteIcon,
  Shield,
  Truck,
  User,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";
import { TripStatusBadge } from "./shared";

type Props = {
  trip: AdminTrip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionExpired: () => void;
};

function ObservationRow({ obs, index }: { obs: TripObservation; index: number }) {
  const ts = typeof obs.ts === "number" ? new Date(obs.ts) : null;
  const latNum = typeof obs.lat === "number" ? obs.lat : null;
  const lngNum = typeof obs.lng === "number" ? obs.lng : null;
  const lat = latNum !== null ? latNum.toFixed(6) : null;
  const lng = lngNum !== null ? lngNum.toFixed(6) : null;
  const hasCoords = lat !== null && lng !== null;

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border bg-card/60 p-2.5 transition-colors hover:bg-muted/40">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
            {index + 1}
          </span>
          <p className="text-xs font-semibold capitalize truncate">
            {obs.record_type?.replace(/_/g, " ") || "Record"}
          </p>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground shrink-0">
          {ts
            ? ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : "—"}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
        <span className="font-mono truncate">{hasCoords ? `${lat}, ${lng}` : "No GPS fix"}</span>
        {hasCoords && (
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
            title="Open coordinates in maps"
          >
            <span>Map</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </li>
  );
}

export function AdminTripDetailSheet({ trip, open, onOpenChange, onSessionExpired }: Props) {
  const [detail, setDetail] = useState<AdminTripDetail | null>(null);
  const [observations, setObservations] = useState<TripObservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<"csv" | "shapefile" | null>(null);

  useEffect(() => {
    if (!open || !trip) return;
    let cancelled = false;
    const tok = loadToken();
    if (!tok) {
      onSessionExpired();
      return;
    }
    setLoading(true);
    setDetail(null);
    setObservations([]);
    Promise.all([
      fetchAdminTripDetail(tok, trip.tripId, trip.unit_id || undefined),
      fetchAdminTripObservations(tok, trip.tripId, trip.unit_id || undefined),
    ])
      .then(([d, o]) => {
        if (cancelled) return;
        setDetail(d);
        setObservations(Array.isArray(o) ? o : []);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          onSessionExpired();
        } else {
          toast.error(err instanceof Error ? err.message : "Failed to load trip detail");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, trip, onSessionExpired]);

  const download = async (kind: "csv" | "shapefile") => {
    if (!trip) return;
    const tok = loadToken();
    if (!tok) {
      onSessionExpired();
      return;
    }
    setDownloading(kind);
    try {
      if (kind === "csv") {
        await downloadAdminTripZip(tok, trip.tripId, trip.unit_id || undefined);
        toast.success(`CSV ZIP downloaded · ${trip.tripId}`);
      } else {
        await downloadAdminTripShapefile(tok, trip.tripId, trip.unit_id || undefined);
        toast.success(`Shapefile downloaded · ${trip.tripId}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
      } else {
        toast.error(err instanceof Error ? err.message : "Download failed");
      }
    } finally {
      setDownloading(null);
    }
  };

  const meta = [
    { icon: CalendarDays, label: "Date & Time", value: formatDateTime(detail?.date ?? trip?.date) },
    { icon: Truck, label: "Vehicle Type", value: detail?.vehicleType || trip?.vehicleType || "—" },
    {
      icon: Shield,
      label: "Capacity",
      value: detail?.passengerCapacity != null ? `${detail.passengerCapacity} seats` : "—",
    },
    {
      icon: User,
      label: "Driver / Owner",
      value:
        detail?.owner_name || detail?.owner_email || trip?.owner_name || trip?.owner_email || "—",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-4 sm:max-w-md sm:p-6 overflow-hidden"
      >
        <SheetHeader className="space-y-1.5 pb-2 border-b">
          <div className="flex items-center justify-between gap-2 pr-6">
            <TripStatusBadge status={detail?.status || trip?.status} />
            <Badge variant="outline" className="font-mono text-[10px]">
              Unit: {detail?.unit_id || trip?.unit_id || "—"}
            </Badge>
          </div>
          <SheetTitle className="flex items-start gap-2 text-base sm:text-lg leading-snug">
            <MapPin className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <span className="break-words">
              {detail?.originDestination || trip?.originDestination || "Trip Detail"}
            </span>
          </SheetTitle>
          <SheetDescription className="break-all font-mono text-[11px] text-muted-foreground">
            ID: {trip?.tripId}
          </SheetDescription>
        </SheetHeader>

        {/* Action Downloads Bar */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 text-xs font-medium"
            disabled={downloading !== null}
            onClick={() => download("csv")}
          >
            {downloading === "csv" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CloudDownload className="h-3.5 w-3.5" />
            )}
            Download CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 text-xs font-medium"
            disabled={downloading !== null}
            onClick={() => download("shapefile")}
          >
            {downloading === "shapefile" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Layers className="h-3.5 w-3.5" />
            )}
            Download SHP
          </Button>
        </div>

        {/* Scrollable details and observation list */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1 pb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Loading trip details & points…</span>
            </div>
          ) : (
            <>
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {meta.map((m) => (
                  <div key={m.label} className="rounded-lg border bg-muted/20 p-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                      <m.icon className="h-3 w-3 shrink-0" />
                      <span>{m.label}</span>
                    </p>
                    <p className="mt-1 text-xs font-medium leading-snug break-words">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Route Type */}
              <div className="rounded-lg border bg-muted/20 p-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <RouteIcon className="h-3 w-3 shrink-0" />
                  Route Type
                </p>
                <p className="mt-1 text-xs font-medium">
                  {detail?.routeType || trip?.routeType || "Standard route"}
                </p>
              </div>

              {/* Observations Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Recorded Points ({observations.length})
                  </p>
                  {observations.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">GPS tracking data</span>
                  )}
                </div>

                {observations.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                    No GPS observations recorded for this trip.
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {observations.map((obs, idx) => (
                      <ObservationRow key={obs.id ?? `${obs.ts}-${idx}`} obs={obs} index={idx} />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
