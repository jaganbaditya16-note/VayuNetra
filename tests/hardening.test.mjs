import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { clientIp } from "../lib/security/client-ip.ts";
import { parseBoundedJson, RequestBodyTooLargeError } from "../lib/security/request-body.ts";
import { usesDevelopmentIntegrityFallback } from "../lib/reports/analysis.ts";
import { buildDevelopmentPriority } from "../lib/priorities/engine.ts";

test("rate limiting trusts only the right-most forwarded hop, so a spoofed header cannot mint a new bucket", () => {
  // A platform proxy such as Cloud Run appends the real client address last.
  const behindProxy = new Request("http://local.test", {
    headers: { "x-forwarded-for": "203.0.113.9, 198.51.100.42" },
  });
  assert.equal(clientIp(behindProxy), "198.51.100.42");

  // A caller sending its own X-Forwarded-For cannot override that last hop.
  const spoofed = new Request("http://local.test", {
    headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2, 10.0.0.3" },
  });
  assert.equal(clientIp(spoofed), "10.0.0.3");

  assert.equal(
    clientIp(new Request("http://local.test", { headers: { "x-forwarded-for": "2001:0db8:85a3::8a2e:0370:7334" } })),
    "2001:0db8:85a3::8a2e:0370:7334",
  );
  assert.equal(
    clientIp(new Request("http://local.test", { headers: { "x-forwarded-for": "[::1]:443" } })),
    "::1",
  );
  assert.equal(
    clientIp(new Request("http://local.test", { headers: { "x-real-ip": "203.0.113.7" } })),
    "203.0.113.7",
  );

  // Unusable or unidentifiable input fails closed onto one shared bucket
  // rather than granting a caller its own allowance.
  assert.equal(clientIp(new Request("http://local.test")), "unidentified");
  assert.equal(
    clientIp(new Request("http://local.test", { headers: { "x-forwarded-for": "not-an-ip" } })),
    "unidentified",
  );
  assert.equal(
    clientIp(new Request("http://local.test", { headers: { "x-forwarded-for": "999.1.1.1" } })),
    "unidentified",
  );
});

test("a caller rotating X-Forwarded-For values still resolves to one rate-limit bucket", () => {
  // `checkRateLimit` keys buckets on `${scope}:${clientIp(request)}`, so the
  // spoofing resistance is fully determined by clientIp.
  const spoofedRequests = Array.from(
    { length: 10 },
    (_, index) =>
      new Request("http://local.test", {
        headers: { "x-forwarded-for": `10.0.0.${index}, 203.0.113.5` },
      }),
  );

  const keys = new Set(spoofedRequests.map((request) => `report-submit:${clientIp(request)}`));

  // Rotating the caller-supplied leading hop cannot escape the bucket.
  assert.equal(keys.size, 1);
  assert.equal([...keys][0], "report-submit:203.0.113.5");
});

