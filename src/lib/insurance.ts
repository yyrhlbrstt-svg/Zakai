/**
 * Duplicate-insurance detector — one of the biggest silent leaks in Israeli
 * household budgets (~₪3.5B/year wasted on overlapping cover). The key legal
 * distinction the public misses:
 *
 *  - INDEMNITY policies (שיפוי) — health, surgery, out-of-basket drugs — pay
 *    only the ACTUAL cost. Holding the same indemnity cover twice (e.g. a
 *    private policy AND your kupat-cholim's שב"ן) means you pay two premiums
 *    but can only claim once → the second premium is pure waste.
 *  - COMPENSATION policies (פיצוי) — life, critical-illness, personal-accident
 *    — pay a fixed sum regardless of cost, so stacking them CAN be legitimate.
 *
 * This engine flags likely-wasteful indemnity overlaps and estimates the
 * monthly premium that could be recovered. Deterministic and tested; it never
 * tells the user to cancel — it flags what's worth checking with the insurer.
 * Not insurance advice. Money in agorot.
 */

export type PolicyKind = "indemnity" | "compensation";

export interface PolicyType {
  key: string;
  kind: PolicyKind;
  /** Typical private monthly premium in agorot (conservative benchmark). */
  typicalMonthlyAgorot: number;
}

/** The overlap-prone policy types, with conservative premium benchmarks. */
export const POLICY_TYPES: PolicyType[] = [
  { key: "surgery", kind: "indemnity", typicalMonthlyAgorot: 6000 }, // ניתוחים
  { key: "drugs", kind: "indemnity", typicalMonthlyAgorot: 4500 }, // תרופות מחוץ לסל
  { key: "transplant", kind: "indemnity", typicalMonthlyAgorot: 3000 }, // השתלות
  { key: "consultations", kind: "indemnity", typicalMonthlyAgorot: 3500 }, // ייעוץ ובדיקות
  { key: "criticalIllness", kind: "compensation", typicalMonthlyAgorot: 7000 }, // מחלות קשות
  { key: "personalAccident", kind: "compensation", typicalMonthlyAgorot: 4000 }, // תאונות אישיות
  { key: "life", kind: "compensation", typicalMonthlyAgorot: 8000 }, // חיים
];

export interface CoverageInput {
  /** Policy keys the user holds privately. */
  privateKeys: string[];
  /** Policy keys the user holds through work or kupat-cholim (שב"ן). */
  collectiveKeys: string[];
}

export interface DuplicationFinding {
  key: string;
  kind: PolicyKind;
  /** True when this overlap is likely wasteful (indemnity held twice). */
  wasteful: boolean;
  estMonthlyAgorot: number;
}

export interface DuplicationResult {
  findings: DuplicationFinding[];
  /** Sum of the estimated recoverable monthly premium (wasteful overlaps). */
  wastefulMonthlyAgorot: number;
  wastefulYearlyAgorot: number;
  /** Overlaps that are NOT flagged as waste (compensation — stacking is OK). */
  stackableCount: number;
}

const BY_KEY = new Map(POLICY_TYPES.map((p) => [p.key, p]));

export function computeDuplication(input: CoverageInput): DuplicationResult {
  const priv = new Set(input.privateKeys);
  const coll = new Set(input.collectiveKeys);

  const findings: DuplicationFinding[] = [];
  let wastefulMonthlyAgorot = 0;
  let stackableCount = 0;

  for (const p of POLICY_TYPES) {
    const overlaps = priv.has(p.key) && coll.has(p.key);
    if (!overlaps) continue;
    // Only indemnity overlaps are wasteful — you can't be paid twice for cost.
    const wasteful = p.kind === "indemnity";
    // The recoverable premium is the cheaper (collective) side kept, private
    // side dropped — we conservatively count one typical premium as recoverable.
    const estMonthlyAgorot = wasteful ? p.typicalMonthlyAgorot : 0;
    if (wasteful) wastefulMonthlyAgorot += estMonthlyAgorot;
    else stackableCount += 1;
    findings.push({ key: p.key, kind: p.kind, wasteful, estMonthlyAgorot });
  }

  return {
    findings,
    wastefulMonthlyAgorot,
    wastefulYearlyAgorot: wastefulMonthlyAgorot * 12,
    stackableCount,
  };
}

export function policyKind(key: string): PolicyKind | null {
  return BY_KEY.get(key)?.kind ?? null;
}
