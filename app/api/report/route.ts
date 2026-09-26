import { NextResponse } from "next/server";
import { addReport, getReports } from "@/lib/reports/store";
import type { Severity } from "@/lib/environmental/types";

const VALID_CATEGORIES = new Set([
  "industrial",
  "vehicular",
  "burning",
  "dust",
  "air_pollution",
  "water_pollution",
  "waste",
  "noise",
  "other",
]);

const VALID_SEVERITIES = new Set([
  "low",
  "moderate",
  "high",
  "critical",
]);

export async function GET() {
  try {
    const reports = getReports();

    return NextResponse.json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load reports." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      description,
      language,
      location,
      analysis,
    } = body;

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: "Report description is required." },
        { status: 400 }
      );
    }

    const latitude =
      typeof location?.latitude === "number" &&
      Number.isFinite(location.latitude)
        ? location.latitude
        : null;

    const longitude =
      typeof location?.longitude === "number" &&
      Number.isFinite(location.longitude)
        ? location.longitude
        : null;

    const category =
      typeof analysis?.category === "string" &&
      VALID_CATEGORIES.has(analysis.category)
        ? analysis.category
        : "other";

    const severity =
      typeof analysis?.severity === "string" &&
      VALID_SEVERITIES.has(analysis.severity)
        ? (analysis.severity as Severity)
        : "moderate";

    const report = addReport({
      id: `report-${Date.now()}`,
      latitude,
      longitude,
      category,
      severity,
      summary:
        typeof analysis?.summary === "string" && analysis.summary.trim()
          ? analysis.summary.trim()
          : description.trim(),
      reportedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Environmental report received.",
      report: {
        ...report,
        language: language || "English",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}
