import { NextResponse } from "next/server";
import { getIntegrityConfigurationError, getReportsPersistenceConfiguration } from "@/lib/reports/persistence-config";

export async function GET() {
  const persistence = getReportsPersistenceConfiguration();
  const integrityError = getIntegrityConfigurationError();
  const production = process.env.NODE_ENV === "production";

  const checks = {
    persistence: persistence.mode === "supabase" ? "configured" : persistence.mode,
    integrity: integrityError ? "misconfigured" : production ? "configured" : "development-mode",
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
  };

  const ready = persistence.mode === "supabase" && !integrityError;

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      ready,
      checks,
      version: process.env.npm_package_version ?? "0.1.0",
    },
    {
      status: ready || !production ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
