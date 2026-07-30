import { NextResponse } from "next/server";
import { z } from "zod";
import { aiAvailable, analyzeContractText, AiUnavailableError } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * No login required, on purpose: the whole appeal of a "paste your contract,
 * see the red flags" tool is that someone can try it the moment they're
 * staring at a lease, with nothing to sign up for first. Rate-limited by IP
 * instead of user id for exactly that reason — matches the mandate/verify
 * endpoint's shape, since both are public tools that call a paid AI provider.
 */
const MAX_CHARS = 20_000;

const schema = z.object({
  text: z.string().trim().min(20).max(MAX_CHARS),
});

export async function POST(request: Request) {
  if (!aiAvailable()) {
    return NextResponse.json({ error: "aiUnavailable" }, { status: 503 });
  }

  const limited = await rateLimit("contract-analyze", clientIp(request), 10, 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const analysis = await analyzeContractText(parsed.data.text);
    return NextResponse.json(analysis);
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: "aiUnavailable" }, { status: 503 });
    }
    await reportError(err, { route: "contract-analyze" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}
