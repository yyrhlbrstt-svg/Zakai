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
  note: string;
}

export function buildAuthorityWalletBundle(input: {
  origin: string;
  locale: string;
  country: string | null;
  row: GrantedAuthority;
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
    note:
      "Portable proof pack — institutions verify Mandate JWTs against jwks; humans verify authorization codes at public_page. Revocation propagates via status list.",
  };
}
