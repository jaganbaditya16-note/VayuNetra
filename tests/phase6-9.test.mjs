import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDevelopmentPriority } from "../lib/priorities/engine.ts";
import { getPublicContextCatalog } from "../lib/public-data/catalog.ts";
import { OFFICIAL_SOURCE_REGISTRY, VERIFIED_PLANNING_SNAPSHOTS } from "../lib/public-data/official-sources.ts";
import { isPriorityTrustworthy, validatePublicDataset } from "../lib/public-data/provenance.ts";
import { countryGeographyAdapters, validateGeographicHierarchy } from "../lib/geography/types.ts";
import { signReviewAudit, validateReviewTransition, verifyReviewAudit } from "../lib/reports/review.ts";
import { readBoundedBody, RequestBodyTooLargeError } from "../lib/security/request-body.ts";
import { internalServiceUrl } from "../lib/security/internal-origin.ts";

test("public provenance rejects malformed, stale, unavailable, and falsely verified data", () => {
  const catalog = getPublicContextCatalog();
  assert.equal(catalog.demographics.provenance.verification, "verified");
  assert.equal(catalog.demographics.provenance.freshness, "stale");
  assert.equal(catalog.demographics.value.population, 112374333);
  assert.equal(isPriorityTrustworthy(catalog.demographics), false);
  assert.equal(catalog.illustrativeDevelopmentContext.provenance.delivery, "illustrative");
  assert.equal(isPriorityTrustworthy(catalog.illustrativeDevelopmentContext), false);
  assert.equal(validatePublicDataset({ value: 20, provenance: { verification: "verified", freshness: "fresh", delivery: "live", sourceUrl: "javascript:alert(1)", publisher: "x", measuredAt: "2026-01-01" } }), false);
  const stale = { value: 20, provenance: { publisher: "Publisher", sourceUrl: "https://example.org/data", retrievedAt: "2026-09-27T00:00:00Z", measuredAt: "2026-01-01", geographicLevel: "district", geographyId: "IN-1", geographyName: "Example", freshness: "stale", verification: "verified", delivery: "cached" } };
  assert.equal(validatePublicDataset(stale), true);
  assert.equal(isPriorityTrustworthy(stale), false);
});

test("official source registry keeps public sources explicit and marks cached snapshots", () => {
  assert.ok(OFFICIAL_SOURCE_REGISTRY.length >= 4);
  for (const source of OFFICIAL_SOURCE_REGISTRY) {
    assert.equal(["source_verified_not_ingested", "snapshot_ingested"].includes(source.status), true);
    assert.equal(new URL(source.sourceUrl).protocol, "https:");
  }
  const snapshot = VERIFIED_PLANNING_SNAPSHOTS[0];
  assert.equal(snapshot.provenance.geographyId, "IN-MH");
  assert.equal(snapshot.provenance.verification, "verified");
  assert.equal(snapshot.provenance.freshness, "stale");
  assert.equal(snapshot.useInPriorityScoring, true);
});

test("review migration is represented with a current applied-schema version in the deployment package", () => {
  assert.equal(readFileSync(new URL("../supabase/migrations/20260927100622_human_review_workflow.sql", import.meta.url), "utf8").includes("vayunetra_reports_workflow_status_check"), true);
});

test("illustrative and unverified public context cannot influence priority scores", () => {
  const input = { location: { city: "Example", area: "Example", latitude: null, longitude: null }, reportCount: 10, confidence: 0.8, severity: "high", contributors: ["roads"], evidenceBasis: ["citizen reports"] };
  const illustrative = { id: "fixture", name: "Fixture", state: "Example", country: "India", latitude: 0, longitude: 0, populationExposure: 1, infrastructureGap: 1, investmentAlignment: 1, inclusionNeed: 1, existingServices: [], plannedPrograms: [], contextStatus: "illustrative", sources: ["fixture"] };
  const withoutContext = buildDevelopmentPriority(input, []);
  const withIllustration = buildDevelopmentPriority(input, [illustrative]);
  assert.equal(withoutContext.priorityScore, withIllustration.priorityScore);
  assert.equal(withIllustration.dataQuality, "unavailable");
  assert.equal(withIllustration.infrastructureGap, 0);
  assert.ok(withIllustration.rationale.some((line) => line.includes("do not affect this score")));
  const verified = { ...illustrative, contextStatus: "verified", freshness: "fresh", sourceUrl: "https://data.example.org/indicator", measuredAt: "2026-09-01", sources: ["Verified source"], infrastructureGap: 0.9 };
  const withVerifiedContext = buildDevelopmentPriority({ ...input, context: verified }, []);
  assert.equal(withVerifiedContext.dataQuality, "verified");
  assert.ok(withVerifiedContext.infrastructureGap > 0);

  const staleVerified = { ...verified, freshness: "stale" };
  const withStaleVerifiedContext = buildDevelopmentPriority({ ...input, context: staleVerified }, []);
  assert.equal(withStaleVerifiedContext.dataQuality, "mixed");
  assert.ok(withStaleVerifiedContext.infrastructureGap > 0);
  assert.ok(withStaleVerifiedContext.infrastructureGap < withVerifiedContext.infrastructureGap);
  assert.ok(withStaleVerifiedContext.rationale.some((line) => line.includes("70% weight")));
});

