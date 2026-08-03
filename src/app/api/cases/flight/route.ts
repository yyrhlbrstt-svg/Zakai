import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { buildFlightDemandLetter } from "@/lib/flightLetter";
import {
  computeEntitlement,
  computeEntitlementEU,
  type DistanceTier,
  type EuDistanceTier,
} from "@/lib/flightRights";
import { resolveAirlineContactEmail, resolveAirlineProviderKey } from "@/lib/airlineContacts";
import { firstOutreachEmail } from "@/lib/outreachEmail";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  passengerName: z.string().min(1).max(80),
  airline: z.string().min(1).max(120),
  flightNumber: z.string().min(1).max(40),
  flightDate: z.string().min(1).max(40),
  route: z.string().min(1).max(120),
  airlineContactEmail: z.string().email().max(120).optional(),
  jurisdiction: z.enum(["il", "eu"]),
  kind: z.enum(["cancelled", "delay"]),
  tier: z.enum(["short", "medium", "long"]),
  noticeDaysAhead: z.number().min(0).max(60).optional(),
  delayHours: z.number().min(0).max(48).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-flight", auth.userId, 15, 24 * 3600);
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

  const isEU = data.jurisdiction === "eu";
  const disruption =
    data.kind === "cancelled"
      ? {
          kind: "cancelled" as const,
          noticeDaysAhead: data.noticeDaysAhead ?? 0,
          tier: data.tier as DistanceTier & EuDistanceTier,
        }
      : {
          kind: "delay" as const,
          delayHours: data.delayHours ?? 8,
          tier: data.tier as DistanceTier & EuDistanceTier,
        };

  const letter = buildFlightDemandLetter({
    passengerName: data.passengerName || user.name || "",
    airline: data.airline,
    flightNumber: data.flightNumber,
    flightDate: data.flightDate,
    route: data.route,
    jurisdiction: data.jurisdiction,
    disruption,
  });

  // Statutory compensation becomes the "owed" amount (one-shot recovery).
  // Target 0 = full recovery expected.
  let amountShekels = 0;
  if (isEU) {
    const eu = computeEntitlementEU(disruption);
    // Rough ILS conversion for case tracking only (fee computed on documented recovery).
    amountShekels = Math.round((eu.compensationEur || 0) * 4);
  } else {
    const il = computeEntitlement(disruption);
    amountShekels = Math.round((il.compensationAgorot || 0) / 100);
  }
  // Floor so a case always has a non-zero original for fee math when recovery lands.
  if (amountShekels < 50) amountShekels = 50;

  const strategy = isEU
    ? "דרישת פיצוי EC261 עם Mandate"
    : "דרישת פיצוי לפי חוק שירותי תעופה עם Mandate";

  // buildFlightDemandLetter returns one string rather than {subject, body},
  // so the stance is applied to the body and the subject left untouched — the
  // dimensions the engine measures all live in the body anyway.
  const stance = await chooseStance({
    market: "IL",
    vertical: "airline",
    counterparty: String(data.airline).slice(0, 64),
  });
  const variant = variantById(stance.variantId);
  const drafted = { subject: "", body: letter };
  const staged = variant ? applyStance(drafted, variant) : drafted;
  const stanceApplied = variant !== undefined && stanceAffects(drafted, variant);

  const outreachTo = firstOutreachEmail(
    data.airlineContactEmail,
    resolveAirlineContactEmail(data.airline),
  );
  if (!outreachTo) {
    return NextResponse.json({ error: "needsOutreachEmail" }, { status: 400 });
  }

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: resolveAirlineProviderKey(data.airline),
      amountShekels,
      plan: `${data.flightNumber} · ${data.route}`,
      strategy,
      targetShekels: 0,
      draftMessage: staged.body,
      strategyVariant: stanceApplied ? stance.variantId : undefined,
      strategySeed: stanceApplied ? stance.seed : undefined,
      vertical: "airline",
      beneficiaryLabel: data.passengerName || undefined,
      counterpartyEmail: outreachTo,
      // Explicit agent click = consent to the draft → start APPROVED.
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
    body: letter,
    status: kase.status,
    amountShekels,
    message: "case_opened",
  });
}
