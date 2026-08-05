import { NextResponse } from "next/server";
import { MandateError, MandateKeyUnavailableError } from "@/lib/mandate/mandate";
import {
  verifyMandateWithTrustRegistry,
  RegistryVerifyError,
} from "@/lib/mandate/verifyWithRegistry";
import { decide, permittedActions } from "@/lib/mandate/decision";
import { resolveRevocationState } from "@/lib/mandate/revocationCheck";
import { buildMandateRef, draftDecisionRecord } from "@/lib/settlement/records";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "May this agent do this, right now?" — one call, one answer.
 *
 * WHY THIS EXISTS ALONGSIDE /verify
 *
 * `/verify` answers whether a token is authentic. That leaves the institution
 * holding the hard part: matching scopes, checking the audience, enforcing
 * per-act confirmation, and deciding what an unknown revocation status means.
 * Every integrator writes those fifty lines, writes them differently, and gets
 * one of them wrong — usually the one where holding "may cancel my
 * subscriptions" is mistaken for agreement to cancel this one.
 *
 * So this endpoint returns a decision rather than evidence. An integration that
 * is five lines and never contains authorization logic is one that does not get
 * rewritten later, and giving away the hard part is precisely what makes
 * leaving expensive.
 *
 * The decision itself is pure and lives in `decision.ts`, tested offline. This
 * route does three things it cannot: verify the signature, look up revocation,
 * and rate-limit. Everything else is delegated, so the answer a caller gets
 * here and the answer they would compute themselves with the reference
 * verifier are the same answer.
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

interface Body {
  token?: string;
  audience?: string;
  action?: string;
  subject?: string;
  market?: string;
  actConfirmation?: string;
}

export async function POST(req: Request) {
  const limited = await rateLimit("mandate-decide", clientIp(req), 120, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: CORS });
  }

  const token = (body.token || "").trim();
  const audience = (body.audience || "").trim();
  const action = (body.action || "").trim();
  if (!token || !audience || !action) {
    return NextResponse.json(
      { error: "missing_fields", need: ["token", "audience", "action"] },
      { status: 400, headers: CORS },
    );
  }
  if (token.length > 16_384) {
    return NextResponse.json({ error: "token_too_large" }, { status: 400, headers: CORS });
  }

  try {
    const { claims, issuer } = await verifyMandateWithTrustRegistry(token, { audience });

    // Prefer signed status list when zkm.status is present; live DB otherwise.
    // Unknown is carried through honestly — never assume active on outage.
    const { state: revocation } = await resolveRevocationState({
      jti: claims.jti,
      status: claims.status,
      issuer: issuer.iss,
      jwksUri: issuer.jwksUri,
      liveLookup: async (jti) => {
        try {
          const row = await prisma.mandateRevocation.findUnique({
            where: { jti },
            select: { jti: true },
          });
          return row ? "revoked" : "active";
        } catch {
          return "unknown";
        }
      },
    });

    const input = {
      claims,
      audience,
      subject: body.subject?.trim() || undefined,
      market: body.market?.trim() || undefined,
      revocation,
    };

    const result = decide({ ...input, action, actConfirmation: body.actConfirmation });

    // The settlement layer's decision link, drafted rather than merely
    // documented. `/decide` computes permit/deny; the settlement chain needs
    // a *signed* record of that decision, and until now the only way to get
    // one was to read settlement/records.ts and reconstruct the shape by
    // hand — real friction for the one institution that would otherwise be
    // first to actually produce a chain link. `decision.institution` still
    // signs this, not Zakai: that field name is exactly where the caller's
    // own key goes. Handing over a filled-in draft is what makes producing
    // the first real settlement record five minutes of work instead of a
    // day reading a spec. Built via the two shared, tested helpers rather
    // than by hand here, precisely because hand-rolling this once already
    // produced a broken_chain (hashing the reference object instead of
    // reusing the mandate's own `hash` field) before it shipped.
    const mandateRef = buildMandateRef(claims, token);
    const settlementDecisionDraft = draftDecisionRecord(mandateRef, {
      institution: audience,
      action,
      decision: result.decision,
      reason: result.reason,
      actConfirmation: body.actConfirmation,
    });

    return NextResponse.json(
      {
        ...result,
        // What else this token is good for here. The first thing an integrator
        // asks, and the loop they would otherwise write themselves.
        permitted: permittedActions(input),
        principal: result.decision === "permit" ? claims.principal : undefined,
        settlementDecisionDraft,
        settlementNote:
          "Sign this record with your own key to create the settlement chain's decision link. See settlement.test_vectors_uri in the discovery document.",
      },
      // A deny is a successful answer to a legitimate question, not a client
      // error: 200 with decision:"deny". Returning 4xx would push integrators
      // into treating a network failure and a refusal as the same event.
      { status: 200, headers: CORS },
    );
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) {
      return NextResponse.json({ error: "issuer_key_unavailable" }, { status: 503, headers: CORS });
    }
    if (err instanceof RegistryVerifyError) {
      return NextResponse.json(
        {
          decision: "deny",
          reason: err.code.toLowerCase(),
          detail: err.message,
          obligations: [],
        },
        { status: 200, headers: CORS },
      );
    }
    if (err instanceof MandateError) {
      return NextResponse.json(
        { decision: "deny", reason: "invalid_token", detail: err.message, obligations: [] },
        { status: 200, headers: CORS },
      );
    }
    return NextResponse.json({ error: "verification_failed" }, { status: 500, headers: CORS });
  }
}
