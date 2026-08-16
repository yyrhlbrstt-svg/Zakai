import "server-only";
import { secretsMatch } from "@/lib/security/timingSafe";
import { prisma } from "@/lib/prisma";

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
  return adminEmailList().includes(email.toLowerCase());
}

/** The parsed allow-list itself, for callers that need to query by it directly. */
export function adminEmailList(): string[] {
  return (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * User row IDs for every ADMIN_EMAIL address that has actually signed up.
 * Email is never lowercased at signup (see isAdminEmail's own comparison),
 * so this matches case-insensitively per address rather than a single `in`
 * filter, which would silently miss a differently-cased stored email.
 */
export async function findAdminUserIds(): Promise<string[]> {
  const emails = adminEmailList();
  if (emails.length === 0) return [];
  const admins = await prisma.user.findMany({
    where: { OR: emails.map((email) => ({ email: { equals: email, mode: "insensitive" } })) },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}
