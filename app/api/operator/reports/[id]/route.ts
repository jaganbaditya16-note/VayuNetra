import { NextResponse } from "next/server";
import { getReportsPersistenceConfiguration, getIntegrityConfigurationError } from "@/lib/reports/persistence-config";
import { REPORT_WORKFLOW, signReviewAudit, validateReviewTransition, verifyReviewAudit } from "@/lib/reports/review";
import { readBoundedBody, RequestBodyTooLargeError } from "@/lib/security/request-body";

const MAX_BODY_BYTES = 16_384;
const NOTE_MAX = 2000;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const integrityError = getIntegrityConfigurationError();
  if (integrityError) return NextResponse.json({ error: integrityError }, { status: 503 });
  const persistence = getReportsPersistenceConfiguration();
  if (persistence.mode !== "supabase") return NextResponse.json({ error: "Operator workflow requires Supabase." }, { status: 503 });
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token.length > 4096) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
  try {
    const userResponse = await fetch(`${persistence.url}/auth/v1/user`, {
      headers: { apikey: persistence.serviceRoleKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000), cache: "no-store",
    });
    if (!userResponse.ok) return NextResponse.json({ error: "Operator authentication failed." }, { status: 401 });
    const user = await userResponse.json();
    if (user?.app_metadata?.role !== "operator" || typeof user?.id !== "string") return NextResponse.json({ error: "Operator role required." }, { status: 403 });

    const declaredSize = Number(request.headers.get("content-length") ?? "0");
    if (declaredSize > MAX_BODY_BYTES) return NextResponse.json({ error: "Review request is too large." }, { status: 413 });
    if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return NextResponse.json({ error: "Review requests must use JSON." }, { status: 415 });
    const bytes = await readBoundedBody(request, MAX_BODY_BYTES);
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ error: "Review request is malformed." }, { status: 400 });
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Review request is malformed." }, { status: 400 });
    }
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Invalid report identifier." }, { status: 400 });
    const status = body?.status;
    const reviewNotes = body?.reviewNotes ?? null;
    const resolutionNotes = body?.resolutionNotes ?? null;
    const assignedAuthority = body?.assignedAuthority ?? null;
    const escalated = body?.escalated ?? false;
    if (typeof status !== "string" || !REPORT_WORKFLOW.some((allowed) => allowed === status) || ![reviewNotes, resolutionNotes, assignedAuthority].every((value) => value === null || (typeof value === "string" && value.length <= NOTE_MAX)) || typeof escalated !== "boolean") {
      return NextResponse.json({ error: "Review fields are invalid." }, { status: 400 });
    }
    const currentResponse = await fetch(`${persistence.url}/rest/v1/vayunetra_reports?id=eq.${encodeURIComponent(id)}&select=status`, {
      headers: { apikey: persistence.serviceRoleKey, Authorization: `Bearer ${persistence.serviceRoleKey}` }, cache: "no-store",
    });
    if (!currentResponse.ok) throw new Error("Report review lookup failed.");
    const rows = await currentResponse.json();
    const current = Array.isArray(rows) ? rows[0] : null;
    if (!current) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    if (!validateReviewTransition(current.status, status)) return NextResponse.json({ error: "Status transition is not allowed." }, { status: 409 });
    const timestamp = new Date().toISOString();
    const event = { reportId: id, actorId: user.id, previousStatus: current.status, nextStatus: status, timestamp, reviewNotes, resolutionNotes, assignedAuthority, escalated };
    const auditSecret = process.env.VAYUNETRA_INTEGRITY_SECRET?.trim() ?? "";
    if (Buffer.byteLength(auditSecret, "utf8") < 32) return NextResponse.json({ error: "VAYUNETRA_INTEGRITY_SECRET must contain at least 32 bytes for signed review events." }, { status: 503 });
    const signature = signReviewAudit(auditSecret, event);
    const response = await fetch(`${persistence.url}/rest/v1/rpc/apply_report_review`, {
      method: "POST", headers: { apikey: persistence.serviceRoleKey, Authorization: `Bearer ${persistence.serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_report_id: id, p_actor_id: user.id, p_expected_status: current.status, p_new_status: status, p_review_notes: reviewNotes, p_resolution_notes: resolutionNotes, p_assigned_authority: assignedAuthority, p_escalated: escalated, p_event_at: timestamp, p_event_signature: signature }),
      signal: AbortSignal.timeout(8000), cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Review was not applied; the report may have changed concurrently." }, { status: 409 });
    return NextResponse.json({ success: true, status, updatedAt: timestamp });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "Review request is too large." }, { status: 413 });
    if (error instanceof SyntaxError || error instanceof TypeError) return NextResponse.json({ error: "Review request is malformed." }, { status: 400 });
    return NextResponse.json({ error: "Operator review is temporarily unavailable." }, { status: 503 });
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const persistence = getReportsPersistenceConfiguration();
  if (persistence.mode !== "supabase") return NextResponse.json({ error: "Operator workflow requires Supabase." }, { status: 503 });
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token.length > 4096) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
  try {
    const userResponse = await fetch(`${persistence.url}/auth/v1/user`, { headers: { apikey: persistence.serviceRoleKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!userResponse.ok) return NextResponse.json({ error: "Operator authentication failed." }, { status: 401 });
    const user = await userResponse.json();
    if (user?.app_metadata?.role !== "operator") return NextResponse.json({ error: "Operator role required." }, { status: 403 });
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Invalid report identifier." }, { status: 400 });
    const [reportResponse, eventsResponse] = await Promise.all([
      fetch(`${persistence.url}/rest/v1/vayunetra_reports?id=eq.${encodeURIComponent(id)}&select=id,created_at,description,latitude,longitude,category,severity,summary,evidence,source,status,verification_status,assigned_authority,review_notes,resolution_notes,escalated,reviewed_at,resolved_at,geography`, { headers: { apikey: persistence.serviceRoleKey, Authorization: `Bearer ${persistence.serviceRoleKey}` }, cache: "no-store" }),
      fetch(`${persistence.url}/rest/v1/vayunetra_report_review_events?report_id=eq.${encodeURIComponent(id)}&select=id,actor_id,previous_status,next_status,event_at,review_notes,resolution_notes,assigned_authority,escalated,event_signature&order=event_at.desc`, { headers: { apikey: persistence.serviceRoleKey, Authorization: `Bearer ${persistence.serviceRoleKey}` }, cache: "no-store" }),
    ]);
    if (!reportResponse.ok || !eventsResponse.ok) throw new Error("Operator history lookup failed.");
    const reports = await reportResponse.json();
    const events = await eventsResponse.json();
    if (!Array.isArray(reports) || !reports[0]) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const auditSecret = process.env.VAYUNETRA_INTEGRITY_SECRET?.trim() ?? "";
    const verifiedEvents = Array.isArray(events) ? events.map((event) => {
      const payload = {
        reportId: event.report_id,
        actorId: event.actor_id,
        previousStatus: event.previous_status,
        nextStatus: event.next_status,
        timestamp: new Date(event.event_at).toISOString(),
        reviewNotes: event.review_notes ?? null,
        resolutionNotes: event.resolution_notes ?? null,
        assignedAuthority: event.assigned_authority ?? null,
        escalated: event.escalated === true,
      };
      return { ...event, signatureValid: auditSecret.length >= 32 && verifyReviewAudit(auditSecret, payload, event.event_signature) };
    }) : [];
    return NextResponse.json({ report: reports[0], events: verifiedEvents }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Operator report history is temporarily unavailable." }, { status: 503 });
  }
}
