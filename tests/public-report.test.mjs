import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { toPublicReport } from "../lib/reports/public.ts";
import {
  createReportIntegrity,
  isPriorityEligibleReport,
  makeFallbackAnalysis,
  validateAnalysis,
  validateEnvironmentalEvidence,
} from "../lib/reports/analysis.ts";
import {
  getIntegrityConfigurationError,
  getReportsPersistenceConfiguration,
} from "../lib/reports/persistence-config.ts";

test("public projection omits precise coordinates, raw text, and private fields", () => {
  const privateReport = {
    id: "citizen-report-123456789",
    latitude: 19.076123,
    longitude: 72.877712,
    category: "air_pollution",
    severity: "high",
    reportedAt: "2026-09-27T12:34:56.789Z",
    description: "My home at 12 Example Street has heavy smoke",
    summary: "My home at 12 Example Street has heavy smoke",
    language: "en",
    possibleSources: ["private model output"],
    recommendedAction: "internal action notes",
    confidence: 0.83,
    evidence: { provider: "private-provider", photo: "sensitive-payload" },
    status: "reported",
    isSample: false,
  };

  const result = toPublicReport(privateReport);
  const serialized = JSON.stringify(result);

  assert.equal(result.latitude, 19.1);
  assert.equal(result.longitude, 72.9);
  assert.notEqual(result.latitude, privateReport.latitude);
  assert.notEqual(result.longitude, privateReport.longitude);
  assert.equal(result.category, "air_pollution");
  assert.equal(result.severity, "high");
  assert.equal(result.status, "reported");
  assert.equal(result.reportedAt, "2026-09-27");
  assert.equal(result.isSample, false);
  assert.match(result.id, /^public-[0-9a-f]{24}$/);
  assert.equal(result.summary, "air pollution");

  for (const privateValue of [
    String(privateReport.latitude),
    String(privateReport.longitude),
    privateReport.description,
    "private-provider",
    "sensitive-payload",
  ]) {
    assert.equal(serialized.includes(privateValue), false);
  }
  for (const privateKey of ["description", "language", "possibleSources", "recommendedAction", "confidence", "evidence"]) {
    assert.equal(Object.hasOwn(result, privateKey), false);
  }
});

test("public projection supports reports without a location", () => {
  const result = toPublicReport({
    id: "report-no-location",
    latitude: null,
    longitude: null,
    category: "burning",
    severity: "moderate",
    reportedAt: "2026-09-27T00:00:00.000Z",
  });

  assert.equal(result.latitude, null);
  assert.equal(result.longitude, null);
  assert.equal(result.summary, "burning");
});

test("public projection marks sample provenance unknown instead of claiming non-demo status", () => {
  const result = toPublicReport({ id: "unlabelled-local-row", latitude: null, longitude: null, category: "roads", severity: "low", reportedAt: "2026-09-27" });
  assert.equal(result.isSample, null);
});

test("strict analysis validator accepts valid server analysis and rejects malformed output", () => {
  const valid = {
    category: "burning",
    severity: "high",
    confidence: 0.78,
    summary: "Smoke was reported near a road.",
    possibleSources: ["Open burning"],
    recommendedAction: "Request local verification.",
    provider: "gemini",
    source: "gemini-api",
  };
  assert.deepEqual(validateAnalysis(valid), valid);
  assert.throws(() => validateAnalysis({ ...valid, confidence: 92 }));
  assert.throws(() => validateAnalysis({ ...valid, severity: "extreme" }));
  assert.throws(() => validateAnalysis({ ...valid, evidence: { forged: true } }));
  assert.throws(() => validateAnalysis({ ...valid, provider: "client" }));
  assert.throws(() => validateAnalysis({ ...valid, possibleSources: ["x".repeat(200)] }));
});

test("environmental evidence is validated as a separate bounded evidence class", () => {
  assert.deepEqual(
    validateEnvironmentalEvidence({
      value: 12.5,
      unit: "mol/m2",
      indicator: "NO2",
      source: "satellite source",
      measuredAt: "2026-09-27T00:00:00.000Z",
      isSatelliteEstimate: true,
    }),
    {
      value: 12.5,
      unit: "mol/m2",
      indicator: "NO2",
      source: "satellite source",
      measuredAt: "2026-09-27T00:00:00.000Z",
      isSatelliteEstimate: true,
    },
  );
  assert.throws(() => validateEnvironmentalEvidence({ value: "forged", source: "client" }));
});

