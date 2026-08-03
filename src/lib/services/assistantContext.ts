import "server-only";
import { prisma } from "@/lib/prisma";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { getAgentRoundMap } from "@/lib/services/agentFollowUp";
import { providerHebrewName } from "@/lib/providers";
import { nextActionInstruction, rankNextAction } from "@/lib/services/nextAction";

const ACTIVE = new Set(["ANALYZED", "APPROVED", "VERIFIED", "SENT"]);

/**
 * Rich case snapshot for the in-app assistant — open loops, proposed savings,
 * pending fees. Kept out of the cached system prompt.
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
    },
  });

  if (cases.length === 0) {
    return [
      "CASES: none yet.",
      nextActionInstruction({ kind: "start_money" }),
      "",
      "RULE: NEXT_ACTION wins over every other suggestion. End every reply with /money. Do not open score or secondary verticals first.",
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
  const ranked = rankNextAction(
    cases.map((c) => ({
      id: c.id,
      status: c.status,
      fee: c.fee,
      agentRound: agentRounds.get(c.id) ?? 0,
      mandateActive: c.authorization?.status === "ACTIVE",
    })),
    proposedHints,
  );

  const lines: string[] = ["CASES (newest first):"];
  for (const c of cases) {
    const label = providerHebrewName(c.provider);
    const proposed = proposedMap.get(c.id);
    let line =
      `- id=${c.id} | ${label} | vertical=${c.vertical ?? "telecom"} | status=${c.status}` +
      ` | pays ₪${Math.round(c.amountOriginal / 100)}` +
      ` | target ₪${Math.round(c.targetAmount / 100)}`;
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

  if (ranked.kind === "proposed_saving") {
    lines.push(
      "",
      `PROPOSED_SAVING: Provider reply detected for case ${ranked.caseId}. User should open /dashboard?case=${ranked.caseId} and one-tap record ₪${ranked.newAmountShekels}.`,
    );
  }

  const open = cases.filter((c) => ACTIVE.has(c.status));
  if (open.length > 0) {
    const topId =
      ranked.kind === "pending_fee" ||
      ranked.kind === "proposed_saving" ||
      ranked.kind === "sent_exhausted" ||
      ranked.kind === "mandate_inactive" ||
      ranked.kind === "pre_send" ||
      ranked.kind === "sent_wait"
        ? ranked.caseId
        : open[0]!.id;
    const top = open.find((c) => c.id === topId) ?? open[0]!;
    lines.push(
      "",
      `OPEN_LOOP: Case ${top.id} (${top.status}) needs user action on /dashboard?case=${top.id}`,
    );
  }

  lines.push(
    "",
    nextActionInstruction(ranked),
    "",
    "RULE: NEXT_ACTION wins over every other suggestion. End every reply with that single link. Match the on-screen next-action panel.",
  );

  return lines.join("\n");
}
