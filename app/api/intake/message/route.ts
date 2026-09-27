import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { internalServiceUrl } from "@/lib/security/internal-origin";
import { parseBoundedJson, RequestBodyTooLargeError } from "@/lib/security/request-body";

const MAX_INTAKE_BODY_BYTES = 64 * 1024;
const VALID_CHANNELS = new Set(["whatsapp", "sms", "webchat", "messaging"]);

export async function POST(request: Request) {
  const rateLimitResponse = checkRateLimit(request, "message-intake", 30, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const parsedBody = await parseBoundedJson(request, MAX_INTAKE_BODY_BYTES);
    const body = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
      ? parsedBody as Record<string, unknown>
      : {};
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const language = typeof body.language === "string" && body.language.trim()
      ? body.language.trim()
      : "English";
    const channel = typeof body.channel === "string" && body.channel.trim()
      ? body.channel.trim().toLowerCase()
      : "messaging";
    const location = body.location && typeof body.location === "object"
      ? body.location
      : { latitude: null, longitude: null };

    if (!VALID_CHANNELS.has(channel)) {
      return NextResponse.json(
        { error: "Unsupported channel. Use whatsapp, sms, webchat, or messaging." },
        { status: 400 },
      );
    }
    if (!text) return NextResponse.json({ error: "Message text is required." }, { status: 400 });
    if (text.length > 4000) {
      return NextResponse.json({ error: "Message text must be 4000 characters or fewer." }, { status: 413 });
    }

    const reportUrl = internalServiceUrl("/api/report");
    const reportResponse = await fetch(reportUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: text, language, location, channel }),
      cache: "no-store",
    });
    const reportData = await reportResponse.json();
    if (!reportResponse.ok) {
      return NextResponse.json(
        { error: reportData.error ?? "Message could not be validated and saved." },
        { status: reportResponse.status },
      );
    }

    return NextResponse.json(
      {
        success: true,
        channel,
        analysis: reportData.analysis,
        evidenceClasses: reportData.evidenceClasses,
        report: reportData.report,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return NextResponse.json({ error: "Request body is malformed." }, { status: 400 });
    }
    console.error("Message intake failed:", error);
    return NextResponse.json(
      { error: "Message intake is temporarily unavailable." },
      { status: 503 },
    );
  }
}
