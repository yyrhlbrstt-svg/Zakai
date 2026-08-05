import "server-only";

export function appOriginForInstitutionEmails(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.MANDATE_ISSUER?.trim() ||
    "https://zakai-3uxj.vercel.app"
  ).replace(/\/+$/, "");
}

/** Shared block for verifier onboarding + outbound aggregate notices. */
export function conformanceProbeEmailSection(origin: string, institutionId?: string): string {
  const base = origin.replace(/\/+$/, "");
  const aud = (institutionId || "YOUR_AUD").trim().toLowerCase();
  return `
Finish inbound in one sitting (no call to Zakai required):
  1) Pilot package + filled sample curl:
     GET ${base}/api/institution/pilot-package?audience=${aud}
  2) Readiness wizard:
     ${base}/he/institutions/leader
  3) Clone receiver for your VPC:
     ${base}/reference/inbound-receiver/receive.mjs
  4) Ignore-cost meter (when volume exists):
     ${base}/api/institution/ignore-cost?institution=${aud}

Independent conformance (no SSRF — paste JWKS inline):
  POST ${base}/api/mandate/conformance/probe
  Body: { "jwks": [...], "audience": "${aud}", "sampleValidToken": "..." }

Join kit (all audiences): ${base}/api/network/join-kit
Test vectors: ${base}/api/mandate/test-vectors
JWKS: ${base}/.well-known/zakai-jwks.json
MCP (verification-only): not yet on the public npm registry — clone, then
  npm ci --prefix sdk && npm run build --prefix sdk && node sdk/dist/mcp-bin.js
  (full instructions: sdk/README.md, "MCP server" section)
`.trim();
}

export async function sendVerifierWelcomeEmail(input: {
  institutionId: string;
  displayNameEn: string;
  contactEmail: string;
  tier: string;
}): Promise<void> {
  const { sendEmail } = await import("@/lib/messaging");
  const origin = appOriginForInstitutionEmails();
  const { subject, body } = buildVerifierWelcomeEmail({
    origin,
    institutionId: input.institutionId,
    displayNameEn: input.displayNameEn,
    tier: input.tier,
    publicLeadersUrl: `${origin}/he/institutions/leaders`,
  });
  await sendEmail({
    to: input.contactEmail,
    subject,
    body,
  });
}

export function buildVerifierWelcomeEmail(input: {
  origin: string;
  institutionId: string;
  displayNameEn: string;
  tier: string;
  publicLeadersUrl: string;
}): { subject: string; body: string } {
  const probe = conformanceProbeEmailSection(input.origin, input.institutionId);
  return {
    subject: `Zakai — Reference Verifier listed (${input.tier})`,
    body: `Hello ${input.displayNameEn} team,

You are now on the public Reference Verifiers wall as \`${input.institutionId}\` (${input.tier} tier).

What this means:
- Display name is public; your contact email is not exposed in the API.
- When documented consumer outreach targets your Mandate audience, you may receive aggregate notices (no customer PII).

Next steps (self-serve, ~30 minutes):
${probe}

Public listing: ${input.publicLeadersUrl}
Outreach one-pager for your risk team: ${input.origin}/api/institution/outreach-kit

— Zakai Mandate network`,
  };
}
