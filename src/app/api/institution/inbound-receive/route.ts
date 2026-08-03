import { NextResponse } from "next/server";
import { MandateError, MandateKeyUnavailableError } from "@/lib/mandate/mandate";
import {
  verifyMandateWithTrustRegistry,
  RegistryVerifyError,
} from "@/lib/mandate/verifyWithRegistry";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import {
  inboundReceiveBodySchema,
  rememberInboundJti,
} from "@/lib/protocol/inboundReceiver";
import { FORBIDDEN_SCOPES } from "@/lib/mandate/scopes";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reference institution inbound receiver — cloneable demo.
 * Institutions should host their own webhook; this proves the format end-to-end.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
  "Cache-Control": cacheControlHeader("live_aggregate"),
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  return NextResponse.json(
    {
      spec: "zakai-inbound-receive",
      role: "reference_receiver",
      post: "/api/institution/inbound-receive",
      docs: "/.well-known/zakai-inbound-receive.json",
      clone: "reference/inbound-receiver/",
    },
    { headers: CORS },
  );
}

export async function POST(request: Request) {
  const limited = await rateLimit("inbound-receive-ref", clientIp(request), 60, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  const raw = await request.json().catch(() => null);
  const parsed = inboundReceiveBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "malformed", details: parsed.error.flatten() },
      { status: 400, headers: CORS },
    );
  }
  const body = parsed.data;

  const idemHeader = request.headers.get("Idempotency-Key")?.trim();
  if (idemHeader && idemHeader !== body.mandate_jti) {
    return NextResponse.json(
      { error: "idempotency_mismatch", expect: "mandate_jti" },
      { status: 400, headers: CORS },
    );
  }

  if (rememberInboundJti(body.mandate_jti) === "duplicate") {
    return NextResponse.json(
      { error: "duplicate", mandate_jti: body.mandate_jti },
      { status: 409, headers: CORS },
    );
  }

  try {
    // Banks pin their own audience; the reference receiver extracts aud from
    // the token then verifies via trust registry (any admitted issuer).
    let audience = "";
    try {
      const mid = body.mandate_jws.split(".")[1];
      if (!mid) throw new Error("bad_token");
      const json = Buffer.from(mid, "base64url").toString("utf8");
      const raw = JSON.parse(json) as { aud?: string | string[] };
      audience = Array.isArray(raw.aud) ? String(raw.aud[0] ?? "") : String(raw.aud ?? "");
    } catch {
      return NextResponse.json({ error: "malformed_token" }, { status: 400, headers: CORS });
    }
    if (!audience) {
      return NextResponse.json({ error: "missing_audience" }, { status: 400, headers: CORS });
    }

    const { claims } = await verifyMandateWithTrustRegistry(body.mandate_jws, { audience });

    if (claims.jti !== body.mandate_jti) {
      return NextResponse.json(
        { error: "jti_mismatch" },
        { status: 400, headers: CORS },
      );
    }

    const scopes = claims.scopes ?? [];
    const hit = scopes.filter((s) => (FORBIDDEN_SCOPES as readonly string[]).includes(s));
    if (hit.length > 0) {
      return NextResponse.json(
        { error: "forbidden_scope", scopes: hit },
        { status: 422, headers: CORS },
      );
    }

    let revoked = false;
    try {
      const row = await prisma.mandateRevocation.findUnique({
        where: { jti: body.mandate_jti },
        select: { jti: true },
      });
      revoked = Boolean(row);
    } catch {
      /* db optional for reference */
    }
    if (revoked) {
      return NextResponse.json(
        { error: "revoked", mandate_jti: body.mandate_jti },
        { status: 401, headers: CORS },
      );
    }

    return NextResponse.json(
      {
        accepted: true,
        status: 202,
        mandate_jti: body.mandate_jti,
        intent: body.intent,
        vertical: body.vertical,
        note: "Reference receiver — process asynchronously in production.",
      },
      { status: 202, headers: CORS },
    );
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) {
      return NextResponse.json({ error: "signing_unavailable" }, { status: 503, headers: CORS });
    }
    if (err instanceof RegistryVerifyError) {
      return NextResponse.json(
        { error: "mandate_rejected", reason: err.code, detail: err.message },
        { status: 401, headers: CORS },
      );
    }
    if (err instanceof MandateError) {
      return NextResponse.json(
        { error: "mandate_rejected", reason: err.message },
        { status: 401, headers: CORS },
      );
    }
    return NextResponse.json({ error: "verify_failed" }, { status: 401, headers: CORS });
  }
}
