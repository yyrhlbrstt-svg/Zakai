import "server-only";
import { prisma } from "@/lib/prisma";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { providerHebrewName } from "@/lib/providers";

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
    },
  });

  if (cases.length === 0) {
    return [
      "CASES: none yet.",
      "NEXT: suggest /money (scan) or the tightest vertical for their question.",
    ].join("\n");
  }

  const sentIds = cases.filter((c) => c.status === "SENT").map((c) => c.id);
  const proposedMap = sentIds.length > 0 ? await getProposedSavingsMap(sentIds) : new Map();

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

  const open = cases.filter((c) => ACTIVE.has(c.status));
  if (open.length > 0) {
    const top = open[0]!;
    lines.push(
      "",
      `OPEN_LOOP: Case ${top.id} (${top.status}) needs user action on /dashboard?case=${top.id}`,
    );
  }

  const withProposal = sentIds.filter((id) => proposedMap.has(id));
  if (withProposal.length > 0) {
    const id = withProposal[0]!;
    const p = proposedMap.get(id)!;
    lines.push(
      "",
      `PROPOSED_SAVING: Provider reply detected for case ${id}. User should open /dashboard?case=${id} and one-tap record ₪${p.newAmountShekels}. Do NOT invent amounts.`,
    );
  }

  lines.push(
    "",
    "RULE: If OPEN_LOOP or PROPOSED_SAVING exists, that case wins over starting a new vertical.",
  );

  return lines.join("\n");
}
