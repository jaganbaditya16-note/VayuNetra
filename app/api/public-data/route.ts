import { NextResponse } from "next/server";
import { getPublicContextCatalog } from "@/lib/public-data/catalog";
import { OFFICIAL_SOURCE_REGISTRY, VERIFIED_PLANNING_SNAPSHOTS } from "@/lib/public-data/official-sources";

export async function GET() {
  return NextResponse.json({
    success: true,
    datasets: getPublicContextCatalog(),
    officialSourceRegistry: OFFICIAL_SOURCE_REGISTRY,
    verifiedPlanningSnapshots: VERIFIED_PLANNING_SNAPSHOTS,
    environmentalAdapter: {
      publisher: "European Space Agency Copernicus / Google Earth Engine",
      sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S5P_NRTI_L3_NO2",
      measurement: "Sentinel-5P tropospheric NO₂ column estimate; not ground AQI",
      access: "Available through /api/environmental when Earth Engine credentials/runtime are configured",
      freshnessPolicyDays: 30,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
