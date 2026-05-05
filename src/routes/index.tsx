import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  MapPin,
  Navigation,
  Square,
  Plus,
  TrafficCone,
  Upload,
  Bus,
  Trash2,
  Wifi,
  WifiOff,
  Download,
} from "lucide-react";
import { useGps } from "@/hooks/use-gps";
import {
  haversine,
  loadActive,
  loadTrips,
  saveActive,
  saveTrips,
} from "@/lib/storage";
import type { Stop, Trip, SignalDelay } from "@/lib/types";
import { TripStatBadge } from "@/components/TripStatBadge";

export const Route = createFileRoute("/")({
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
  const [active, setActive] = useState<Trip | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  // load
  useEffect(() => {
    setActive(loadActive());
    setTrips(loadTrips());
  }, []);

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
    fare: number;
    initialPassengers: number;
  }) => {
    const trip: Trip = {
      id: uid(),
      origin: data.origin,
      destination: data.destination,
      fare: data.fare,
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

  const endTrip = (stop: Omit<Stop, "id" | "ts" | "lat" | "lng">) => {
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
  };

  const uploadAll = async () => {
    // Front-end only: simulated upload + mark as uploaded.
    if (!online) {
      toast.error("You're offline — try again when connected");
      return;
    }
    const pending = trips.filter((t) => !t.uploaded);
    if (!pending.length) {
      toast.info("Nothing to upload");
      return;
    }
    toast.loading(`Uploading ${pending.length} trip(s)...`, { id: "up" });
    await new Promise((r) => setTimeout(r, 900));
    const next = trips.map((t) => ({ ...t, uploaded: true }));
    setTrips(next);
    saveTrips(next);
    toast.success(`Uploaded ${pending.length} trip(s)`, { id: "up" });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(trips, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transit-trips-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
              <div className="flex gap-2">
                <Button onClick={uploadAll} className="flex-1 gap-2">
                  <Upload className="h-4 w-4" /> Upload to web
                </Button>
                <Button variant="outline" onClick={exportJson} className="gap-2">
                  <Download className="h-4 w-4" /> JSON
                </Button>
              </div>
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

function NewTripForm({
  onStart,
}: {
  onStart: (d: { origin: string; destination: string; fare: number; initialPassengers: number }) => void;
}) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [fare, setFare] = useState("");
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
      fare: Number(fare) || 0,
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Fare</Label>
            <Input inputMode="decimal" value={fare} onChange={(e) => setFare(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>Passengers @ start</Label>
            <Input inputMode="numeric" value={pax} onChange={(e) => setPax(e.target.value)} placeholder="0" />
          </div>
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

function ActiveTripView({
  trip,
  now,
  onAddStop,
  onEnd,
}: {
  trip: Trip;
  now: number;
  onAddStop: (s: Omit<Stop, "id" | "ts" | "lat" | "lng">) => void;
  onEnd: (s: Omit<Stop, "id" | "ts" | "lat" | "lng">) => void;
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

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Stops timeline</h3>
        {trip.stops.length === 0 ? (
          <p className="text-xs text-muted-foreground">No stops logged yet.</p>
        ) : (
          <ol className="space-y-3">
            {trip.stops.map((s, i) => (
              <li key={s.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                      s.type === "signalized"
                        ? "bg-signal text-signal-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {i + 1}
                  </div>
                  {i < trip.stops.length - 1 && <div className="my-1 w-px flex-1 bg-border" />}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.type === "signalized" ? (
                      <Badge className="gap-1 bg-signal text-signal-foreground hover:bg-signal">
                        <TrafficCone className="h-3 w-3" /> Signal · {s.signalDelay}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <MapPin className="h-3 w-3" /> Stop
                      </Badge>
                    )}
                    {s.dwellSeconds != null && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        dwell {s.dwellSeconds}s
                      </Badge>
                    )}
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {new Date(s.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  {s.intersectionName && (
                    <div className="mt-1 text-xs font-medium">{s.intersectionName}</div>
                  )}
                  <div className="mt-1 text-sm">
                    <span className="font-mono">+{s.boarding}</span> board ·{" "}
                    <span className="font-mono">-{s.alighting}</span> alight
                  </div>
                  {s.notes && <p className="mt-1 text-xs text-muted-foreground">"{s.notes}"</p>}
                  {s.lat != null && (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {s.lat.toFixed(5)}, {s.lng?.toFixed(5)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

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
        onSubmit={(d) => {
          onEnd(d);
          setEndOpen(false);
        }}
      />
    </div>
  );
}

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
  onSubmit: (s: Omit<Stop, "id" | "ts" | "lat" | "lng">) => void;
}) {
  const [type, setType] = useState<"regular" | "signalized">("regular");
  const [delay, setDelay] = useState<SignalDelay>("none");
  const [board, setBoard] = useState("0");
  const [alight, setAlight] = useState("0");
  const [notes, setNotes] = useState("");
  const [intersection, setIntersection] = useState("");
  const [dwellStart, setDwellStart] = useState<number | null>(null);
  const [dwellPaused, setDwellPaused] = useState<number>(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (open) {
      setType("regular");
      setDelay("none");
      setBoard("0");
      setAlight("0");
      setNotes("");
      setIntersection("");
      setDwellStart(Date.now());
      setDwellPaused(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || dwellStart === null) return;
    const t = setInterval(() => setTick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [open, dwellStart]);

  const dwellMs = dwellStart === null ? dwellPaused : dwellPaused + (Date.now() - dwellStart);
  const dwellSec = Math.round(dwellMs / 1000);
  // reference tick to satisfy linter
  void tick;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("regular")}
              className={`rounded-lg border p-3 text-left transition ${
                type === "regular" ? "border-primary bg-secondary" : "hover:bg-secondary/50"
              }`}
            >
              <MapPin className="mb-1 h-4 w-4" />
              <div className="text-sm font-medium">Regular stop</div>
            </button>
            <button
              type="button"
              onClick={() => setType("signalized")}
              className={`rounded-lg border p-3 text-left transition ${
                type === "signalized" ? "border-primary bg-secondary" : "hover:bg-secondary/50"
              }`}
            >
              <TrafficCone className="mb-1 h-4 w-4" />
              <div className="text-sm font-medium">Signal intersection</div>
            </button>
          </div>

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

          {type === "signalized" && (
            <>
              <div className="space-y-2">
                <Label>Signalized intersection (area / name)</Label>
                <Input
                  value={intersection}
                  onChange={(e) => setIntersection(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. 5th Ave & Main St"
                />
              </div>
              <div className="space-y-2">
                <Label>Signal delay</Label>
                <RadioGroup
                  value={delay}
                  onValueChange={(v) => setDelay(v as SignalDelay)}
                  className="grid grid-cols-3 gap-2"
                >
                  {(["none", "short", "long"] as const).map((v) => (
                    <Label
                      key={v}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-2 text-xs capitalize ${
                        delay === v ? "border-primary bg-secondary" : ""
                      }`}
                    >
                      <RadioGroupItem value={v} className="sr-only" />
                      {v}
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </>
          )}

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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() =>
              onSubmit({
                type,
                signalDelay: type === "signalized" ? delay : undefined,
                intersectionName:
                  type === "signalized" && intersection.trim()
                    ? intersection.trim()
                    : undefined,
                dwellSeconds: dwellSec,
                boarding: Math.max(0, parseInt(board) || 0),
                alighting: Math.max(0, parseInt(alight) || 0),
                notes: notes.trim() || undefined,
              })
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
  const signalStops = trip.stops.filter((s) => s.type === "signalized").length;
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
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
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
        <div>
          <div className="font-mono text-sm font-semibold">{signalStops}</div>
          <div className="text-[10px] text-muted-foreground">signals</div>
        </div>
      </div>
    </Card>
  );
}
