/**
 * Entitlement-aware insights — turn the deterministic rights engine into
 * actionable, money-specific nudges for the assistant.
 *
 * Each insight links to an existing in-app flow so the agent proposes and the
 * gated product executes. Values are conservative estimates from the rights
 * catalog; nothing is invented.
 */

import {
  evaluateRights,
  type RightsProfile,
  type Entitlement,
  type RightCategory,
} from "./rights";

export interface EntitlementInsight {
  /** i18n key under assistant.insights.* */
  key: string;
  params: Record<string, number>;
  href: string;
  weight: number;
}

interface EntitlementConfig {
  /** Which entitlements (by id) trigger this insight. */
  ids: string[];
  /** i18n key used for the insight text. */
  key: string;
  /** Deep link into the matching vertical. */
  href: string;
  /** Relative priority — higher first. */
  weight: number;
  /**
   * Optional conservative yearly value in agorot, used when the engine itself
   * does not attach a quantified amount to the entitlement. Only set values
   * that are stable and well-known.
   */
  estimatedYearlyAgorot?: number;
  /**
   * If true, one insight is emitted per matched entitlement (useful when each
   * instance has its own screen). If false, a single combined insight is emitted.
   */
  perEntitlement?: boolean;
}

const CONFIG: EntitlementConfig[] = [
  // High-confidence, high-value verticals with their own screens.
  {
    ids: ["tax_refund"],
    key: "taxRefund",
    href: "/taxrefund",
    weight: 92,
    estimatedYearlyAgorot: 120_000, // conservative average partial-year refund
  },
  {
    ids: ["mobile_check"],
    key: "mobileCheck",
    href: "/check",
    weight: 88,
    estimatedYearlyAgorot: 40_000, // ~₪330/mo at 18% saving × 12 (very conservative)
  },
  {
    ids: ["electricity_switch"],
    key: "electricitySwitch",
    href: "/electricity",
    weight: 86,
    estimatedYearlyAgorot: 25_000, // ~7% off a typical bill
  },
  {
    ids: ["flight_comp"],
    key: "flightComp",
    href: "/flights",
    weight: 84,
    estimatedYearlyAgorot: 140_000, // one short-haul comp ~₪1,400
  },
  {
    ids: ["miluim_pay"],
    key: "miluimPay",
    href: "/miluim",
    weight: 82,
  },
  {
    ids: ["subscription_audit"],
    key: "subscriptionAudit",
    href: "/scan",
    weight: 80,
    estimatedYearlyAgorot: 42_000, // one forgotten ₪35/mo sub
  },
  {
    ids: ["pension_fees"],
    key: "pensionFees",
    href: "/payslip",
    weight: 78,
  },
  {
    ids: ["work_grant"],
    key: "workGrant",
    href: "/rights",
    weight: 76,
  },
  {
    ids: ["bank_basic_track", "bank_senior_track", "bank_soldier_student"],
    key: "bankTrack",
    href: "/rights",
    weight: 74,
  },
  {
    ids: ["arnona_income", "arnona_oleh", "arnona_senior", "arnona_disability", "arnona_soldier"],
    key: "arnonaDiscount",
    href: "/business",
    weight: 72,
  },
];

const ID_TO_CONFIG = new Map<string, EntitlementConfig>();
for (const cfg of CONFIG) {
  for (const id of cfg.ids) {
    ID_TO_CONFIG.set(id, cfg);
  }
}

/** Convert a persisted rights-profile row into the engine's input shape. */
export function profileFromRow(row: {
  ageGroup: string;
  employment: string;
  children: number;
  childrenUnder6: number;
  renting: boolean;
  lowIncome: boolean;
  newImmigrant: boolean;
  dischargedSoldier: boolean;
  reservist: boolean;
  disability: boolean;
}): RightsProfile {
  return {
    ageGroup: asAgeGroup(row.ageGroup),
    employment: asEmployment(row.employment),
    children: row.children,
    childrenUnder6: row.childrenUnder6,
    renting: row.renting,
    lowIncome: row.lowIncome,
    newImmigrant: row.newImmigrant,
    dischargedSoldier: row.dischargedSoldier,
    reservist: row.reservist,
    disability: row.disability,
  };
}

function asAgeGroup(v: string): RightsProfile["ageGroup"] {
  if (v === "18_24" || v === "25_44" || v === "45_66" || v === "67_plus") return v;
  return "25_44";
}

function asEmployment(v: string): RightsProfile["employment"] {
  if (
    v === "employee" ||
    v === "self_employed" ||
    v === "unemployed" ||
    v === "student" ||
    v === "soldier" ||
    v === "retired"
  ) {
    return v;
  }
  return "employee";
}

/**
 * Build entitlement insights from a profile. Conservative, deterministic,
 * and safe to run on every assistant page load.
 */
export function computeEntitlementInsights(profile: RightsProfile): EntitlementInsight[] {
  const { matches } = evaluateRights(profile);
  const out: EntitlementInsight[] = [];
  const seenKeys = new Set<string>();

  for (const cfg of CONFIG) {
    const matched = matches.filter((m) => cfg.ids.includes(m.id));
    if (matched.length === 0) continue;

    if (cfg.perEntitlement) {
      for (const m of matched) {
        out.push(buildInsight(cfg, [m]));
      }
      continue;
    }

    // Combined insight for the config group. Use the first key only once.
    if (seenKeys.has(cfg.key)) continue;
    seenKeys.add(cfg.key);
    out.push(buildInsight(cfg, matched));
  }

  // Generic fallback: if we matched rights not covered above, suggest the
  // rights quiz once, with a count.
  const coveredIds = new Set(CONFIG.flatMap((c) => c.ids));
  const uncovered = matches.filter((m) => !coveredIds.has(m.id));
  if (uncovered.length > 0) {
    out.push({
      key: "moreRights",
      params: { count: uncovered.length },
      href: "/rights",
      weight: 50,
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}

function buildInsight(cfg: EntitlementConfig, matched: Entitlement[]): EntitlementInsight {
  const quantified = matched.reduce((s, e) => s + (e.yearlyAgorot ?? 0), 0);
  const estimated = cfg.estimatedYearlyAgorot ?? 0;
  const yearlyAgorot = quantified > 0 ? quantified : estimated;
  return {
    key: cfg.key,
    params: { count: matched.length, yearly: yearlyAgorot },
    href: cfg.href,
    weight: cfg.weight,
  };
}

/** Sum of quantified + conservative estimated yearly value across all insights. */
export function totalYearlyPotential(insights: EntitlementInsight[]): number {
  return insights.reduce((s, i) => s + (i.params.yearly ?? 0), 0);
}
