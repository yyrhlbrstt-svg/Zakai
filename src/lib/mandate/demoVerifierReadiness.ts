import "server-only";
import { randomUUID } from "node:crypto";
import {
  issueMandate,
  loadSigningKeyFromEnv,
} from "@/lib/mandate/mandate";
import { allocateStatusIndex, statusListUriForIssuer } from "@/lib/mandate/statusIndex";
import { prisma } from "@/lib/prisma";
import { VERIFIER_READINESS_AUDIENCE } from "@/lib/referenceVerifier";

function mandateIssuer(): string {
  return (
    process.env.MANDATE_ISSUER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://zakai-3uxj.vercel.app"
  );
}

/** Short-lived mandate for institutions to prove their verify client works. */
export async function issueVerifierReadinessDemoToken(): Promise<{
  token: string;
  jti: string;
} | null> {
  try {
    const key = loadSigningKeyFromEnv();
    const issuer = mandateIssuer();
    const jti = `readiness_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const statusIndex = await allocateStatusIndex(prisma, jti);
    const token = await issueMandate(
      {
        jti,
        issuer,
        audience: VERIFIER_READINESS_AUDIENCE,
        subject: "verifier-readiness-demo",
        principal: { name: "Verifier readiness demo", reference: "demo" },
        scopes: ["claim:submit"],
        market: "IL",
        statement: "Demo mandate for Reference Verifier readiness self-test only.",
        ttlSeconds: 3600,
        status: {
          idx: statusIndex,
          uri: statusListUriForIssuer(issuer),
        },
      },
      key,
    );
    return { token, jti };
  } catch {
    return null;
  }
}

/** Short-lived Mandate for a bank to POST into the reference inbound receiver. */
export async function issueInstitutionPilotSample(audience: string): Promise<{
  token: string;
  jti: string;
  audience: string;
  statusIndex: number;
} | null> {
  const aud = audience.trim().toLowerCase();
  if (!aud || aud.length < 3 || aud.length > 64) return null;
  try {
    const key = loadSigningKeyFromEnv();
    const issuer = mandateIssuer();
    const jti = `pilot_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const statusIndex = await allocateStatusIndex(prisma, jti);
    const token = await issueMandate(
      {
        jti,
        issuer,
        audience: aud,
        subject: "institution-pilot-sample",
        principal: { name: "Institution pilot sample", reference: "pilot" },
        scopes: ["request:records", "claim:submit"],
        market: "IL",
        statement: "Demo mandate for institution inbound pilot only — not a live consumer claim.",
        ttlSeconds: 3600,
        status: {
          idx: statusIndex,
          uri: statusListUriForIssuer(issuer),
        },
      },
      key,
    );
    return { token, jti, audience: aud, statusIndex };
  } catch {
    return null;
  }
}
