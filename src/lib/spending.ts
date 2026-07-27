/**
 * "Where does my money go?" — a full spending overview from a bank / card
 * statement the user pastes or uploads. Where subscriptions.ts finds only the
 * recurring charges, this categorises EVERY transaction and sums it, so a user
 * who "doesn't remember what they spend on" sees the whole picture at a glance.
 *
 * Reuses the same license-free, deterministic parser as the recurring scan
 * (the user brings their own export — no open-banking license needed) and works
 * in any country: it's arithmetic over merchant text, not Israel-specific.
 *
 * Money is integer agorot (minor units), as everywhere in Zakai.
 */

import { parseStatement, categorize, type StatementTxn } from "./subscriptions";

export type SpendCategory =
  | "groceries"
  | "dining"
  | "transport"
  | "shopping"
  | "health"
  | "housing"
  | "bills"
  | "entertainment"
  | "cash"
  | "other";

/**
 * Everyday-spend patterns (Israeli + international brands). Checked in order;
 * the recurring "bill" merchants (telecom/TV/electricity/insurance) are folded
 * in via subscriptions.ts's categorize() so the two engines never disagree.
 */
const SPEND_PATTERNS: Array<[SpendCategory, RegExp]> = [
  [
    "groceries",
    /(שופרסל|רמי לוי|ויקטורי|יינות ביתן|טיב טעם|מגה|אושר עד|יוחננוף|shufersal|supersol|מכולת|מרכול|סופרמרקט|super ?market|grocery|tesco|sainsbury|aldi|lidl|carrefour|mercadona|albert heijn|walmart|kroger|costco|whole foods|trader joe)/i,
  ],
  [
    "dining",
    /(מקדונלד|mcdonald|בורגר|burger|קפה|cafe|coffee|starbucks|wolt|וולט|תן ביס|10bis|משעדה|מסעדה|restaurant|פיצה|pizza|domino|kfc|שווארמה|פלאפל|סושי|sushi|בית קפה|ארומה|aroma|נדזטיז)/i,
  ],
  [
    "transport",
    /(פז|סונול|דלק|delek|paz|sonol|דור אלון|ten |רב.?קו|rav.?kav|פנגו|pango|סלופארק|cellopark|uber|אובר|gett|גט|טקסי|taxi|חניון|parking|shell|bp |רכבת|train|אגד|egged|דן |מטרו|נמל תעופה|ryanair|easyjet|טיסה|flight)/i,
  ],
  [
    "shopping",
    /(זארה|zara|איקאה|ikea|עלי אקספרס|aliexpress|amazon|אמזון|ebay|asos|shein|terminalx|טרמינל|קסטרו|castro|fox|רנואר|גולף|נעל|אופנה|fashion|h&m|next|zalando|decathlon|דקטלון|ace|הום סנטר|home center)/i,
  ],
  [
    "health",
    /(סופר.?פארם|super.?pharm|ניו.?פארם|new.?pharm|be pharm|בי פארם|פארם|pharmacy|מכבי|כללית|clalit|maccabi|מאוחדת|לאומית|קופת חולים|רופא|doctor|dental|שיניים|אופטיק|optic|מרפאה|clinic|בית מרקחת)/i,
  ],
  [
    "housing",
    /(עיריית|ארנונה|arnona|ועד בית|מי |מים|water|תאגיד|שכירות|rent|משכנתא|mortgage|גז|gas|amidar|עמידר|council tax)/i,
  ],
  [
    "entertainment",
    /(סינמה|cinema|קולנוע|יס פלנט|רב.?חן|theatre|תיאטרון|steam|nintendo|בית קולנוע|הופעה|כרטיסים|tickets|לונה פארק|superland|לונפארק)/i,
  ],
  [
    "cash",
    /(משיכת מזומן|כספומט|atm|cash withdrawal|העברה|transfer|bit|ביט|paybox|פייבוקס|העברת כספים|withdrawal)/i,
  ],
];

/**
 * Categorise one merchant into an everyday-spend bucket. Recurring bills
 * (telecom/TV/electricity/insurance) and digital/fitness subscriptions are
 * mapped from subscriptions.ts's categoriser so a "Netflix" or "Cellcom" line
 * lands in the right bucket here too.
 */
export function categorizeSpend(merchant: string): SpendCategory {
  const recurring = categorize(merchant);
  if (recurring === "cellular" || recurring === "tv_internet" || recurring === "electricity" || recurring === "insurance") {
    return "bills";
  }
  if (recurring === "fitness" || recurring === "digital") return "entertainment";

  for (const [cat, re] of SPEND_PATTERNS) {
    if (re.test(merchant)) return cat;
  }
  return "other";
}

export interface CategorySpend {
  category: SpendCategory;
  totalAgorot: number;
  count: number;
  /** Share of total spend, 0..1. */
  share: number;
}

export interface MerchantSpend {
  merchant: string;
  totalAgorot: number;
  count: number;
}

export interface SpendingSummary {
  transactions: number;
  totalAgorot: number;
  /** Per-category totals, sorted by amount descending. */
  byCategory: CategorySpend[];
  /** The biggest merchants by total spend (top 8). */
  topMerchants: MerchantSpend[];
}

function summarize(txns: StatementTxn[]): SpendingSummary {
  const catTotals = new Map<SpendCategory, { total: number; count: number }>();
  const merchantTotals = new Map<string, { merchant: string; total: number; count: number }>();
  let total = 0;

  for (const t of txns) {
    total += t.amountAgorot;

    const cat = categorizeSpend(t.merchant);
    const c = catTotals.get(cat);
    if (c) {
      c.total += t.amountAgorot;
      c.count += 1;
    } else {
      catTotals.set(cat, { total: t.amountAgorot, count: 1 });
    }

    const key = t.merchant.toLowerCase().replace(/\s+/g, " ").trim();
    const m = merchantTotals.get(key);
    if (m) {
      m.total += t.amountAgorot;
      m.count += 1;
    } else {
      merchantTotals.set(key, { merchant: t.merchant, total: t.amountAgorot, count: 1 });
    }
  }

  const byCategory: CategorySpend[] = [...catTotals.entries()]
    .map(([category, v]) => ({
      category,
      totalAgorot: v.total,
      count: v.count,
      share: total > 0 ? v.total / total : 0,
    }))
    .sort((a, b) => b.totalAgorot - a.totalAgorot);

  const topMerchants: MerchantSpend[] = [...merchantTotals.values()]
    .map((v) => ({ merchant: v.merchant, totalAgorot: v.total, count: v.count }))
    .sort((a, b) => b.totalAgorot - a.totalAgorot)
    .slice(0, 8);

  return { transactions: txns.length, totalAgorot: total, byCategory, topMerchants };
}

/** Parse a pasted/uploaded statement and produce the full spending overview. */
export function analyzeSpending(text: string): SpendingSummary {
  return summarize(parseStatement(text));
}
