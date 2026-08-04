/**
 * The only volume numbers that matter for the consumer loop:
 * Mandates sent, SavingsProofs recorded, completion rate per main vertical.
 *
 * No vanity (users, leads, pageviews). Documented proofs only — estimates
 * (selfReported) never inflate completion.
 */

import "server-only";
import { prisma } from "@/lib/prisma";

/** UI label → Case.vertical key(s). Money Hub / check map to telecom. */
export const MAIN_LOOP_VERTICALS: readonly {
  id: string;
  verticals: readonly string[];
  he: string;
  en: string;
}[] = [
  { id: "money", verticals: ["telecom"], he: "כסף שלי / סלולר", en: "My money / telecom" },
  { id: "cancel", verticals: ["subscription"], he: "ביטול מנוי", en: "Cancel" },
  { id: "electricity", verticals: ["electricity"], he: "חשמל", en: "Electricity" },
  { id: "deposit", verticals: ["deposit"], he: "פיקדון", en: "Deposit" },
  { id: "late-payment", verticals: ["late-payment"], he: "תשלום באיחור", en: "Late payment" },
  { id: "parking", verticals: ["parking"], he: "חניה", en: "Parking" },
  { id: "transport-fine", verticals: ["transport-fine"], he: "קנס תחבורה", en: "Transport fine" },
] as const;

const SENT_PLUS = new Set(["SENT", "SAVED", "NO_SAVING"]);

export type VerticalLoopStats = {
  id: string;
  labelHe: string;
  labelEn: string;
  opened: number;
  mandatesSent: number;
  proofsDocumented: number;
  /** opened → SENT+ */
  sendRatePct: number | null;
  /** SENT+ → documented SavingsProof */
  proofRatePct: number | null;
};

export type LoopVolumeSnapshot = {
  mandatesSent: number;
  mandatesActive: number;
  mandatesIssued7d: number;
  proofsDocumented: number;
  proofsDocumented7d: number;
  /** SENT+ → documented proof (overall) */
  overallProofRatePct: number | null;
  /** opened (all cases) → SENT+ */
  overallSendRatePct: number | null;
  casesOpened: number;
  sentWaitingProof: number;
  byVertical: VerticalLoopStats[];
  smtpConfigured: boolean;
};

export function pct(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 100);
}

/** Pure — used by tests and by loadLoopVolume. */
export function buildVerticalStats(
  cases: readonly { id: string; vertical: string; status: string }[],
  proofCaseIds: ReadonlySet<string>,
): VerticalLoopStats[] {
  return MAIN_LOOP_VERTICALS.map((def) => {
    const keys = new Set(def.verticals);
    const rows = cases.filter((c) => keys.has(c.vertical));
    const opened = rows.length;
    const sentRows = rows.filter((c) => SENT_PLUS.has(c.status));
    const mandatesSentV = sentRows.length;
    const proofs = rows.filter((c) => proofCaseIds.has(c.id)).length;
    return {
      id: def.id,
      labelHe: def.he,
      labelEn: def.en,
      opened,
      mandatesSent: mandatesSentV,
      proofsDocumented: proofs,
      sendRatePct: pct(mandatesSentV, opened),
      proofRatePct: pct(proofs, mandatesSentV),
    };
  });
}

export async function loadLoopVolume(smtpConfigured: boolean): Promise<LoopVolumeSnapshot> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const mainKeys = MAIN_LOOP_VERTICALS.flatMap((v) => [...v.verticals]);

  const [
    casesOpened,
    mandatesSent,
    mandatesActive,
    mandatesIssued7d,
    proofsDocumented,
    proofsDocumented7d,
    sentWaitingProof,
    casesInMain,
    proofRows,
  ] = await Promise.all([
    prisma.case.count(),
    prisma.case.count({ where: { status: { in: ["SENT", "SAVED", "NO_SAVING"] } } }),
    prisma.authorization.count({ where: { status: "ACTIVE", revokedAt: null } }),
    prisma.authorization.count({ where: { issuedAt: { gte: weekAgo } } }),
    prisma.savingsProof.count({
      where: { selfReported: false, savingMonthly: { gt: 0 } },
    }),
    prisma.savingsProof.count({
      where: {
        selfReported: false,
        savingMonthly: { gt: 0 },
        recordedAt: { gte: weekAgo },
      },
    }),
    prisma.case.count({ where: { status: "SENT" } }),
    prisma.case.findMany({
      where: { vertical: { in: [...mainKeys] } },
      select: { id: true, vertical: true, status: true },
      take: 50_000,
    }),
    prisma.savingsProof.findMany({
      where: { selfReported: false, savingMonthly: { gt: 0 } },
      select: { caseId: true },
      take: 50_000,
    }),
  ]);

  const proofCaseSet = new Set(proofRows.map((p) => p.caseId));
  const byVertical = buildVerticalStats(casesInMain, proofCaseSet);

  return {
    mandatesSent,
    mandatesActive,
    mandatesIssued7d,
    proofsDocumented,
    proofsDocumented7d,
    overallProofRatePct: pct(proofsDocumented, mandatesSent),
    overallSendRatePct: pct(mandatesSent, casesOpened),
    casesOpened,
    sentWaitingProof,
    byVertical,
    smtpConfigured,
  };
}
