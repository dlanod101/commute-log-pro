export type GpsPoint = {
  record_type: "gps_point";
  ts: number;
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number | null;
};

export type StopType = "regular" | "signalized";
export type SignalDelay = "none" | "short" | "long";

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
  signalDelay?: SignalDelay;
  boarding: number;
  alighting: number;
  dwellSeconds?: number;
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
