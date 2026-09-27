import type { GeographicHierarchy } from "@/lib/geography/types";
import type { PublicDataset } from "../public-data/provenance.ts";

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
  provenance?: PublicDataset["provenance"];
};

export type EnvironmentalSource =
  | "government"
  | "satellite"
  | "citizen"
  | "derived";

export type Severity =
  | "low"
  | "moderate"
  | "high"
  | "critical";

/**
 * Civic request categories supported by VayuNetra.
 *
 * The environmental categories are retained for backward compatibility
 * with existing reports and evidence pipelines.
 */
export type CivicCategory =
  // Existing environmental categories
  | "industrial"
  | "vehicular"
  | "burning"
  | "dust"
  | "air_pollution"
  | "water_pollution"
  | "waste"
  | "noise"

  // Broader civic-development categories
  | "roads"
  | "mobility"
  | "public_transport"
  | "water_supply"
  | "drainage_flooding"
  | "waste_sanitation"
  | "education"
  | "healthcare"
  | "connectivity"
  | "electricity"
  | "public_spaces"
  | "community_facilities"

  | "other";

export type CivicDomain =
  | "environment"
  | "infrastructure"
  | "mobility"
  | "utilities"
  | "sanitation"
  | "education"
  | "health"
  | "connectivity"
  | "public_spaces"
  | "community"
  | "other";

export type CitizenReport = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  category: CivicCategory;
  domain?: CivicDomain;
  severity: Severity;
  summary: string;
  reportedAt: string;
  language?: string;
  description?: string;
  possibleSources?: string[];
  recommendedAction?: string;
  confidence?: number | null;
  evidence?: Record<string, unknown>;
  geography?: GeographicHierarchy | null;
  status?: string;
};

export type FusionInput = {
  location: {
    city: string;
    area: string;
    latitude: number | null;
    longitude: number | null;
    geography?: GeographicHierarchy | null;
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
    provenance?: PublicDataset["provenance"];
  };
  reportCount: number;
  status: "reported" | "under_review" | "verified" | "action_needed" | "resolved" | "rejected";
  recommendedAction?: string;
};

export function isCivicCategory(
  value: unknown
): value is CivicCategory {
  return (
    typeof value === "string" &&
    [
      "industrial",
      "vehicular",
      "burning",
      "dust",
      "air_pollution",
      "water_pollution",
      "waste",
      "noise",
      "roads",
      "mobility",
      "public_transport",
      "water_supply",
      "drainage_flooding",
      "waste_sanitation",
      "education",
      "healthcare",
      "connectivity",
      "electricity",
      "public_spaces",
      "community_facilities",
      "other",
    ].includes(value)
  );
}
