import Papa from "papaparse";

function downloadCSV(data: any[], filename: string) {
  const csv = Papa.unparse(data);

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
}

export function exportTripSummaryCSV(trips: any[]) {
  const rows = trips.map((trip) => ({
    trip_id: trip.id,
    origin: trip.origin,
    destination: trip.destination,
    fare: trip.fare,

    initial_passengers: trip.initialPassengers,

    started_at: new Date(trip.startedAt).toLocaleString(),

    ended_at: new Date(trip.endedAt).toLocaleString(),

    trip_duration_minutes:
      ((trip.endedAt - trip.startedAt) / 1000 / 60).toFixed(2),

    distance_km: (trip.distanceMeters / 1000).toFixed(2),

    gps_points: trip.gps.length,

    total_stops: trip.stops.length,

    total_boarding: trip.stops.reduce(
      (sum: number, s: any) => sum + (s.boarding || 0),
      0
    ),

    total_alighting: trip.stops.reduce(
      (sum: number, s: any) => sum + (s.alighting || 0),
      0
    ),
  }));

  downloadCSV(rows, "trip-summary.csv");
}

export function exportStopsCSV(trips: any[]) {
  const stopRows: any[] = [];

  trips.forEach((trip) => {
    trip.stops.forEach((stop: any) => {
      stopRows.push({
        trip_id: trip.id,

        origin: trip.origin,

        destination: trip.destination,

        stop_id: stop.id,

        stop_type: stop.type,

        timestamp: new Date(stop.ts).toLocaleString(),

        latitude: stop.lat,

        longitude: stop.lng,

        dwell_seconds: stop.dwellSeconds,

        boarding: stop.boarding,

        alighting: stop.alighting,

        media_count: stop.media?.length || 0,
      });
    });
  });

  downloadCSV(stopRows, "trip-stops.csv");
}

export function exportGPSCSV(trips: any[]) {
  const gpsRows: any[] = [];

  trips.forEach((trip) => {
    trip.gps.forEach((point: any) => {
      gpsRows.push({
        trip_id: trip.id,

        origin: trip.origin,

        destination: trip.destination,

        timestamp: new Date(point.ts).toLocaleString(),

        latitude: point.lat,

        longitude: point.lng,

        accuracy: point.accuracy,

        speed: point.speed,
      });
    });
  });

  downloadCSV(gpsRows, "trip-gps.csv");
}