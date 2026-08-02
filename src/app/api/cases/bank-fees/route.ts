import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { buildBankFeeLetter, type BankFeeKind } from "@/lib/bankFeeLetter";
import { resolveBankProvider } from "@/lib/normalizeBankProvider";
import { withFooter } from "@/lib/letterFooter";
import { localeForCountry } from "@/lib/localePath";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  bankKey: z.string().max(32).optional(),
  bank: z.string().min(1).max(120),
  accountLast4: z.string().max(8).optional(),
  feeKind: z.enum(["account_mgmt", "atm", "foreign_fx", "check", "rejected", "other"]),
  feeDescription: z.string().max(160).optional(),
  amountShekels: z.number().min(0).max(50000).optional(),
  chargeDate: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-bank-fees", auth.userId, 20, 24 * 3600);
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

  const { providerKey, displayName } = resolveBankProvider({
    bankKey: data.bankKey,
    bankName: data.bank,
  });

  const letter = buildBankFeeLetter({
    customerName: data.customerName || user.name || "",
    bank: displayName,
    accountLast4: data.accountLast4,
    feeKind: data.feeKind as BankFeeKind,
    feeDescription: data.feeDescription,
    amountShekels: data.amountShekels,
    chargeDate: data.chargeDate,
  });

  const amount = data.amountShekels && data.amountShekels > 0 ? data.amountShekels : 30;

  let kase;
  try {
    // Ask the Strategy Engine how to pitch this one, and actually apply it.
    // Recording a stance that did not change the letter would attribute an
    // outcome to a choice that had no effect — fabricated evidence, which is
    // worse than none because none is visibly absent.
    const stance = await chooseStance({
      market: "IL",
      vertical: "bank-fees",
      counterparty: providerKey.slice(0, 64),
    });
    const variant = variantById(stance.variantId);
    const staged = variant ? applyStance(letter, variant) : letter;
    const stanceApplied = variant !== undefined && stanceAffects(letter, variant);

    const loc = localeForCountry(user.country || "IL");
    const footerLocale = loc === "he" || loc === "ar" ? "he" : "en";
    const bodyWithFooter = withFooter(staged.body, footerLocale);

    kase = await createCase({
      userId: auth.userId,
      provider: providerKey,
      amountShekels: amount,
      plan: data.feeDescription || data.feeKind,
      strategy: "ערעור על עמלת בנק עם Mandate",
      targetShekels: 0,
      draftMessage: `${staged.subject}

${bodyWithFooter}`,
      strategyVariant: stanceApplied ? stance.variantId : undefined,
      strategySeed: stanceApplied ? stance.seed : undefined,
      vertical: "bank-fees",
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
    subject: letter.subject,
    body: letter.body,
    status: kase.status,
    message: "case_opened",
  });
}
