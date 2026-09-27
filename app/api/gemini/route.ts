import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { validateAnalysis } from "@/lib/reports/analysis";
import { readBoundedBody, parseBoundedJson, RequestBodyTooLargeError } from "@/lib/security/request-body";

const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_TIMEOUT_MS = 9_000;
const GEMINI_MAX_ATTEMPTS = 2;
const GEMINI_RETRY_DELAY_MS = 700;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({
    apiKey,
  });
}

function errorStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error
  ) {
    const status = (error as { status?: unknown }).status;

    return typeof status === "number"
      ? status
      : undefined;
  }

  return undefined;
}

function isRetryableGeminiError(error: unknown) {
  const status = errorStatus(error);

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

async function generateGeminiResponse(
  ai: GoogleGenAI,
  contents:
    | string
    | Array<{
        inlineData?: {
          mimeType: string;
          data: string;
        };
        text?: string;
      }>
) {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= GEMINI_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const responsePromise =
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents,
          config: {
            responseMimeType: "application/json",
          },
        });

      const timeoutPromise = new Promise<never>(
        (_, reject) => {
          const timeout = setTimeout(() => {
            reject(
              new Error(
                "Gemini request timed out."
              )
            );
          }, GEMINI_TIMEOUT_MS);

          timeout.unref?.();
        }
      );

      return await Promise.race([
        responsePromise,
        timeoutPromise,
      ]);
    } catch (error: unknown) {
      lastError = error;

      console.error(
        `Gemini attempt ${attempt} failed:`,
        error
      );

      if (
        attempt >= GEMINI_MAX_ATTEMPTS ||
        !isRetryableGeminiError(error)
      ) {
        throw error;
      }

      await sleep(
        GEMINI_RETRY_DELAY_MS * attempt
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini request failed.");
}

export async function POST(request: Request) {
  const rateLimitResponse = checkRateLimit(
    request,
    "gemini",
    30,
    60_000
  );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let invalidModelOutput = false;

  try {
    const ai = getGeminiClient();

    if (!ai) {
      return NextResponse.json(
        {
          error:
            "AI analysis is temporarily unavailable.",
        },
        { status: 503 }
      );
    }

    const contentType =
      request.headers.get("content-type") ?? "";

    let description = "";
    let language = "English";
    let location: unknown = null;
    let evidence: unknown = null;

    let imageData:
      | {
          mimeType: string;
          data: string;
        }
      | null = null;

    if (
      contentType.includes(
        "multipart/form-data"
      )
    ) {
      const bytes = await readBoundedBody(request, 9 * 1024 * 1024);
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      const formData = await new Request(request.url, { method: "POST", headers, body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer }).formData();

      description = String(
        formData.get("description") ?? ""
      );

      language = String(
        formData.get("language") ?? "English"
      );

      const locationValue =
        formData.get("location");

      const evidenceValue =
        formData.get("evidence");

      if (
        typeof locationValue === "string" &&
        locationValue.trim()
      ) {
        location = JSON.parse(locationValue);
      }

      if (
        typeof evidenceValue === "string" &&
        evidenceValue.trim()
      ) {
        evidence = JSON.parse(evidenceValue);
      }

      const image = formData.get("image");

      if (image instanceof File && image.size > 0) {
        const allowedImageTypes =
          new Set([
            "image/jpeg",
            "image/png",
            "image/webp",
          ]);

        if (!allowedImageTypes.has(image.type)) {
          return NextResponse.json(
            {
              error:
                "Only JPEG, PNG, and WebP images are supported.",
            },
            { status: 400 }
          );
        }

        if (image.size > 8 * 1024 * 1024) {
          return NextResponse.json(
            {
              error:
                "Photo must be 8 MB or smaller.",
            },
            { status: 413 }
          );
        }

        const bytes =
          await image.arrayBuffer();

        imageData = {
          mimeType: image.type,
          data: Buffer.from(bytes).toString(
            "base64"
          ),
        };
      }
    } else {
      const parsedBody = await parseBoundedJson(request, 64 * 1024);
      const body = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody) ? parsedBody as Record<string, unknown> : {};

      description = typeof body.description === "string" ? body.description : "";
      language =
        typeof body.language === "string" && body.language.trim() ? body.language : "English";
      location =
        body.location ?? null;
      evidence =
        body.evidence ?? null;
    }

    if (
      !description ||
      !description.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Report description is required.",
        },
        { status: 400 }
      );
    }

    const prompt = `
You are VayuNetra, an environmental intelligence assistant for India.

Analyze this citizen environmental report.

Citizen report:
${description}

Reported language:
${language || "English"}

Reported location:
${JSON.stringify(
  location || "Not provided"
)}

Environmental evidence available to the system:
${JSON.stringify(
  evidence || "Not available"
)}

Photo evidence:
${
  imageData
    ? "A citizen photo is attached. Use only visibly supported details from the image."
    : "No photo was attached."
}

Use environmental evidence only as supporting context. Do not treat satellite indicators as AQI, and do not claim a pollution source is confirmed unless the evidence explicitly supports that conclusion.

Classify the report using EXACTLY one category from:

Environmental:
- industrial
- vehicular
- burning
- dust
- air_pollution
- water_pollution
- waste
- noise

Civic development:
- roads
- mobility
- public_transport
- water_supply
- drainage_flooding
- waste_sanitation
- education
- healthcare
- connectivity
- electricity
- public_spaces
- community_facilities

Other:
- other

Choose the category that best matches the citizen's primary reported problem.
Use civic-development categories for infrastructure or public-service needs even when no environmental issue is involved.

Choose exactly one severity:
- low
- moderate
- high
- critical

Return ONLY valid JSON with these fields:
{
  "category": "industrial | vehicular | burning | dust | air_pollution | water_pollution | waste | noise | roads | mobility | public_transport | water_supply | drainage_flooding | waste_sanitation | education | healthcare | connectivity | electricity | public_spaces | community_facilities | other",
  "severity": "low | moderate | high | critical",
  "summary": "short factual summary",
  "possibleSources": ["possible source 1", "possible source 2"],
  "recommendedAction": "practical community or authority action",
  "confidence": 0
}

The confidence must be a number from 0 to 1.

Important:
- Do not claim that a pollution source is confirmed from the citizen report alone.
- Use "possible", "reported", or similar wording when evidence is insufficient.
- Base the classification only on the information provided.
- Do not invent measurements, AQI values, or environmental observations.
`;

    const contents = imageData
      ? [
          {
            inlineData: {
              mimeType:
                imageData.mimeType,
              data: imageData.data,
            },
          },
          {
            text: prompt,
          },
        ]
      : prompt;

    const response =
      await generateGeminiResponse(
        ai,
        contents
      );

    const text = response.text;

    invalidModelOutput = true;

    if (!text) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    const parsed =
      JSON.parse(text);

    const analysis = validateAnalysis({
      ...parsed,
      provider: "gemini",
      source: "gemini-api",
    });

    invalidModelOutput = false;

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error: unknown) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    if (error instanceof SyntaxError || error instanceof TypeError) return NextResponse.json({ error: "Request body is malformed." }, { status: 400 });
    console.error(
      "Gemini analysis error:",
      error
    );

    if (invalidModelOutput) {
      return NextResponse.json(
        {
          error:
            "Gemini returned malformed analysis.",
        },
        { status: 502 }
      );
    }

    if (errorStatus(error) === 429) {
      return NextResponse.json(
        {
          error:
            "Gemini capacity is temporarily unavailable. Please try again shortly.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "30",
          },
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "AI analysis is temporarily unavailable. Please try again.",
      },
      { status: 503 }
    );
  }
}
