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

export function institutionDisplayName(
  locale: string,
  row: { displayNameHe: string; displayNameEn: string },
): string {
  if (locale === "he" || locale === "ar") return row.displayNameHe;
  return row.displayNameEn;
}
