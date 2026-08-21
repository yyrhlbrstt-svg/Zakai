import { NextResponse } from "next/server";
import { z } from "zod";
import { recordEvent } from "@/lib/events/spine";
import { getSessionUserId } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/**
 * Record that Zakai told somebody they are owed money.
 *
 * WHY THIS ENDPOINT EXISTS AT ALL
 *
 * The statement scan runs in the browser so a bank statement never leaves the
 * device, which means the one moment worth counting — the gate deciding to
 * speak — happens where the spine cannot see it. This is the narrowest
 * possible bridge: counts and confidences, no merchant strings, no amounts
 * that could identify a transaction beyond the estimate the person was shown,
 * and nothing resembling statement text.
 *
 * WHY IT REQUIRES A SESSION
 *
 * Not only to stop a stranger inflating the denominator, though it does. A
 * claim shown to a signed-out visitor can never be linked to a case, because
 * cases require an account — so counting it would put events in the
 * denominator that are structurally incapable of reaching the numerator, and
 * the ratio would drift downward for a reason that has nothing to do with
 * whether the detector is any good. Signed-in surfaces only, compared against
 * signed-in cases, is the honest comparison rather than the flattering one.
 */
const BodySchema = z.object({
  surface: z.enum(["money_scan", "leaks", "entitlements", "vertical_tool", "signal"]),
  claims: z
    .array(
      z.object({
        claimType: z.string().min(1).max(60),
        estimatedValueAgorot: z.number().int().nonnegative().nullable(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .min(1)
    .max(25),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const limited = await rateLimit("claim-surfaced", userId || clientIp(request), 60, 3600);
  if (!limited.ok) return NextResponse.json({ ok: false, error: "tooManyRequests" }, { status: 429 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  // Fail-soft on purpose, like the spine itself: a screen that could not be
  // counted is still a screen that helped somebody.
  let recorded = 0;
  for (const claim of parsed.data.claims) {
    const res = await recordEvent({
      eventType: "claim.surfaced",
      payload: {
        claimType: claim.claimType,
        estimatedValueAgorot: claim.estimatedValueAgorot,
        confidence: claim.confidence,
        surface: parsed.data.surface,
      },
    });
    if (res.ok) recorded += 1;
  }

  return NextResponse.json({ ok: true, recorded });
}
