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

type CacheEntry = {
  value: SatelliteReading;
  expiresAt: number;
  staleUntil: number;
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_CACHE_TTL_MS = 60 * 60 * 1000;
const EARTH_ENGINE_TIMEOUT_MS = 12_000;
const MAX_OUTPUT_BYTES = 256 * 1024;
const MAX_ERROR_BYTES = 32 * 1024;
const MAX_DATE_RANGE_DAYS = 10;

const environmentalCache = new Map<string, CacheEntry>();

function satelliteProvenance(measuredAt: string, delivery: "live" | "cached", stale = false) {
  const endDate = measuredAt.split(" to ").at(-1) ?? "";
  const age = Date.now() - new Date(`${endDate}T23:59:59Z`).getTime();
  const fresh = Number.isFinite(age) && age <= 30 * 24 * 60 * 60 * 1000;
  return {
    publisher: "European Space Agency Copernicus / Google Earth Engine",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S5P_NRTI_L3_NO2",
    retrievedAt: new Date().toISOString(),
    measuredAt,
    geographicLevel: "point_buffer_10km",
    geographyId: null,
    geographyName: null,
    freshness: stale || !fresh ? "stale" : "fresh",
    verification: "verified",
    delivery,
  } as const;
}

function normalizeCoordinate(value: number) {
  return value.toFixed(4);
}

function cacheKey(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
) {
  return [
    normalizeCoordinate(latitude),
    normalizeCoordinate(longitude),
    startDate,
    endDate,
  ].join(":");
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function dateDifferenceDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();

  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

function appendBounded(
  current: string,
  chunk: Buffer,
  maxBytes: number
) {
  if (Buffer.byteLength(current) >= maxBytes) {
    return current;
  }

  const remaining = maxBytes - Buffer.byteLength(current);
  return current + chunk.toString("utf8").slice(0, remaining);
}

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

    const pythonCommand =
      process.platform === "win32" ? "py" : "python3";

    const childProcess = spawn(
      pythonCommand,
      [
        scriptPath,
        String(latitude),
        String(longitude),
        startDate,
        endDate,
      ],
      {
        windowsHide: true,
      }
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finishReject = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    };

    const finishResolve = (result: SatelliteReading) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    const timeout = setTimeout(() => {
      childProcess.kill();

      finishReject(
        new Error("Earth Engine request timed out.")
      );
    }, EARTH_ENGINE_TIMEOUT_MS);

    childProcess.stdout.on("data", (data: Buffer) => {
      stdout = appendBounded(stdout, data, MAX_OUTPUT_BYTES);
    });

    childProcess.stderr.on("data", (data: Buffer) => {
      stderr = appendBounded(stderr, data, MAX_ERROR_BYTES);
    });

    childProcess.on("error", (error) => {
      finishReject(error instanceof Error ? error : new Error("Earth Engine process failed."));
    });

    childProcess.on("close", (code) => {
      if (settled) {
        return;
      }

      if (code !== 0) {
        finishReject(new Error("Earth Engine process failed."));
        return;
      }

      try {
        const lines = stdout
          .trim()
          .split(/\r?\n/)
          .filter(Boolean);

        const jsonLine = lines.at(-1);

        if (!jsonLine) {
          finishReject(new Error("Earth Engine returned no result."));
          return;
        }

        const result = JSON.parse(jsonLine) as SatelliteReading & {
          error?: unknown;
        };

        if (result.error) {
          finishReject(new Error("Earth Engine returned an unavailable result."));
          return;
        }

        finishResolve(result);
      } catch {
        finishReject(
          new Error("Could not parse Earth Engine response.")
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

    const requestedStartDate = searchParams.get("startDate");
    const requestedEndDate = searchParams.get("endDate");

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

    const endDateValue = new Date();
    const startDateValue = new Date(
      endDateValue.getTime() - 5 * 24 * 60 * 60 * 1000
    );

    const formatDate = (value: Date) =>
      value.toISOString().slice(0, 10);

    const startDate =
      requestedStartDate || formatDate(startDateValue);

    const endDate =
      requestedEndDate || formatDate(endDateValue);

    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
      return NextResponse.json(
        {
          success: false,
          error: "Dates must use YYYY-MM-DD format.",
        },
        { status: 400 }
      );
    }

    const rangeDays = dateDifferenceDays(startDate, endDate);

    if (rangeDays < 0 || rangeDays > MAX_DATE_RANGE_DAYS) {
      return NextResponse.json(
        {
          success: false,
          error: `Date range must be between 0 and ${MAX_DATE_RANGE_DAYS} days.`,
        },
        { status: 400 }
      );
    }

    const key = cacheKey(
      latitude,
      longitude,
      startDate,
      endDate
    );

    const now = Date.now();
    const cached = environmentalCache.get(key);

    if (cached && cached.expiresAt > now) {
      return NextResponse.json(
        {
          success: true,
          satellite: cached.value,
          provenance: satelliteProvenance(cached.value.measuredAt, "cached"),
          cached: true,
        },
        {
          headers: {
            "Cache-Control": "private, max-age=900",
          },
        }
      );
    }

    try {
      const satellite = await runEarthEngine(
        latitude,
        longitude,
        startDate,
        endDate
      );

      environmentalCache.set(key, {
        value: satellite,
        expiresAt: now + CACHE_TTL_MS,
        staleUntil: now + STALE_CACHE_TTL_MS,
      });

      return NextResponse.json(
        {
          success: true,
          satellite,
          provenance: satelliteProvenance(satellite.measuredAt, "live"),
          cached: false,
        },
        {
          headers: {
            "Cache-Control": "private, max-age=900",
          },
        }
      );
    } catch (providerError) {
      console.error("Earth Engine request failed:", providerError);

      if (cached && cached.staleUntil > now) {
        return NextResponse.json(
          {
            success: true,
            satellite: cached.value,
            provenance: satelliteProvenance(cached.value.measuredAt, "cached", true),
            cached: true,
            stale: true,
          },
          {
            headers: {
              "Cache-Control": "private, max-age=60",
              "X-VayuNetra-Data": "stale-cache",
            },
          }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Satellite data is temporarily unavailable.",
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Satellite endpoint error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Satellite data is temporarily unavailable.",
      },
      { status: 503 }
    );
  }
}
