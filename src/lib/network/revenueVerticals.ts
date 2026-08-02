/**
 * The global revenue map — which problems people already pay to solve, which
 * markets Zakai can address with today's product shape, and how money is
 * captured. This is the CEO-facing catalog exposed at /api/network/opportunity-map
 * for agents, partners, and internal prioritisation. Amounts are indicative
 * headline recoveries in minor units of the stated currency — never promises.
 */

export type MonetizationModel =
  | "success_fee"
  | "subscription"
  | "oracle_api"
  | "lead_fee"
  | "network_verification";

export type VerticalStatus = "live_agent" | "letter_pack" | "rights_only" | "planned";

export interface RevenueVertical {
  id: string;
  markets: string[];
  titleEn: string;
  titleHe: string;
  avgRecoveryMinor: number;
  currency: string;
  monetization: MonetizationModel;
  status: VerticalStatus;
  /** In-app path when one exists. */
  route?: string;
  /** Global pack right id (market-specific prefix applied at runtime). */
  packRightId?: string;
  citation?: string;
}

export const REVENUE_VERTICALS: readonly RevenueVertical[] = [
  {
    id: "il_telecom_agent",
    markets: ["IL"],
    titleEn: "Mobile / internet bill negotiation",
    titleHe: "התאמת חשבון סלולר ואינטרנט",
    avgRecoveryMinor: 1_800_000,
    currency: "ILS",
    monetization: "success_fee",
    status: "live_agent",
    route: "/money",
  },
  {
    id: "il_subscription_cancel",
    markets: ["IL"],
    titleEn: "Subscription cancel or retention discount",
    titleHe: "ביטול מנוי או הנחת שימור",
    avgRecoveryMinor: 840_000,
    currency: "ILS",
    monetization: "success_fee",
    status: "live_agent",
    route: "/cancel",
  },
  {
    id: "il_electricity",
    markets: ["IL"],
    titleEn: "Electricity supplier switch / social tariff",
    titleHe: "חשמל — מעבר ספק או תעריף מוזל",
    avgRecoveryMinor: 1_200_000,
    currency: "ILS",
    monetization: "success_fee",
    status: "live_agent",
    route: "/electricity",
  },
  {
    id: "gb_student_loan_overpayment",
    markets: ["GB"],
    titleEn: "UK student loan overpayment refund",
    titleHe: "החזר יתר על הלוואת סטודנטים (בריטניה)",
    avgRecoveryMinor: 24_000,
    currency: "GBP",
    monetization: "success_fee",
    status: "letter_pack",
    route: "/student-loan-overpayment",
    packRightId: "student_loan_overpayment",
    citation: "SLC repayment account / Education (Student Loans) Regulations 1998",
  },
  {
    id: "us_wage_theft",
    markets: ["US"],
    titleEn: "Unpaid wages / overtime (FLSA)",
    titleHe: "שכר גנוב ושעות נוספות (ארה״ב)",
    avgRecoveryMinor: 50_000_00,
    currency: "USD",
    monetization: "success_fee",
    status: "letter_pack",
    route: "/wage-statement-audit",
    packRightId: "wage_statement_audit",
  },
  {
    id: "us_fdcpa",
    markets: ["US"],
    titleEn: "Debt collector statutory violations (FDCPA)",
    titleHe: "הפרות חוק גביית חוב (FDCPA)",
    avgRecoveryMinor: 1_000_00,
    currency: "USD",
    monetization: "success_fee",
    status: "planned",
    citation: "15 U.S.C. § 1692k",
  },
  {
    id: "eu_train_delay",
    markets: ["GB", "DE", "FR"],
    titleEn: "Train delay compensation (EU/UK passenger rights)",
    titleHe: "פיצוי על עיכוב רכבת",
    avgRecoveryMinor: 25_00,
    currency: "EUR",
    monetization: "success_fee",
    status: "rights_only",
    route: "/flights",
    citation: "EU Regulation 1371/2007 / UK National Rail conditions",
  },
  {
    id: "mandate_verification",
    markets: ["*"],
    titleEn: "Mandate verify + decide (institutional)",
    titleHe: "אימות והחלטת Mandate למוסדות",
    avgRecoveryMinor: 0,
    currency: "USD",
    monetization: "network_verification",
    status: "live_agent",
    route: "/en/institutions",
  },
  {
    id: "oracle_predict",
    markets: ["*"],
    titleEn: "Calibrated claim outcome prediction",
    titleHe: "חיזוי תוצאת תביעה מכויל",
    avgRecoveryMinor: 0,
    currency: "USD",
    monetization: "oracle_api",
    status: "live_agent",
    citation: "De-identified StrategyOutcome graph",
  },
] as const;

export function revenueVerticalsForMarket(market: string): RevenueVertical[] {
  const upper = market.toUpperCase();
  return REVENUE_VERTICALS.filter((v) => v.markets.includes("*") || v.markets.includes(upper));
}
