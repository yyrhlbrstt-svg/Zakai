/**
 * "What am I paying for?" — recurring-charge detection from a bank / credit
 * card statement the user exports and uploads themselves.
 *
 * Deliberately license-free: the user brings their own data (CSV export from
 * their bank or card issuer), so no open-banking "financial information
 * service" license is needed at this stage (see GROWTH.md for the licensed
 * path). Parsing is deterministic and fully tested — no AI required.
 *
 * All money is integer agorot, as everywhere in Zakai.
 */

import { resolveProviderKey, type ProviderKey } from "./providers";

export interface StatementTxn {
  date: Date;
  merchant: string;
  amountAgorot: number; // positive = charge
}

export type ChargeCategory =
  | "cellular"
  | "tv_internet"
  | "electricity"
  | "insurance"
  | "fitness"
  | "digital"
  | "other";

export interface RecurringCharge {
  merchant: string;
  category: ChargeCategory;
  /** Estimated monthly amount in agorot (median of the observed charges). */
  monthlyAgorot: number;
  /** How many charges were observed. */
  occurrences: number;
  /** Zakai provider key when the merchant maps to one we can act on. */
  providerKey: ProviderKey | null;
  /**
   * How sure the detector is that this really is a recurring charge, 0..1.
   *
   * Measured from the evidence actually present — how many times it was seen,
   * how steady the amount is, how regular the cadence — never asserted. The
   * claim gate reads this to decide whether Zakai is entitled to tell somebody
   * they are paying for this every month; before it existed, "recurring" was a
   * boolean and two coffees thirty days apart carried the same weight as
   * twelve identical monthly charges.
   */
  confidence: number;
  /**
   * The dates this charge was actually seen on, oldest first.
   *
   * `detectRecurring` already sorts by date and measures the gaps — that is
   * how it decides something recurs at all — and used to throw every date
   * away. So the scan could say "you pay this monthly" but not "and it is due
   * on Tuesday", from data it had just finished reading. Kept so
   * `estimateNextCharge` can answer the second question, which is the one that
   * lets someone cancel before the money leaves rather than chase it after.
   */
  chargedOn: Date[];
}

