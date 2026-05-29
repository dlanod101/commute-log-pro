import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  downloadTripProcessZip,
  downloadTripShapefileZip,
  fetchRemoteTrips,
  loadToken,
  type RemoteTrip,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CloudDownload, Database, Layers, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type MyDataSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  online: boolean;
  onSessionExpired: () => void;
};

export function MyDataSheet({
  open,
  onOpenChange,
  online,
  onSessionExpired,
}: MyDataSheetProps) {
  const [trips, setTrips] = useState<RemoteTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const handleApiError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
        toast.error("Session expired — sign in again");
        return;
      }
      const msg = err instanceof Error ? err.message : fallback;
      toast.error(msg);
    },
    [onSessionExpired],
  );

  const loadTrips = useCallback(async () => {
    if (!online) {
      toast.error("You're offline — connect to load online trips");
      return;
    }
    const token = loadToken();
    if (!token) {
      onSessionExpired();
      return;
    }
    setLoading(true);
    try {
      const list = await fetchRemoteTrips(token);
      setTrips(list);
    } catch (err) {
      handleApiError(err, "Failed to load trips");
    } finally {
      setLoading(false);
    }
  }, [online, onSessionExpired, handleApiError]);

  useEffect(() => {
    if (open) loadTrips();
  }, [open, loadTrips]);

  const download = async (
    tripId: string,
    kind: "csv" | "shapefile",
  ) => {
    if (!online) {
      toast.error("You're offline — connect to download");
      return;
    }
    const token = loadToken();
    if (!token) {
      onSessionExpired();
      return;
    }
    const key = `${tripId}:${kind}`;
    setDownloadingKey(key);
    try {
      if (kind === "csv") {
        await downloadTripProcessZip(tripId, token);
        toast.success(`CSV ZIP downloaded · ${tripId}`);
      } else {
        await downloadTripShapefileZip(tripId, token);
        toast.success(`Shapefile downloaded · ${tripId}`);
      }
    } catch (err) {
      handleApiError(err, "Download failed");
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            My data
          </SheetTitle>
          <SheetDescription>
            Trips uploaded to the server. Download CSV or shapefile ZIPs per trip.
            Shapefiles require GPS points on the server.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={loadTrips}
            disabled={loading || !online}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>

        <div className="mt-4 flex-1 space-y-2 overflow-y-auto pb-4">
          {loading && trips.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading trips…
            </div>
          )}
          {!loading && trips.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No trips on the server yet. Upload from the History tab on this device.
            </Card>
          )}
          {trips.map((trip) => {
            const { tripId } = trip;
            const csvKey = `${tripId}:csv`;
            const shpKey = `${tripId}:shapefile`;
            const busy = downloadingKey !== null;
            const when = trip.date
              ? new Date(trip.date).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "";
            return (
              <Card key={tripId} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{trip.originDestination}</p>
                  {when && (
                    <p className="text-[11px] text-muted-foreground">{when}</p>
                  )}
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{tripId}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={busy || !online}
                    onClick={() => download(tripId, "csv")}
                  >
                    {downloadingKey === csvKey ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CloudDownload className="h-3.5 w-3.5" />
                    )}
                    CSV ZIP
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={busy || !online}
                    onClick={() => download(tripId, "shapefile")}
                  >
                    {downloadingKey === shpKey ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Layers className="h-3.5 w-3.5" />
                    )}
                    Shapefile
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
