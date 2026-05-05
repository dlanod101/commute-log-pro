export type GpsPoint = {
  ts: number;
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number | null;
};

export type StopType = "regular" | "signalized";
export type SignalDelay = "none" | "short" | "long";

export type Stop = {
  id: string;
  ts: number;
  lat: number | null;
  lng: number | null;
  type: StopType;
  signalDelay?: SignalDelay;
  boarding: number;
  alighting: number;
  notes?: string;
};

export type Trip = {
  id: string;
  origin: string;
  destination: string;
  fare: number;
  initialPassengers: number;
  startedAt: number;
  endedAt?: number;
  endStopId?: string;
  distanceMeters: number;
  gps: GpsPoint[];
  stops: Stop[];
  uploaded?: boolean;
};
