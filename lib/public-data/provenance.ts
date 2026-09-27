export type FreshnessStatus = "fresh" | "stale" | "unavailable";
export type VerificationStatus = "verified" | "unverified" | "illustrative" | "unavailable";
export type DataDelivery = "live" | "cached" | "illustrative" | "unavailable";

export type PublicDataset<T = unknown> = {
  value: T | null;
  provenance: {
    publisher: string | null;
    sourceUrl: string | null;
    retrievedAt: string | null;
    measuredAt: string | null;
    geographicLevel: string | null;
    geographyId: string | null;
    geographyName: string | null;
    freshness: FreshnessStatus;
    verification: VerificationStatus;
    delivery: DataDelivery;
  };
};

export function validatePublicDataset(value: unknown): value is PublicDataset {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const dataset = value as Record<string, unknown>;
  if (!Object.hasOwn(dataset, "value") || !dataset.provenance || typeof dataset.provenance !== "object") return false;
  const provenance = dataset.provenance as Record<string, unknown>;
  const enums: Record<string, readonly string[]> = {
    freshness: ["fresh", "stale", "unavailable"],
    verification: ["verified", "unverified", "illustrative", "unavailable"],
    delivery: ["live", "cached", "illustrative", "unavailable"],
  };
  for (const [field, allowed] of Object.entries(enums)) {
    if (!allowed.includes(String(provenance[field]))) return false;
  }
  for (const field of ["publisher", "sourceUrl", "retrievedAt", "measuredAt", "geographicLevel", "geographyId", "geographyName"]) {
    const entry = provenance[field];
    if (entry !== null && typeof entry !== "string") return false;
  }
  if (provenance.sourceUrl !== null) {
    try {
      if (new URL(String(provenance.sourceUrl)).protocol !== "https:") return false;
    } catch { return false; }
  }
  if (provenance.verification === "verified" && (!provenance.publisher || !provenance.sourceUrl || !provenance.measuredAt)) return false;
  if (provenance.verification === "illustrative" && provenance.delivery !== "illustrative") return false;
  if (provenance.delivery === "unavailable" && dataset.value !== null) return false;
  return true;
}

export function unavailableDataset<T = never>(): PublicDataset<T> {
  return { value: null, provenance: {
    publisher: null, sourceUrl: null, retrievedAt: null, measuredAt: null,
    geographicLevel: null, geographyId: null, geographyName: null,
    freshness: "unavailable", verification: "unavailable", delivery: "unavailable",
  } };
}

export function illustrativeDataset<T>(value: T, label: string): PublicDataset<T> {
  return { value, provenance: {
    publisher: "VayuNetra prototype fixture", sourceUrl: null, retrievedAt: null,
    measuredAt: null, geographicLevel: null, geographyId: null, geographyName: label,
    freshness: "unavailable", verification: "illustrative", delivery: "illustrative",
  } };
}

export function isPriorityTrustworthy(dataset: PublicDataset): boolean {
  return validatePublicDataset(dataset) && dataset.value !== null &&
    dataset.provenance.verification === "verified" &&
    dataset.provenance.freshness === "fresh" &&
    (dataset.provenance.delivery === "live" || dataset.provenance.delivery === "cached");
}
