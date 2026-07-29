import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  issueMandate,
  loadSigningKeyFromEnv,
  MandateError,
  MandateKeyUnavailableError,
} from "@/lib/mandate/mandate";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { prisma } from "@/lib/prisma";
import { checkDelegation, delegationClaim, hashIssuerKey } from "@/lib/mandate/delegation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Two callers, and they are not the same caller.
 *
 * The first-party key issues mandates for this product's own users, whose
 * identity this product verified. A delegated agent's key issues for *its*
 * users, whom we have never met — so those mandates carry `on_behalf_of` and
 * say in plain words who performed the verification.
 *
 * Conflating them would mean this company vouching for a check it never
 * performed, which is the failure that ends a trust network permanently.
 */
async function resolveCaller(req: Request): Promise<
  | { kind: "first_party" }
  | { kind: "delegated"; slug: string; name: string; allowedScopes: string[] }
  | { kind: "rejected" }
> {
  const provided = (req.headers.get("x-zakai-issue-key") || "").trim();
  if (!provided) return { kind: "rejected" };

  const expected = process.env.MANDATE_ISSUE_KEY;
  if (expected && provided === expected) return { kind: "first_party" };

  // Looked up by hash, so the table holds no usable credential. Any failure
  // here is a rejection rather than a fallback: an issuance endpoint that
  // degrades open is one that issues authority when the database is slow.
  try {
    const row = await prisma.delegatedIssuer.findUnique({
      where: { keyHash: hashIssuerKey(provided) },
      select: { slug: true, name: true, allowedScopes: true, status: true },
    });
    if (!row || row.status !== "active") return { kind: "rejected" };
    void prisma.delegatedIssuer
      .update({ where: { slug: row.slug }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
    return { kind: "delegated", slug: row.slug, name: row.name, allowedScopes: row.allowedScopes };
  } catch {
    return { kind: "rejected" };
  }
}

export async function POST(req: Request) {
  const caller = await resolveCaller(req);
  if (caller.kind === "rejected") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit("mandate-issue", clientIp(req), 30, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: {
    audience?: string;
    subject?: string;
    name?: string;
    scopes?: string[];
    market?: string;
    statement?: string;
    reference?: string;
    contactMasked?: string;
    ttlSeconds?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const audience = (body.audience || "").trim();
  const subject = (body.subject || "").trim();
  const name = (body.name || "").trim();
  const statement = (body.statement || "").trim();
  const scopes = Array.isArray(body.scopes) ? body.scopes.map(String).slice(0, 32) : [];
  const market = (body.market || "IL").trim().toUpperCase().slice(0, 2);

  if (!audience || !subject || !name || !statement || scopes.length === 0) {
    return NextResponse.json(
      { error: "missing_fields", need: ["audience", "subject", "name", "statement", "scopes"] },
      { status: 400 },
    );
  }
  if (audience.length > 128 || subject.length > 128 || name.length > 200 || statement.length > 4000) {
    return NextResponse.json({ error: "field_too_long" }, { status: 400 });
  }

  // A delegated agent may request only what it was admitted for, and never an
  // act no mandate may carry — enforced here rather than trusted, because an
  // issuer that can exceed its grant by asking is not constrained at all.
  if (caller.kind === "delegated") {
    const allowed = checkDelegation(
      { slug: caller.slug, allowedScopes: caller.allowedScopes, status: "active" },
      scopes,
    );
    if (!allowed.ok) {
      return NextResponse.json(
        { error: "delegation_refused", reason: allowed.reason, scope: allowed.scope },
        { status: 403 },
      );
    }
  }

  const jti = randomUUID();
  const issuer =
    process.env.MANDATE_ISSUER ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://zakai-3uxj.vercel.app";

  try {
    const key = loadSigningKeyFromEnv();
    const token = await issueMandate(
      {
        jti,
        issuer,
        audience,
        subject,
        principal: {
          name,
          reference: body.reference?.slice(0, 64),
          contactMasked: body.contactMasked?.slice(0, 64),
        },
        scopes,
        market,
        statement:
          caller.kind === "delegated"
            ? `${statement}\n\n${delegationClaim(caller.slug, caller.name).note}`
            : statement,
        // The structured claim, not only the sentence above: a verifier's code
        // must be able to branch on delegation without parsing free text.
        onBehalfOf:
          caller.kind === "delegated" ? delegationClaim(caller.slug, caller.name) : undefined,
        ttlSeconds: body.ttlSeconds,
      },
      key,
    );

    const payloadB64 = token.split(".")[1];
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const claims = JSON.parse(payloadJson) as { exp: number };

    return NextResponse.json({
      jti,
      token,
      exp: claims.exp,
      // Echoed so a delegated caller can see, in its own logs, that the token
      // it received discloses the delegation rather than passing as ours.
      onBehalfOf: caller.kind === "delegated" ? caller.slug : undefined,
      jwks: "/.well-known/zakai-jwks.json",
      statusPath: `/api/mandate/status/${jti}`,
    });
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) {
      return NextResponse.json({ error: "mandate_keys_not_configured" }, { status: 503 });
    }
    if (err instanceof MandateError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    throw err;
  }
}
