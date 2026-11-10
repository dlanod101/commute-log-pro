import { useEffect, useState } from "react";
import {
  ApiError,
  downloadAdminTripShapefile,
  downloadAdminTripZip,
  fetchAdminTrips,
  loadToken,
  type AdminTrip,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CloudDownload,
  Eye,
  Filter,
  Layers,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Truck,
  User as UserIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminTripDetailSheet } from "./AdminTripDetailSheet";
import { formatDateTime } from "@/lib/utils";
import { TripStatusBadge } from "./shared";

const PAGE_SIZE = 20;

type Props = {
  onSessionExpired: () => void;
};

export function AdminTripsTab({ onSessionExpired }: Props) {
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);

  const [statusFilter, setStatusFilter] = useState("");
  const [unitInput, setUnitInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminTrip | null>(null);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Debounce filter inputs to avoid over-fetching
  useEffect(() => {
    const t = setTimeout(() => setOffset(0), 300);
    return () => clearTimeout(t);
  }, [unitInput, dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    const tok = loadToken();
    if (!tok) {
      onSessionExpired();
      return;
    }
    setLoading(true);
    fetchAdminTrips(tok, {
      unit_id: unitInput.trim() || undefined,
      status: statusFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      offset,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return;
        setTrips(res.trips ?? []);
        setTotal(res.total ?? 0);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          onSessionExpired();
          toast.error("Session expired — sign in again");
        } else {
          toast.error(err instanceof Error ? err.message : "Failed to load trips");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, unitInput, dateFrom, dateTo, offset, refreshTick, onSessionExpired]);

  const download = async (trip: AdminTrip, kind: "csv" | "shapefile") => {
    const tok = loadToken();
    if (!tok) {
      onSessionExpired();
      return;
    }
    const key = `${trip.tripId}:${kind}`;
    setDownloadingKey(key);
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
      setDownloadingKey(null);
    }
  };

  const clearFilters = () => {
    setStatusFilter("");
    setUnitInput("");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
  };

  const activeFiltersCount =
    (statusFilter ? 1 : 0) + (unitInput.trim() ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          {/* Quick unit search input */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={unitInput}
              onChange={(e) => setUnitInput(e.target.value)}
              placeholder="Search by unit ID…"
              className="pl-9 pr-8 h-10 text-sm"
            />
            {unitInput && (
              <button
                type="button"
                onClick={() => setUnitInput("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Quick status selector on desktop / toggle on mobile */}
          <div className="hidden sm:block w-40">
            <Select
              value={statusFilter || "all"}
              onValueChange={(v) => {
                setStatusFilter(v === "all" ? "" : v);
                setOffset(0);
              }}
            >
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mobile Filter Toggle */}
          <Button
            type="button"
            variant={showFiltersMobile || activeFiltersCount > 0 ? "secondary" : "outline"}
            className="h-10 gap-1.5 px-3 sm:hidden"
            onClick={() => setShowFiltersMobile((prev) => !prev)}
            aria-expanded={showFiltersMobile}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <Badge
                variant="default"
                className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full"
              >
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          {/* Refresh button */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            title="Refresh trips"
            onClick={() => setRefreshTick((t) => t + 1)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Detailed Filters (Collapsible on mobile, inline on desktop) */}
        <div
          className={`rounded-xl border bg-card p-3 shadow-sm transition-all ${
            showFiltersMobile ? "block" : "hidden sm:block"
          }`}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:items-end">
            <div className="space-y-1 sm:hidden">
              <Label htmlFor="mobile-status-filter" className="text-xs">
                Status
              </Label>
              <Select
                value={statusFilter || "all"}
                onValueChange={(v) => {
                  setStatusFilter(v === "all" ? "" : v);
                  setOffset(0);
                }}
              >
                <SelectTrigger id="mobile-status-filter" className="h-9 text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="trip-date-from" className="text-xs">
                From Date
              </Label>
              <Input
                id="trip-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="trip-date-to" className="text-xs">
                To Date
              </Label>
              <Input
                id="trip-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-1 sm:pt-0">
              {activeFiltersCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="gap-1.5 h-9 text-xs text-muted-foreground hover:text-foreground w-full sm:w-auto"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters ({activeFiltersCount})
                </Button>
              ) : (
                <span className="hidden lg:inline text-xs text-muted-foreground">
                  Showing latest recorded trips
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trips Results Overview */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground px-0.5">
        <span>
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Updating…
            </span>
          ) : (
            <>
              Found <strong className="text-foreground">{total}</strong> trip
              {total === 1 ? "" : "s"}
            </>
          )}
        </span>
        <span>
          Page {page} of {pageCount}
        </span>
      </div>

      {/* Mobile Trips Feed (md:hidden) */}
      <div className="space-y-3 md:hidden">
        {loading && trips.length === 0 && (
          <Card className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
            <p className="text-sm font-medium">Loading fleet trips…</p>
          </Card>
        )}

        {!loading && trips.length === 0 && (
          <Card className="flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
              <MapPin className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold">No trips found</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs">
              {activeFiltersCount > 0
                ? "No trips matched your active filters. Try loosening the date or unit criteria."
                : "No recorded trips are available yet."}
            </p>
            {activeFiltersCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </Button>
            )}
          </Card>
        )}

        {trips.map((trip) => {
          const isBusy = downloadingKey !== null;
          const csvKey = `${trip.tripId}:csv`;
          const shpKey = `${trip.tripId}:shapefile`;
          const isDownloadingCsv = downloadingKey === csvKey;
          const isDownloadingShp = downloadingKey === shpKey;

          return (
            <Card
              key={`${trip.unit_id}-${trip.tripId}`}
              className="overflow-hidden border p-3.5 shadow-sm transition-shadow hover:shadow active:bg-muted/30"
              onClick={() => setSelected(trip)}
            >
              {/* Header: Date + Status */}
              <div className="flex items-center justify-between gap-2 border-b pb-2 mb-2.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span>{formatDateTime(trip.date)}</span>
                </div>
                <TripStatusBadge status={trip.status} />
              </div>

              {/* Route */}
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm leading-snug">
                    {trip.originDestination || "Route not specified"}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground truncate">
                    ID: {trip.tripId}
                  </p>
                </div>
              </div>

              {/* Metadata chips */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                {trip.unit_id && (
                  <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                    Unit: {trip.unit_id}
                  </Badge>
                )}
                {trip.vehicleType && (
                  <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-secondary-foreground font-medium">
                    <Truck className="h-3 w-3" />
                    {trip.vehicleType}
                  </span>
                )}
                {trip.routeType && (
                  <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                    {trip.routeType}
                  </span>
                )}
                {(trip.owner_name || trip.owner_email) && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground max-w-[14rem] truncate">
                    <UserIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{trip.owner_name || trip.owner_email}</span>
                  </span>
                )}
              </div>

              {/* Touch-friendly Actions */}
              <div className="mt-3.5 pt-2.5 border-t flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="flex-1 gap-1.5 h-9 text-xs font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(trip);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View details
                </Button>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5 text-xs gap-1"
                    title="Download CSV ZIP"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      download(trip, "csv");
                    }}
                  >
                    {isDownloadingCsv ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CloudDownload className="h-3.5 w-3.5" />
                    )}
                    <span>CSV</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5 text-xs gap-1"
                    title="Download Shapefile"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      download(trip, "shapefile");
                    }}
                  >
                    {isDownloadingShp ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Layers className="h-3.5 w-3.5" />
                    )}
                    <span>SHP</span>
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Desktop Trips Table (hidden md:block) */}
      <Card className="hidden md:block overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-44">Date & Time</TableHead>
              <TableHead>Route / Origin & Destination</TableHead>
              <TableHead className="w-36">Driver / Owner</TableHead>
              <TableHead className="w-28">Vehicle</TableHead>
              <TableHead className="w-28">Type</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && trips.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading trips…
                  </span>
                </TableCell>
              </TableRow>
            )}
            {!loading && trips.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                  No trips match the current filter criteria.
                </TableCell>
              </TableRow>
            )}
            {trips.map((trip) => {
              const busy = downloadingKey !== null;
              const csvKey = `${trip.tripId}:csv`;
              const shpKey = `${trip.tripId}:shapefile`;
              return (
                <TableRow
                  key={`${trip.unit_id}-${trip.tripId}`}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setSelected(trip)}
                >
                  <TableCell className="whitespace-nowrap text-xs font-medium">
                    {formatDateTime(trip.date)}
                  </TableCell>
                  <TableCell className="max-w-[16rem]">
                    <p className="truncate font-medium text-sm">{trip.originDestination || "—"}</p>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                      {trip.tripId}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[10rem]">
                    <p className="truncate text-xs">{trip.owner_name || trip.owner_email || "—"}</p>
                    {trip.unit_id && (
                      <p className="font-mono text-[10px] text-muted-foreground truncate">
                        {trip.unit_id}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{trip.vehicleType || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {trip.routeType || "—"}
                  </TableCell>
                  <TableCell>
                    <TripStatusBadge status={trip.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="View details"
                        onClick={() => setSelected(trip)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Download CSV ZIP"
                        disabled={busy}
                        onClick={() => download(trip, "csv")}
                      >
                        {downloadingKey === csvKey ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CloudDownload className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Download Shapefile"
                        disabled={busy}
                        onClick={() => download(trip, "shapefile")}
                      >
                        {downloadingKey === shpKey ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Layers className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination Footer */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-2">
        <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
          Showing {trips.length > 0 ? offset + 1 : 0}–{Math.min(offset + PAGE_SIZE, total)} of{" "}
          {total} trips
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1 text-xs px-3"
            disabled={offset === 0 || loading}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-xs font-medium px-2">
            {page} / {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1 text-xs px-3"
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AdminTripDetailSheet
        trip={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onSessionExpired={onSessionExpired}
      />
    </div>
  );
}
