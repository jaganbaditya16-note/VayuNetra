import { NextResponse } from "next/server";
import { getReports } from "@/lib/reports/store";
import {
  buildDevelopmentPriority,
  rankDevelopmentPriorities,
} from "@/lib/priorities/engine";
import type { DevelopmentContext } from "@/lib/priorities/types";
import contextData from "@/data/development-context.json";
import { createHash } from "node:crypto";
import { coarseCoordinate } from "@/lib/reports/public";
import { isPriorityEligibleReport } from "@/lib/reports/analysis";
import {
  getIntegrityConfigurationError,
  getReportsPersistenceConfiguration,
} from "@/lib/reports/persistence-config";

type LocatedReport =
  Awaited<ReturnType<typeof getReports>>[number] & {
    latitude: number | null;
    longitude: number | null;
  };

function hasLocation(
  report: Awaited<ReturnType<typeof getReports>>[number],
): report is LocatedReport {
  const coordinates = typeof report.latitude === "number" &&
    typeof report.longitude === "number" &&
    Number.isFinite(report.latitude) &&
    Number.isFinite(report.longitude);
  const geography = report.geography && Array.isArray(report.geography.levels) && report.geography.levels.some((level) => level.identifier || level.name);
  return coordinates || Boolean(geography);
}

function distanceSquared(
  a: { latitude: number | null; longitude: number | null },
  b: { latitude: number | null; longitude: number | null },
) {
  if (typeof a.latitude !== "number" || typeof a.longitude !== "number" || typeof b.latitude !== "number" || typeof b.longitude !== "number") return Number.POSITIVE_INFINITY;
  const lat = a.latitude - b.latitude;
  const lon = a.longitude - b.longitude;

  return lat * lat + lon * lon;
}

function geographyKey(report: LocatedReport) {
  const hierarchy = report.geography;
  if (!hierarchy) return null;
  const level = [...hierarchy.levels].reverse().find((item) => item.identifier || item.name);
  return level ? `${hierarchy.countryCode}:${level.level}:${level.identifier ?? level.name}` : null;
}

function evidenceProfile(
  report: Awaited<ReturnType<typeof getReports>>[number],
) {
  const rawEvidence =
    report.evidence &&
    typeof report.evidence === "object"
      ? (report.evidence as Record<string, unknown>)
      : {};

  const confidence =
    typeof report.confidence === "number" &&
    Number.isFinite(report.confidence)
      ? Math.max(
          0,
          Math.min(1, report.confidence),
        )
      : 0.5;

  const environmentalEvidence =
    rawEvidence.environmentalEvidence &&
    typeof rawEvidence.environmentalEvidence ===
      "object"
      ? (rawEvidence.environmentalEvidence as Record<
          string,
          unknown
        >)
      : null;

  const hasSatelliteEvidence = Boolean(
    environmentalEvidence?.source === "Google Earth Engine / Sentinel-5P TROPOMI" &&
      environmentalEvidence.isSatelliteEstimate === true &&
      typeof environmentalEvidence.value === "number" && Number.isFinite(environmentalEvidence.value) &&
      typeof environmentalEvidence.measuredAt === "string" &&
      /^\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}$/.test(environmentalEvidence.measuredAt) &&
      Date.now() - new Date(`${environmentalEvidence.measuredAt.split(" to ")[1]}T23:59:59Z`).getTime() <= 30 * 24 * 60 * 60 * 1000,
  );

  return {
    confidence,
    hasSatelliteEvidence,
  };
}

