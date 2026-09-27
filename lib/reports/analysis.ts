import { createHmac, timingSafeEqual } from "node:crypto";

export const REPORT_CATEGORIES = [
  // Existing environmental categories
  "industrial",
  "vehicular",
  "burning",
  "dust",
  "air_pollution",
  "water_pollution",
  "waste",
  "noise",

  // Broader civic-development categories
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
] as const;

export const REPORT_SEVERITIES = [
  "low",
  "moderate",
  "high",
  "critical",
] as const;

export type ReportCategory =
  (typeof REPORT_CATEGORIES)[number];

export type ReportSeverity =
  (typeof REPORT_SEVERITIES)[number];

export type AnalysisProvider =
  | "gemini"
  | "local-fallback";

export type ValidatedAnalysis = {
  category: ReportCategory;
  severity: ReportSeverity;
  confidence: number;
  summary: string;
  possibleSources: string[];
  recommendedAction: string;
  provider: AnalysisProvider;
  source:
    | "gemini-api"
    | "deterministic-rules";
};

const hasOnlyKeys = (
  value: Record<string, unknown>,
  keys: string[],
) =>
  Object.keys(value).every((key) =>
    keys.includes(key),
  );

function boundedText(
  value: unknown,
  maxLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

export function validateAnalysis(
  value: unknown,
): ValidatedAnalysis {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Analysis must be an object.",
    );
  }

  const candidate =
    value as Record<string, unknown>;

  const allowedKeys = [
    "category",
    "severity",
    "confidence",
    "summary",
    "possibleSources",
    "recommendedAction",
    "provider",
    "source",
  ];

  if (
    !hasOnlyKeys(
      candidate,
      allowedKeys,
    )
  ) {
    throw new Error(
      "Analysis contains unsupported fields.",
    );
  }

  if (
    !(
      REPORT_CATEGORIES as readonly unknown[]
    ).includes(candidate.category)
  ) {
    throw new Error(
      "Analysis category is invalid.",
    );
  }

  if (
    !(
      REPORT_SEVERITIES as readonly unknown[]
    ).includes(candidate.severity)
  ) {
    throw new Error(
      "Analysis severity is invalid.",
    );
  }

  if (
    typeof candidate.confidence !==
      "number" ||
    !Number.isFinite(
      candidate.confidence,
    ) ||
    candidate.confidence < 0 ||
    candidate.confidence > 1
  ) {
    throw new Error(
      "Analysis confidence must be between 0 and 1.",
    );
  }

  if (
    !boundedText(
      candidate.summary,
      500,
    )
  ) {
    throw new Error(
      "Analysis summary is invalid.",
    );
  }

  if (
    !Array.isArray(
      candidate.possibleSources,
    ) ||
    candidate.possibleSources.length > 5 ||
    !candidate.possibleSources.every(
      (item) =>
        boundedText(item, 160),
    )
  ) {
    throw new Error(
      "Analysis possible sources are invalid.",
    );
  }

  if (
    !boundedText(
      candidate.recommendedAction,
      500,
    )
  ) {
    throw new Error(
      "Analysis recommended action is invalid.",
    );
  }

  if (
    (
      candidate.provider !==
        "gemini" &&
      candidate.provider !==
        "local-fallback"
    ) ||
    (
      candidate.source !==
        "gemini-api" &&
      candidate.source !==
        "deterministic-rules"
    ) ||
    (
      candidate.provider ===
        "gemini" &&
      candidate.source !==
        "gemini-api"
    ) ||
    (
      candidate.provider ===
        "local-fallback" &&
      candidate.source !==
        "deterministic-rules"
    )
  ) {
    throw new Error(
      "Analysis provider metadata is invalid.",
    );
  }

  return {
    category:
      candidate.category as ReportCategory,
    severity:
      candidate.severity as ReportSeverity,
    confidence:
      candidate.confidence,
    summary:
      candidate.summary.trim(),
    possibleSources:
      candidate.possibleSources.map(
        (item) => item.trim(),
      ),
    recommendedAction:
      candidate.recommendedAction.trim(),
    provider:
      candidate.provider,
    source:
      candidate.source,
  };
}

