import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { fuseEvidence, rankHotspots } from "@/lib/environmental/fusion";
import { getReports } from "@/lib/reports/store";
import type {
  CitizenReport,
  EnvironmentalReading,
} from "@/lib/environmental/types";
import { coarseCoordinate } from "@/lib/reports/public";
import { isPriorityEligibleReport } from "@/lib/reports/analysis";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  getIntegrityConfigurationError,
  getReportsPersistenceConfiguration,
} from "@/lib/reports/persistence-config";

const CLUSTER_RADIUS_KM = 2;
const EARTH_ENGINE_TIMEOUT_MS = 12_000;
const EARTH_ENGINE_CACHE_TTL_MS = 15 * 60 * 1000;
const EARTH_ENGINE_MAX_OUTPUT_BYTES = 256 * 1024;
const EARTH_ENGINE_MAX_ERROR_BYTES = 32 * 1024;
const SATELLITE_CONCURRENCY = 2;

type SatelliteCacheEntry = {
  value: EnvironmentalReading | undefined;
  expiresAt: number;
};

const satelliteCache = new Map<string, SatelliteCacheEntry>();

const inFlightSatelliteRequests = new Map<
  string,
  Promise<EnvironmentalReading | undefined>
>();

function hasValidLocation(
  report: CitizenReport
): report is CitizenReport & {
  latitude: number;
  longitude: number;
} {
  return (
    typeof report.latitude === "number" &&
    typeof report.longitude === "number" &&
    Number.isFinite(report.latitude) &&
    Number.isFinite(report.longitude) &&
    !(report.latitude === 0 && report.longitude === 0)
  );
}

function distanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
) {
  const earthRadiusKm = 6371;
  const dLat = ((latitude2 - latitude1) * Math.PI) / 180;
  const dLon = ((longitude2 - longitude1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((latitude1 * Math.PI) / 180) *
      Math.cos((latitude2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

function clusterReports(reports: CitizenReport[]) {
  const clusters: CitizenReport[][] = [];
  for (const report of reports) {
    const matchingCluster = clusters.find((cluster) => {
      const reference = cluster[0];
      if (hasValidLocation(reference) && hasValidLocation(report)) {
        return distanceKm(reference.latitude, reference.longitude, report.latitude, report.longitude) <= CLUSTER_RADIUS_KM;
      }
      const key = hierarchyKey(report);
      return !hasValidLocation(reference) && key !== null && key === hierarchyKey(reference);
    });
    if (matchingCluster) matchingCluster.push(report);
    else clusters.push([report]);
  }
  return clusters;
}

function boundedAppend(
  current: string,
  chunk: Buffer,
  maxBytes: number
) {
  if (Buffer.byteLength(current) >= maxBytes) {
    return current;
  }

  const remaining = maxBytes - Buffer.byteLength(current);

  return (
    current +
    chunk.toString("utf8").slice(0, remaining)
  );
}

function satelliteCacheKey(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
) {
  return [
    latitude.toFixed(4),
    longitude.toFixed(4),
    startDate,
    endDate,
  ].join(":");
}

function runEarthEngine(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<EnvironmentalReading | undefined> {
  return new Promise((resolve) => {
    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "earth_engine.py"
    );

    const pythonCommand =
      process.platform === "win32"
        ? "py"
        : "python3";

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

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      childProcess.kill();

      console.error(
        "Earth Engine hotspot request timed out."
      );

      resolve(undefined);
    }, EARTH_ENGINE_TIMEOUT_MS);

    const finish = (
      value: EnvironmentalReading | undefined
    ) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };

    childProcess.stdout.on("data", (data: Buffer) => {
      stdout = boundedAppend(
        stdout,
        data,
        EARTH_ENGINE_MAX_OUTPUT_BYTES
      );
    });

    childProcess.stderr.on("data", (data: Buffer) => {
      stderr = boundedAppend(
        stderr,
        data,
        EARTH_ENGINE_MAX_ERROR_BYTES
      );
    });

    childProcess.on("error", (error) => {
      console.error(
        "Earth Engine process error:",
        error
      );

      finish(undefined);
    });

    childProcess.on("close", (code) => {
      if (settled) {
        return;
      }

      if (code !== 0) {
        console.error(
          "Earth Engine hotspot process failed:",
          stderr.slice(0, 500)
        );

        finish(undefined);
        return;
      }

      try {
        const lines = stdout
          .trim()
          .split(/\r?\n/)
          .filter(Boolean);

        const jsonLine = lines.at(-1);

        if (!jsonLine) {
          finish(undefined);
          return;
        }

        const result = JSON.parse(jsonLine) as {
          value?: unknown;
          source?: unknown;
          measuredAt?: unknown;
          error?: unknown;
        };

        if (result.error) {
          finish(undefined);
          return;
        }

        const measuredAt = typeof result.measuredAt === "string" ? result.measuredAt : new Date().toISOString();
        const measuredEnd = measuredAt.split(" to ").at(-1) ?? measuredAt;
        const age = Date.now() - new Date(`${measuredEnd}T23:59:59Z`).getTime();
        finish({
          id: `satellite-${latitude}-${longitude}`,
          city: "Satellite analysis area",
          area: "Environmental observation area",
          latitude,
          longitude,
          aqi: null,
          category: "NO₂",
          pm25: null,
          pm10: null,
          indicatorValue:
            typeof result.value === "number"
              ? result.value
              : null,
          source:
            typeof result.source === "string"
              ? result.source
              : "Earth Engine",
          sourceType: "satellite",
          measuredAt,
          provenance: {
            publisher: "European Space Agency Copernicus / Google Earth Engine",
            sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S5P_NRTI_L3_NO2",
            retrievedAt: new Date().toISOString(),
            measuredAt,
            geographicLevel: "point_buffer_10km",
            geographyId: null,
            geographyName: null,
            freshness: Number.isFinite(age) && age <= 30 * 24 * 60 * 60 * 1000 ? "fresh" : "stale",
            verification: "verified",
            delivery: "live",
          },
        });
      } catch (error) {
        console.error(
          "Could not parse Earth Engine hotspot result:",
          error
        );

        finish(undefined);
      }
    });
  });
}

async function getSatelliteReading(
  latitude: number,
  longitude: number
): Promise<EnvironmentalReading | undefined> {
  const endDate = new Date();
  const startDate = new Date(
    endDate.getTime() - 5 * 24 * 60 * 60 * 1000
  );

  const formatDate = (value: Date) =>
    value.toISOString().slice(0, 10);

  const startDateString = formatDate(startDate);
  const endDateString = formatDate(endDate);

  const key = satelliteCacheKey(
    latitude,
    longitude,
    startDateString,
    endDateString
  );

  const now = Date.now();
  const cached = satelliteCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value ? { ...cached.value, provenance: cached.value.provenance ? { ...cached.value.provenance, delivery: "cached" } : undefined } : undefined;
  }

  const existingRequest =
    inFlightSatelliteRequests.get(key);

  if (existingRequest) {
    return existingRequest;
  }

  const request = runEarthEngine(
    latitude,
    longitude,
    startDateString,
    endDateString
  )
    .then((value) => {
      satelliteCache.set(key, {
        value,
        expiresAt:
          Date.now() + EARTH_ENGINE_CACHE_TTL_MS,
      });

      return value;
    })
    .finally(() => {
      inFlightSatelliteRequests.delete(key);
    });

  inFlightSatelliteRequests.set(key, request);

  return request;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex++;

      if (index >= items.length) {
        return;
      }

      results[index] = await worker(
        items[index],
        index
      );
    }
  }

  const workerCount = Math.min(
    Math.max(1, concurrency),
    items.length
  );

  await Promise.all(
    Array.from(
      { length: workerCount },
      () => runWorker()
    )
  );

  return results;
}