export interface ScanResult {
  transactions: number;
  recurring: RecurringCharge[];
  /** Total estimated monthly recurring spend in agorot. */
  totalMonthlyAgorot: number;
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

const DATE_RE =
  /^\s*(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\s*$|^\s*(\d{4})-(\d{2})-(\d{2})\s*$/;

function parseDate(raw: string): Date | null {
  const m = raw.trim().match(DATE_RE);
  if (!m) return null;
  if (m[4]) {
    // ISO yyyy-mm-dd
    const d = new Date(Number(m[4]), Number(m[5]) - 1, Number(m[6]));
    return isNaN(d.getTime()) ? null : d;
  }
  // Israeli exports are day-first: dd/mm/yyyy or dd.mm.yy
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (day > 31 || month > 12) return null;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

/** "1,234.56 ₪", "₪89.90", "89,90" → agorot; null when not money-like. */
function parseAmount(raw: string): number | null {
  let s = raw.replace(/[₪"\s]/g, "").replace(/ש"ח|שח/g, "");
  if (!s) return null;
  const negative = /^-|-$|^\(.*\)$/.test(s);
  s = s.replace(/[()-]/g, "");
  // European style "89,90" (comma decimal, no dot)
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const agorot = Math.round(parseFloat(s) * 100);
  return negative ? -agorot : agorot;
}

function detectDelimiter(line: string): string {
  const counts: Array<[string, number]> = [
    ["\t", (line.match(/\t/g) || []).length],
    [",", (line.match(/,/g) || []).length],
    [";", (line.match(/;/g) || []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/**
 * Split a CSV line honoring double quotes. A quote only OPENS a quoted field
 * at the start of a cell — a `"` in the middle (e.g. Hebrew `בע"מ`) is data,
 * not CSV syntax, and must not swallow the rest of the line.
 */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      if (!inQuotes && cur === "") inQuotes = true;
      else if (inQuotes) inQuotes = false;
      else cur += ch;
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/**
 * Parse pasted/uploaded statement text. Column positions are inferred per
 * line — date-shaped cell → date, money-shaped cell → amount, the longest
 * remaining text → merchant — so the exact export format (Isracard, Max, Cal,
 * bank sites) doesn't matter. Header rows and non-transaction lines are
 * skipped naturally because they don't yield a date + amount + merchant.
 * When several money-shaped cells exist (עסקה + חיוב), the LAST one wins,
 * matching the Israeli convention of the actual billed amount appearing last.
 */
export function parseStatement(text: string): StatementTxn[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const delim = detectDelimiter(lines[0].includes("\t") || lines.length === 1 ? lines[0] : lines[1] ?? lines[0]);

  const txns: StatementTxn[] = [];
  for (const line of lines) {
    const cells = splitLine(line, delim);
    if (cells.length < 2) continue;

    let date: Date | null = null;
    let amount: number | null = null;
    let merchant = "";

    for (const cell of cells) {
      if (date === null) {
        const d = parseDate(cell);
        if (d) {
          date = d;
          continue;
        }
      }
      const a = parseAmount(cell);
      if (a !== null && cell.match(/\d/)) {
        amount = a; // last money-shaped cell wins
        continue;
      }
      if (cell.length > merchant.length && /[A-Za-zא-ת]/.test(cell)) merchant = cell;
    }

    if (date && amount !== null && amount !== 0 && merchant) {
      txns.push({ date, merchant, amountAgorot: amount });
    }
  }

  /**
   * Statements disagree about which way a charge points.
   *
   * Israeli card statements list what you were billed as a positive number.
   * Bank account exports list the same event as a debit — negative — with
   * credits positive. This parser only ever kept positives, so pasting a bank
   * export produced zero transactions and the scan reported "no recurring
   * charges found": indistinguishable, from the outside, from a bank the
   * product simply cannot read.
   *
   * A statement is internally consistent, so its sign convention can be read
   * off it. If anything positive is present, positives are the charges and
   * negatives are refunds — the original behaviour, untouched. Only when a
   * statement is entirely negative is it the other convention, and then the
   * magnitudes are the charges.
   */
  const positives = txns.filter((t) => t.amountAgorot > 0);
  if (positives.length > 0) return positives;
  return txns.map((t) => ({ ...t, amountAgorot: Math.abs(t.amountAgorot) }));
}

/* ------------------------------------------------------------------ */
/* Categorisation                                                      */
/* ------------------------------------------------------------------ */

const CATEGORY_PATTERNS: Array<[ChargeCategory, RegExp]> = [
  // Electricity FIRST: brands like "סלקום אנרג'י" and "פרטנר פאוור" contain a
  // telecom brand name and would otherwise be swallowed by the cellular rule.
  [
    "electricity",
    /(חברת החשמל|חשמל|אלקטרה פאוור|electra ?power|אנרג'?י|energy|פאוור|power|נגה)/i,
  ],
  [
    "cellular",
    /(סלקום|cellcom|פרטנר|partner|פלאפון|pelephone|הוט מובייל|hot ?mobile|גולן|golan|019|012 ?מובייל|רמי לוי תקשורת|we4g|wecom|וואלה מובייל)/i,
  ],
  [
    "tv_internet",
    // Short Hebrew tokens (יס, הוט) are guarded with letter lookarounds so
    // they never match inside another word (e.g. "פלייס", "הוטל").
    /(בזק|bezeq|(?<![א-ת])יס(?![א-ת])|(?<![a-z])yes(?![a-z])|(?<![א-ת])הוט(?![א-ת])(?! מובייל)|(?<![a-z])hot(?![a-z])(?! ?mobile)|נטפליקס|netflix|דיסני|disney|סטינג|sting ?tv|פרטנר טי\.?וי|אינטרנט)/i,
  ],
  [
    "insurance",
    /(ביטוח|הפניקס|הראל|מגדל|כלל ביטוח|מנורה|איילון|AIG|ביטוח ישיר|9 ?מיליון|ליברה|wesure)/i,
  ],
  ["fitness", /(הולמס פלייס|holmes|גו אקטיב|go ?active|פיטנס|fitness|חדר כושר|גרייט שייפ|icon)/i],
  [
    "digital",
    /(spotify|ספוטיפיי|youtube|apple\.com|itunes|icloud|google|amazon prime|hbo|אמזון|פלייסטיישן|playstation|xbox|dropbox|chatgpt|openai|claude)/i,
  ],
];

export function categorize(merchant: string): ChargeCategory {
  for (const [cat, re] of CATEGORY_PATTERNS) {
    if (re.test(merchant)) return cat;
  }
  return "other";
}

/** Categories with a Zakai flow today (telecom → check; electricity → compare). */
const ACTIONABLE: ChargeCategory[] = ["cellular", "tv_internet"];

/* ------------------------------------------------------------------ */
/* Recurring detection                                                 */
/* ------------------------------------------------------------------ */

function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/בע"מ|בעמ|ltd\.?|inc\.?/g, "")
    .replace(/\d{3,}/g, "") // strip branch/tx numbers
    .replace(/[^A-Za-zא-ת ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A gap counts as monthly at 20–40 days — the same window the detector uses. */
function isMonthlyGap(days: number): boolean {
  return days >= 20 && days <= 40;
}

/**
 * How sure we are that a group of charges is a subscription rather than a
 * coincidence, from the three things the data can actually tell us.
 *
 * Occurrences dominate because they are the component that cannot be faked by
 * chance: two charges a month apart for a similar amount is a plausible
 * accident (a fortnightly shop, two visits to the same restaurant), and twelve
 * of them is not. The other two components refine a number that occurrences
 * has already bounded, which is why 2 occurrences cannot reach the speaking
 * threshold no matter how tidy the amounts are.
 *
 * WHAT IS DELIBERATELY NOT IN HERE, AND WHAT WOULD SETTLE IT
 *
 * Merchant identity. A company in the provider registry bills recurringly by
 * construction, so seeing it twice is stronger evidence than seeing an unknown
 * merchant twice — which argues for a bounded prior that could lift a tidy
 * 2-sighting case over the bar. It is left out on purpose, for two reasons.
 *
 * The prior is not uniform across the registry: a streaming service has almost
 * no one-off charges, while a telecom sells handsets. Guessing per-merchant
 * billing models with no data is exactly the thumb on the scale the gate
 * exists to prevent, and it would arrive dressed as a detector improvement.
 *
 * The evidence that settles it already has an instrument: alert-to-outcome
 * (`src/lib/intel/alertToOutcome.ts`). If claims about registry merchants
 * prove at the same rate as the rest, the prior is real and belongs here with
 * a measured weight. If they prove worse, it never did. Add it when the number
 * exists, not before.
 */
export function recurringConfidence(
  amountsAgorot: readonly number[],
  gapsDays: readonly number[],
): number {
  const n = amountsAgorot.length;
  if (n < 2) return 0;

  // 2 → 0.3, 3 → 0.6, 4 → 0.9, 5+ → 1. Saturating, because the difference
  // between eight sightings and nine is not information. The 2-sighting value
  // is chosen so that even a flawless pair — identical amounts, exactly thirty
  // days apart — lands at 0.65 and stays below the speaking threshold. That is
  // the claim in the paragraph above, kept true by arithmetic rather than by
  // assertion, and asserted again in the tests.
  const occurrence = Math.min(1, 0.3 + (n - 2) * 0.3 - Math.max(0, n - 4) * 0.1);

  const med = median([...amountsAgorot]);
  const spread =
    med > 0
      ? amountsAgorot.reduce((sum, a) => sum + Math.abs(a - med), 0) / (n * med)
      : 1;
  // 0% deviation → 1, 25% average deviation → 0. Beyond that it is not the
  // same charge repeating, it is the same shop being visited.
  const steadiness = Math.max(0, 1 - spread / 0.25);

  const cadence =
    gapsDays.length === 0
      ? 0
      : gapsDays.filter(isMonthlyGap).length / gapsDays.length;

  const score = 0.5 * occurrence + 0.3 * steadiness + 0.2 * cadence;
  return Number(Math.min(1, Math.max(0, score)).toFixed(3));
}

/**
 * A merchant is "recurring" when charges repeat on a roughly monthly cadence
 * (any gap of 20–40 days between consecutive charges) with similar amounts,
 * or appears 3+ times. Conservative on purpose: a false "you have a
 * subscription" erodes trust faster than a miss.
 */
export function detectRecurring(txns: StatementTxn[]): RecurringCharge[] {
  const groups = new Map<string, StatementTxn[]>();
  for (const t of txns) {
    const key = normalizeMerchant(t.merchant);
    if (!key) continue;
    const arr = groups.get(key);
    if (arr) arr.push(t);
    else groups.set(key, [t]);
  }

  const out: RecurringCharge[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.date.getTime() - b.date.getTime());

    const amounts = list.map((t) => t.amountAgorot);
    const med = median(amounts);
    const similar = amounts.every((a) => Math.abs(a - med) <= Math.max(med * 0.25, 500));

    const gaps: number[] = [];
    for (let i = 1; i < list.length; i++) {
      gaps.push((list[i].date.getTime() - list[i - 1].date.getTime()) / DAY_MS);
    }
    const monthlyGap = gaps.some(isMonthlyGap);

    const isRecurring = (monthlyGap && similar) || list.length >= 3;
    if (!isRecurring) continue;

    const merchant = list[list.length - 1].merchant;
    const category = categorize(merchant);
    out.push({
      merchant,
      category,
      monthlyAgorot: med,
      occurrences: list.length,
      providerKey: ACTIONABLE.includes(category) ? resolveProviderKey(merchant) : null,
      confidence: recurringConfidence(amounts, gaps),
      chargedOn: list.map((t) => t.date), // already sorted oldest-first above
    });
  }

  out.sort((a, b) => b.monthlyAgorot - a.monthlyAgorot);
  return out;
}

export function scanStatement(text: string): ScanResult {
  const transactions = parseStatement(text);
  const recurring = detectRecurring(transactions);
  return {
    transactions: transactions.length,
    recurring,
    totalMonthlyAgorot: recurring.reduce((s, r) => s + r.monthlyAgorot, 0),
  };
}
