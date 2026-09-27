import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function errorStatus(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

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

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();

      description = String(formData.get("description") ?? "");
      language = String(formData.get("language") ?? "English");

      const locationValue = formData.get("location");
      const evidenceValue = formData.get("evidence");

      if (typeof locationValue === "string" && locationValue.trim()) {
        location = JSON.parse(locationValue);
      }

      if (typeof evidenceValue === "string" && evidenceValue.trim()) {
        evidence = JSON.parse(evidenceValue);
      }

      const image = formData.get("image");

      if (image instanceof File && image.size > 0) {
        const allowedImageTypes = new Set([
          "image/jpeg",
          "image/png",
          "image/webp",
        ]);

        if (!allowedImageTypes.has(image.type)) {
          return NextResponse.json(
            {
              error: "Only JPEG, PNG, and WebP images are supported.",
            },
            { status: 400 }
          );
        }

        if (image.size > 8 * 1024 * 1024) {
          return NextResponse.json(
            {
              error: "Photo must be 8 MB or smaller.",
            },
            { status: 413 }
          );
        }

        const bytes = await image.arrayBuffer();

        imageData = {
          mimeType: image.type,
          data: Buffer.from(bytes).toString("base64"),
        };
      }
    } else {
      const body = await request.json();

      description = body.description ?? "";
      language = body.language || "English";
      location = body.location ?? null;
      evidence = body.evidence ?? null;
    }

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: "Report description is required." },
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
${JSON.stringify(location || "Not provided")}

Environmental evidence available to the system:
${JSON.stringify(evidence || "Not available")}

Photo evidence:
${
  imageData
    ? "A citizen photo is attached. Use only visibly supported details from the image."
    : "No photo was attached."
}

Use environmental evidence only as supporting context. Do not treat satellite indicators as AQI, and do not claim a pollution source is confirmed unless the evidence explicitly supports that conclusion.

Classify the report using EXACTLY one category from:
- industrial
- vehicular
- burning
- dust
- air_pollution
- water_pollution
- waste
- noise
- other

Choose the category that best matches the citizen's description.

Choose exactly one severity:
- low
- moderate
- high
- critical

Return ONLY valid JSON with these fields:
{
  "category": "industrial | vehicular | burning | dust | air_pollution | water_pollution | waste | noise | other",
  "severity": "low | moderate | high | critical",
  "summary": "short factual summary",
  "possibleSources": ["possible source 1", "possible source 2"],
  "recommendedAction": "practical community or authority action",
  "confidence": 0
}

The confidence must be a number from 0 to 1, where 1 means highest confidence.

Important:
- Do not claim that a pollution source is confirmed from the citizen report alone.
- Use "possible", "reported", or similar wording when evidence is insufficient.
- Base the classification only on the information provided.
- Do not invent measurements, AQI values, or environmental observations.
`;

    let response;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: imageData
            ? [
                {
                  inlineData: {
                    mimeType: imageData.mimeType,
                    data: imageData.data,
                  },
                },
                { text: prompt },
              ]
            : prompt,
          config: {
            responseMimeType: "application/json",
          },
        });

        break;
      } catch (error: unknown) {
        console.error(`Gemini attempt ${attempt} failed:`, error);

        const status = errorStatus(error);

        if (status === 429) {
          throw error;
        }

        if (attempt === 3) {
          throw error;
        }

        await sleep(attempt * 1500);
      }
    }

    const text = response?.text;

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    const analysis = JSON.parse(text);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error: unknown) {
    console.error("Gemini analysis error:", error);

    if (errorStatus(error) === 429) {
      return NextResponse.json(
        {
          error:
            "Gemini free-tier quota is temporarily exhausted. Please wait before trying again.",
        },
        {
          status: 429,
          headers: { "Retry-After": "60" },
        }
      );
    }

    return NextResponse.json(
      {
        error: "Gemini is temporarily unavailable. Please try again.",
      },
      { status: 503 }
    );
  }
}