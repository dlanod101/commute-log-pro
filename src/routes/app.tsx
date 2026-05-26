import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { requireAuth } from "@/lib/auth-guard";
import {
  ApiError,
  getMe,
  loadToken,
  saveToken,
  uploadTrip,
  type User,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  MapPin,
  Navigation,
  Square,
  Plus,
  Upload,
  Bus,
  Trash2,
  Wifi,
  WifiOff,
  LogOut,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { useGps } from "@/hooks/use-gps";
import {
  haversine,
  loadActive,
  loadTrips,
  saveActive,
  saveTrips,
} from "@/lib/storage";
import type { Stop, Trip } from "@/lib/types";
import { TripStatBadge } from "@/components/TripStatBadge";

export const Route = createFileRoute("/app")({
  beforeLoad: requireAuth,
  component: App,
});

const uid = () => Math.random().toString(36).slice(2, 10);

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function fmtKm(m: number) {
  return `${(m / 1000).toFixed(2)} km`;
}

function App() {
  const navigate = useNavigate();
  const [active, setActive] = useState<Trip | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [user, setUser] = useState<User | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loadToken()) {
      navigate({ to: "/" });
      return;
    }
    setActive(loadActive());
    setTrips(loadTrips());
    const token = loadToken();
    if (token) {
      getMe(token)
        .then(setUser)
        .catch(() => {
          saveToken(null);
          navigate({ to: "/" });
        });
    }
  }, [navigate]);

  const signOut = () => {
    saveToken(null);
    navigate({ to: "/" });
  };

  // ticker
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  // online/offline
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // persist active
  useEffect(() => {
    saveActive(active);
  }, [active]);

  const handleGps = (p: { ts: number; lat: number; lng: number }) => {
    setActive((prev) => {
      if (!prev) return prev;
      const last = prev.gps[prev.gps.length - 1];
      const minGap = 1000;
      if (last && p.ts - last.ts < minGap) return prev;
      const added =
        last && p.ts - last.ts > 0
          ? haversine(last, p)
          : 0;
      return {
        ...prev,
        gps: [...prev.gps, p],
        distanceMeters: prev.distanceMeters + added,
      };
    });
  };

  const { status: gpsStatus, last: lastPoint } = useGps(!!active && !active.endedAt, handleGps);

  const startTrip = (data: {
    origin: string;
    destination: string;
    initialPassengers: number;
  }) => {
    const trip: Trip = {
      id: uid(),
      origin: data.origin,
      destination: data.destination,
      fare: 0,
      initialPassengers: data.initialPassengers,
      startedAt: Date.now(),
      distanceMeters: 0,
      gps: [],
      stops: [],
    };
    setActive(trip);
    toast.success("Trip started — GPS tracking on");
  };

  const addStop = (stop: Omit<Stop, "id" | "ts" | "lat" | "lng">) => {
    if (!active) return;
    const s: Stop = {
      ...stop,
      id: uid(),
      ts: Date.now(),
      lat: lastPoint?.lat ?? null,
      lng: lastPoint?.lng ?? null,
    };
    setActive({ ...active, stops: [...active.stops, s] });
    toast.success("Stop logged");
  };

  const endTrip = (stop: Omit<Stop, "id" | "ts" | "lat" | "lng">, fare?: number) => {
    if (!active) return;
    const s: Stop = {
      ...stop,
      id: uid(),
      ts: Date.now(),
      lat: lastPoint?.lat ?? null,
      lng: lastPoint?.lng ?? null,
    };
    const ended: Trip = {
      ...active,
      stops: [...active.stops, s],
      endedAt: Date.now(),
      endStopId: s.id,
      fare: fare ?? active.fare,
    };
    const next = [ended, ...trips];
    setTrips(next);
    saveTrips(next);
    setActive(null);
    toast.success("Trip ended & saved to phone");
  };

  const deleteTrip = (id: string) => {
    const next = trips.filter((t) => t.id !== id);
    setTrips(next);
    saveTrips(next);
    toast.success("Trip deleted");
  };

  const uploadAll = async () => {
    if (!online) {
      toast.error("You're offline — try again when connected");
      return;
    }
    const token = loadToken();
    if (!token) {
      navigate({ to: "/" });
      return;
    }
    const pending = trips.filter((t) => !t.uploaded);
    if (!pending.length) {
      toast.info("Nothing to upload");
      return;
    }
    setUploading(true);
    toast.loading(`Uploading ${pending.length} trip(s)...`, { id: "up" });
    const uploadedIds = new Set<string>();
    try {
      for (const trip of pending) {
        try {
          await uploadTrip(trip, token);
          uploadedIds.add(trip.id);
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            saveToken(null);
            navigate({ to: "/" });
            toast.error("Session expired — sign in again", { id: "up" });
            return;
          }
          const msg = err instanceof Error ? err.message : "Upload failed";
          if (uploadedIds.size > 0) {
            const next = trips.map((t) =>
              uploadedIds.has(t.id) ? { ...t, uploaded: true } : t,
            );
            setTrips(next);
            saveTrips(next);
          }
          toast.error(msg, { id: "up" });
          return;
        }
      }
      const next = trips.map((t) =>
        uploadedIds.has(t.id) ? { ...t, uploaded: true } : t,
      );
      setTrips(next);
      saveTrips(next);
      toast.success(`Uploaded ${uploadedIds.size} trip(s)`, { id: "up" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-hero text-primary-foreground shadow-elevated">
              <Bus className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">T-data fetcher</h1>
              <p className="text-[11px] text-muted-foreground">Transit field data collection</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 font-mono text-[10px]">
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "ONLINE" : "OFFLINE"}
            </Badge>
            <Badge
              variant="outline"
              className={`gap-1 font-mono text-[10px] ${
                gpsStatus === "active" ? "border-success text-success" : ""
              }`}
            >
              <Navigation className="h-3 w-3" />
              GPS {gpsStatus.toUpperCase()}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={signOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        {active ? (
          <ActiveTripView
            trip={active}
            now={now}
            onAddStop={addStop}
            onEnd={endTrip}
          />
        ) : (
          <Tabs defaultValue="start">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="start">New trip</TabsTrigger>
              <TabsTrigger value="history">
                History {trips.length ? `(${trips.length})` : ""}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="start" className="mt-4">
              <NewTripForm onStart={startTrip} />
            </TabsContent>
            <TabsContent value="history" className="mt-4 space-y-3">
              {user && (
                <p className="text-center text-xs text-muted-foreground">
                  Signed in as {user.name || user.email} · Unit {user.unit_id}
                </p>
              )}
              <Button
                onClick={uploadAll}
                className="w-full gap-2"
                disabled={uploading}
              >
                <Upload className="h-4 w-4" /> Upload to web
              </Button>
              {trips.length === 0 && (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  No trips saved yet.
                </Card>
              )}
              {trips.map((t) => (
                <TripCard key={t.id} trip={t} onDelete={() => deleteTrip(t.id)} />
              ))}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

// ========== NEW TRIP FORM (no fare) ==========
function NewTripForm({
  onStart,
}: {
  onStart: (d: { origin: string; destination: string; initialPassengers: number }) => void;
}) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [pax, setPax] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) {
      toast.error("Origin & destination required");
      return;
    }
    onStart({
      origin: origin.trim().slice(0, 80),
      destination: destination.trim().slice(0, 80),
      initialPassengers: Math.max(0, parseInt(pax) || 0),
    });
  };

  return (
    <Card className="p-5 shadow-card">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Origin</Label>
          <Input value={origin} onChange={(e) => setOrigin(e.target.value)} maxLength={80} placeholder="e.g. Central Station" />
        </div>
        <div className="space-y-2">
          <Label>Destination</Label>
          <Input value={destination} onChange={(e) => setDestination(e.target.value)} maxLength={80} placeholder="e.g. Airport" />
        </div>
        <div className="space-y-2">
          <Label>Passengers @ start</Label>
          <Input inputMode="numeric" value={pax} onChange={(e) => setPax(e.target.value)} placeholder="0" />
        </div>
        <Button type="submit" size="lg" className="w-full gap-2 bg-gradient-hero">
          <Navigation className="h-4 w-4" /> Start trip & GPS
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          GPS records every 1–3 sec. Works offline; data saved to phone.
        </p>
      </form>
    </Card>
  );
}

// ========== ACTIVE TRIP VIEW (stop timeline removed) ==========
function ActiveTripView({
  trip,
  now,
  onAddStop,
  onEnd,
}: {
  trip: Trip;
  now: number;
  onAddStop: (s: Omit<Stop, "id" | "ts" | "lat" | "lng">) => void;
  onEnd: (s: Omit<Stop, "id" | "ts" | "lat" | "lng">, fare: number) => void;
}) {
  const [stopOpen, setStopOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const { passengers, totalBoard, totalAlight } = useMemo(() => {
    let p = trip.initialPassengers;
    let b = 0;
    let a = 0;
    for (const s of trip.stops) {
      p += s.boarding - s.alighting;
      b += s.boarding;
      a += s.alighting;
    }
    return { passengers: p, totalBoard: b, totalAlight: a };
  }, [trip]);

  const elapsed = (trip.endedAt ?? now) - trip.startedAt;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-0 bg-gradient-hero p-5 text-primary-foreground shadow-elevated">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-80">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          Trip in progress
        </div>
        <div className="mt-2 font-mono text-xs opacity-80">ID · {trip.id}</div>
        <div className="mt-3 flex items-center gap-2 text-lg font-semibold">
          <span className="truncate">{trip.origin}</span>
          <span className="opacity-50">→</span>
          <span className="truncate">{trip.destination}</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <TripStatBadge label="Time" value={fmtDuration(elapsed)} />
        <TripStatBadge label="Distance" value={fmtKm(trip.distanceMeters)} />
        <TripStatBadge label="Onboard" value={String(passengers)} />
        <TripStatBadge label="Stops" value={String(trip.stops.length)} accent />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Passenger movement</h3>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            start: {trip.initialPassengers}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border bg-success/10 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-success">
              <ArrowDownToLine className="h-3 w-3" /> Boarded
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-success">
              {totalBoard}
            </div>
          </div>
          <div className="rounded-xl border bg-destructive/10 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-destructive">
              <ArrowUpFromLine className="h-3 w-3" /> Alighted
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-destructive">
              {totalAlight}
            </div>
          </div>
          <div className="rounded-xl border bg-secondary p-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Onboard
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{passengers}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" onClick={() => setStopOpen(true)} className="h-16 gap-2">
          <Plus className="h-5 w-5" /> Log stop
        </Button>
        <Button
          size="lg"
          variant="destructive"
          onClick={() => setEndOpen(true)}
          className="h-16 gap-2"
        >
          <Square className="h-5 w-5" /> End trip
        </Button>
      </div>

      {/* Stops timeline removed – stops are still saved in background */}

      <StopDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        title="Log stop"
        submitLabel="Save stop"
        onSubmit={(d) => {
          onAddStop(d);
          setStopOpen(false);
        }}
      />
      <StopDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        title="End trip at stop"
        submitLabel="End trip"
        destructive
        onSubmit={(d, fare) => {
          onEnd(d, fare);
          setEndOpen(false);
        }}
      />
    </div>
  );
}

// ========== STOP DIALOG (regular stops only, fare on end) ==========
function StopDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  destructive,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  submitLabel: string;
  destructive?: boolean;
  onSubmit: (s: Omit<Stop, "id" | "ts" | "lat" | "lng">, fare?: number) => void;
}) {
  const [board, setBoard] = useState("0");
  const [alight, setAlight] = useState("0");
  const [notes, setNotes] = useState("");
  const [dwellStart, setDwellStart] = useState<number | null>(null);
  const [dwellPaused, setDwellPaused] = useState<number>(0);
  const [tick, setTick] = useState(0);
  const [fare, setFare] = useState("");

  useEffect(() => {
    if (open) {
      setBoard("0");
      setAlight("0");
      setNotes("");
      setDwellStart(Date.now());
      setDwellPaused(0);
      setFare("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || dwellStart === null) return;
    const t = setInterval(() => setTick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [open, dwellStart]);

  const dwellMs = dwellStart === null ? dwellPaused : dwellPaused + (Date.now() - dwellStart);
  const dwellSec = Math.round(dwellMs / 1000);
  void tick;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-secondary/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Dwell time
                </div>
                <div className="font-mono text-2xl font-semibold tabular-nums">
                  {fmtDuration(dwellMs)}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={dwellStart === null ? "default" : "outline"}
                onClick={() => {
                  if (dwellStart === null) {
                    setDwellStart(Date.now());
                  } else {
                    setDwellPaused(dwellPaused + (Date.now() - dwellStart));
                    setDwellStart(null);
                  }
                }}
              >
                {dwellStart === null ? "Resume" : "Stop timer"}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Auto-started when stop logged. Stop the timer when the vehicle moves.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Boarding</Label>
              <Input inputMode="numeric" value={board} onChange={(e) => setBoard(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Alighting</Label>
              <Input inputMode="numeric" value={alight} onChange={(e) => setAlight(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Any observations…"
              rows={3}
            />
          </div>

          {destructive && (
            <div className="space-y-2">
              <Label>Total fare (₦)</Label>
              <Input
                inputMode="decimal"
                value={fare}
                onChange={(e) => setFare(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() =>
              onSubmit(
                {
                  type: "regular",
                  dwellSeconds: dwellSec,
                  boarding: Math.max(0, parseInt(board) || 0),
                  alighting: Math.max(0, parseInt(alight) || 0),
                  notes: notes.trim() || undefined,
                },
                destructive ? (parseFloat(fare) || 0) : undefined
              )
            }
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TripCard({ trip, onDelete }: { trip: Trip; onDelete: () => void }) {
  const dur = (trip.endedAt ?? trip.startedAt) - trip.startedAt;
  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant={trip.uploaded ? "default" : "outline"} className="text-[10px]">
              {trip.uploaded ? "UPLOADED" : "ON DEVICE"}
            </Badge>
            <span className="font-mono text-[10px] text-muted-foreground">{trip.id}</span>
          </div>
          <div className="mt-1 truncate text-sm font-semibold">
            {trip.origin} → {trip.destination}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {new Date(trip.startedAt).toLocaleString()}
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="font-mono text-sm font-semibold">{fmtDuration(dur)}</div>
          <div className="text-[10px] text-muted-foreground">time</div>
        </div>
        <div>
          <div className="font-mono text-sm font-semibold">{fmtKm(trip.distanceMeters)}</div>
          <div className="text-[10px] text-muted-foreground">distance</div>
        </div>
        <div>
          <div className="font-mono text-sm font-semibold">{trip.stops.length}</div>
          <div className="text-[10px] text-muted-foreground">stops</div>
        </div>
      </div>
    </Card>
  );
}