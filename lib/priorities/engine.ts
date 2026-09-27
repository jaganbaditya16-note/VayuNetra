import type { DevelopmentContext, DevelopmentPriority, PriorityInput } from "./types.ts";

const CONTRIBUTOR_PROJECTS: Array<[string, string]> = [
  ["construction/dust", "Deploy dust-control and neighbourhood air-quality monitoring."],
  ["industrial activity", "Strengthen industrial-area monitoring and compliance inspection coverage."],
  ["traffic", "Assess traffic-management and roadside air-quality monitoring interventions."],
  ["open burning", "Strengthen waste collection and open-burning prevention coverage."],
  ["waste", "Improve waste collection, segregation and local disposal infrastructure."],
  ["noise", "Assess traffic/noise mitigation and community monitoring coverage."],
];

const STALE_CONTEXT_WEIGHT = 0.7;
const MAX_CONTEXT_DISTANCE_SQUARED = 4;

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function isTrustworthyContext(context: DevelopmentContext) {
  return context.contextStatus === "verified" &&
    context.freshness !== "unavailable" &&
    Boolean(context.measuredAt) &&
    Boolean(context.sourceUrl?.startsWith("https://")) &&
    context.sources.length > 0;
}

function nearestContext(input: PriorityInput, contexts: DevelopmentContext[]) {
  const countryCode = input.location.geography?.countryCode;
  const requestedIds = new Set((input.location.geography?.levels ?? [])
    .filter((level) => level.identifier)
    .map((level) => level.level + ":" + level.identifier));
  const geographicMatch = contexts.find((context) => isTrustworthyContext(context) &&
    context.geography?.countryCode === countryCode && context.geography?.levels.some((level) =>
      level.identifier && requestedIds.has(level.level + ":" + level.identifier)));
  if (geographicMatch) return geographicMatch;
  if (input.location.latitude === null || input.location.longitude === null) return undefined;
  let best: DevelopmentContext | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const context of contexts.filter((item) =>
    isTrustworthyContext(item) && (!countryCode || item.geography?.countryCode === countryCode),
  )) {
    const dLat = input.location.latitude - context.latitude;
    const dLon = input.location.longitude - context.longitude;
    const distance = dLat * dLat + dLon * dLon;

    if (distance < bestDistance) {
      bestDistance = distance;
      best = context;
    }
  }

  return bestDistance <= MAX_CONTEXT_DISTANCE_SQUARED ? best : undefined;
}

function projectFor(contributors: string[]) {
  for (const [key, project] of CONTRIBUTOR_PROJECTS) {
    if (contributors.some((value) => value.toLowerCase().includes(key))) {
      return project;
    }
  }

  return "Conduct a local needs assessment and connect the highest-confidence evidence cluster to the relevant public-service intervention.";
}

export function buildDevelopmentPriority(
  input: PriorityInput,
  contexts: DevelopmentContext[],
): DevelopmentPriority {
  const requestedContext = input.context;
  const context = requestedContext && isTrustworthyContext(requestedContext)
    ? requestedContext
    : nearestContext(input, contexts);
  const contextWeight = context?.freshness === "stale" ? STALE_CONTEXT_WEIGHT : context ? 1 : 0;

  const demandSignal = clamp(
    Math.min(input.reportCount / 10, 1) * 0.7 +
      (input.severity === "critical" ? 0.3 : input.severity === "high" ? 0.2 : input.severity === "moderate" ? 0.1 : 0),
  );

  const evidenceStrength = clamp(input.confidence);
  const infrastructureGap = (context?.infrastructureGap ?? 0) * contextWeight;
  const populationExposure = (context?.populationExposure ?? 0) * contextWeight;
  const investmentAlignment = (context?.investmentAlignment ?? 0) * contextWeight;
  const inclusionNeed = (context?.inclusionNeed ?? 0) * contextWeight;

  // The score is deliberately transparent: AI structures the demand; this
  // deterministic layer prevents an LLM from silently inventing a priority.
  const demandWeight = context ? 0.25 : 0.5;
  const evidenceWeight = context ? 0.25 : 0.5;
  const priorityScore = Math.round(100 * clamp(
    demandSignal * demandWeight + evidenceStrength * evidenceWeight +
    infrastructureGap * (context ? 0.2 : 0) +
    populationExposure * (context ? 0.15 : 0) +
    investmentAlignment * (context ? 0.1 : 0) +
    inclusionNeed * (context ? 0.05 : 0),
  ));

  const priorityBand =
    priorityScore >= 80
      ? "urgent"
      : priorityScore >= 65
        ? "high"
        : priorityScore >= 45
          ? "emerging"
          : "monitor";

  const rationale = [
    input.reportCount + " located citizen report" + (input.reportCount === 1 ? "" : "s") + " currently support this demand cluster.",
    "Evidence strength is " + Math.round(evidenceStrength * 100) + "% from the current evidence pipeline.",
    ...(context
      ? [
          "Infrastructure-gap signal is " + Math.round(infrastructureGap * 100) + "% from verified " + (context.freshness === "stale" ? "but stale" : "fresh") + " context.",
          "Population-exposure signal is " + Math.round(populationExposure * 100) + "% from the available demographic baseline.",
          "Investment-alignment signal is " + Math.round(investmentAlignment * 100) + "% from verified planning context.",
          ...(context.freshness === "stale"
            ? ["Official context is cached at an older measurement period; contextual signals are discounted to " + Math.round(STALE_CONTEXT_WEIGHT * 100) + "% weight."]
            : []),
        ]
      : ["Infrastructure, demographic, and planning context are unavailable and do not affect this score."]),
  ];

  const evidenceBasis = [
    ...input.evidenceBasis,
    ...(context ? [
      "Context: " + context.name + ", " + context.state,
      ...(context.dataNotes ?? []),
    ] : []),
  ];

  return {
    id: "priority-" + input.location.latitude + "-" + input.location.longitude,
    location: input.location,
    priorityBand,
    priorityScore,
    demandSignal: Number(demandSignal.toFixed(2)),
    evidenceStrength: Number(evidenceStrength.toFixed(2)),
    infrastructureGap: Number(infrastructureGap.toFixed(2)),
    populationExposure: Number(populationExposure.toFixed(2)),
    investmentAlignment: Number(investmentAlignment.toFixed(2)),
    inclusionNeed: Number(inclusionNeed.toFixed(2)),
    recommendedProject: projectFor(input.contributors),
    rationale,
    evidenceBasis,
    dataQuality: context?.freshness === "fresh" ? "verified" : context ? "mixed" : "unavailable",
    contextSources: context?.sources ?? [],
  };
}

export function rankDevelopmentPriorities(items: DevelopmentPriority[]) {
  return [...items].sort((a, b) => b.priorityScore - a.priorityScore);
}
