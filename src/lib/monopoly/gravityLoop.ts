/**
 * Monopoly execution loop — what to do next from real counters only.
 * Never invent volume, partners, or “we already won.”
 */

import type { PipeNetworkVolume } from "@/lib/pipe/pipeNetwork";
import type { RailMaturity } from "./sevenRails";

export type PipeGravityTier = "empty" | "signal" | "gravity" | "network";

export type MonopolyMoveId =
  | "smtp"
  | "merge_deploy"
  | "verify_email_fast_path"
  | "volume_sent"
  | "volume_proof"
  | "second_issuer"
  | "institution_pull"
  | "hold_phase_d";

export interface MonopolyNextMove {
  id: MonopolyMoveId;
  /** 1 = do first */
  priority: number;
  titleHe: string;
  titleEn: string;
  whyHe: string;
  whyEn: string;
  href?: string;
  /** True when this move blocks Visa-like gravity */
  blocksMonopoly: boolean;
}

export interface MonopolyLoopInput {
  smtpConfigured: boolean;
  pipeReadyInProd?: boolean;
  pipe: PipeNetworkVolume & { gravity_tier: PipeGravityTier };
  infrastructureScore: number;
  closedLoopMaturity: RailMaturity;
  mandateMaturity: RailMaturity;
  delegatedIssuersActive: number;
  emailVerifyGap?: boolean;
}

/** The only three conditions that turn Zakai from an app into infrastructure. */
export type IrreversibilityId = "consumers_on_mandate" | "mandate_better" | "proof_volume";

export interface IrreversibilityCondition {
  id: IrreversibilityId;
  titleHe: string;
  titleEn: string;
  /** Honest meter from real counters — never invented traction. */
  meterHe: string;
  meterEn: string;
  met: boolean;
}

export interface MonopolyLoopPlan {
  thesisHe: string;
  thesisEn: string;
  gravity_tier: PipeGravityTier;
  /** App → infrastructure only when all three are true. */
  irreversibility: IrreversibilityCondition[];
  irreversibilityReady: boolean;
  moves: MonopolyNextMove[];
  /** Single P0 — founder dashboard headline */
  p0: MonopolyNextMove;
  disclaimerHe: string;
  disclaimerEn: string;
}

function tierRank(t: PipeGravityTier): number {
  switch (t) {
    case "network":
      return 3;
    case "gravity":
      return 2;
    case "signal":
      return 1;
    default:
      return 0;
  }
}

/**
 * Ordered monopoly moves. SMTP and volume beat PayPlus every time.
 */
