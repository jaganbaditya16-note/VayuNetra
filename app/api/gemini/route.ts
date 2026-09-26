import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function errorStatus(error: unknown) {\n  if (typeof error === "object" && error !== null && "status" in error) {\n    const status = (error as { status?: unknown }).status;\n    return typeof status === "number" ? status : undefined;\n  }\n  return undefined;\n}\n\nexport async function POST(request: Request) {
  try {
    const body = await request.json();

    const { description, language, location, evidence } = body;

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

The confidence must be a number from 0 to 100.

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
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });

        break;
      } catch (error: unknown) {
        console.error(`Gemini attempt ${attempt} failed:`, error);

        const status = error?.status;

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
  } catch (error: any) {
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