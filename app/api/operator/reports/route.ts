import { NextResponse } from "next/server";
import { getReportsPersistenceConfiguration, getIntegrityConfigurationError } from "@/lib/reports/persistence-config";

const MAX_LIMIT = 100;

async function authenticateOperator(request: Request, url: string, serviceRoleKey: string) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token.length > 4096) {
    return { response: NextResponse.json({ error: "Operator authentication required." }, { status: 401 }) };
  }
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!userResponse.ok) {
    return { response: NextResponse.json({ error: "Operator authentication failed." }, { status: 401 }) };
  }
  const user = await userResponse.json();
  if (user?.app_metadata?.role !== "operator" || typeof user?.id !== "string") {
    return { response: NextResponse.json({ error: "Operator role required." }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: Request) {
  const integrityError = getIntegrityConfigurationError();
  if (integrityError) return NextResponse.json({ error: integrityError }, { status: 503 });
  const persistence = getReportsPersistenceConfiguration();
  if (persistence.mode !== "supabase") {
    return NextResponse.json({ error: "Operator workflow requires Supabase." }, { status: 503 });
  }
  try {
    const auth = await authenticateOperator(request, persistence.url, persistence.serviceRoleKey);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "50") || 50, 1), MAX_LIMIT);
    const status = searchParams.get("status");
    const allowedStatuses = new Set(["reported", "under_review", "verified", "action_needed", "resolved", "rejected"]);
    if (status && !allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
    }

    const filter = status ? `&status=eq.${encodeURIComponent(status)}` : "";
    const response = await fetch(
      `${persistence.url}/rest/v1/vayunetra_reports?select=id,created_at,description,latitude,longitude,category,severity,summary,status,verification_status,assigned_authority,review_notes,resolution_notes,escalated,reviewed_at,resolved_at,geography&order=created_at.desc&limit=${limit}${filter}`,
      {
        headers: { apikey: persistence.serviceRoleKey, Authorization: `Bearer ${persistence.serviceRoleKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) throw new Error("Operator report list lookup failed.");
    const reports = await response.json();
    return NextResponse.json({ reports: Array.isArray(reports) ? reports : [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Operator report list is temporarily unavailable." }, { status: 503 });
  }
}
