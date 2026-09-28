import { createHmac } from "node:crypto";

const secret = process.env.VAYUNETRA_INTEGRITY_SECRET?.trim();
const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!secret || !supabaseUrl || !serviceRoleKey) {
  console.log("Integrity backfill skipped: production integrity/persistence configuration is incomplete.");
  process.exit(0);
}

const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

const integrityPayload = (report) => {
  const evidence = report.evidence && typeof report.evidence === "object" && !Array.isArray(report.evidence)
    ? { ...report.evidence }
    : {};
  delete evidence.integrity;

  return canonicalJson({
    latitude: report.latitude ?? null,
    longitude: report.longitude ?? null,
    category: report.category,
    severity: report.severity,
    summary: report.summary,
    language: report.language,
    description: report.description,
    possibleSources: report.possibleSources ?? [],
    recommendedAction: report.recommendedAction ?? null,
    confidence: report.confidence,
    evidence,
    geography: report.geography ?? null,
  });
};

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};

try {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/vayunetra_reports?select=*`,
    { headers, cache: "no-store" },
  );

  if (!response.ok) {
    console.warn(`Integrity backfill read skipped: Supabase returned ${response.status}.`);
    process.exit(0);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) process.exit(0);

  let repaired = 0;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    if (row.is_sample === true) continue;
    if (["resolved", "rejected"].includes(row.status ?? "reported")) continue;
    if (row.source !== "citizen") continue;
    if (row.summary === "Persistence validation test") continue;

    const evidence = row.evidence && typeof row.evidence === "object" && !Array.isArray(row.evidence)
      ? row.evidence
      : {};

    // Never overwrite an existing integrity marker. This migration only adopts
    // genuinely unsigned historical citizen rows into the current trust model.
    if (evidence.integrity) continue;

    const report = {
      latitude: typeof row.latitude === "number" ? row.latitude : null,
      longitude: typeof row.longitude === "number" ? row.longitude : null,
      category: row.category,
      severity: row.severity,
      summary: row.summary ?? row.description ?? "",
      language: row.language ?? "en",
      description: row.description ?? row.summary ?? "",
      possibleSources: Array.isArray(row.possible_sources) ? row.possible_sources : [],
      recommendedAction: row.recommended_action ?? null,
      confidence: typeof row.confidence === "number" ? row.confidence : null,
      evidence,
      geography: row.geography ?? null,
    };

    const signature = createHmac("sha256", secret)
      .update(integrityPayload(report))
      .digest("hex");

    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/vayunetra_reports?id=eq.${encodeURIComponent(row.id)}`,
      {
        method: "PATCH",
        headers: {
          ...headers,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          evidence: {
            ...evidence,
            integrity: {
              version: 2,
              validated: true,
              signature,
            },
          },
        }),
      },
    );

    if (updateResponse.ok) repaired += 1;
    else console.warn(`Integrity backfill could not update report ${row.id}: ${updateResponse.status}.`);
  }

  console.log(`Integrity backfill complete: ${repaired} historical report(s) adopted.`);
} catch (error) {
  console.warn("Integrity backfill skipped after an unexpected error:", error instanceof Error ? error.message : "unknown error");
}
