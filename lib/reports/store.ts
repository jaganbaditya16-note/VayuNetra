import fs from "fs";
import path from "path";
import type { CitizenReport } from "@/lib/environmental/types";

const reportsFile = path.join(process.cwd(), "data", "reports.json");

type StoredReport = CitizenReport & {
  language?: string;
  description?: string;
  possibleSources?: string[];
  recommendedAction?: string;
  confidence?: number | null;
  evidence?: Record<string, unknown>;
};

function readFallbackReports(): StoredReport[] {
  try {
    if (!fs.existsSync(reportsFile)) return [];
    const content = fs.readFileSync(reportsFile, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(content) as StoredReport[];
  } catch {
    return [];
  }
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function mapRow(row: Record<string, unknown>): StoredReport {
  return {
    id: String(row.id),
    latitude: typeof row.latitude === "number" ? row.latitude : null,
    longitude: typeof row.longitude === "number" ? row.longitude : null,
    category: String(row.category ?? "other"),
    severity: String(row.severity ?? "moderate") as CitizenReport["severity"],
    summary: String(row.summary ?? row.description ?? ""),
    reportedAt: String(row.created_at ?? new Date().toISOString()),
    language: String(row.language ?? "en"),
    description: String(row.description ?? row.summary ?? ""),
    possibleSources: Array.isArray(row.possible_sources) ? row.possible_sources : [],
    recommendedAction:\n      typeof row.recommended_action === "string"\n        ? row.recommended_action\n        : undefined,
    confidence: typeof row.confidence === "number" ? row.confidence : null,
    evidence:\n      row.evidence && typeof row.evidence === "object" && !Array.isArray(row.evidence)\n        ? (row.evidence as Record<string, unknown>)\n        : {},
  };
}

export async function getReports(): Promise<StoredReport[]> {
  const config = supabaseConfig();

  if (!config) return readFallbackReports();

  try {
    const response = await fetch(
      `${config.url}/rest/v1/vayunetra_reports?select=*&order=created_at.desc`,
      {
        headers: {
          apikey: config.key,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("Supabase report read failed:", response.status);
      return readFallbackReports();
    }

    const rows = await response.json();
    return Array.isArray(rows) ? rows.map(mapRow) : [];
  } catch (error) {
    console.error("Supabase report read error:", error);
    return readFallbackReports();
  }
}

export async function addReport(report: StoredReport) {
  const config = supabaseConfig();

  if (!config) {
    const reports = readFallbackReports();
    reports.push(report);
    fs.writeFileSync(reportsFile, JSON.stringify(reports, null, 2), "utf8");
    return report;
  }

  const response = await fetch(`${config.url}/rest/v1/vayunetra_reports`, {
    method: "POST",
    headers: {
      apikey: config.key,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      description: report.description ?? report.summary,
      language: report.language ?? "en",
      location_text: null,
      latitude: report.latitude,
      longitude: report.longitude,
      category: report.category,
      severity: report.severity,
      summary: report.summary,
      possible_sources: report.possibleSources ?? [],
      recommended_action: report.recommendedAction ?? null,
      confidence: report.confidence ?? null,
      evidence: report.evidence ?? {},
      source: "citizen",
      is_sample: false,
      status: "reported",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase report insert failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) && rows[0] ? mapRow(rows[0]) : report;
}