export async function GET(request: Request) {
  // This route fans out to Earth Engine child processes, so it needs the same
  // per-client limit as the other public analysis routes.
  const rateLimitResponse = checkRateLimit(
    request,
    "hotspots",
    20,
    60_000,
  );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const integrityError =
      getIntegrityConfigurationError();

    if (integrityError) {
      return NextResponse.json(
        {
          success: false,
          error: integrityError,
          hotspots: [],
        },
        { status: 503 }
      );
    }

    const persistence =
      getReportsPersistenceConfiguration();

    if (persistence.mode === "error") {
      return NextResponse.json(
        {
          success: false,
          error: persistence.error,
          hotspots: [],
        },
        { status: 503 }
      );
    }

    const reports = (
      await getReports()
    ).filter(isPriorityEligibleReport).filter((report) => !["resolved", "rejected"].includes(report.status ?? "reported"));

    const locatedReports = reports.filter(hasUsableGeography);

    if (locatedReports.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        hotspots: [],
        demo: false,
        message:
          "No citizen reports with coordinates or administrative geography yet.",
      });
    }

    const clusters =
      clusterReports(locatedReports);

    const hotspots = await mapWithConcurrency(
      clusters,
      SATELLITE_CONCURRENCY,
      async (cluster, index) => {
        const coordinateReports = cluster.filter(hasValidLocation);
        const latitude = coordinateReports.length
          ? coordinateReports.reduce((sum, report) => sum + report.latitude, 0) / coordinateReports.length
          : null;
        const longitude = coordinateReports.length
          ? coordinateReports.reduce((sum, report) => sum + report.longitude, 0) / coordinateReports.length
          : null;
        const satelliteReading = latitude !== null && longitude !== null
          ? await getSatelliteReading(latitude, longitude)
          : undefined;
        const hasGeography = Boolean(cluster[0].geography);

        return fuseEvidence({
          location: {
            city: hasGeography ? "Reported administrative geography" : `Reported area ${index + 1}`,
            area: hasGeography ? "Citizen-reported administrative area" : `Citizen hotspot ${index + 1}`,
            latitude,
            longitude,
            geography: cluster[0].geography ?? null,
          },
          satelliteReading,
          citizenReports: cluster,
        });
      }
    );

    return NextResponse.json({
      success: true,
      count: hotspots.length,
      hotspots: rankHotspots(hotspots).map(
        (hotspot) => ({
          ...hotspot,
          location: {
            city: hotspot.location.city,
            area: hotspot.location.area,
            latitude:
              coarseCoordinate(
                hotspot.location.latitude
              ),
            longitude:
              coarseCoordinate(
                hotspot.location.longitude
              ),
          },
          satelliteEvidence:
            hotspot.satelliteEvidence
              ? {
                  indicator:
                    hotspot.satelliteEvidence
                      .indicator,
                  value:
                    hotspot.satelliteEvidence.value,
                  unit:
                    hotspot.satelliteEvidence.unit,
                  source: hotspot.satelliteEvidence.source,
                  measuredAt: hotspot.satelliteEvidence.measuredAt,
                  provenance: hotspot.satelliteEvidence.provenance,
                }
              : undefined,
        })
      ),
      demo: false,
    }, { headers: { "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=30" } });
  } catch (error) {
    console.error(
      "Hotspot clustering failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        hotspots: [],
        error:
          "Hotspot processing temporarily unavailable",
      },
      { status: 503 }
    );
  }
}

function hierarchyKey(report: CitizenReport): string | null {
  const geography = report.geography;
  if (!geography || !Array.isArray(geography.levels)) return null;
  const level = [...geography.levels].reverse().find((item) => item.identifier || item.name);
  return level ? `${geography.countryCode}:${level.level}:${level.identifier ?? level.name}` : null;
}

function hasUsableGeography(report: CitizenReport): boolean {
  return hasValidLocation(report) || hierarchyKey(report) !== null;
}
