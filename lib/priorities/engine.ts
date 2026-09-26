import type { DevelopmentContext, DevelopmentPriority, PriorityInput } from "./types";

const CONTRIBUTOR_PROJECTS: Array<[string, string]> = [
  ["construction/dust", "Deploy dust-control and neighbourhood air-quality monitoring."],
  ["industrial activity", "Strengthen industrial-area monitoring and compliance inspection coverage."],
  ["traffic", "Assess traffic-management and roadside air-quality monitoring interventions."],
  ["open burning", "Strengthen waste collection and open-burning prevention coverage."],
  ["waste", "Improve waste collection, segregation and local disposal infrastructure."],
  ["noise", "Assess traffic/noise mitigation and community monitoring coverage."],
];

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function nearestContext(input: PriorityInput, contexts: DevelopmentContext[]) {
  let best: DevelopmentContext | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const context of contexts) {
    const dLat = input.location.latitude - context.latitude;
    const dLon = input.location.longitude - context.longitude;
    const distance = dLat * dLat + dLon * dLon;

    if (distance < bestDistance) {
      bestDistance = distance;
      best = context;
    }
  }

  return best;
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
  const context = input.context ?? nearestContext(input, contexts);

  const demandSignal = clamp(
    Math.min(input.reportCount / 10, 1) * 0.7 +
      (input.severity === "critical" ? 0.3 : input.severity === "high" ? 0.2 : input.severity === "moderate" ? 0.1 : 0),
  );

  const evidenceStrength = clamp(input.confidence);
  const infrastructureGap = context?.infrastructureGap ?? 0.5;
  const populationExposure = context?.populationExposure ?? 0.5;
  const investmentAlignment = context?.investmentAlignment ?? 0.5;
  const inclusionNeed = context?.inclusionNeed ?? 0.5;

  // The score is deliberately transparent: AI structures the demand; this
  // deterministic layer prevents an LLM from silently inventing a priority.
  const priorityScore = Math.round(
    100 *
      clamp(
        demandSignal * 0.25 +
          evidenceStrength * 0.25 +
          infrastructureGap * 0.2 +
          populationExposure * 0.15 +
          investmentAlignment * 0.1 +
          inclusionNeed * 0.05,
      ),
  );

  const priorityBand =
    priorityScore >= 80
      ? "urgent"
      : priorityScore >= 65
        ? "high"
        : priorityScore >= 45
          ? "emerging"
          : "monitor";

  const rationale = [
    `${input.reportCount} located citizen report${input.reportCount === 1 ? "" : "s"} currently support this demand cluster.`,
    `Evidence strength is ${Math.round(evidenceStrength * 100)}% from the current evidence pipeline.`,
    `Infrastructure-gap signal is ${Math.round(infrastructureGap * 100)}% in the available context layer.`,
    `Population-exposure signal is ${Math.round(populationExposure * 100)}% in the available context layer.`,
    `Investment-alignment signal is ${Math.round(investmentAlignment * 100)}% against the available planning context.`,
  ];

  const evidenceBasis = [
    ...input.evidenceBasis,
    ...(context ? [`Context: ${context.name}, ${context.state}`] : []),
  ];

  return {
    id: `priority-${input.location.latitude}-${input.location.longitude}`,
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
    dataQuality: context?.contextStatus === "verified" ? "verified" : "illustrative",
    contextSources: context?.sources ?? [],
  };
}

export function rankDevelopmentPriorities(items: DevelopmentPriority[]) {
  return [...items].sort((a, b) => b.priorityScore - a.priorityScore);
}
