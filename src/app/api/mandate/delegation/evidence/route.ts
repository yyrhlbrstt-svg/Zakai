import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import {
  dryRunIssuerAdmission,
  issuerEvidencePackage,
} from "@/lib/mandate/issuerEvidence";
import type { RegisteredIssuer } from "@/lib/mandate/trustRegistry";

export const runtime = "nodejs";

const candidateSchema = z.object({
  iss: z.string().url().max(400),
  name: z.string().trim().min(2).max(120),
  jwksUri: z.string().url().max(400),
  statusListUri: z.string().url().max(400),
  allowedScopes: z.array(z.string()).min(1).max(64),
  status: z.enum(["active", "suspended", "withdrawn"]).default("active"),
  admittedAt: z.string().trim().min(4).max(32).optional(),
  note: z.string().max(500).optional(),
});

/** Public conformance package — cloneable checklist for issuer #2. */
export async function GET() {
  return NextResponse.json(await issuerEvidencePackage(), {
    headers: {
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * Dry-run registry admission. Never writes ISSUERS / env / DelegatedIssuer.
 * Candidates learn scope and URI problems before emailing a human.
 */
export async function POST(request: Request) {
  const limited = await rateLimit("issuer-evidence-dryrun", clientIp(request), 30, 3600);
  if (!limited.ok) return badRequest("tooManyRequests", 429);

  const body = await request.json().catch(() => null);
  const parsed = candidateSchema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const candidate: RegisteredIssuer = {
    iss: parsed.data.iss,
    name: parsed.data.name,
    jwksUri: parsed.data.jwksUri,
    statusListUri: parsed.data.statusListUri,
    allowedScopes: parsed.data.allowedScopes,
    status: parsed.data.status,
    admittedAt: parsed.data.admittedAt ?? new Date().toISOString().slice(0, 10),
    ...(parsed.data.note ? { note: parsed.data.note } : {}),
  };

  const result = await dryRunIssuerAdmission(candidate);
  return NextResponse.json(
    {
      ...result,
      package_url: "/api/mandate/delegation/evidence",
    },
    {
      status: result.ok ? 200 : 422,
      headers: { "Access-Control-Allow-Origin": "*" },
    },
  );
}
