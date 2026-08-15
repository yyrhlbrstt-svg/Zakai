import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId, badRequest } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { isPlanId, planConfig } from "@/lib/plans";

/**
 * Someone tried to pay us, and we could not take it.
 *
 * WHY THIS EXISTS
 *
 * `POST /api/account/plan` refuses a paid tier with 402 while no PSP is
 * configured — correctly; granting Pro for free would be worse. But the
 * refusal was the end of the road. A person tapped "upgrade", read a note
 * saying billing is not connected yet, and left, and nothing anywhere
 * recorded that it happened.
 *
 * That is the most expensive silence in the product. Not because of the
 * ₪19.90 — because the single hardest number to obtain in a business with no
 * revenue is *how many people would have paid*, and it was being thrown away
 * one tap at a time. Every other question about whether this works is
 * downstream of that one.
 *
 * Deliberately not a lead form. The person is signed in, so there is nothing
 * to type: one tap, recorded against the account. And deliberately not a
 * promise that anybody will call — `docs/INFRASTRUCTURE_DOCTRINE.md` forbids
 * that, and the copy says only that they will be told when it is possible to
 * pay, which is a thing we can actually do.
 */
const schema = z.object({ plan: z.string().trim().min(1).max(20) });

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("plan-interest", auth.userId, 10, 24 * 3600);
  if (!limited.ok) return badRequest("tooManyRequests", 429);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const { plan } = parsed.data;
  if (!isPlanId(plan) || planConfig(plan).priceAgorot === 0) {
    // Only a paid tier can be waited for. A free plan needs no queue.
    return badRequest("genericError");
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true, phone: true, email: true },
  });
  if (!user) return badRequest("mustLogin", 401);

  const vertical = `plan:${plan}`;

  /**
   * Idempotent by account and plan. Somebody who taps twice, or comes back
   * next week and taps again, is one person who wants to pay — counting them
   * twice would inflate the one number this endpoint exists to keep honest.
   */
  const existing = await prisma.lead.findFirst({
    where: { userId: auth.userId, vertical },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ ok: true, alreadyWaiting: true });

  await prisma.lead.create({
    data: {
      vertical,
      name: user.name,
      phone: user.phone ?? "",
      email: user.email,
      note: "ניסה לשדרג לפני שהחיוב חובר",
      userId: auth.userId,
    },
  });

  return NextResponse.json({ ok: true, alreadyWaiting: false });
}
