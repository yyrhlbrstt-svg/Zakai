import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { COUPON_CATEGORIES } from "@/lib/coupons";
import { CouponError, addCoupon } from "@/lib/services/couponVault";

/**
 * Add a coupon to the vault.
 *
 * Nothing here fetches or discovers a code. Every row arrives because a person
 * typed it — which is the only way we can say a code is real without having an
 * agreement with whoever issued it.
 */
const schema = z.object({
  merchant: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(64),
  category: z.enum(COUPON_CATEGORIES),
  /** Whole percent. Mutually exclusive with amountShekels — enforced below. */
  percentOff: z.number().int().min(1).max(100).nullable().optional(),
  amountShekels: z.number().min(0.01).max(1_000_000).nullable().optional(),
  minSpendShekels: z.number().min(0.01).max(1_000_000).nullable().optional(),
  expiresAt: z.string().max(32).optional(),
  note: z.string().max(300).optional(),
  url: z.string().max(500).optional(),
});

/** Shekels in, agorot stored. Rounded once, at the boundary, never later. */
const toMinor = (v: number | null | undefined) =>
  v === null || v === undefined ? null : Math.round(v * 100);

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("coupons-add", auth.userId, 60, 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const d = parsed.data;

  try {
    const created = await addCoupon(auth.userId, {
      merchant: d.merchant,
      code: d.code,
      category: d.category,
      percentOff: d.percentOff ?? null,
      amountMinor: toMinor(d.amountShekels),
      minSpendMinor: toMinor(d.minSpendShekels),
      expiresAt: d.expiresAt,
      note: d.note,
      url: d.url,
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    if (err instanceof CouponError) {
      // A plan gate is a 403, not a validation error — the request was well
      // formed and the answer is "not on this plan".
      return badRequest(err.code, err.code === "planRequired" ? 403 : 400);
    }
    throw err;
  }
}