export type ValidatedEnvironmentalEvidence = {
  value: number | null;
  unit: string;
  indicator: string;
  source: string;
  measuredAt: string;
  isSatelliteEstimate: boolean;
};

export function validateEnvironmentalEvidence(
  value: unknown,
): ValidatedEnvironmentalEvidence | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Environmental evidence must be an object.",
    );
  }

  const item =
    value as Record<string, unknown>;

  if (
    !hasOnlyKeys(item, [
      "value",
      "unit",
      "indicator",
      "source",
      "measuredAt",
      "isSatelliteEstimate",
    ]) ||
    !(
      item.value === null ||
      (
        typeof item.value ===
          "number" &&
        Number.isFinite(item.value)
      )
    ) ||
    !boundedText(item.unit, 80) ||
    !boundedText(
      item.indicator,
      120,
    ) ||
    !boundedText(item.source, 120) ||
    !boundedText(
      item.measuredAt,
      64,
    ) ||
    !Number.isFinite(
      Date.parse(item.measuredAt),
    ) ||
    item.isSatelliteEstimate !== true
  ) {
    throw new Error(
      "Environmental evidence is malformed.",
    );
  }

  return {
    value:
      item.value as number | null,
    unit: item.unit.trim(),
    indicator:
      item.indicator.trim(),
    source:
      item.source.trim(),
    measuredAt:
      item.measuredAt,
    isSatelliteEstimate: true,
  };
}

