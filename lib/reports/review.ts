import { createHmac, timingSafeEqual } from "node:crypto";

export const REPORT_WORKFLOW = ["reported", "under_review", "verified", "action_needed", "resolved", "rejected"] as const;
export type ReportWorkflowStatus = typeof REPORT_WORKFLOW[number];

const transitions: Record<ReportWorkflowStatus, readonly ReportWorkflowStatus[]> = {
  reported: ["under_review", "rejected"],
  under_review: ["verified", "action_needed", "rejected"],
  verified: ["under_review", "action_needed", "resolved", "rejected"],
  action_needed: ["under_review", "resolved", "rejected"],
  resolved: ["under_review"],
  rejected: ["under_review"],
};

export function validateReviewTransition(from: unknown, to: unknown): to is ReportWorkflowStatus {
  return typeof from === "string" && REPORT_WORKFLOW.includes(from as ReportWorkflowStatus) &&
    typeof to === "string" && transitions[from as ReportWorkflowStatus].includes(to as ReportWorkflowStatus);
}

export function signReviewAudit(secret: string, event: Record<string, unknown>): string {
  return createHmac("sha256", secret).update(JSON.stringify(event)).digest("hex");
}

export function verifyReviewAudit(secret: string, event: Record<string, unknown>, signature: string): boolean {
  const expected = signReviewAudit(secret, event);
  const actualBytes = Buffer.from(signature, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function sanitizePublicWorkflowStatus(value: unknown): ReportWorkflowStatus {
  return REPORT_WORKFLOW.includes(value as ReportWorkflowStatus) ? value as ReportWorkflowStatus : "reported";
}
