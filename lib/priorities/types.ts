import type { GeographicHierarchy } from "../geography/types.ts";

export type DevelopmentContext = {
  id: string;
  name: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  populationExposure: number;
  infrastructureGap: number;
  investmentAlignment: number;
  inclusionNeed: number;
  existingServices: string[];
  plannedPrograms: string[];
  contextStatus: "illustrative" | "verified";
  sources: string[];
  geography?: GeographicHierarchy | null;
  sourceUrl?: string | null;
  measuredAt?: string | null;
  geographyId?: string | null;
  geographicLevel?: string | null;
  freshness?: "fresh" | "stale" | "unavailable";
  dataNotes?: string[];
};

export type PriorityInput = {
  location: {
    city: string;
    area: string;
    latitude: number | null;
    longitude: number | null;
    geography?: GeographicHierarchy | null;
  };
  reportCount: number;
  confidence: number;
  severity: string;
  contributors: string[];
  evidenceBasis: string[];
  context?: DevelopmentContext;
};

export type DevelopmentPriority = {
  id: string;
  location: PriorityInput["location"];
  priorityBand: "monitor" | "emerging" | "high" | "urgent";
  priorityScore: number;
  demandSignal: number;
  evidenceStrength: number;
  infrastructureGap: number;
  populationExposure: number;
  investmentAlignment: number;
  inclusionNeed: number;
  recommendedProject: string;
  rationale: string[];
  evidenceBasis: string[];
  dataQuality: "illustrative" | "mixed" | "verified" | "unavailable";
  contextSources: string[];
};
