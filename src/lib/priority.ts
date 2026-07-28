/**
 * Next-best-action ranking for consumer money recovery.
 * Money OS agent paths always rank above passive calculators.
 */

export type PriorityAction = {
  id: string;
  href: string;
  titleHe: string;
  titleEn: string;
  whyHe: string;
  whyEn: string;
  monthlyPotentialShekels: number;
  effort: "low" | "medium" | "high";
  /** Agent path = closed-loop Case; calculator = estimate only */
  agentic?: boolean;
};

const CATALOG: PriorityAction[] = [
  {
    id: "money",
    href: "/money",
    titleHe: "הכסף שלי — סריקה + תיק סוכן",
    titleEn: "My money — scan + agent case",
    whyHe: "צילום מסך → הסוכן פותח תיק עם Mandate",
    whyEn: "Screenshot → agent opens Mandate case",
    monthlyPotentialShekels: 150,
    effort: "low",
    agentic: true,
  },
  {
    id: "cancel",
    href: "/cancel",
    titleHe: "ביטול / הנחה — הסוכן שולח",
    titleEn: "Cancel / discount — agent sends",
    whyHe: "תיק + Mandate + מעקב + תיעוד חיסכון",
    whyEn: "Case + Mandate + follow-up + savings proof",
    monthlyPotentialShekels: 70,
    effort: "low",
    agentic: true,
  },
  {
    id: "what-am-i-owed",
    href: "/what-am-i-owed",
    titleHe: "מה מגיע לי?",
    titleEn: "What am I owed?",
    whyHe: "פוטנציאל → דלתות פעולה עם סוכן",
    whyEn: "Potential → agent action doors",
    monthlyPotentialShekels: 90,
    effort: "low",
    agentic: true,
  },
  {
    id: "check",
    href: "/check",
    titleHe: "סלולר / אינטרנט — משא ומתן",
    titleEn: "Mobile / internet — negotiate",
    whyHe: "משא ומתן מתועד + Mandate",
    whyEn: "Documented negotiation + Mandate",
    monthlyPotentialShekels: 55,
    effort: "medium",
    agentic: true,
  },
  {
    id: "bank-fees",
    href: "/bank-fees",
    titleHe: "עמלות בנק — הסוכן שולח",
    titleEn: "Bank fees — agent sends",
    whyHe: "תיק מלא + Mandate + תיעוד",
    whyEn: "Full case + Mandate + proof",
    monthlyPotentialShekels: 40,
    effort: "low",
    agentic: true,
  },
  {
    id: "electricity",
    href: "/electricity",
    titleHe: "חשמל — מעבר ספק עם סוכן",
    titleEn: "Electricity — agent switches supplier",
    whyHe: "תיק + Mandate + שליחה + חיסכון מתועד",
    whyEn: "Case + Mandate + send + documented saving",
    monthlyPotentialShekels: 45,
    effort: "low",
    agentic: true,
  },
  {
    id: "leaks",
    href: "/leaks",
    titleHe: "מפת נזילות",
    titleEn: "Leaks map",
    whyHe: "כל נקודות הדליפה → פעולת סוכן",
    whyEn: "Every leak → agent action",
    monthlyPotentialShekels: 40,
    effort: "low",
    agentic: true,
  },
  {
    id: "refund-chase",
    href: "/refund-chase",
    titleHe: "החזר שלא הגיע",
    titleEn: "Missing refund",
    whyHe: "דרישה בכתב דרך הסוכן",
    whyEn: "Written demand via agent",
    monthlyPotentialShekels: 50,
    effort: "low",
    agentic: true,
  },
  {
    id: "credit-card",
    href: "/credit-card",
    titleHe: "ריבית כרטיס",
    titleEn: "Card interest",
    whyHe: "כמה עולה היתרה המסתובבת",
    whyEn: "Cost of revolving balance",
    monthlyPotentialShekels: 120,
    effort: "medium",
  },
  {
    id: "duplicate-insurance",
    href: "/duplicate-insurance",
    titleHe: "ביטוח כפול",
    titleEn: "Duplicate insurance",
    whyHe: "פרמיה מיותרת",
    whyEn: "Wasted premium",
    monthlyPotentialShekels: 60,
    effort: "medium",
  },
  {
    id: "taxrefund",
    href: "/taxrefund",
    titleHe: "החזר מס",
    titleEn: "Tax refund",
    whyHe: "עד 6 שנים אחורה",
    whyEn: "Up to 6 years back",
    monthlyPotentialShekels: 100,
    effort: "medium",
  },
  {
    id: "flights",
    href: "/flights",
    titleHe: "פיצוי טיסה",
    titleEn: "Flight compensation",
    whyHe: "עיכוב / ביטול → תיק סוכן",
    whyEn: "Delay / cancel → agent case",
    monthlyPotentialShekels: 80,
    effort: "medium",
    agentic: true,
  },
];

/** Rank: agentic boost, then potential / effort. */
export function rankPriorityActions(limit = 5): PriorityAction[] {
  const weight = (a: PriorityAction) => {
    const base =
      a.monthlyPotentialShekels / (a.effort === "low" ? 1 : a.effort === "medium" ? 1.4 : 2);
    return base * (a.agentic ? 1.35 : 1);
  };
  return [...CATALOG].sort((a, b) => weight(b) - weight(a)).slice(0, limit);
}

export function priorityDigestHe(): string {
  return rankPriorityActions(6)
    .map(
      (a) =>
        `- ${a.titleHe} (${a.href})${a.agentic ? " [AGENT]" : ""}: ~₪${a.monthlyPotentialShekels}/ח׳ · ${a.whyHe}`,
    )
    .join("\n");
}