export async function GET() {
  try {
    const integrityError = getIntegrityConfigurationError();
    if (integrityError) {
      return NextResponse.json({ success: false, error: integrityError }, { status: 503 });
    }
    const persistence = getReportsPersistenceConfiguration();
    if (persistence.mode === "error") {
      return NextResponse.json({ success: false, error: persistence.error }, { status: 503 });
    }

    const contexts = (contextData as DevelopmentContext[])
      .filter((context) => context.contextStatus === "verified" && context.freshness !== "stale");

    const trustedReports = (await getReports()).filter(isPriorityEligibleReport)
      .filter((report) => !["resolved", "rejected"].includes(report.status ?? "reported"));
    const seenIntegritySignatures = new Set<string>();
    const reports = trustedReports
      .filter((report) => {
        const evidence = report.evidence as Record<string, unknown>;
        const integrity = evidence.integrity as { signature?: unknown };
        if (typeof integrity.signature !== "string" || seenIntegritySignatures.has(integrity.signature)) {
          return false;
        }
        seenIntegritySignatures.add(integrity.signature);
        return true;
      })
      .filter(hasLocation);

    const groups: LocatedReport[][] = [];

    for (const report of reports) {
      const nearest = groups.find((group) => {
        const distance = distanceSquared(group[0], report);
        if (Number.isFinite(distance)) return distance <= 0.0004;
        const key = geographyKey(report);
        return key !== null && key === geographyKey(group[0]);
      });

      if (nearest) {
        nearest.push(report);
      } else {
        groups.push([report]);
      }
    }

    const priorities = groups.map((group) => {
      const first = group[0];

      const geographicContext = first.geography ? contexts.find((item) =>
        item.geography?.countryCode === first.geography?.countryCode && item.geography?.levels.some((contextLevel) =>
          first.geography?.levels.some((reportLevel) => reportLevel.level === contextLevel.level && reportLevel.identifier && reportLevel.identifier === contextLevel.identifier))) : undefined;
      const coordinateContext = !geographicContext && typeof first.latitude === "number" && typeof first.longitude === "number" && contexts.length ? contexts.reduce(
        (best, item) =>
          distanceSquared(
            item,
            first,
          ) <
          distanceSquared(
            best,
            first,
          )
            ? item
            : best,
      ) : undefined;
      const context = geographicContext ?? coordinateContext;

      const severityRank = {
        low: 1,
        moderate: 2,
        high: 3,
        critical: 4,
      };

      const worst = group.reduce(
        (value, report) =>
          severityRank[report.severity] >
          severityRank[value]
            ? report.severity
            : value,
        "low" as keyof typeof severityRank,
      );

      const evidenceProfiles =
        group.map(evidenceProfile);

      const averageConfidence =
        evidenceProfiles.reduce(
          (sum, item) =>
            sum + item.confidence,
          0,
        ) / evidenceProfiles.length;

      const satelliteCoverage =
        evidenceProfiles.filter(
          (item) =>
            item.hasSatelliteEvidence,
        ).length /
        evidenceProfiles.length;

      const evidenceConfidence =
        Math.min(
          0.98,
            averageConfidence +
            satelliteCoverage * 0.12,
        );

      const evidenceBasis = [
        "Citizen reports",
        "Geospatial demand cluster",
        `${Math.round(
          averageConfidence * 100,
        )}% average report confidence`,
        ...(satelliteCoverage > 0
          ? [
              `Satellite evidence on ${Math.round(
                satelliteCoverage * 100,
              )}% of reports`,
            ]
          : []),
      ];

      return buildDevelopmentPriority(
        {
          location: {
            city: context?.state ?? "Unspecified municipality",
            area: context?.name.replace(
              " demonstration context",
              "",
            ) ?? "Unspecified local area",
            latitude: first.latitude,
            longitude: first.longitude,
            geography: first.geography ?? null,
          },
          reportCount: group.length,
          confidence: evidenceConfidence,
          severity: worst,
          contributors: group.map(
            (report) => report.category,
          ),
          evidenceBasis,
          context,
        },
        contexts,
      );
    });

    return NextResponse.json({
      success: true,
      count: priorities.length,
      priorities: rankDevelopmentPriorities(priorities).map((priority, index) => ({
        ...priority,
        id: `priority-${createHash("sha256")
          .update(
            [
              priority.location.city,
              priority.location.area,
              coarseCoordinate(priority.location.latitude),
              coarseCoordinate(priority.location.longitude),
              priority.priorityScore,
              index,
            ].join("|"),
          )
          .digest("hex")
          .slice(0, 20)}`,
        location: {
          city: priority.location.city,
          area: priority.location.area,
          latitude: coarseCoordinate(priority.location.latitude),
          longitude: coarseCoordinate(priority.location.longitude),
        },
      })),
      contextDisclosure:
        "Demographic, infrastructure, and public-investment datasets are unavailable. Illustrative fixture values are excluded from these scores.",
    }, { headers: { "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=30" } });
  } catch (error) {
    console.error(
      "Development priority processing failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        priorities: [],
        error:
          "Priority processing temporarily unavailable.",
      },
      { status: 500 },
    );
  }
}
