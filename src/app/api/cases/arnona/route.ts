import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { ARNONA_AGENT_RIGHTS, buildArnonaAgentLetter } from "@/lib/arnonaAppeal";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  customerId: z.string().max(20).default(""),
  municipalityName: z.string().min(1).max(120),
  municipalityEmail: z.string().email().max(200),
  rightId: z.enum(ARNONA_AGENT_RIGHTS),
  propertyAddress: z.string().max(200).default(""),
  payerNumber: z.string().max(80).default(""),
  details: z.string().max(500).default(""),
  monthlyArnonaShekels: z.number().min(1).max(500_000),
  targetMonthlyShekels: z.number().min(0).max(500_000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-arnona", auth.userId, 20, 24 * 3600);
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

  const name = data.customerName.trim() || user.name || "";
  const letter = buildArnonaAgentLetter(data.rightId, {
    name,
    id: data.customerId.trim(),
    municipality: data.municipalityName.trim(),
    details: data.details.trim() || data.propertyAddress.trim(),
  });
  if (!letter) return badRequest("genericError");

  const target =
    data.targetMonthlyShekels != null && data.targetMonthlyShekels >= 0
      ? data.targetMonthlyShekels
      : Math.max(0, Math.round(data.monthlyArnonaShekels * 0.75));

  const stance = await chooseStance({
    market: "IL",
    vertical: "arnona",
    counterparty: data.municipalityName.slice(0, 64),
  });
  const variant = variantById(stance.variantId);
  const drafted = { subject: letter.subject, body: letter.body };
  const staged = variant ? applyStance(drafted, variant) : drafted;
  const stanceApplied = variant !== undefined && stanceAffects(drafted, variant);

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: data.municipalityName.slice(0, 80),
      counterpartyEmail: data.municipalityEmail,
      amountShekels: data.monthlyArnonaShekels,
      plan: data.payerNumber || data.propertyAddress || "ארנונה",
      strategy: "בקשת הנחה / תיקון חיוב ארנונה עם Mandate",
      targetShekels: target,
      draftMessage: `${staged.subject}\n\n${staged.body}`,
      strategyVariant: stanceApplied ? stance.variantId : undefined,
      strategySeed: stanceApplied ? stance.seed : undefined,
      vertical: "arnona",
      beneficiaryLabel: name || undefined,
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
