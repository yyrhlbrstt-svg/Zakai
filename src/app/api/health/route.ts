import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiAvailable, aiProvider, askZakai } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { loadSigningKeyFromEnv, MandateKeyUnavailableError } from "@/lib/mandate/mandate";

export const dynamic = "force-dynamic";

/**
 * Public self-diagnostic — founder-on-a-phone check of deployment wiring.
 * Never exposes secrets.
 */
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
  } catch (err) {
    mandateKeys = !(err instanceof MandateKeyUnavailableError) ? false : false;
  }

  let mandateRevocationTable = false;
  try {
    await prisma.mandateRevocation.findFirst({ take: 1 });
    mandateRevocationTable = true;
  } catch {
    mandateRevocationTable = false;
  }

  const base = {
    ok: db,
    db,
    ai: aiAvailable(),
    aiProvider: aiProvider(),
    mandateKeys,
    mandateRevocationTable,
    markets: ["IL", "GB", "US"],
    locales: ["he", "en", "ar", "ru"],
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
