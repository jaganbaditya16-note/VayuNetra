import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { description, language, location } = body;

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
${location || "Not provided"}

Return ONLY valid JSON with these fields:
{
  "category": "air_pollution | water_pollution | waste | noise | traffic | other",
  "severity": "low | moderate | high | critical",
  "summary": "short factual summary",
  "possibleSources": ["possible source 1", "possible source 2"],
  "recommendedAction": "practical community or authority action",
  "confidence": 0
}

The confidence must be a number from 0 to 100.

Do not claim that a pollution source is confirmed from the citizen report alone.
Use wording such as "possible" or "reported" when evidence is insufficient.
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
      } catch (error: any) {
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

    if (error?.status === 429) {
      return NextResponse.json(
        {
          error:
            "Gemini request limit reached. Please wait a moment and try again.",
        },
        { status: 429 }
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
