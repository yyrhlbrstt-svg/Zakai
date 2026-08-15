import "server-only";
import { secretsMatch } from "@/lib/security/timingSafe";

/** Founder/ops diagnostics — never expose env values in JSON. */
export function isInternalOpsRequest(request: Request): boolean {
  const adminToken = process.env.ZAKAI_ADMIN_TOKEN?.trim();
  if (!adminToken) return false;
  const url = new URL(request.url);
  if (url.searchParams.get("internal") !== "1") return false;
  const provided = request.headers.get("x-zakai-admin-token") || "";
  return secretsMatch(provided, adminToken);
}

/**
 * Same ADMIN_EMAIL allow-list /founder itself is gated by (comma-separated).
 * Shared so a second consumer — /api/founder/grant-owner-access — can't drift
 * from the one place that decides who is the founder.
 */
export function isAdminEmail(email: string): boolean {
  const allow = (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}