export function makeFallbackAnalysis(
  description: string,
): ValidatedAnalysis {
  const text =
    description.toLowerCase();

  let category: ReportCategory =
    "other";

  let severity: ReportSeverity =
    "moderate";

  let recommendedAction =
    "Review the citizen report and consider the appropriate local authority or community response.";

  // Environmental categories
  if (
    text.includes("smoke") ||
    text.includes("burn") ||
    text.includes("open fire")
  ) {
    category = "burning";
    recommendedAction =
      "Verify the reported smoke or burning source and consider appropriate local mitigation.";
  } else if (
    text.includes("dust") ||
    text.includes("construction")
  ) {
    category = "dust";
    recommendedAction =
      "Inspect the reported area and consider dust-control measures.";
  } else if (
    text.includes("traffic") ||
    text.includes("vehicle") ||
    text.includes("emission")
  ) {
    category = "vehicular";
    recommendedAction =
      "Review traffic conditions and consider inspection of nearby emission sources.";
  } else if (
    text.includes("factory") ||
    text.includes("industrial")
  ) {
    category = "industrial";
    recommendedAction =
      "Review the nearby industrial area for possible environmental concerns.";
  } else if (
    text.includes("garbage") ||
    text.includes("litter")
  ) {
    category = "waste";
    recommendedAction =
      "Inspect the reported waste location and arrange appropriate collection.";
  } else if (
    text.includes("water pollution") ||
    text.includes("dirty water") ||
    text.includes("contaminated water")
  ) {
    category = "water_pollution";
    recommendedAction =
      "Inspect the reported water source and consider appropriate water-quality verification.";
  } else if (
    text.includes("noise") ||
    text.includes("loudspeaker") ||
    text.includes("loud music")
  ) {
    category = "noise";
    recommendedAction =
      "Review the reported noise source and consider the applicable local response.";
  }

  // Civic-development categories
  else if (
    text.includes("pothole") ||
    text.includes("road damage") ||
    text.includes("broken road") ||
    text.includes("road repair")
  ) {
    category = "roads";
    recommendedAction =
      "Inspect the reported road condition and consider repair or maintenance.";
  } else if (
    text.includes("bus") ||
    text.includes("bus stop") ||
    text.includes("public transport") ||
    text.includes("transport")
  ) {
    category = "public_transport";
    recommendedAction =
      "Review the reported public-transport gap and consider the relevant service or infrastructure response.";
  } else if (
    text.includes("traffic jam") ||
    text.includes("congestion") ||
    text.includes("footpath") ||
    text.includes("sidewalk")
  ) {
    category = "mobility";
    recommendedAction =
      "Review the reported mobility problem and assess appropriate traffic, pedestrian, or access improvements.";
  } else if (
    text.includes("water supply") ||
    text.includes("no water") ||
    text.includes("water shortage")
  ) {
    category = "water_supply";
    recommendedAction =
      "Verify the reported water-supply issue and assess the appropriate utility response.";
  } else if (
    text.includes("flood") ||
    text.includes("flooding") ||
    text.includes("drain") ||
    text.includes("waterlogging")
  ) {
    category = "drainage_flooding";
    recommendedAction =
      "Inspect the reported drainage or flooding location and consider immediate maintenance or mitigation.";
  } else if (
    text.includes("sanitation") ||
    text.includes("sewage") ||
    text.includes("toilet")
  ) {
    category = "waste_sanitation";
    recommendedAction =
      "Review the reported sanitation issue and coordinate the appropriate local service response.";
  } else if (
    text.includes("school") ||
    text.includes("classroom") ||
    text.includes("education")
  ) {
    category = "education";
    recommendedAction =
      "Review the reported education infrastructure or service gap with the relevant authority.";
  } else if (
    text.includes("hospital") ||
    text.includes("clinic") ||
    text.includes("healthcare") ||
    text.includes("health center")
  ) {
    category = "healthcare";
    recommendedAction =
      "Review the reported healthcare access or facility issue with the relevant authority.";
  } else if (
    text.includes("internet") ||
    text.includes("network") ||
    text.includes("mobile signal") ||
    text.includes("connectivity")
  ) {
    category = "connectivity";
    recommendedAction =
      "Review the reported connectivity gap and assess the relevant infrastructure or service response.";
  } else if (
    text.includes("power cut") ||
    text.includes("electricity") ||
    text.includes("street light")
  ) {
    category = "electricity";
    recommendedAction =
      "Verify the reported electricity or public-lighting issue and consider the relevant utility response.";
  } else if (
    text.includes("park") ||
    text.includes("playground") ||
    text.includes("public space")
  ) {
    category = "public_spaces";
    recommendedAction =
      "Inspect the reported public-space condition and consider maintenance or improvement.";
  } else if (
    text.includes("community center") ||
    text.includes("community hall") ||
    text.includes("community facility")
  ) {
    category =
      "community_facilities";
    recommendedAction =
      "Review the reported community-facility gap and assess the appropriate local development response.";
  }

  if (
    text.includes("critical") ||
    text.includes("dangerous") ||
    text.includes("emergency") ||
    text.includes("unbearable")
  ) {
    severity = "high";
  }

  return validateAnalysis({
    category,
    severity,
    confidence: 0.55,
    summary:
      description.trim().slice(0, 500),
    possibleSources: [
      "Citizen-reported signal; requires verification",
    ],
    recommendedAction,
    provider: "local-fallback",
    source: "deterministic-rules",
  });
}

