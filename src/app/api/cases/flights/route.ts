import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import {
  computeEntitlement,
  computeEntitlementEU,
} from "@/lib/flightRights";
import { formatAgorot } from "@/lib/money";

const schema = z.object({
  airline: z.string().min(1),
  flightNumber: z.string().min(1),
  flightDate: z.string().min(1),
  route: z.string().min(1),
  jurisdiction: z.enum(["il", "eu"]),
  kind: z.enum(["cancelled", "delay"]),
  tier: z.enum(["short", "medium", "long"]),
  noticeDaysAhead: z.number().min(0).max(365).optional(),
  delayHours: z.number().min(0).max(48).optional(),
});

/**
 * Open a real Zakai case for a flight-compensation claim.
 * The user still sends the demand letter in their own name (legally clean),
 * but the case is tracked in the unified pipeline: status, follow-up, and
 * documentation of any compensation received.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return badRequest("mustLogin", 401);

  const activeCount = await prisma.case.count({
    where: { userId: auth.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user.plan, activeCount)) return badRequest("caseLimit", 403);

  const d = parsed.data;
  const isEU = d.jurisdiction === "eu";

  const entitlement =
    d.kind === "cancelled"
      ? isEU
        ? computeEntitlementEU({ kind: "cancelled", noticeDaysAhead: d.noticeDaysAhead ?? 0, tier: d.tier })
        : computeEntitlement({ kind: "cancelled", noticeDaysAhead: d.noticeDaysAhead ?? 0, tier: d.tier })
      : isEU
        ? computeEntitlementEU({ kind: "delay", delayHours: d.delayHours ?? 0, tier: d.tier })
        : computeEntitlement({ kind: "delay", delayHours: d.delayHours ?? 0, tier: d.tier });

  const compensationAgorot =
    ("compensationAgorot" in entitlement ? entitlement.compensationAgorot : 0) || 0;
  const compensationEur =
    ("compensationEur" in entitlement ? entitlement.compensationEur : 0) || 0;

  // For the case engine we treat the compensation as the "saving" amount and
  // the target as 0 (the user should pay nothing further to the airline).
  const amountShekels = isEU ? compensationEur * 4 : compensationAgorot / 100;
  if (amountShekels <= 0) {
    return NextResponse.json({ ok: false, reason: "no_compensation" }, { status: 422 });
  }

  const strategy = `תביעת פיצוי ${isEU ? "לפי תקנת EC 261" : "לפי חוק שירותי תעופה"} עבור טיסה ${d.flightNumber}.`;
  const draftMessage = `לכבוד מחלקת שירות הלקוחות של ${d.airline},

הנני פונה בדרישת פיצוי בגין טיסה ${d.flightNumber} בתאריך ${d.flightDate} בקו ${d.route}, בהתאם ל${isEU ? "תקנת (EC) 261/2004" : 'חוק שירותי תעופה, התשע"ב-2012'}.

אבקש את התייחסותכם וביצוע התשלום בתוך 21 ימים.

בכבוד,
${user.name}
(נוסח בסיוע זכאי — סוכן דיגיטלי)`;

  try {
    const kase = await createCase({
      userId: auth.userId,
      provider: "airline",
      amountShekels,
      plan: `${d.airline} ${d.flightNumber}`,
      strategy,
      targetShekels: 0,
      marketLowShekels: 0,
      marketHighShekels: amountShekels,
      draftMessage,
    });

    return NextResponse.json({
      ok: true,
      caseId: kase.id,
      compensationLabel: isEU ? `€${compensationEur}` : formatAgorot(compensationAgorot, "he-IL"),
      strategy,
      draftMessage,
    });
  } catch (err) {
    if (err instanceof CaseError && err.message === "CASE_LIMIT") {
      return badRequest("caseLimit", 403);
    }
    throw err;
  }
}
