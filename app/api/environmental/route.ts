import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

type SatelliteReading = {
  value: number | null;
  unit: string;
  indicator: string;
  source: string;
  measuredAt: string;
  isSatelliteEstimate: boolean;
};

function runEarthEngine(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<SatelliteReading> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "earth_engine.py"
    );

    const childProcess = spawn("py", [
      scriptPath,
      String(latitude),
      String(longitude),
      startDate,
      endDate,
    ]);

    let stdout = "";
    let stderr = "";

    childProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    childProcess.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr || "Earth Engine process failed."
          )
        );
        return;
      }

      try {
        const lines = stdout
          .trim()
          .split(/\r?\n/)
          .filter(Boolean);

        const jsonLine = lines[lines.length - 1];

        const result = JSON.parse(jsonLine);

        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(result);
      } catch {
        reject(
          new Error(
            "Could not parse Earth Engine response."
          )
        );
      }
    });
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const latitude = Number(searchParams.get("latitude"));
    const longitude = Number(searchParams.get("longitude"));

    const startDate =
      searchParams.get("startDate") || "2026-09-20";

    const endDate =
      searchParams.get("endDate") || "2026-09-25";

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid latitude and longitude are required.",
        },
        { status: 400 }
      );
    }

    const satellite = await runEarthEngine(
      latitude,
      longitude,
      startDate,
      endDate
    );

    return NextResponse.json({
      success: true,
      satellite,
    });
  } catch (error) {
    console.error("Satellite data request failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Satellite data unavailable.",
      },
      { status: 500 }
    );
  }
}
