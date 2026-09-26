import type {
  FusionInput,
  Hotspot,
  Severity,
  CitizenReport,
  EnvironmentalReading,
} from "./types";

const SEVERITY_RANK: Record<Severity, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

const WEIGHTS = {
  base: 0.05,
  government: 0.45,
  satellite: 0.2,
  citizenMax: 0.25,
  citizenSaturationCount: 30,
};

const CATEGORY_TO_CONTRIBUTOR: Record<string, string> = {
  industrial: "industrial activity",
  vehicular: "traffic",
  burning: "open burning",
  dust: "construction/dust",
  air_pollution: "general air pollution",
  other: "unspecified local source",
};

function aqiToSeverity(aqi: number): Severity {
  if (aqi > 300) return "critical";
  if (aqi > 200) return "high";
  if (aqi > 100) return "moderate";
  return "low";
}

function worstReportSeverity(reports: CitizenReport[]): Severity {
  return reports.reduce<Severity>((worst, report) => {
    return SEVERITY_RANK[report.severity] > SEVERITY_RANK[worst]
      ? report.severity
      : worst;
  }, "low");
}

function readingSeverity(
  reading?: EnvironmentalReading
): Severity | undefined {
  if (!reading || typeof reading.aqi !== "number") return undefined;
  return aqiToSeverity(reading.aqi);
}

function hasValidLocation(
  report: CitizenReport
): report is CitizenReport & {
  latitude: number;
  longitude: number;
} {
  return (
    typeof report.latitude === "number" &&
    typeof report.longitude === "number" &&
    Number.isFinite(report.latitude) &&
    Number.isFinite(report.longitude) &&
    !(report.latitude === 0 && report.longitude === 0)
  );
}

export function fuseEvidence(input: FusionInput): Hotspot {
  const {
    location,
    governmentReading,
    satelliteReading,
  } = input;

  const citizenReports = input.citizenReports.filter(hasValidLocation);

  const hasGovernment = !!governmentReading;
  const hasSatellite = !!satelliteReading;
  const reportCount = citizenReports.length;

  const citizenWeight =
    WEIGHTS.citizenMax *
    Math.min(reportCount / WEIGHTS.citizenSaturationCount, 1);

  let confidence =
    WEIGHTS.base +
    (hasGovernment ? WEIGHTS.government : 0) +
    (hasSatellite ? WEIGHTS.satellite : 0) +
    citizenWeight;

  confidence = Math.min(confidence, 0.98);

  let severity: Severity =
    readingSeverity(governmentReading) ??
    (reportCount ? worstReportSeverity(citizenReports) : "low");

  if (reportCount) {
    const reportSeverity = worstReportSeverity(citizenReports);

    if (SEVERITY_RANK[reportSeverity] > SEVERITY_RANK[severity]) {
      severity = reportSeverity;
      confidence = Math.min(confidence + 0.05, 0.98);
    }
  }

  const evidenceBasis: string[] = [];

  if (governmentReading) {
    evidenceBasis.push(
      `Government station reading${
        governmentReading.aqi !== null
          ? ` (AQI ${governmentReading.aqi})`
          : ""
      }`
    );
  }

  if (satelliteReading) {
    const satelliteValue =
      typeof satelliteReading.indicatorValue === "number"
        ? satelliteReading.indicatorValue.toExponential(3)
        : null;

    evidenceBasis.push(
      satelliteValue
        ? `Satellite NO₂ indicator (${satelliteValue} mol/m²)`
        : "Satellite-derived environmental indicator"
    );
  }

  if (reportCount) {
    evidenceBasis.push(
      `${reportCount} citizen report${reportCount > 1 ? "s" : ""}`
    );
  }

  if (!evidenceBasis.length) {
    evidenceBasis.push("No evidence available for this location");
  }

  const possibleContributors = Array.from(
    new Set(
      citizenReports
        .map(
          (report) =>
            CATEGORY_TO_CONTRIBUTOR[report.category] ?? report.category
        )
        .filter(Boolean)
    )
  );

  return {
    location,
    severity,
    confidence: Number(confidence.toFixed(2)),
    isSatelliteEstimate: !hasGovernment && hasSatellite,
    isSample: false,
    possibleContributors,
    evidenceBasis,
    satelliteEvidence: satelliteReading ? {
      indicator: satelliteReading.category ?? "tropospheric_NO2_column_number_density",
      value: satelliteReading.indicatorValue ?? null,
      unit: "mol/m²",
      source: satelliteReading.source,
      measuredAt: satelliteReading.measuredAt,
    } : undefined,
    reportCount,
    status: "reported",
  };
}

export function rankHotspots(hotspots: Hotspot[]): Hotspot[] {
  return [...hotspots].sort((a, b) => {
    const severityDifference =
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];

    if (severityDifference !== 0) {
      return severityDifference;
    }

    return b.confidence - a.confidence;
  });
}
