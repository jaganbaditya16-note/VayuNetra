import { NextResponse } from "next/server";
import { addReport, getReports } from "@/lib/reports/store";
import { toPublicReport } from "@/lib/reports/public";
import {
  makeFallbackAnalysis,
  createReportIntegrity,
  validateAnalysis,
  validateEnvironmentalEvidence,
} from "@/lib/reports/analysis";
import {
  getIntegrityConfigurationError,
  getReportsPersistenceConfiguration,
} from "@/lib/reports/persistence-config";
import { validateGeographicHierarchy } from "@/lib/geography/types";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { parseBoundedJson, readBoundedBody, RequestBodyTooLargeError } from "@/lib/security/request-body";
import { internalServiceUrl } from "@/lib/security/internal-origin";

export async function GET() {
  try {
    const reports = await getReports();

    return NextResponse.json({
      success: true,
      count: reports.length,
      reports: reports.map(toPublicReport),
    }, { headers: { "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=30" } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Production report persistence")) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: "Unable to load reports." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, "report-submit", 12, 60_000);
  if (limited) return limited;
  try {
    const integrityError = getIntegrityConfigurationError();
    if (integrityError) {
      return NextResponse.json({ error: integrityError }, { status: 503 });
    }
    const persistence = getReportsPersistenceConfiguration();
    if (persistence.mode === "error") {
      return NextResponse.json({ error: persistence.error }, { status: 503 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    let description = "";
    let language = "English";
    let location: { latitude: number | null; longitude: number | null } = {
      latitude: null,
      longitude: null,
    };
    let channel = "web";
    let image: File | null = null;
    let geography: unknown = null;

    if (contentType.includes("multipart/form-data")) {
      const bytes = await readBoundedBody(request, 9 * 1024 * 1024);
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      const form = await new Request(request.url, { method: "POST", headers, body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer }).formData();
      description = String(form.get("description") ?? "").trim();
      language = String(form.get("language") ?? "English").trim() || "English";
      channel = String(form.get("channel") ?? "web").trim().toLowerCase();
      const locationField = form.get("location");
      if (typeof locationField === "string" && locationField.trim()) {
        location = JSON.parse(locationField);
      }
      const geographyField = form.get("geography");
      if (typeof geographyField === "string" && geographyField.trim()) geography = JSON.parse(geographyField);
      const candidateImage = form.get("image");
      if (candidateImage instanceof File && candidateImage.size > 0) {
        image = candidateImage;
      }
    } else {
      const parsedBody = await parseBoundedJson(request, 64 * 1024);
      const body = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody) ? parsedBody as Record<string, unknown> : {};
      description = typeof body?.description === "string" ? body.description.trim() : "";
      language = typeof body?.language === "string" && body.language.trim()
        ? body.language.trim()
        : "English";
      channel = typeof body?.channel === "string" && body.channel.trim()
        ? body.channel.trim().toLowerCase()
        : "web";
      if (body?.location && typeof body.location === "object") {
        const candidateLocation = body.location as Record<string, unknown>;
        location = { latitude: candidateLocation.latitude as number | null, longitude: candidateLocation.longitude as number | null };
      }
      geography = body?.geography ?? null;
    }

    if (!description) {
      return NextResponse.json(
        { error: "Report description is required." },
        { status: 400 }
      );
    }
    if (description.length > 4000 || language.length > 40) {
      return NextResponse.json(
        { error: "Report description or language is too long." },
        { status: 413 },
      );
    }
    if (!["web", "whatsapp", "sms", "webchat", "messaging"].includes(channel)) {
      return NextResponse.json({ error: "Unsupported submission channel." }, { status: 400 });
    }

    const validCoordinate = (value: unknown, min: number, max: number) =>
      value === null || value === undefined ||
      (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max);
    if (
      !location || typeof location !== "object" ||
      !validCoordinate(location.latitude, -90, 90) ||
      !validCoordinate(location.longitude, -180, 180)
    ) {
      return NextResponse.json({ error: "Location coordinates are invalid." }, { status: 400 });
    }
    const validatedGeography = geography === null ? null : validateGeographicHierarchy(geography);
    if (geography !== null && !validatedGeography) return NextResponse.json({ error: "Geographic hierarchy is invalid or unsupported." }, { status: 400 });

    if (image) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
        return NextResponse.json({ error: "Only JPEG, PNG, and WebP images are supported." }, { status: 400 });
      }
      if (image.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: "Photo must be 8 MB or smaller." }, { status: 413 });
      }
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

    let environmentalEvidence = null;
    if (latitude !== null && longitude !== null) {
      const environmentalUrl = internalServiceUrl("/api/environmental");
      environmentalUrl.searchParams.set("latitude", String(latitude));
      environmentalUrl.searchParams.set("longitude", String(longitude));
      try {
        const environmentalResponse = await fetch(environmentalUrl, {
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        });
        if (environmentalResponse.ok) {
          const environmentalData = await environmentalResponse.json();
          environmentalEvidence = validateEnvironmentalEvidence(
            environmentalData?.satellite ?? null,
          );
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("Environmental evidence")) throw error;
        environmentalEvidence = null;
      }
    }

    const geminiUrl = internalServiceUrl("/api/gemini");
    const forwardedFor = request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "internal-report";
    let geminiResponse: Response | null = null;
    try {
      if (image) {
        const modelForm = new FormData();
        modelForm.set("description", description);
        modelForm.set("language", language);
        modelForm.set("location", JSON.stringify(location));
        modelForm.set("evidence", JSON.stringify(environmentalEvidence));
        modelForm.set("image", image, image.name || "evidence-image");
        geminiResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: { "x-forwarded-for": forwardedFor },
          body: modelForm,
          cache: "no-store",
        });
      } else {
        geminiResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": forwardedFor,
          },
          body: JSON.stringify({ description, language, location, evidence: environmentalEvidence }),
          cache: "no-store",
        });
      }
    } catch {
      geminiResponse = null;
    }

    if (geminiResponse?.status === 502) {
      return NextResponse.json({ error: "Analysis returned malformed data; report was not saved." }, { status: 502 });
    }
    if (geminiResponse && !geminiResponse.ok && ![429, 500, 503].includes(geminiResponse.status)) {
      return NextResponse.json({ error: "Analysis could not be validated; report was not saved." }, { status: 502 });
    }

    let analysis;
    if (geminiResponse?.ok) {
      const result = await geminiResponse.json();
      analysis = validateAnalysis(result?.analysis);
    } else {
      analysis = makeFallbackAnalysis(description);
    }

    const evidence: Record<string, unknown> = {
      citizenClaim: { channel, language },
      geminiInterpretation: analysis,
      photoEvidence: { attached: Boolean(image) },
      environmentalEvidence,
      publicDataContext: null,
      provider: { name: analysis.provider, source: analysis.source },
    };

    const reportToStore = {
      id: `report-${Date.now()}`,
      latitude,
      longitude,
      category: analysis.category,
      severity: analysis.severity,
      summary: analysis.summary,
      reportedAt: new Date().toISOString(),
      language,
      description,
      possibleSources: analysis.possibleSources,
      recommendedAction: analysis.recommendedAction,
      confidence: analysis.confidence,
      evidence,
      geography: validatedGeography,
    };
    reportToStore.evidence = {
      ...evidence,
      integrity: createReportIntegrity(reportToStore),
    };

    const report = await addReport(reportToStore);

    return NextResponse.json({
      success: true,
      message: "Environmental report received.",
      report: toPublicReport(report),
      analysis: {
        ...analysis,
        ...(analysis.provider === "local-fallback"
          ? { providerMessage: "Gemini was unavailable; deterministic fallback analysis was used." }
          : {}),
      },
      evidenceClasses: {
        citizenClaim: true,
        geminiInterpretation: analysis.provider === "gemini",
        fallbackInterpretation: analysis.provider === "local-fallback",
        photoEvidence: Boolean(image),
        environmentalEvidence: Boolean(environmentalEvidence),
        publicDataContext: false,
      },
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    if (error instanceof SyntaxError || error instanceof TypeError) return NextResponse.json({ error: "Request body is malformed." }, { status: 400 });
    console.error("Report submission failed:", error);
    return NextResponse.json(
      { error: "Unable to validate or save the report." },
      { status: 502 }
    );
  }
}