test("message intake applies a bounded body read", async () => {
  const route = readFileSync(
    new URL("../app/api/intake/message/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /parseBoundedJson/);
  assert.match(route, /RequestBodyTooLargeError/);
  assert.doesNotMatch(route, /await request\.json\(\)/);

  const oversized = new Request("http://local.test", { method: "POST", body: "x".repeat(200) });
  await assert.rejects(() => parseBoundedJson(oversized, 64), RequestBodyTooLargeError);
});

test("public satellite and hotspot routes are rate limited and cap child processes", () => {
  const environmental = readFileSync(
    new URL("../app/api/environmental/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(environmental, /checkRateLimit\(request, "environmental"/);
  assert.match(environmental, /MAX_CONCURRENT_SATELLITE_PROCESSES/);
  assert.match(environmental, /SATELLITE_QUEUE_LIMIT/);
  // Every settled path must return its slot or the limiter deadlocks.
  const releases = environmental.match(/releaseSatelliteSlot\(slot\)/g) ?? [];
  assert.ok(releases.length >= 2, "both resolve and reject release the process slot");

  const hotspots = readFileSync(
    new URL("../app/api/hotspots/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(hotspots, /checkRateLimit\(\s*request,\s*"hotspots"/);
});

test("production never falls back to the development integrity placeholder", () => {
  assert.equal(
    usesDevelopmentIntegrityFallback({ NODE_ENV: "production" }),
    false,
  );
  assert.equal(
    usesDevelopmentIntegrityFallback({ NODE_ENV: "production", GEMINI_API_KEY: "gemini-key" }),
    false,
  );
  assert.equal(
    usesDevelopmentIntegrityFallback({ NODE_ENV: "development" }),
    true,
  );
  assert.equal(
    usesDevelopmentIntegrityFallback({
      NODE_ENV: "development",
      VAYUNETRA_INTEGRITY_SECRET: "dedicated-integrity-key-with-more-than-32-bytes",
    }),
    false,
  );
  assert.equal(
    usesDevelopmentIntegrityFallback({ NODE_ENV: "development", GEMINI_API_KEY: "gemini-key" }),
    false,
  );

  const analysis = readFileSync(
    new URL("../lib/reports/analysis.ts", import.meta.url),
    "utf8",
  );
  // The placeholder must only be reachable on the non-production branch.
  const productionBranch = analysis.slice(analysis.indexOf('process.env.NODE_ENV ===\n    "production"'));
  assert.equal(
    productionBranch.slice(0, productionBranch.indexOf("}")).includes("DEVELOPMENT_INTEGRITY_SECRET"),
    false,
  );
});

test("a fresh development install signs reports so the local pipeline is not silently inert", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSecret = process.env.VAYUNETRA_INTEGRITY_SECRET;
  const previousGemini = process.env.GEMINI_API_KEY;

  delete process.env.VAYUNETRA_INTEGRITY_SECRET;
  delete process.env.GEMINI_API_KEY;

  // The unconfigured case is the one that previously produced a working
  // submission endpoint feeding an empty map and an empty priority list.
  assert.equal(usesDevelopmentIntegrityFallback({ NODE_ENV: "development" }), true);

  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousSecret === undefined) delete process.env.VAYUNETRA_INTEGRITY_SECRET;
  else process.env.VAYUNETRA_INTEGRITY_SECRET = previousSecret;
  if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = previousGemini;
});

test("a report submitted without geolocation is accepted instead of being rejected", () => {
  const route = readFileSync(
    new URL("../app/api/report/route.ts", import.meta.url),
    "utf8",
  );

  // The browser always appends the location field. When a citizen declines the
  // permission prompt this serialises to the literal string "null", which used
  // to be parsed into null and then rejected as "invalid coordinates",
  // silently losing the single most common submission path.
  assert.match(
    route,
    /parsedLocation && typeof parsedLocation === "object" && !Array\.isArray\(parsedLocation\)/,
  );

  // Coordinate range validation must still apply to real payloads.
  assert.match(route, /validCoordinate\(location\.latitude, -90, 90\)/);
  assert.match(route, /validCoordinate\(location\.longitude, -180, 180\)/);

  // The intake adapter forwards the same payload shape, so it must not send a
  // bare null location either.
  const intake = readFileSync(
    new URL("../app/api/intake/message/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(intake, /latitude: null, longitude: null/);
});

test("the evidence map legend covers every severity colour the map can draw", () => {
  const map = readFileSync(
    new URL("../components/VayuMap.tsx", import.meta.url),
    "utf8",
  );

  // severityColor() falls through to a cyan marker for any non critical /
  // high / moderate value, so the legend has to document that colour too.
  const fallback = /return "#22d3ee";/.test(map);
  assert.equal(fallback, true, "low severity uses the cyan fallback colour");
  assert.match(map, /bg-cyan-400\s*"\s*\/>\s*Low/);
  assert.match(map, /Critical/);
  assert.match(map, /High/);
  assert.match(map, /Moderate/);
});

test("priority rationale agrees in number for a single report", () => {
  const base = {
    location: { city: "Example", area: "Example", latitude: null, longitude: null },
    confidence: 0.8,
    severity: "high",
    contributors: ["roads"],
    evidenceBasis: [],
  };
  const single = buildDevelopmentPriority({ ...base, reportCount: 1 }, []);
  const multiple = buildDevelopmentPriority({ ...base, reportCount: 3 }, []);

  assert.match(single.rationale[0], /^1 located citizen report currently supports this demand cluster\.$/);
  assert.match(multiple.rationale[0], /^3 located citizen reports currently support this demand cluster\.$/);
});
