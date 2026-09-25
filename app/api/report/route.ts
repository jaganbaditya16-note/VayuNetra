import { NextResponse } from "next/server";

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

    return NextResponse.json({
      success: true,
      message: "Environmental report received.",
      report: {
        description: description.trim(),
        language: language || "English",
        location: location || null,
        receivedAt: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}
