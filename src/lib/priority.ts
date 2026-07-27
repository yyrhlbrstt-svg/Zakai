/**
 * Next-best-action ranking for consumer money recovery.
 * Deterministic estimates — not promises. Used by Money Hub / agent context.
 */

export type PriorityAction = {
  id: string;
  href: string;
  titleHe: string;
  titleEn: string;
  whyHe: string;
  whyEn: string;
  /** Rough monthly ILS recovery potential for prioritization only */
  monthlyPotentialShekels: number;
  effort: "low" | "medium" | "high";
};

const CATALOG: PriorityAction[] = [
  {
    id: "money",
    href: "/money",
    titleHe: "מפת החיובים שלי",
    titleEn: "My money map",
    whyHe: "רואים מה יורד כל חודש בלי סיסמאות בנק",
    whyEn: "See monthly charges without bank passwords",
    monthlyPotentialShekels: 80,
    effort: "low",
  },
  {
    id: "cancel",
    href: "/cancel",
    titleHe: "ביטול / הנחת מנוי",
    titleEn: "Cancel or discount a sub",
    whyHe: "מכתב מיידי לכל חברה",
    whyEn: "Instant letter to any company",
    monthlyPotentialShekels: 50,
    effort: "low",
  },
  {
    id: "check",
    href: "/check",
    titleHe: "הורדת סלולר / אינטרנט",
    titleEn: "Lower mobile / internet",
    whyHe: "משא ומתן מתועד + Mandate",
    whyEn: "Documented negotiation + mandate",
    monthlyPotentialShekels: 40,
    effort: "medium",
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
    id: "electricity",
    href: "/electricity",
    titleHe: "חשמל",
    titleEn: "Electricity",
    whyHe: "מעבר ספק / תעריף",
    whyEn: "Switch supplier / rate",
    monthlyPotentialShekels: 35,
    effort: "low",
  },
  {
    id: "bank-fees",
    href: "/bank-fees",
    titleHe: "עמלות בנק",
    titleEn: "Bank fees",
    whyHe: "מכתב ביטול עמלה",
    whyEn: "Fee-waiver letter",
    monthlyPotentialShekels: 25,
    effort: "low",
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
    id: "refund-chase",
    href: "/refund-chase",
    titleHe: "החזר שלא הגיע",
    titleEn: "Missing refund",
    whyHe: "דרישה לחנות",
    whyEn: "Demand to the merchant",
    monthlyPotentialShekels: 30,
    effort: "low",
  },
  {
    id: "leaks",
    href: "/leaks",
    titleHe: "מפת נזילות מלאה",
    titleEn: "Full leaks map",
    whyHe: "כל הבעיות במקום אחד",
    whyEn: "All problem areas in one place",
    monthlyPotentialShekels: 20,
    effort: "low",
  },
];

/** Rank by potential / effort weight. */
export function rankPriorityActions(limit = 5): PriorityAction[] {
  const weight = (a: PriorityAction) =>
    a.monthlyPotentialShekels / (a.effort === "low" ? 1 : a.effort === "medium" ? 1.4 : 2);
  return [...CATALOG].sort((a, b) => weight(b) - weight(a)).slice(0, limit);
}

export function priorityDigestHe(): string {
  return rankPriorityActions(6)
    .map((a) => `- ${a.titleHe} (${a.href}): ~₪${a.monthlyPotentialShekels}/ח׳ פוטנציאל · ${a.whyHe}`)
    .join("\n");
}
