import { NextResponse } from "next/server";
import { inspectMandate, looksLikeCompactJws } from "@/lib/mandate/inspect";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import type { RevocationState } from "@/lib/mandate/revocationCheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paste a mandate, get the truth about it — without taking our word for any of it.
 *
 * This is the endpoint a bank's engineer, a journalist, or another agent is
 * pointed at. It is a GET as well as a POST on purpose: a POST-only endpoint
 * cannot be pasted into a browser bar, quoted in an article, or clicked from a
 * chat, and "you must write a curl command first" is the same barrier as "call
 * us" wearing different clothes.
 *
 * The one rule it is built around: it never answers "valid". It answers which
 * checks ran, which did not, and hands back the JWKS URI so the reader can
 * redo the cryptography themselves. See lib/mandate/inspect.ts for why that
 * separation from /api/mandate/verify is deliberate rather than a duplication.
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const MAX_TOKEN = 16_384;

/** Live revocation for legacy tokens with no embedded status pointer. */
async function liveLookup(jti: string): Promise<RevocationState> {
  try {
    const row = await prisma.mandateRevocation.findUnique({
      where: { jti },
      select: { jti: true },
    });
    return row ? "revoked" : "active";
  } catch {
    // Fail closed. An unreachable store is not evidence of anything.
    return "unknown";
  }
}

/**
 * What an identifier alone can and cannot establish.
 *
 * A jti is a name, not a proof. It is worth answering because whoever was
 * handed one in a letter has no token to paste — but the answer must never
 * read like verification, so it says outright that the only cryptographic
 * check available needs the signed mandate itself.
 */
async function inspectIdentifier(jti: string) {
  let revoked = false;
  let issuedHere = false;
  let storeReachable = true;
  try {
    const [revocation, authorization] = await Promise.all([
      prisma.mandateRevocation.findUnique({ where: { jti }, select: { revokedAt: true } }),
      prisma.authorization.findUnique({
        where: { mandateJti: jti },
        select: { status: true, issuedAt: true },
      }),
    ]);
    revoked = Boolean(revocation);
    issuedHere = Boolean(authorization);
  } catch {
    storeReachable = false;
  }

  if (!storeReachable) {
    return {
      kind: "identifier" as const,
      jti,
      knownToThisIssuer: null,
      revoked: null,
      verdict: "unknown" as const,
      reason: "The status store could not be reached, so nothing is being asserted about this identifier.",
    };
  }

  if (revoked) {
    return {
      kind: "identifier" as const,
      jti,
      knownToThisIssuer: true,
      revoked: true,
      verdict: "revoked" as const,
      reason: "This mandate identifier is on the revocation list. It authorises nothing.",
    };
  }

  if (!issuedHere) {
    return {
      kind: "identifier" as const,
      jti,
      knownToThisIssuer: false,
      revoked: false,
      verdict: "not_issued_here" as const,
      reason:
        "No mandate with this identifier was issued by Zakai. Note that absence from a revocation " +
        "list alone never proves a mandate is real — only the signed mandate can be verified.",
    };
  }

  return {
    kind: "identifier" as const,
    jti,
    knownToThisIssuer: true,
    revoked: false,
    verdict: "issued_and_not_revoked" as const,
    reason:
      "Zakai issued a mandate with this identifier and has not revoked it. This is a recency check, " +
      "not a cryptographic one — paste the signed mandate itself to have the signature verified.",
  };
}

async function respond(rawToken: string, rawJti: string) {
  const token = rawToken.trim();
  const jti = rawJti.trim();

  if (!token && !jti) {
    return NextResponse.json(
      {
        error: "missing_input",
        need: ["token", "or", "jti"],
        hint: 'GET /api/mandate/inspect?token=<compact-jws>  ·  GET /api/mandate/inspect?jti=<mandate-id>',
      },
      { status: 400, headers: CORS },
    );
  }

  if (token) {
    if (token.length > MAX_TOKEN) {
      return NextResponse.json({ error: "token_too_large" }, { status: 400, headers: CORS });
    }
    if (!looksLikeCompactJws(token)) {
      // Somebody pasted an identifier into the token field. Answering the
      // question they meant beats returning a shape error about the one they
      // did not know they were asking.
      return NextResponse.json(await inspectIdentifier(token.slice(0, 128)), { headers: CORS });
    }
    const report = await inspectMandate(token, { liveLookup });
    return NextResponse.json({ kind: "mandate", ...report }, { headers: CORS });
  }

  if (jti.length < 8 || jti.length > 128) {
    return NextResponse.json({ error: "invalid_jti" }, { status: 400, headers: CORS });
  }
  return NextResponse.json(await inspectIdentifier(jti), { headers: CORS });
}

export async function GET(req: Request) {
  const limited = await rateLimit("mandate-inspect", clientIp(req), 60, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }
  const url = new URL(req.url);
  return respond(url.searchParams.get("token") ?? "", url.searchParams.get("jti") ?? "");
}

export async function POST(req: Request) {
  const limited = await rateLimit("mandate-inspect", clientIp(req), 60, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }
  let body: { token?: string; mandate?: string; jws?: string; jti?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: CORS });
  }
  return respond(body.token || body.mandate || body.jws || "", body.jti || "");
}
