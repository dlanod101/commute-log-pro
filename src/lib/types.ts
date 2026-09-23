export type GpsPoint = {
  record_type: "gps_point";
  ts: number;
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number | null;
};

export type StopType = "regular" | "signalized";

export type VehicleType = {
  id: string;
  code: string;
  name: string;
  capacity: number;
  active?: boolean;
};

export type Stop = {
  id: string;
  ts: number;
  lat: number | null;
  lng: number | null;
  type: StopType;
  boarding: number;
  alighting: number;
  /** Time spent stopped at this stop visit, in seconds. Sent for every stop type. */
  dwellSeconds?: number;
  /** Independent "Delay Time" for this stop visit, in seconds. */
  delaySeconds?: number;
  intersectionName?: string;
  notes?: string;
};

export type Trip = {
  id: string;
  origin: string;
  destination: string;
  fare: number | null;
  vehicle?: VehicleType;
  /** Free-text route type typed by the operator (e.g. "Fixed-Route" or "Charter Service"). */
  routeType?: string;
  initialPassengers: number;
  startedAt: number;
  endedAt?: number;
  endStopId?: string;
  distanceMeters: number;
  gps: GpsPoint[];
  stops: Stop[];
  status?: "ongoing" | "completed";
  uploaded?: boolean;
};