test("fallback is explicit and unsigned or changed reports cannot affect priorities", () => {
  const fallback = makeFallbackAnalysis("Smoke and burning were reported.");
  assert.equal(fallback.provider, "local-fallback");
  assert.equal(fallback.source, "deterministic-rules");
  assert.equal(fallback.category, "burning");

  process.env.VAYUNETRA_INTEGRITY_SECRET = "unit-test-integrity-key";
  const report = {
    latitude: 19.1,
    longitude: 72.9,
    category: "burning",
    severity: "moderate",
    summary: "Smoke was reported.",
    language: "English",
    description: "Citizen smoke claim.",
    possibleSources: ["Citizen-reported signal"],
    recommendedAction: "Verify locally.",
    confidence: 0.55,
    evidence: { photoEvidence: { attached: true } },
  };
  const signed = {
    ...report,
    evidence: { ...report.evidence, integrity: createReportIntegrity(report) },
  };
  assert.equal(isPriorityEligibleReport(signed), true);
  const legacySigned = { ...report, evidence: { ...report.evidence, integrity: createReportIntegrity(report, 1) } };
  assert.equal(isPriorityEligibleReport(legacySigned), true);
  assert.equal(isPriorityEligibleReport({ ...signed, severity: "critical" }), false);
  assert.equal(isPriorityEligibleReport({ ...report, evidence: { integrity: { version: 1, validated: true } } }), false);
  assert.equal(isPriorityEligibleReport({ ...report, evidence: {} }), false);
  delete process.env.VAYUNETRA_INTEGRITY_SECRET;
});

test("persistence configuration uses local JSON only outside production", () => {
  assert.deepEqual(
    getReportsPersistenceConfiguration({ NODE_ENV: "development" }),
    { mode: "local-json" },
  );
  assert.deepEqual(
    getReportsPersistenceConfiguration({
      NODE_ENV: "production",
      SUPABASE_URL: "https://db.example.test/",
      SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    }),
    {
      mode: "supabase",
      url: "https://db.example.test",
      serviceRoleKey: "server-only-test-key",
    },
  );
  assert.equal(
    getReportsPersistenceConfiguration({
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://db.example.test",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
    }).mode,
    "error",
  );
});

test("production integrity requires its dedicated secret even when Gemini is configured", () => {
  assert.match(
    getIntegrityConfigurationError({ NODE_ENV: "production", GEMINI_API_KEY: "gemini-key" }) ?? "",
    /VAYUNETRA_INTEGRITY_SECRET/,
  );
  assert.equal(
    getIntegrityConfigurationError({
      NODE_ENV: "production",
      VAYUNETRA_INTEGRITY_SECRET: "dedicated-integrity-key-with-more-than-32-bytes",
      GEMINI_API_KEY: "gemini-key",
    }),
    null,
  );
  assert.match(
    getIntegrityConfigurationError({ NODE_ENV: "production", VAYUNETRA_INTEGRITY_SECRET: "short" }) ?? "",
    /at least 32 bytes/,
  );
});

test("reports migration adopts the UUID table without deleting rows or replacing existing category rules", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260927000100_reports_data_governance.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /create table if not exists public\.vayunetra_reports\s*\([\s\S]*?id uuid primary key default gen_random_uuid\(\)/i);
  assert.match(migration, /add column if not exists evidence jsonb/i);
  assert.match(migration, /from pg_policies[\s\S]*?drop policy %I/i);
  assert.match(migration, /revoke all on public\.vayunetra_reports from public, anon/i);
  assert.match(migration, /create policy vayunetra_reports_operator_read/i);
  assert.doesNotMatch(migration, /drop table|truncate table|delete from public\.vayunetra_reports|update public\.vayunetra_reports/i);
  assert.doesNotMatch(migration, /alter table public\.vayunetra_reports add constraint [^;]*category/i);
});