test("India geography normalizes identifiers and unsupported countries stay unavailable", () => {
  const india = validateGeographicHierarchy({ countryCode: "in", levels: [
    { level: "state_province", identifier: "mh-27", name: "Maharashtra" },
    { level: "district", identifier: "mumbai-suburban", name: "Mumbai Suburban" },
  ] });
  assert.equal(india.countryCode, "IN");
  assert.equal(india.levels[0].identifier, "MH-27");
  assert.equal(validateGeographicHierarchy({ countryCode: "BR", levels: [{ level: "state_province", identifier: "SP", name: "São Paulo" }] }), null);
  assert.equal(validateGeographicHierarchy({ countryCode: "IN", levels: [{ level: "ward_local_area", identifier: "bad/id", name: "Ward" }] }), null);
  assert.ok(countryGeographyAdapters.IN.supportedLevels.includes("ward_local_area"));
  assert.deepEqual(validateGeographicHierarchy({ countryCode: "IN", levels: [] })?.levels, []);
});

test("operator workflow rejects unauthorized transitions and detects audit tampering", () => {
  assert.equal(validateReviewTransition("reported", "under_review"), true);
  assert.equal(validateReviewTransition("reported", "resolved"), false);
  assert.equal(validateReviewTransition("resolved", "verified"), false);
  const event = { reportId: "r1", actorId: "u1", previousStatus: "reported", nextStatus: "under_review", timestamp: "2026-09-27T00:00:00.000Z", reviewNotes: "Checked", resolutionNotes: null, assignedAuthority: "Municipal team", escalated: false };
  const signature = signReviewAudit("test-integrity-key-which-is-long-enough-32", event);
  assert.equal(verifyReviewAudit("test-integrity-key-which-is-long-enough-32", event, signature), true);
  assert.equal(verifyReviewAudit("test-integrity-key-which-is-long-enough-32", { ...event, reviewNotes: "changed" }, signature), false);
});

test("request body reader enforces byte limits while reading streamed payloads", async () => {
  const request = new Request("http://local.test", { method: "POST", body: "small" });
  assert.equal(new TextDecoder().decode(await readBoundedBody(request, 10)), "small");
  const oversized = new Request("http://local.test", { method: "POST", body: "too large" });
  await assert.rejects(() => readBoundedBody(oversized, 3), RequestBodyTooLargeError);
});

test("server-side internal API calls cannot derive an origin from an untrusted Host header", () => {
  process.env.PORT = "32100";
  const url = internalServiceUrl("/api/report");
  assert.equal(url.origin, "http://127.0.0.1:32100");
  assert.throws(() => internalServiceUrl("//attacker.example/api/report"));
  delete process.env.PORT;
});

test("review database migration installs transactional transitions and private audit RLS", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260927100622_human_review_workflow.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.vayunetra_report_review_events/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /concurrent report update/i);
  assert.match(sql, /event_signature/i);
  assert.match(sql, /review_events_append_only/i);
  assert.match(sql, /vayunetra_reports_status_workflow_guard/i);
  assert.match(sql, /update public\.vayunetra_reports set status = 'under_review' where status in \('reviewed'/i);
  assert.doesNotMatch(sql, /drop table|truncate table|delete from public\.vayunetra_reports/i);
});

test("configured Supabase persistence fails closed instead of silently falling back to local JSON", () => {
  const store = readFileSync(new URL("../lib/reports/store.ts", import.meta.url), "utf8");
  assert.doesNotMatch(store, /Supabase report read failed; using local development reports/i);
  assert.doesNotMatch(store, /Supabase report read error; using local development reports/i);
});

test("health route reveals configuration state but not secrets", () => {
  const route = readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(route, /Cache-Control.*no-store/i);
  assert.match(route, /getReportsPersistenceConfiguration/);
  assert.doesNotMatch(route, /JSON\.stringify\(process\.env\)/i);
});

test("operator API requires trusted operator role and does not accept browser-supplied provider credentials", () => {
  const route = readFileSync(new URL("../app/api/operator/reports/[id]/route.ts", import.meta.url), "utf8");
  assert.match(route, /app_metadata\?\.role !== "operator"/);
  assert.match(route, /auth\/v1\/user/);
  assert.match(route, /rpc\/apply_report_review/);
  assert.match(route, /readBoundedBody/);
  assert.match(route, /signatureValid/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
});
