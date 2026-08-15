import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { CouponError, deleteCoupon, setCouponUsed } from "@/lib/services/couponVault";

const patchSchema = z.object({ used: z.boolean() });

/** Mark a coupon used, or put it back if it was marked by mistake. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  try {
    await setCouponUsed(auth.userId, id, parsed.data.used);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CouponError) return badRequest(err.code, 404);
    throw err;
  }
}

/** Remove a code the person no longer wants us holding. Actually removed. */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  try {
    await deleteCoupon(auth.userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CouponError) return badRequest(err.code, 404);
    throw err;
  }
}
