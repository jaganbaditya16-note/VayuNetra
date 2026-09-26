import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { fuseEvidence, rankHotspots } from "@/lib/environmental/fusion";
import { getReports } from "@/lib/reports/store";
import type {
  CitizenReport,
  EnvironmentalReading,
} from "@/lib/environmental/types";

const CLUSTER_RADIUS_KM = 2;

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

function clusterReports(
  reports: Array<
    CitizenReport & {
      latitude: number;
      longitude: number;
    }
  >
) {
  const clusters: Array<
    Array<
      CitizenReport & {
        latitude: number;
        longitude: number;
      }
    >
  > = [];

  for (const report of reports) {
    let matchingCluster:
      | Array<
          CitizenReport & {
            latitude: number;
            longitude: number;
          }
        >
      | undefined;

    for (const cluster of clusters) {
      const reference = cluster[0];

      if (
        distanceKm(
          reference.latitude,
          reference.longitude,
          report.latitude,
          report.longitude
        ) <= CLUSTER_RADIUS_KM
      ) {
        matchingCluster = cluster;
        break;
      }
    }

    if (matchingCluster) {
      matchingCluster.push(report);
    } else {
      clusters.push([report]);
    }
  }

  return clusters;
}

function getSatelliteReading(
  latitude: number,
  longitude: number
): Promise<EnvironmentalReading | undefined> {
  return new Promise((resolve) => {
    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "earth_engine.py"
    );

    const pythonCommand = process.platform === "win32" ? "py" : "python3";
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 5 * 24 * 60 * 60 * 1000);
    const formatDate = (value: Date) => value.toISOString().slice(0, 10);

    const childProcess = spawn(pythonCommand, [
      scriptPath,
      String(latitude),
      String(longitude),
      formatDate(startDate),
      formatDate(endDate),
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
        console.error("Earth Engine failed:", stderr);
        resolve(undefined);
        return;
      }

      try {
        const lines = stdout
          .trim()
          .split(/\r?\n/)
          .filter(Boolean);

        const result = JSON.parse(lines[lines.length - 1]);

        if (result.error) {
          console.error("Earth Engine error:", result.error);
          resolve(undefined);
          return;
        }

        resolve({
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
          source: result.source,
          sourceType: "satellite",
          measuredAt: result.measuredAt,
        });
      } catch (error) {
        console.error(
          "Could not parse Earth Engine result:",
          error
        );
        resolve(undefined);
      }
    });
  });
}

export async function GET() {
  try {
    const reports = getReports();
    const locatedReports = reports.filter(hasValidLocation);

    if (locatedReports.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        hotspots: [],
        demo: false,
        message: "No citizen reports with valid location data yet.",
      });
    }

    const clusters = clusterReports(locatedReports);

    const hotspots = await Promise.all(
      clusters.map(async (cluster, index) => {
        const latitude =
          cluster.reduce(
            (sum, report) => sum + report.latitude,
            0
          ) / cluster.length;

        const longitude =
          cluster.reduce(
            (sum, report) => sum + report.longitude,
            0
          ) / cluster.length;

        const satelliteReading = await getSatelliteReading(
          latitude,
          longitude
        );

        return fuseEvidence({
          location: {
            city: `Reported area ${index + 1}`,
            area: `Citizen hotspot ${index + 1}`,
            latitude,
            longitude,
          },
          satelliteReading,
          citizenReports: cluster,
        });
      })
    );

    return NextResponse.json({
      success: true,
      count: hotspots.length,
      hotspots: rankHotspots(hotspots),
      demo: false,
    });
  } catch (error) {
    console.error("Hotspot clustering failed:", error);

    return NextResponse.json(
      {
        success: false,
        hotspots: [],
        error: "Hotspot processing temporarily unavailable",
      },
      { status: 200 }
    );
  }
}