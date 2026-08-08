import "server-only";
import { absoluteLocaleUrl, localeForCountry } from "@/lib/localePath";
import { WELL_KNOWN_RELATIVE, absoluteWellKnown } from "@/lib/protocol/laws";
import type { GrantedAuthority } from "@/lib/services/authorityControl";

export const WALLET_BUNDLE_SPEC = "zakai-authority-wallet" as const;
export const WALLET_BUNDLE_VERSION = 1;

export interface AuthorityWalletBundle {
  spec: typeof WALLET_BUNDLE_SPEC;
  version: typeof WALLET_BUNDLE_VERSION;
  exportedAt: string;
  authorization: {
    code: string;
    provider: string;
    scope: string;
    status: string;
    issuedAt: string;
    revokedAt: string | null;
    caseId: string;
  };
  verify: {
    public_page: string;
    printable_document: string;
  };
  mandate_infrastructure: {
    protocol_manifest: string;
    jwks: string;
    trust_registry: string;
    verify_post: string;
    decide_post: string;
    status_uri_template: string;
    revocations: string;
  };
  /**
   * The signed settlement for this case, when one exists.
   *
   * The bundle carried the authority — proof that the person allowed the
   * claim — and nothing about how it ended. Half a record is a strange thing
   * to hand someone: it proves you were entitled to ask and says nothing
   * about what you got, which is the half a counterparty, a regulator or a
   * landlord would actually weigh.
   *
   * Null when the case has not settled, or settled before signing existed.
   * Absent is a real state and it is said, rather than being papered over
   * with an empty object that reads like a settlement of zero.
   */
  settlement: {
    jws: string;
    verify_post: string;
  } | null;
  note: string;
}

export function buildAuthorityWalletBundle(input: {
  origin: string;
  locale: string;
  country: string | null;
  row: GrantedAuthority;
  /** Signed settlement for this case, when the case has settled. */
  settlementJws?: string | null;
}): AuthorityWalletBundle {
  const loc = localeForCountry(input.country);
  const origin = input.origin.replace(/\/+$/, "");
  const code = input.row.code;
  const verifyPath = `/verify?code=${encodeURIComponent(code)}`;
  const docPath = `/authorization/${encodeURIComponent(code)}`;

  return {
    spec: WALLET_BUNDLE_SPEC,
    version: WALLET_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    authorization: {
      code: input.row.code,
      provider: input.row.provider,
      scope: input.row.scope,
      status: input.row.status,
      issuedAt: input.row.issuedAt.toISOString(),
      revokedAt: input.row.revokedAt?.toISOString() ?? null,
      caseId: input.row.caseId,
    },
    verify: {
      public_page: absoluteLocaleUrl(origin, loc, verifyPath),
      printable_document: absoluteLocaleUrl(origin, loc, docPath),
    },
    mandate_infrastructure: {
      protocol_manifest: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.protocol),
      jwks: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.jwks),
      trust_registry: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.trustRegistry),
      verify_post: `${origin}/api/mandate/verify`,
      decide_post: `${origin}/api/mandate/decide`,
      status_uri_template: `${origin}/api/mandate/status/{jti}`,
      revocations: `${origin}/api/mandate/revocations`,
    },
    settlement: input.settlementJws
      ? {
          jws: input.settlementJws,
          verify_post: `${origin}/api/mandate/verify-settlement`,
        }
      : null,
    note:
      "Portable proof pack — institutions verify Mandate JWTs against jwks; humans verify authorization codes at public_page. Revocation propagates via status list.",
  };
}
