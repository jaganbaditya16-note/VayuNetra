export type ReportsPersistenceConfiguration =
  | { mode: "supabase"; url: string; serviceRoleKey: string }
  | { mode: "local-json" }
  | { mode: "error"; error: string };

export function getReportsPersistenceConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): ReportsPersistenceConfiguration {
  const production = env.NODE_ENV === "production";
  const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (production) {
    if (!url || !serviceRoleKey) {
      return {
        mode: "error",
        error: "Production report persistence requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      };
    }
    return { mode: "supabase", url, serviceRoleKey };
  }

  if (url && serviceRoleKey) {
    return { mode: "supabase", url, serviceRoleKey };
  }

  return { mode: "local-json" };
}

export function getIntegrityConfigurationError(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (env.NODE_ENV === "production") {
    const secret = env.VAYUNETRA_INTEGRITY_SECRET?.trim() ?? "";
    if (!secret) {
      return "Production priority integrity requires the VAYUNETRA_INTEGRITY_SECRET environment variable.";
    }
    if (Buffer.byteLength(secret, "utf8") < 32) {
      return "VAYUNETRA_INTEGRITY_SECRET must contain at least 32 bytes in production.";
    }
  }
  return null;
}
