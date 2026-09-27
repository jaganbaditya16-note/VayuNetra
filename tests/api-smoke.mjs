import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createReportIntegrity } from "../lib/reports/analysis.ts";

process.env.VAYUNETRA_INTEGRITY_SECRET = "smoke-test-integrity-secret-for-tests-123456";

const privateReport = {
  id: "smoke-report-93847561",
  latitude: 19.076123,
  longitude: 72.877712,
  category: "burning",
  severity: "high",
  summary: "Private citizen summary with home address",
  description: "Private citizen description with home address",
  language: "en",
  possible_sources: ["private source"],
  recommended_action: "private action",
  confidence: 0.84,
  evidence: {
    provider: "private provider",
    payload: "private payload",
    photoEvidence: { attached: true },
  },
  created_at: "2026-09-27T12:34:56.789Z",
  status: "reported",
  is_sample: false,
};
privateReport.evidence.integrity = createReportIntegrity({
  latitude: privateReport.latitude,
  longitude: privateReport.longitude,
  category: privateReport.category,
  severity: privateReport.severity,
  summary: privateReport.summary,
  language: privateReport.language,
  description: privateReport.description,
  possibleSources: privateReport.possible_sources,
  recommendedAction: privateReport.recommended_action,
  confidence: privateReport.confidence,
  evidence: {
    provider: privateReport.evidence.provider,
    payload: privateReport.evidence.payload,
    photoEvidence: privateReport.evidence.photoEvidence,
  },
});
let insertedReport = null;
let serviceRoleHeaderSeen = false;
const forgedPriorityReport = {
  ...privateReport,
  id: "forged-priority-report",
  severity: "critical",
  confidence: 1,
  evidence: { ...privateReport.evidence, integrity: { version: 1, validated: true, signature: "forged" } },
};
const legacyReport = {
  ...privateReport,
  id: "legacy-unsigned-report",
  severity: "critical",
  confidence: 0.99,
  evidence: { provider: "legacy-unverified" },
};

const mockDatabase = createServer(async (request, response) => {
  serviceRoleHeaderSeen ||= request.headers.authorization === "Bearer smoke-test-service-role-key";
  if (request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify([privateReport, forgedPriorityReport, legacyReport]));
    return;
  }

  let requestBody = "";
  for await (const chunk of request) {
    requestBody += chunk.toString();
  }
  insertedReport = JSON.parse(requestBody);
  response.writeHead(201, { "Content-Type": "application/json" });
  response.end(JSON.stringify([privateReport]));
});

mockDatabase.listen(0, "127.0.0.1");
await once(mockDatabase, "listening");
const databasePort = mockDatabase.address().port;
const appPort = 31947;
const build = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(appPort),
      SUPABASE_URL: `http://127.0.0.1:${databasePort}`,
      SUPABASE_SERVICE_ROLE_KEY: "smoke-test-service-role-key",
      VAYUNETRA_INTEGRITY_SECRET: "smoke-test-integrity-secret-for-tests-123456",
      GEMINI_API_KEY: "",
    },
    stdio: "inherit",
  },
);
const [buildCode] = await once(build, "exit");
assert.equal(buildCode, 0, "smoke build completes with in-memory Supabase URL");

const app = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", String(appPort)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(appPort),
      SUPABASE_URL: `http://127.0.0.1:${databasePort}`,
      SUPABASE_SERVICE_ROLE_KEY: "smoke-test-service-role-key",
      VAYUNETRA_INTEGRITY_SECRET: "smoke-test-integrity-secret-for-tests-123456",
      GEMINI_API_KEY: "",
    },
    stdio: "ignore",
  },
);

const appUrl = `http://127.0.0.1:${appPort}`;
let started = false;

