import { createHash } from "node:crypto";
import { sanitizePublicWorkflowStatus } from "./review.ts";

type PublicReportInput = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  category: string;
  severity: string;
  reportedAt: string;
  status?: string;
  isSample?: boolean | null;
};

/**
 * Public report locations use a 0.1-degree grid (roughly 11 km north/south).
 * This intentionally trades street-level accuracy for broad-area visualization.
 */
export function coarseCoordinate(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

export function toPublicReport(report: PublicReportInput) {
  return {
    id: `public-${createHash("sha256").update(report.id).digest("hex").slice(0, 24)}`,
    latitude: coarseCoordinate(report.latitude),
    longitude: coarseCoordinate(report.longitude),
    category: report.category,
    severity: report.severity,
    status: sanitizePublicWorkflowStatus(report.status),
    reportedAt: report.reportedAt.slice(0, 10),
    isSample: typeof report.isSample === "boolean" ? report.isSample : null,
    summary: report.category.replaceAll("_", " "),
  };
}
