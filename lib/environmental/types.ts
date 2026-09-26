export type EnvironmentalReading = {
  id: string;
  city: string;
  area: string;
  latitude: number;
  longitude: number;
  aqi: number | null;
  category: string | null;
  pm25: number | null;
  pm10: number | null;
  indicatorValue?: number | null;
  source: string;
  sourceType: "government" | "satellite" | "citizen" | "derived";
  measuredAt: string | null;
};
export type EnvironmentalSource =
  | "government"
  | "satellite"
  | "citizen"
  | "derived";

export type Severity = "low" | "moderate" | "high" | "critical";

export type CitizenReport = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  category: string;
  severity: Severity;
  summary: string;
  reportedAt: string;
  language?: string;
  description?: string;
  possibleSources?: string[];
  recommendedAction?: string;
  confidence?: number | null;
  evidence?: Record<string, unknown>;
};


export type FusionInput = {
  location: {
    city: string;
    area: string;
    latitude: number;
    longitude: number;
  };
  governmentReading?: EnvironmentalReading;
  satelliteReading?: EnvironmentalReading;
  citizenReports: CitizenReport[];
};

export type Hotspot = {
  location: FusionInput["location"];
  severity: Severity;
  confidence: number;
  isSatelliteEstimate: boolean;
  isSample: boolean;
  possibleContributors: string[];
  evidenceBasis: string[];
  satelliteEvidence?: {
    indicator: string;
    value: number | null;
    unit: string;
    source: string;
    measuredAt: string | null;
  };
  reportCount: number;
  status: "reported" | "verified" | "action-needed" | "resolved";
  recommendedAction?: string;
};