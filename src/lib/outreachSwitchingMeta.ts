import {
  SWITCHING_SPEC,
  SWITCHING_VERSION,
  SWITCHING_PROFILES,
  type SwitchingProfile,
} from "@/lib/protocol/switching";

export function switchingProfileForCase(input: {
  vertical: string;
  market?: string;
}): SwitchingProfile | undefined {
  const market = (input.market ?? "IL").toUpperCase();
  const vertical = input.vertical.toLowerCase();
  const exact = SWITCHING_PROFILES.find(
    (p) => p.vertical === vertical && (p.market === market || p.market === "*"),
  );
  if (exact) return exact;
  if (vertical === "subscription") {
    return SWITCHING_PROFILES.find((p) => p.id === "subscription-cancel-universal-1");
  }
  if (vertical === "telecom" || vertical === "mobile") {
    return SWITCHING_PROFILES.find((p) => p.id === "telecom-disconnect-il-1");
  }
  return undefined;
}

/** Machine-readable block appended to provider outreach (email footer). */
export function buildOutreachProtocolFooter(input: {
  appUrl: string;
  authCode: string;
  mandateJti?: string | null;
  vertical: string;
  market?: string;
}): string {
  const base = input.appUrl.replace(/\/+$/, "");
  const profile = switchingProfileForCase({
    vertical: input.vertical,
    market: input.market,
  });
  const lines = [
    "",
    "————————————————————————",
    "Zakai protocol metadata (for automated intake)",
    `${SWITCHING_SPEC}@${SWITCHING_VERSION}`,
    profile ? `switching_profile: ${profile.id}` : "switching_profile: unmapped",
    `authorization_code: ${input.authCode}`,
    `verify_human: ${base}/verify?code=${encodeURIComponent(input.authCode)}`,
  ];
  if (input.mandateJti) {
    lines.push(`mandate_jti: ${input.mandateJti}`);
    lines.push(`mandate_status: ${base}/api/mandate/status/${input.mandateJti}`);
  }
  lines.push(`mandate_jwks: ${base}/.well-known/zakai-jwks.json`);
  return lines.join("\n");
}