try {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (app.exitCode !== null) throw new Error("Next server exited during startup");
    try {
      const response = await fetch(`${appUrl}/api/report`);
      if (response.ok) {
        started = true;
        break;
      }
    } catch {
      // Wait for the local production server to accept requests.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(started, true, "Next production server starts");

  const publicResponse = await fetch(`${appUrl}/api/report`);
  assert.equal(publicResponse.status, 200);
  assert.equal(serviceRoleHeaderSeen, true);
  const publicBody = await publicResponse.json();
  const publicJson = JSON.stringify(publicBody);
  assert.equal(publicBody.reports[0].latitude, 19.1);
  assert.equal(publicBody.reports[0].longitude, 72.9);
  assert.equal(publicBody.reports[0].reportedAt, "2026-09-27");
  assert.equal(publicBody.reports[0].category, "burning");
  assert.equal(publicBody.reports[0].severity, "high");
  for (const secret of [
    String(privateReport.latitude),
    String(privateReport.longitude),
    privateReport.description,
    privateReport.summary,
    "private provider",
    "private payload",
  ]) {
    assert.equal(publicJson.includes(secret), false, `public response excludes ${secret}`);
  }

  const submission = await fetch(`${appUrl}/api/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: "Citizen reports smoke near the road",
      language: "English",
      location: { latitude: null, longitude: null },
      analysis: {
        category: "burning",
        severity: "critical",
        confidence: 1,
        summary: "Forged summary",
        possibleSources: ["forged source"],
        recommendedAction: "forged action",
        provider: "gemini",
        environmentalEvidence: { value: 9999, source: "forged satellite" },
      },
      confidence: 1,
      evidence: { integrity: { version: 1, validated: true, signature: "forged" } },
    }),
  });
  assert.equal(submission.status, 200);
  const submissionBody = await submission.json();
  assert.equal(submissionBody.success, true);
  assert.equal(submissionBody.report.category, "burning");
  assert.equal(JSON.stringify(submissionBody).includes("A private test report"), false);
  assert.equal(insertedReport.description, "Citizen reports smoke near the road");
  assert.equal(insertedReport.latitude, null);
  assert.equal(insertedReport.longitude, null);
  assert.equal(insertedReport.category, "burning");
  assert.equal(insertedReport.severity, "moderate");
  assert.equal(insertedReport.confidence, 0.55);
  assert.equal(insertedReport.evidence.provider.name, "local-fallback");
  assert.equal(insertedReport.evidence.environmentalEvidence, null);
  assert.equal(insertedReport.evidence.photoEvidence.attached, false);
  assert.equal(insertedReport.evidence.integrity.validated, true);
  assert.equal(submissionBody.analysis.provider, "local-fallback");
  assert.equal(submissionBody.analysis.source, "deterministic-rules");
  assert.ok(submissionBody.analysis.providerMessage);

  const prioritiesResponse = await fetch(`${appUrl}/api/priorities`);
  assert.equal(prioritiesResponse.status, 200);
  const prioritiesBody = await prioritiesResponse.json();
  assert.equal(prioritiesBody.success, true);
  assert.equal(prioritiesBody.priorities[0].location.latitude, 19.1);
  assert.equal(prioritiesBody.priorities[0].location.longitude, 72.9);
  assert.equal(prioritiesBody.priorities[0].demandSignal, 0.27);
  assert.equal(prioritiesBody.priorities[0].evidenceStrength, 0.84);
  assert.equal(JSON.stringify(prioritiesBody).includes("19.076123"), false);

  const forgedIntake = await fetch(`${appUrl}/api/intake/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "There is dust from construction nearby.",
      language: "English",
      channel: "webchat",
      location: { latitude: null, longitude: null },
    }),
  });
  assert.equal(forgedIntake.status, 201);
  const intakeBody = await forgedIntake.json();
  assert.equal(intakeBody.success, true);
  assert.equal(intakeBody.analysis.provider, "local-fallback");
  assert.equal(intakeBody.analysis.category, "dust");

  privateReport.latitude = null;
  privateReport.longitude = null;
  const hotspotsResponse = await fetch(`${appUrl}/api/hotspots`);
  assert.equal(hotspotsResponse.status, 200);
  const hotspotsBody = await hotspotsResponse.json();
  assert.equal(hotspotsBody.success, true);
  assert.deepEqual(hotspotsBody.hotspots, []);

  console.log("API smoke passed: public report projection, report submission, hotspots, priorities");
} finally {
  app.kill();
  await once(app, "exit").catch(() => {});
  mockDatabase.closeAllConnections();
  mockDatabase.close();
}
