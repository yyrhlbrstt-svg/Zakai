import "server-only";
import { prisma } from "@/lib/prisma";
import {
  EXPIRING_SOON_DAYS,
  planHasCouponVault,
  sortCoupons,
  validateCoupon,
  type CouponRow,
} from "@/lib/coupons";

/**
 * Storage and access for the coupon vault.
 *
 * All the deciding lives in `@/lib/coupons` where it can be tested without a
 * database. This file does three things and nothing else: check the plan,
 * scope every query to one user, and write validated rows.
 */

export class CouponError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Enough rows to be a vault, few enough that one account cannot be a dump. */
export const MAX_COUPONS_PER_USER = 500;

const SELECT = {
  id: true,
  merchant: true,
  code: true,
  category: true,
  percentOff: true,
  amountMinor: true,
  currency: true,
  minSpendMinor: true,
  expiresAt: true,
  note: true,
  url: true,
  source: true,
  usedAt: true,
  createdAt: true,
} as const;

/**
 * The person's plan, read at the moment of the request.
 *
 * Deliberately not cached and not passed in from the client: a gate whose
 * input the caller supplies is not a gate.
 */
export async function userHasVault(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  return planHasCouponVault(user?.plan);
}

export async function listCoupons(userId: string): Promise<CouponRow[]> {
  const rows = await prisma.coupon.findMany({
    where: { userId },
    select: SELECT,
    take: MAX_COUPONS_PER_USER,
    orderBy: { createdAt: "desc" },
  });
  return sortCoupons(rows as CouponRow[]);
}

export async function addCoupon(
  userId: string,
  raw: Parameters<typeof validateCoupon>[0] & { note?: string; url?: string },
): Promise<{ id: string }> {
  if (!(await userHasVault(userId))) throw new CouponError("planRequired");

  const parsed = validateCoupon(raw);
  if (!parsed.ok) throw new CouponError(parsed.reason);

  const count = await prisma.coupon.count({ where: { userId } });
  if (count >= MAX_COUPONS_PER_USER) throw new CouponError("tooMany");

  const note = typeof raw.note === "string" ? raw.note.trim().slice(0, 300) : "";
  // Only http(s). A stored `javascript:` URL rendered as a link is a script
  // the person's own vault would run for them.
  const url =
    typeof raw.url === "string" && /^https?:\/\//i.test(raw.url.trim())
      ? raw.url.trim().slice(0, 500)
      : "";

  const created = await prisma.coupon.create({
    data: {
      userId,
      merchant: parsed.value.merchant,
      code: parsed.value.code,
      category: parsed.value.category,
      percentOff: parsed.value.percentOff,
      amountMinor: parsed.value.amountMinor,
      minSpendMinor: parsed.value.minSpendMinor,
      expiresAt: parsed.value.expiresAt,
      note,
      url,
      source: "manual",
    },
    select: { id: true },
  });
  return created;
}

/**
 * Mark used, or put it back.
 *
 * Scoped by `updateMany` with the userId in the filter rather than a
 * findUnique-then-update: a coupon id is guessable enough that the ownership
 * check has to be part of the write, not a step before it.
 */
export async function setCouponUsed(
  userId: string,
  id: string,
  used: boolean,
): Promise<void> {
  const res = await prisma.coupon.updateMany({
    where: { id, userId },
    data: { usedAt: used ? new Date() : null },
  });
  if (res.count === 0) throw new CouponError("notFound");
}

/**
 * Really delete, unlike a commitment.
 *
 * A commitment row is kept because it is evidence of what somebody was paying.
 * A coupon is not evidence of anything — it is a code the person chose to
 * store — so "delete" here means gone, which is also the only honest answer to
 * someone deleting a code they no longer want us holding.
 */
export async function deleteCoupon(userId: string, id: string): Promise<void> {
  const res = await prisma.coupon.deleteMany({ where: { id, userId } });
  if (res.count === 0) throw new CouponError("notFound");
}

/**
 * Coupons about to lapse, grouped by whose they are — for the weekly reminder.
 *
 * Deliberately not filtered by plan. The vault screen and the write path are
 * gated, but a date we are already holding is a date we honour: withholding
 * "your code expires on Tuesday" from someone who downgraded last month would
 * cost them real money to make a billing point.
 */
export async function expiringCouponsAcrossUsers(
  now: Date = new Date(),
): Promise<Map<string, CouponRow[]>> {
  const horizon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 86_400_000);
  const rows = await prisma.coupon.findMany({
    where: { usedAt: null, expiresAt: { gte: now, lte: horizon } },
    select: { ...SELECT, userId: true },
    orderBy: { expiresAt: "asc" },
    take: 5_000,
  });

  const byUser = new Map<string, CouponRow[]>();
  for (const r of rows) {
    const { userId, ...rest } = r;
    const list = byUser.get(userId) ?? [];
    list.push(rest as CouponRow);
    byUser.set(userId, list);
  }
  return byUser;
}
