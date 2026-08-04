import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { getAgentRoundMap } from "@/lib/services/agentFollowUp";
import { buildRankedCaseInputs } from "@/lib/services/rankCasesForNextAction";
import { nextActionHref, rankNextAction } from "@/lib/services/nextAction";
import { Link } from "@/i18n/routing";
import { providerHebrewName } from "@/lib/providers";
import { heEn } from "@/lib/heEn";

/**
 * Sticky resume for unfinished loops — habit + switching cost.
 * One CTA only; mirrors the next-action ranker. Hidden when nothing is open.
 */
export async function OpenLoopResumeBar({ locale }: { locale: string }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const cases = await prisma.case.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      status: true,
      provider: true,
      vertical: true,
      amountOriginal: true,
      targetAmount: true,
      counterpartyEmail: true,
      fee: { select: { amount: true, status: true } },
      authorization: { select: { status: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });
  if (cases.length === 0) return null;

  const sentIds = cases.filter((c) => c.status === "SENT").map((c) => c.id);
  const [proposedMap, agentRounds] = await Promise.all([
    sentIds.length > 0 ? getProposedSavingsMap(sentIds) : Promise.resolve(new Map()),
    getAgentRoundMap(sentIds),
  ]);
  const proposedHints = new Map(
    [...proposedMap.entries()].map(([id, p]) => [id, { newAmountShekels: p.newAmountShekels }]),
  );
  const ranked = rankNextAction(await buildRankedCaseInputs(cases, agentRounds), proposedHints);
  if (ranked.kind === "start_money") return null;

  const href = nextActionHref(ranked);
  const caseId = "caseId" in ranked ? ranked.caseId : null;
  const row = caseId ? cases.find((c) => c.id === caseId) : null;
  const provider = row ? providerHebrewName(row.provider) : "";
  const he = locale === "he" || locale === "ar";

  const label = (() => {
    switch (ranked.kind) {
      case "pending_fee":
        return he ? "גבו עמלת הצלחה — תיק פתוח" : "Collect success fee — open case";
      case "proposed_saving":
        return he
          ? `רשמו חיסכון מתועד — ${provider}`
          : `Record documented saving — ${provider}`;
      case "sent_exhausted":
        return he ? `סגרו לולאה — ${provider}` : `Close the loop — ${provider}`;
      case "needs_outreach":
        return he ? `חסר אימייל ספק — ${provider}` : `Need provider email — ${provider}`;
      case "mandate_inactive":
        return he ? `חדשו Mandate — ${provider}` : `Re-issue Mandate — ${provider}`;
      case "pre_send":
        return he ? `שלחו Mandate — ${provider}` : `Send Mandate — ${provider}`;
      case "sent_wait":
        return he ? `מעקב / SavingsProof — ${provider}` : `Follow-up / SavingsProof — ${provider}`;
      default:
        return he ? "המשיכו את התיק" : "Continue your case";
    }
  })();

  return (
    <>
      {/* Spacer so fixed bar never covers CTAs */}
      <div className="h-14" aria-hidden />
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[rgba(63,203,155,0.35)] bg-[rgba(6,12,18,0.94)] backdrop-blur-md">
        <div className="max-w-[1080px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-emerald">
              {heEn(he, "לולאה פתוחה", "Open loop")}
            </div>
            <div className="text-[13.5px] font-bold truncate">{label}</div>
          </div>
          <Link
            href={href}
            className="shrink-0 no-underline rounded-full px-4 py-2 text-[13px] font-extrabold text-[#06121A] bg-emerald hover:opacity-90"
          >
            {heEn(he, "המשך", "Continue")}
          </Link>
        </div>
      </div>
    </>
  );
}
