import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiAvailable, aiProvider, askZakai } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { loadSigningKeyFromEnv, MandateKeyUnavailableError } from "@/lib/mandate/mandate";
import { allMarkets } from "@/lib/global/registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
    locales: ["he", "en", "ar", "ru"],
    endpoints: {
      discovery: "/.well-known/zakai-mandate.json",
      jwks: "/.well-known/zakai-jwks.json",
      status: "/api/mandate/status/{jti}",
      verify: "/api/mandate/verify",
      scopes: "/api/mandate/scopes",
      openapi: "/api/mandate/openapi.json",
      institutions: "/en/institutions",
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