export function planMonopolyLoop(input: MonopolyLoopInput): MonopolyLoopPlan {
  const moves: MonopolyNextMove[] = [];
  const tier = input.pipe.gravity_tier;

  if (!input.smtpConfigured) {
    moves.push({
      id: "smtp",
      priority: 1,
      titleHe: "הפעל SMTP_HOST בפרוד",
      titleEn: "Turn on SMTP_HOST in production",
      whyHe:
        "בלי דואר יוצא אין מכתב אמיתי לספק — SENT באפליקציה ≠ מייל שהגיע. מונופול על מסילות ריקות הוא מצג שווא.",
      whyEn:
        "Without outbound mail, SENT in-app is not a letter that arrived. Monopoly on empty rails is theater.",
      href: "/founder",
      blocksMonopoly: true,
    });
  }

  if (input.pipeReadyInProd === false) {
    moves.push({
      id: "merge_deploy",
      priority: 2,
      titleHe: "Merge + Redeploy — הצינור חי בפרוד",
      titleEn: "Merge + Redeploy — pipe live in prod",
      whyHe: "אם /he/pipe או /api/pipe מחזירים 404, המוסדות לא יכולים למשוך — הארכיטקטורה נשארת בסניף.",
      whyEn: "If /he/pipe or /api/pipe 404, institutions cannot pull — architecture is stuck on a branch.",
      href: "/pipe",
      blocksMonopoly: true,
    });
  }

  if (input.emailVerifyGap && input.smtpConfigured) {
    moves.push({
      id: "verify_email_fast_path",
      priority: 3,
      titleHe: "דחוף אימות אימייל → approve+send בלחיצה",
      titleEn: "Push email verify → one-tap approve+send",
      whyHe: "אימייל מאומת מקצר אפס→SENT. כל דקה חיכוך היא Mandate שלא הונפק.",
      whyEn: "Verified email shortens zero→SENT. Every friction minute is a Mandate not issued.",
      href: "/money",
      blocksMonopoly: false,
    });
  }

  if (tierRank(tier) < 2) {
    moves.push({
      id: "volume_sent",
      priority: 4,
      titleHe: "נפח SENT — סלולר / ביטול / עמלות אמיתיים",
      titleEn: "SENT volume — real telecom / cancel / bank-fee cases",
      whyHe: `כבידה מוסדית מתחילה ב־≥20 SENT או Mandates. עכשיו: SENT+=${input.pipe.casesSent}, Mandates=${input.pipe.mandatesIssued}. לא מייל קר לבנקים.`,
      whyEn: `Institutional gravity starts at ≥20 SENT or Mandates. Now: SENT+=${input.pipe.casesSent}, Mandates=${input.pipe.mandatesIssued}. No cold bank spam.`,
      href: "/check",
      blocksMonopoly: true,
    });
  }

  if (input.pipe.savingsProofs < 10 || (tierRank(tier) >= 1 && input.pipe.savingsProofs < 50)) {
    moves.push({
      id: "volume_proof",
      priority: 5,
      titleHe: "סגור לולאה ל־SavingsProof",
      titleEn: "Close the loop to SavingsProof",
      whyHe: `הוכחות מתועדות (${input.pipe.savingsProofs}) הן השיווק היחיד מול מוסדות. אחרי SENT — follow-up → SAVED.`,
      whyEn: `Documented proofs (${input.pipe.savingsProofs}) are the only institutional marketing. After SENT — follow-up → SAVED.`,
      href: "/money",
      blocksMonopoly: tierRank(tier) < 3,
    });
  }

  if (input.delegatedIssuersActive < 1 && tierRank(tier) >= 1) {
    moves.push({
      id: "second_issuer",
      priority: 6,
      titleHe: "מנפיק Mandate שני (delegation pilot)",
      titleEn: "Second Mandate issuer (delegation pilot)",
      whyHe: "רשת עם מנפיק אחד היא מוצר; עם שניים — פרוטוקול. אחרי סיגנל נפח — admit pilot.",
      whyEn: "One issuer is a product; two is a protocol. After volume signal — admit a pilot.",
      href: "/api/mandate/delegation/evidence",
      blocksMonopoly: false,
    });
  }

  if (tierRank(tier) >= 2) {
    moves.push({
      id: "institution_pull",
      priority: 7,
      titleHe: "משיכה מוסדית — הם כותבים אלינו",
      titleEn: "Institutional pull — they write to us",
      whyHe: "שתף /pipe + pilot-package רק אחרי כבידה. אין cold outreach לבנקים.",
      whyEn: "Share /pipe + pilot-package only after gravity. No cold bank outreach.",
      href: "/pipe",
      blocksMonopoly: false,
    });
  }

  moves.push({
    id: "hold_phase_d",
    priority: 99,
    titleHe: "PayPlus / דומיין — רק אחרי כבידה",
    titleEn: "PayPlus / domain — only after gravity",
    whyHe: "סליקה בלי נפח Mandate היא SaaS. מונופול = מסילות עם gravity_tier≥gravity.",
    whyEn: "Checkout without Mandate volume is SaaS. Monopoly = rails at gravity_tier≥gravity.",
    href: "/pipe",
    blocksMonopoly: false,
  });

  moves.sort((a, b) => a.priority - b.priority);
  const p0 = moves.find((m) => m.blocksMonopoly) ?? moves[0]!;

  const irreversibility: IrreversibilityCondition[] = [
    {
      id: "consumers_on_mandate",
      titleHe: "צרכנים שולחים עם Mandate",
      titleEn: "Consumers send with Mandate",
      meterHe: `SENT+=${input.pipe.casesSent} · Mandates=${input.pipe.mandatesIssued} (סף כבידה ≈20)`,
      meterEn: `SENT+=${input.pipe.casesSent} · Mandates=${input.pipe.mandatesIssued} (gravity floor ≈20)`,
      met: input.pipe.casesSent >= 20 || input.pipe.mandatesIssued >= 20,
    },
    {
      id: "mandate_better",
      titleHe: "Mandate נוח ואמין יותר מהחלופות",
      titleEn: "Mandate easier/trustworthier than alternatives",
      meterHe: `מסילות תשתית ${input.infrastructureScore}/100 · בגרות Mandate=${input.mandateMaturity} · SMTP=${input.smtpConfigured ? "on" : "off"}`,
      meterEn: `Infra rails ${input.infrastructureScore}/100 · Mandate maturity=${input.mandateMaturity} · SMTP=${input.smtpConfigured ? "on" : "off"}`,
      met:
        input.smtpConfigured &&
        input.infrastructureScore >= 40 &&
        (input.mandateMaturity === "usable" ||
          input.mandateMaturity === "gravity" ||
          input.mandateMaturity === "default"),
    },
    {
      id: "proof_volume",
      titleHe: "מספיק SavingsProof שהשיטה עובדת",
      titleEn: "Enough SavingsProof that the method works",
      meterHe: `SavingsProof=${input.pipe.savingsProofs} (סף כבידה ≈10 · רשת ≈50)`,
      meterEn: `SavingsProof=${input.pipe.savingsProofs} (gravity floor ≈10 · network ≈50)`,
      met: input.pipe.savingsProofs >= 10,
    },
  ];
  const irreversibilityReady = irreversibility.every((c) => c.met);

  return {
    thesisHe:
      "תשתית (לא אפליקציה) רק כששלושה תנאים בלתי־הפיכים: צרכנים על Mandate + Mandate עדיף על חלופות + נפח SavingsProof. בלי שלושתם — אל תרדפו מיליארדים בחודש.",
    thesisEn:
      "Infrastructure (not an app) only when three conditions are irreversible: consumers on Mandate + Mandate beats alternatives + SavingsProof volume. Without all three — do not chase billions/month.",
    gravity_tier: tier,
    irreversibility,
    irreversibilityReady,
    moves,
    p0,
    disclaimerHe:
      "תכנית ביצוע ממונים אמיתיים בלבד. לא נתח שוק, לא שווי, לא שותפים מדומים.",
    disclaimerEn:
      "Execution plan from real counters only. Not market share, valuation, or fake partners.",
  };
}
