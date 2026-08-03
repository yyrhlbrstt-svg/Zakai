import { decide } from "@/lib/mandate/decision";
import type { MandateClaims } from "@/lib/mandate/mandate";
import { vectorDocument } from "@/lib/mandate/vectors";

/** Slug banks use as Mandate `aud` — e.g. bank-leumi */
const SLUG = /^[a-z][a-z0-9-]{1,46}[a-z0-9]$/;

export function isValidInstitutionSlug(slug: string): boolean {
  const s = slug.trim().toLowerCase();
  if (!SLUG.test(s)) return false;
  if (s.includes("--")) return false;
  return true;
}

export const VERIFIER_READINESS_AUDIENCE = "zakai-verifier-readiness-self-test";

export const VERIFIER_READINESS_ENDPOINTS = [
  { id: "interop", path: "/.well-known/zakai-interop.json" },
  { id: "jwks", path: "/.well-known/zakai-jwks.json" },
  { id: "protocol", path: "/.well-known/zakai-protocol.json" },
  { id: "discovery", path: "/.well-known/zakai-mandate.json" },
  { id: "registry", path: "/.well-known/zakai-trust-registry.json" },
  { id: "scopes", path: "/api/mandate/scopes" },
  { id: "test_vectors", path: "/api/mandate/test-vectors" },
] as const;

export async function serverSideReadinessOk(origin: string): Promise<boolean> {
  for (const ep of VERIFIER_READINESS_ENDPOINTS) {
    try {
      const res = await fetch(`${origin}${ep.path}`, { cache: "no-store" });
      if (!res.ok) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Machine gate for Pioneer / Reference Verifier listing.
 * Honor-system checkboxes are not enough — the same decide() the SDK runs
 * must pass every published authorization vector before anyone can claim support.
 */
export function authorizationVectorsConformant(): {
  ok: boolean;
  total: number;
  failed: string[];
} {
  const doc = vectorDocument() as {
    evaluated_at_unix: number;
    vectors: Array<{
      id: string;
      claims: MandateClaims;
      action: string;
      audience: string;
      subject?: string;
      market?: string;
      revocation?: "active" | "revoked" | "unknown";
      act_confirmation?: string;
      expect: { decision: string; reason?: string | null };
    }>;
  };
  const now = new Date(doc.evaluated_at_unix * 1000);
  const failed: string[] = [];
  for (const v of doc.vectors) {
    const result = decide({
      claims: v.claims,
      action: v.action,
      audience: v.audience,
      subject: v.subject,
      market: v.market,
      revocation: v.revocation ?? "unknown",
      actConfirmation: v.act_confirmation,
      now,
    });
    const expected =
      v.expect.reason != null && v.expect.reason !== ""
        ? `${v.expect.decision}:${v.expect.reason}`
        : v.expect.decision;
    const got =
      result.decision === "deny" && result.reason
        ? `deny:${result.reason}`
        : result.decision;
    if (got !== expected) failed.push(`${v.id}: expected ${expected}, got ${got}`);
  }
  return { ok: failed.length === 0, total: doc.vectors.length, failed };
}

export function institutionDisplayName(
  locale: string,
  row: { displayNameHe: string; displayNameEn: string },
): string {
  if (locale === "he" || locale === "ar") return row.displayNameHe;
  return row.displayNameEn;
}
