import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiAvailable, aiProvider, askZakai } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { loadSigningKeyFromEnv } from "@/lib/mandate/mandate";
import { allMarkets } from "@/lib/global/registry";
import { activeLocales } from "@/i18n/config";
import { isInternalOpsRequest } from "@/lib/ops/internalAdminGate";
import { allFlags } from "@/lib/flags";
import { errorReportingActive } from "@/lib/observability/sentry";

export const dynamic = "force-dynamic";

async function buildInternalHealth(request: Request) {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }

  let mandateKeys = false;
  try {
    loadSigningKeyFromEnv();
    mandateKeys = true;
  } catch {
    mandateKeys = false;
  }

  let mandateRevocationTable = false;
  try {
    await prisma.mandateRevocation.findFirst({ take: 1 });
    mandateRevocationTable = true;
  } catch {
    mandateRevocationTable = false;
  }

  const base = {
    ok: db && mandateKeys,
    db,
    ai: aiAvailable(),
    aiProvider: aiProvider(),
    mandateKeys,
    mandateRevocationTable,
    markets: allMarkets().map((m) => m.code),
    locales: activeLocales,
    endpoints: {
      discovery: "/.well-known/zakai-mandate.json",
      jwks: "/.well-known/zakai-jwks.json",
      status: "/api/mandate/status/{jti}",
      verify: "/api/mandate/verify",
      inspect: "/api/mandate/inspect",
      scopes: "/api/mandate/scopes",
      openapi: "/api/mandate/openapi.json",
      institutions: "/en/institutions",
      readiness: "/api/network/readiness",
    },
    time: new Date().toISOString(),
  };

  const url = new URL(request.url);
  if (url.searchParams.get("checkai") === "1" && aiAvailable()) {
    const limited = await rateLimit("health-checkai", clientIp(request), 10, 3600);
    if (!limited.ok) {
      return NextResponse.json({ ...base, aiCheck: "rate_limited" });
    }
    try {
      const answer = await askZakai("Reply with the single word: ok", {
        plan: "FREE",
        casesSummary: "No checks yet.",
        locale: "en",
      });
      return NextResponse.json({ ...base, aiCheck: "ok", sample: answer.slice(0, 40) });
    } catch (err) {
      const detail = err instanceof Error ? err.message.slice(0, 300) : "unknown";
      return NextResponse.json({ ...base, aiCheck: "error", detail });
    }
  }

  return NextResponse.json(base);
}

/**
 * Public liveness for load balancers — no infra fingerprinting.
 * Full diagnostics: GET ?internal=1 with header X-Zakai-Admin-Token (founder only).
 */
export async function GET(request: Request) {
  if (isInternalOpsRequest(request)) {
    return buildInternalHealth(request);
  }

  const limited = await rateLimit("health-public", clientIp(request), 120, 60);
  if (!limited.ok) {
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  }

  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }

  /*
    Flag state and whether errors are being recorded are deliberately public.

    Neither is a secret — the flags are visible in the UI they gate, and
    "somebody is watching for crashes" is a reassurance rather than an attack
    surface. Making them public is what lets the pre-demo check answer the
    question that actually matters five minutes before a demo: if this breaks
    now, will anyone ever know? A check that needed an admin token would be a
    check nobody ran.
  */
  return NextResponse.json(
    {
      ok: db,
      time: new Date().toISOString(),
      errorReporting: errorReportingActive(),
      flags: Object.fromEntries(allFlags().map((f) => [f.name, f.on])),
    },
    { status: db ? 200 : 503 },
  );
}
