import { NextResponse } from "next/server";
import { getReports } from "@/lib/reports/store";
import { buildDevelopmentPriority, rankDevelopmentPriorities } from "@/lib/priorities/engine";
import type { DevelopmentContext } from "@/lib/priorities/types";
import contextData from "@/data/development-context.json";

type LocatedReport = ReturnType<typeof getReports>[number] & {
  latitude: number;
  longitude: number;
};

function hasLocation(report: ReturnType<typeof getReports>[number]): report is LocatedReport {
  return (
    typeof report.latitude === "number" &&
    typeof report.longitude === "number" &&
    Number.isFinite(report.latitude) &&
    Number.isFinite(report.longitude)
  );
}

function distanceSquared(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const lat = a.latitude - b.latitude;
  const lon = a.longitude - b.longitude;
  return lat * lat + lon * lon;
}

export async function GET() {
  try {
    const contexts = contextData as DevelopmentContext[];
    const reports = getReports().filter(hasLocation);

    const groups: LocatedReport[][] = [];

    for (const report of reports) {
      const nearest = groups.find((group) =>
        distanceSquared(group[0], report) <= 0.0004,
      );

      if (nearest) nearest.push(report);
      else groups.push([report]);
    }

    const priorities = groups.map((group) => {
      const first = group[0];
      const context = contexts.reduce((best, item) =>
        distanceSquared(item, first) < distanceSquared(best, first) ? item : best,
      );

      const severityRank = { low: 1, moderate: 2, high: 3, critical: 4 };
      const worst = group.reduce((value, report) =>
        severityRank[report.severity] > severityRank[value] ? report.severity : value,
        "low" as keyof typeof severityRank,
      );

      return buildDevelopmentPriority({
        location: {
          city: context.state,
          area: context.name.replace(" demonstration context", ""),
          latitude: first.latitude,
          longitude: first.longitude,
        },
        reportCount: group.length,
        confidence: Math.min(0.98, 0.45 + Math.min(group.length / 20, 0.25) + (worst === "critical" ? 0.2 : worst === "high" ? 0.15 : 0.1)),
        severity: worst,
        contributors: group.map((report) => report.category),
        evidenceBasis: ["Citizen reports", "Geospatial demand cluster"],
        context,
      }, contexts);
    });

    return NextResponse.json({
      success: true,
      count: priorities.length,
      priorities: rankDevelopmentPriorities(priorities),
      contextDisclosure: "Prototype context scores are illustrative and must be replaced by verified public datasets before operational use.",
    });
  } catch (error) {
    console.error("Development priority processing failed:", error);
    return NextResponse.json(
      { success: false, priorities: [], error: "Priority processing temporarily unavailable." },
      { status: 500 },
    );
  }
}
