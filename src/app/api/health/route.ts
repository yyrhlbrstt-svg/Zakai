import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiAvailable, aiProvider, askZakai } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Public self-diagnostic — lets anyone (read: the founder, on a phone)
 * verify the deployment's wiring in one glance, without exposing secrets:
 *  - db:  can the app reach the database?
 *  - ai:  is ANTHROPIC_API_KEY configured? (turns on bill-photo analysis,
 *         the assistant chat, and screenshot scanning)
 */
export async function GET(request: Request) {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }

  const base = {
    ok: db,
    db,
    ai: aiAvailable(),
    aiProvider: aiProvider(),
    time: new Date().toISOString(),
  };

  // ?checkai=1 → make one real, tiny model call and report the provider's
  // exact (sanitized) answer. Turns "something went wrong" into a diagnosis
  // anyone can read off their phone. Rate-limited: it costs tokens.
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