function canonicalJson(
  value: unknown,
): string {
  if (Array.isArray(value)) {
    return `[${value
      .map(canonicalJson)
      .join(",")}]`;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const record =
      value as Record<
        string,
        unknown
      >;

    return `{${Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(
            key,
          )}:${canonicalJson(
            record[key],
          )}`,
      )
      .join(",")}}`;
  }

  return (
    JSON.stringify(value) ??
    "null"
  );
}

/**
 * Non-production placeholder used only when neither
 * `VAYUNETRA_INTEGRITY_SECRET` nor `GEMINI_API_KEY` is configured.
 *
 * Without it a fresh `npm run dev` signs nothing, so every local report is
 * stored unsigned and is then excluded from hotspots and priorities. That
 * makes the application look broken locally even though it is behaving exactly
 * as designed. Production never reaches this branch: the placeholder is only
 * consulted outside `NODE_ENV === "production"`, and
 * `getIntegrityConfigurationError` fails production outright when the
 * dedicated secret is absent.
 */
const DEVELOPMENT_INTEGRITY_SECRET =
  "vayunetra-development-only-integrity-secret";

/**
 * Reports whether the active integrity secret is the shared non-production
 * placeholder, so `/api/health` can surface that local signatures carry no
 * real weight.
 */
export function usesDevelopmentIntegrityFallback(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV === "production") {
    return false;
  }

  return !(
    env.VAYUNETRA_INTEGRITY_SECRET?.trim() ||
    env.GEMINI_API_KEY?.trim()
  );
}

function getIntegritySecret(): string {
  const configured =
    process.env
      .VAYUNETRA_INTEGRITY_SECRET
      ?.trim() ?? "";

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    // Production never falls back to any other value.
    return configured;
  }

  return (
    configured ||
    process.env.GEMINI_API_KEY?.trim() ||
    DEVELOPMENT_INTEGRITY_SECRET
  );
}

function reportIntegrityPayload(
  report: Record<string, unknown>,
  version = 2,
) {
  const evidence =
    report.evidence &&
    typeof report.evidence ===
      "object" &&
    !Array.isArray(
      report.evidence,
    )
      ? {
          ...(report.evidence as Record<
            string,
            unknown
          >),
        }
      : {};

  delete evidence.integrity;

  const payload: Record<string, unknown> = {
    latitude:
      report.latitude ?? null,
    longitude:
      report.longitude ?? null,
    category:
      report.category,
    severity:
      report.severity,
    summary:
      report.summary,
    language:
      report.language,
    description:
      report.description,
    possibleSources:
      report.possibleSources ?? [],
    recommendedAction:
      report.recommendedAction ??
      null,
    confidence:
      report.confidence,
    evidence,
  };
  if (version >= 2) payload.geography = report.geography ?? null;
  return canonicalJson(payload);
}

export function createReportIntegrity(
  report: Record<string, unknown>,
  version: 1 | 2 = 2,
) {
  const secret =
    getIntegritySecret();

  const signature = secret
    ? createHmac("sha256", secret)
        .update(
          reportIntegrityPayload(
            report,
            version,
          ),
        )
        .digest("hex")
    : null;

  return {
    version,
    validated:
      signature !== null,
    signature,
  };
}

export function isPriorityEligibleReport(
  report: unknown,
): boolean {
  if (
    !report ||
    typeof report !== "object" ||
    Array.isArray(report)
  ) {
    return false;
  }

  const candidate =
    report as Record<
      string,
      unknown
    >;

  const evidence =
    candidate.evidence;

  if (
    !evidence ||
    typeof evidence !==
      "object" ||
    Array.isArray(evidence)
  ) {
    return false;
  }

  const integrity =
    (
      evidence as {
        integrity?: unknown;
      }
    ).integrity;

  if (
    !integrity ||
    typeof integrity !==
      "object"
  ) {
    return false;
  }

  const marker =
    integrity as {
      version?: unknown;
      validated?: unknown;
      signature?: unknown;
    };

  const secret =
    getIntegritySecret();

  if (
    ![1, 2].includes(Number(marker.version)) ||
    marker.validated !== true ||
    !secret ||
    typeof marker.signature !==
      "string"
  ) {
    return false;
  }

  const expected =
    createHmac("sha256", secret)
      .update(
        reportIntegrityPayload(candidate, Number(marker.version)),
      )
      .digest();

  let provided: Buffer;

  try {
    provided = Buffer.from(
      marker.signature,
      "hex",
    );
  } catch {
    return false;
  }

  return (
    provided.length ===
      expected.length &&
    timingSafeEqual(
      provided,
      expected,
    )
  );
}
