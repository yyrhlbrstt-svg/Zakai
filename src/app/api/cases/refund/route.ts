import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { buildRefundLetter } from "@/lib/refundChase";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  company: z.string().min(1).max(120),
  orderId: z.string().max(80).optional(),
  product: z.string().max(120).optional(),
  amountShekels: z.number().min(0).max(500000).optional(),
  daysWaiting: z.number().min(0).max(365).default(14),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-refund", auth.userId, 20, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return badRequest("mustLogin", 401);

  const activeCount = await prisma.case.count({
    where: { userId: auth.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user.plan, activeCount)) return badRequest("caseLimit", 403);

  const letter = buildRefundLetter({
    customerName: data.customerName || user.name || "",
    company: data.company,
    orderId: data.orderId,
    product: data.product,
    amountShekels: data.amountShekels,
    daysWaiting: data.daysWaiting,
  });

  const amount = data.amountShekels && data.amountShekels > 0 ? data.amountShekels : 100;

  // The stance is chosen and applied before the letter is staged, so what the
  // engine recorded and what the counterparty received are the same document.
  const stance = await chooseStance({
    market: "IL",
    vertical: "refund-chase",
    counterparty: String(data.company).slice(0, 64),
  });
  const variant = variantById(stance.variantId);
  const drafted = letter;
  const staged = variant ? applyStance(drafted, variant) : drafted;
  const stanceApplied = variant !== undefined && stanceAffects(drafted, variant);

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: data.company.slice(0, 80),
      amountShekels: amount,
      plan: data.product || data.orderId || "החזר",
      strategy: "דרישת החזר כספי עם Mandate",
      targetShekels: 0,
      draftMessage: `${staged.subject}\n\n${staged.body}`,
      strategyVariant: stanceApplied ? stance.variantId : undefined,
      strategySeed: stanceApplied ? stance.seed : undefined,
      vertical: "refund-chase",
      beneficiaryLabel: data.customerName || undefined,
      autoApprove: true,
    });
  } catch (err) {
    if (err instanceof CaseError && err.message === "CASE_LIMIT") {
      return badRequest("caseLimit", 403);
    }
    throw err;
  }

  return NextResponse.json({
    caseId: kase.id,
    subject: staged.subject,
    body: staged.body,
    status: kase.status,
    message: "case_opened",
  });
}
