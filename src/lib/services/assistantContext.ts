import "server-only";
import { prisma } from "@/lib/prisma";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { getAgentRoundMap } from "@/lib/services/agentFollowUp";
import { providerHebrewName } from "@/lib/providers";
import { resolveCaseOutreachTo } from "@/lib/caseOutreach";
import { MAX_AGENT_ROUNDS } from "@/lib/services/loopLimits";
import { buildFollowUp } from "@/lib/negotiation";
import { REPLY_KIND_OPTIONS } from "@/lib/negotiation";
import {
  nextActionHref,
  nextActionInstruction,
  rankNextAction,
} from "@/lib/services/nextAction";
import {
  cohortLearning,
  expectedRecoveryAgorot,
  formatLearningBrief,
  type LearningOutcomeRow,
} from "@/lib/strategy/learningInsights";
import { getPriorityCatalogBoosts } from "@/lib/services/priorityBoosts";
import { priorityDigestHe } from "@/lib/priority";

const ACTIVE = new Set(["ANALYZED", "APPROVED", "VERIFIED", "SENT"]);

/**
 * Rich case snapshot for the in-app assistant — open loops, proposed savings,
 * pending fees, and de-identified learning signals. Kept out of the cached
 * system prompt so live outcomes can update every request.
 */
export async function buildAssistantCasesSnapshot(userId: string): Promise<string> {
  const cases = await prisma.case.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: {
      id: true,
      provider: true,
      status: true,
      vertical: true,
      amountOriginal: true,
      targetAmount: true,
      savingsProof: { select: { savingMonthly: true } },
      fee: { select: { amount: true, status: true } },
      authorization: { select: { status: true } },
      counterpartyEmail: true,
    },
  });

  const [catalogBoosts, outcomeRows] = await Promise.all([
    getPriorityCatalogBoosts("IL").catch(() => ({}) as Record<string, number>),
    prisma.strategyOutcome
      .findMany({
        where: { market: "IL", createdAt: { gte: new Date(Date.now() - 540 * 86_400_000) } },
        select: {
          market: true,
          vertical: true,
          counterparty: true,
          variantId: true,
          paid: true,
          recoveredMinor: true,
          days: true,
          selfReported: true,
        },
        take: 8_000,
        orderBy: { createdAt: "desc" },
      })
      .catch(() => [] as LearningOutcomeRow[]),
  ]);

  if (cases.length === 0) {
    const digest = priorityDigestHe(catalogBoosts);
    return [
      "CASES: none yet.",
      nextActionInstruction({ kind: "start_money" }),
      "",
      "LIVE_PRIORITY (from documented StrategyOutcome when volume exists):",
      digest,
      "",
      "RULE: NEXT_ACTION wins over every other suggestion. End every reply with exactly one link: /money. Do not open score or secondary verticals first.",
    ].join("\n");
  }

  const sentIds = cases.filter((c) => c.status === "SENT").map((c) => c.id);
  const [proposedMap, agentRounds] = await Promise.all([
    sentIds.length > 0 ? getProposedSavingsMap(sentIds) : Promise.resolve(new Map()),
    getAgentRoundMap(sentIds),
  ]);
  const proposedHints = new Map(
    [...proposedMap.entries()].map(([id, p]) => [id, { newAmountShekels: p.newAmountShekels }]),
  );

  const learningByKey = new Map<string, ReturnType<typeof cohortLearning>>();
  for (const c of cases) {
    const key = `${c.vertical ?? "telecom"}::${c.provider}`;
    if (learningByKey.has(key)) continue;
    learningByKey.set(
      key,
      cohortLearning(outcomeRows, "IL", c.vertical ?? "telecom", c.provider),
    );
  }

  const rankedInputs = cases.map((c) => {
    const cohort = learningByKey.get(`${c.vertical ?? "telecom"}::${c.provider}`);
    return {
      id: c.id,
      status: c.status,
      fee: c.fee,
      agentRound: agentRounds.get(c.id) ?? 0,
      mandateActive: c.authorization?.status === "ACTIVE",
      hasOutreachEmail: Boolean(
        resolveCaseOutreachTo({
          counterpartyEmail: c.counterpartyEmail,
          provider: c.provider,
          vertical: c.vertical ?? "telecom",
        }),
      ),
      // Real expected recovery = delta × documented win rate (cold prior when thin).
      expectedRecoveryAgorot: expectedRecoveryAgorot(
        c.amountOriginal,
        c.targetAmount,
        cohort?.winRate ?? null,
      ),
    };
  });
  const ranked = rankNextAction(rankedInputs, proposedHints);
  const href = nextActionHref(ranked);

  const openLoops = cases
    .filter((c) => ACTIVE.has(c.status))
    .map((c) => {
      const cohort = learningByKey.get(`${c.vertical ?? "telecom"}::${c.provider}`);
      return {
        id: c.id,
        status: c.status,
        label: providerHebrewName(c.provider),
        expectedShekels: Math.round(
          expectedRecoveryAgorot(
            c.amountOriginal,
            c.targetAmount,
            cohort?.winRate ?? null,
          ) / 100,
        ),
        rounds: agentRounds.get(c.id) ?? 0,
      };
    })
    .sort((a, b) => b.expectedShekels - a.expectedShekels);

  const lines: string[] = [
    "CASES (EV = documented win-rate × amount gap when StrategyOutcome volume exists):",
  ];
  for (const c of cases) {
    const label = providerHebrewName(c.provider);
    const proposed = proposedMap.get(c.id);
    const cohort = learningByKey.get(`${c.vertical ?? "telecom"}::${c.provider}`);
    const expected = Math.round(
      expectedRecoveryAgorot(
        c.amountOriginal,
        c.targetAmount,
        cohort?.winRate ?? null,
      ) / 100,
    );
    const rounds = agentRounds.get(c.id) ?? 0;
    const outreach = resolveCaseOutreachTo({
      counterpartyEmail: c.counterpartyEmail,
      provider: c.provider,
      vertical: c.vertical ?? "telecom",
    });
    let line =
      `- id=${c.id} | ${label} | vertical=${c.vertical ?? "telecom"} | status=${c.status}` +
      ` | pays ₪${Math.round(c.amountOriginal / 100)}` +
      ` | target ₪${Math.round(c.targetAmount / 100)}` +
      ` | expected≈₪${expected}`;
    if (cohort) {
      line += ` | cohortWin=${(cohort.winRate * 100).toFixed(0)}%(n=${cohort.trials})`;
    }
    if (c.status === "SENT") {
      line += ` | rounds=${rounds}/${MAX_AGENT_ROUNDS}`;
      line += c.authorization?.status === "ACTIVE" ? " | Mandate=ACTIVE" : " | Mandate=INACTIVE";
      line += outreach ? " | outreach=ok" : " | outreach=MISSING";
    }
    if (c.savingsProof) {
      line += ` | documented ₪${Math.round(c.savingsProof.savingMonthly / 100)}`;
    }
    if (c.fee && c.fee.status === "PENDING" && c.fee.amount > 0) {
      line += ` | fee PENDING ₪${(c.fee.amount / 100).toFixed(2)}`;
    }
    if (proposed) {
      line += ` | INBOUND_PROPOSAL record ₪${proposed.newAmountShekels} conf=${(proposed.confidence * 100).toFixed(0)}%`;
    }
    lines.push(line);
  }

  if (openLoops.length >= 2) {
    lines.push(
      "",
      "MULTI_CASE_RANK (highest expected recovery first — attack #1 only):",
      ...openLoops.map(
        (c, i) =>
          `  ${i + 1}. ${c.id} ${c.label} status=${c.status} expected≈₪${c.expectedShekels}` +
          (c.status === "SENT" ? ` rounds=${c.rounds}/${MAX_AGENT_ROUNDS}` : ""),
      ),
    );
  }

  if (ranked.kind === "proposed_saving") {
    lines.push(
      "",
      `PROPOSED_SAVING: Provider reply detected for case ${ranked.caseId}. User should open ${href} and one-tap record ₪${ranked.newAmountShekels}.`,
    );
  }

  // Learning brief for the ranked case — explainable stance / timing from outcomes.
  const rankedCase =
    ranked.kind !== "start_money"
      ? cases.find((c) => "caseId" in ranked && c.id === ranked.caseId)
      : undefined;
  if (rankedCase) {
    const cohort = learningByKey.get(
      `${rankedCase.vertical ?? "telecom"}::${rankedCase.provider}`,
    );
    if (cohort) {
      lines.push("", ...formatLearningBrief(cohort, "he"));
      if (cohort.bestStance) {
        lines.push(
          `STANCE_RULE: Prefer ${cohort.bestStance.variantId} tone in written follow-ups for this counterparty. Explainable: ${cohort.bestStance.whyEn}`,
        );
      }
    }
  }

  if (
    ranked.kind === "sent_wait" ||
    ranked.kind === "sent_exhausted" ||
    ranked.kind === "proposed_saving"
  ) {
    const top = cases.find((c) => c.id === ranked.caseId);
    if (top) {
      const tip = buildFollowUp({
        customerName: "",
        providerLabel: providerHebrewName(top.provider),
        amountOriginalShekels: Math.round(top.amountOriginal / 100),
        targetShekels: Math.round(top.targetAmount / 100),
        replyKind: "delay",
        round: Math.min(MAX_AGENT_ROUNDS, (agentRounds.get(top.id) ?? 0) + 2),
      });
      const kinds = REPLY_KIND_OPTIONS.map((k) => k.id).join("|");
      lines.push(
        "",
        `NEGOTIATION_BRIEF (case ${top.id}): reply kinds ${kinds}. Tip: ${tip.tip} Next if silent: ${tip.nextIfNoReply}`,
      );
    }
  }

  const open = cases.filter((c) => ACTIVE.has(c.status));
  if (open.length > 0) {
    const topId =
      ranked.kind === "pending_fee" ||
      ranked.kind === "proposed_saving" ||
      ranked.kind === "sent_exhausted" ||
      ranked.kind === "needs_outreach" ||
      ranked.kind === "mandate_inactive" ||
      ranked.kind === "pre_send" ||
      ranked.kind === "sent_wait"
        ? ranked.caseId
        : open[0]!.id;
    const top = open.find((c) => c.id === topId) ?? open[0]!;
    lines.push(
      "",
      `OPEN_LOOP: Case ${top.id} (${top.status}) needs user action on /dashboard?case=${top.id}`,
      "OPEN_LOOP_RULE: Do NOT suggest /money, /cancel, or any new vertical while OPEN_LOOP exists. Stay on this Case.",
    );
  }

  lines.push(
    "",
    nextActionInstruction(ranked),
    `NEXT_ACTION_HREF: ${href}`,
    "",
    "RULE: NEXT_ACTION wins over every other suggestion. End every reply with exactly that one link and nothing else after it. Match the on-screen next-action panel. Prefer LEARNING / BEST_STANCE when coaching written follow-ups — never invent savings.",
  );

  return lines.join("\n");
}
