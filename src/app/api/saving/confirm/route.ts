import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeProposedSavingConfirm } from "@/lib/services/confirmProposedSaving";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(20).max(2000) });

/**
 * One-tap confirm for inbound-proposed SavingsProof (email magic link).
 * Token is the gate — no session required. Never auto-charges without click.
 */
export async function POST(request: Request) {
  const limited = await rateLimit("saving_confirm", clientIp(request), 30, 900);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const origin = new URL(request.url).origin;
    const result = await consumeProposedSavingConfirm(parsed.data.token, origin);
    if (!result.ok) {
      const status = result.error === "expired" || result.error === "invalid" ? 400 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  } catch (err) {
    await reportError(err, { route: "saving-confirm" });
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
