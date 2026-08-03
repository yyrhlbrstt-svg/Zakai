import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { buildCancelLetter, type CancelIntent } from "@/lib/cancelLetter";
import { rateLimit } from "@/lib/ratelimit";
import {
  pickOutreachEmail,
  resolveSubscriptionCompany,
} from "@/lib/normalizeSubscriptionProvider";
import { withFooter } from "@/lib/letterFooter";
import { localeForCountry } from "@/lib/localePath";
import { expressOpenBody, tryExpressMandateSend } from "@/lib/services/expressCaseOpen";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  company: z.string().min(1).max(120),
  product: z.string().min(1).max(120),
  accountOrEmail: z.string().max(120).optional(),
  contactEmail: z.string().max(120).optional(),
  monthlyShekels: z.number().min(0).max(100000).optional(),
  intent: z.enum(["cancel", "retention", "downgrade", "pause"]),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-cancel", auth.userId, 20, 24 * 3600);
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

  const resolved = resolveSubscriptionCompany(data.company, data.product);
  const outreachTo =
    pickOutreachEmail({
      contactEmail: data.contactEmail,
      defaultContactEmail: resolved.defaultContactEmail,
    }) || undefined;
  if (!outreachTo) {
    return NextResponse.json({ error: "needsOutreachEmail" }, { status: 400 });
  }

  const letter = buildCancelLetter({
    customerName: data.customerName || user.name || "",
    company: resolved.displayName,
    product: data.product,
    accountOrEmail: data.accountOrEmail,
    monthlyShekels: data.monthlyShekels,
    intent: data.intent as CancelIntent,
    reason: data.reason,
  });

  const amount = data.monthlyShekels && data.monthlyShekels > 0 ? data.monthlyShekels : 50;
  const target =
    data.intent === "cancel" || data.intent === "pause"
      ? 0
      : Math.round(amount * 0.7);

  const strategy =
    data.intent === "cancel"
      ? "ביטול מנוי מיידי עם Mandate"
      : data.intent === "retention"
        ? "בקשת שימור / התאמת מחיר"
        : data.intent === "downgrade"
          ? "הורדת מסלול"
          : "הקפאת מנוי";

  let kase;
  try {
    const stance = await chooseStance({
      market: "IL",
      vertical: "subscription",
      counterparty: resolved.providerKey.slice(0, 64),
    });
    const variant = variantById(stance.variantId);
    const staged = variant ? applyStance(letter, variant) : letter;
    const stanceApplied = variant !== undefined && stanceAffects(letter, variant);

    const loc = localeForCountry(user.country || "IL");
    const footerLocale = loc === "he" || loc === "ar" ? "he" : "en";
    const bodyWithFooter = withFooter(staged.body, footerLocale);

    kase = await createCase({
      userId: auth.userId,
      provider: resolved.providerKey.slice(0, 80),
      amountShekels: amount,
      plan: data.product,
      strategy,
      targetShekels: target,
      draftMessage: `${staged.subject}

${bodyWithFooter}`,
      strategyVariant: stanceApplied ? stance.variantId : undefined,
      strategySeed: stanceApplied ? stance.seed : undefined,
      vertical: "subscription",
      beneficiaryLabel: data.customerName || undefined,
      counterpartyEmail: outreachTo,
      autoApprove: true,
    });
  } catch (err) {
    if (err instanceof CaseError && err.message === "CASE_LIMIT") {
      return badRequest("caseLimit", 403);
    }
    throw err;
  }

  const express = await tryExpressMandateSend(kase.id, auth.userId, user.emailVerifiedAt);
  return NextResponse.json(
    expressOpenBody({
      caseId: kase.id,
      ...express,
      extra: {
        subject: letter.subject,
        body: letter.body,
        status: express.dispatched ? "SENT" : kase.status,
        outreachEmail: outreachTo,
        primed: kase.status === "VERIFIED" || Boolean(kase.ownershipVerifiedAt),
      },
    }),
  );
}
