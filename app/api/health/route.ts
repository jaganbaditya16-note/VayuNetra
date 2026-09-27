import { NextResponse } from "next/server";
import { getIntegrityConfigurationError, getReportsPersistenceConfiguration } from "@/lib/reports/persistence-config";
import { usesDevelopmentIntegrityFallback } from "@/lib/reports/analysis";

export async function GET() {
  const persistence = getReportsPersistenceConfiguration();
  const integrityError = getIntegrityConfigurationError();
  const production = process.env.NODE_ENV === "production";
  const developmentIntegrity = usesDevelopmentIntegrityFallback();

  const checks = {
    persistence: persistence.mode === "supabase" ? "configured" : persistence.mode,
    integrity: integrityError
      ? "misconfigured"
      : production
        ? "configured"
        : developmentIntegrity
          ? "development-placeholder"
          : "development-mode",
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
  };

  const ready = persistence.mode === "supabase" && !integrityError;

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      ready,
      checks,
      ...(developmentIntegrity
        ? {
            notice:
              "Using the non-production integrity placeholder because neither VAYUNETRA_INTEGRITY_SECRET nor GEMINI_API_KEY is set. Local reports are signed so the full pipeline works, but these signatures carry no security weight. Set VAYUNETRA_INTEGRITY_SECRET before deploying.",
          }
        : {}),
      version: process.env.npm_package_version ?? "0.1.0",
    },
    {
      status: ready || !production ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
