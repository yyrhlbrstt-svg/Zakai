import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issuerKeyMatches } from "@/lib/mandate/delegation";
import { rateLimit } from "@/lib/ratelimit";
import { getPartnerIntelligence } from "@/lib/partner/intelligence";

/**
 * POST /api/partner/intelligence — partners only.
 *
 * Everything else this product publishes is deliberately open: the rights
 * graph, the mandate spec, the JWKS, the MCP server. This one is not, and the
 * reason is not artificial scarcity. Aggregated outcome evidence is the only
 * asset here that a competitor cannot reproduce by reading the source, and it
 * exists at all because people trusted us with their cases. Giving it away
 * anonymously would spend that trust on strangers; giving it to a named,
 * suspendable partner keeps it accountable to somebody.
 *
 * Auth is the delegated-issuer credential that already governs mandate
 * issuance — same hashed storage, same constant-time comparison, same
 * suspension switch. A partner who abuses this loses mandate issuance too,
 * which is a far better deterrent than a second key nobody can revoke.
 */

const schema = z.object({
  market: z.string().min(2).max(4),
  vertical: z.string().min(1).max(60),
  counterparty: z.string().min(1).max(80),
});

function presentedKey(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

export async function POST(request: Request) {
  const key = presentedKey(request);
  if (!key) {
    return NextResponse.json({ error: "partnerKeyRequired" }, { status: 401 });
  }

  // Rate-limited on the key BEFORE any database lookup by it, so an unknown
  // key cannot be used to probe timing or to hammer the outcome table.
  const limited = await rateLimit("partner-intelligence", key.slice(0, 64), 600, 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const issuers = await prisma.delegatedIssuer.findMany({
    select: { slug: true, keyHash: true, status: true },
    take: 500,
  });
  const issuer = issuers.find((i) => issuerKeyMatches(key, i.keyHash));
  if (!issuer) {
    return NextResponse.json({ error: "unknownPartner" }, { status: 401 });
  }
  if (issuer.status !== "active") {
    return NextResponse.json({ error: "partnerSuspended" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalidRequest" }, { status: 400 });
  }

  const intelligence = await getPartnerIntelligence({
    market: parsed.data.market.toUpperCase(),
    vertical: parsed.data.vertical,
    counterparty: parsed.data.counterparty,
  });

  return NextResponse.json({
    partner: issuer.slug,
    intelligence,
    /*
      Said in the payload, not only in a doc nobody reads: this is evidence,
      not advice, and its value is bounded by how many real cases stand
      behind it. A partner that treats a five-case win rate as a forecast is
      misusing it, and the numbers to notice that are right there.
    */
    disclaimer:
      "De-identified outcome evidence from real closed cases. Counts are exact; rates and averages are withheld below minTrials. Settlement-backed figures are independently verifiable against the published key; self-reported figures are not. Not legal advice and not a prediction.",
  });
}
