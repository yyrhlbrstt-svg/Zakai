import type { RecurringCharge } from "./subscriptions";

/**
 * Turn a business's recurring charges into a list of things it can actually
 * challenge — and route each one to the tool that challenges it.
 *
 * WHY THIS EXISTS
 *
 * The statement scanner was built for a household: it knows cellular, TV,
 * electricity, insurance, gym, streaming. A business's largest recurring
 * costs are none of those. Card-clearing fees, business bank charges,
 * accounting software, a leased vehicle — every one of them lands in "other",
 * which is the same as not being seen at all.
 *
 * So the shop owner who pastes a statement gets a tidy list of charges and no
 * idea which are negotiable. The information a business needs is not "what am
 * I paying" — the statement already said that. It is "which of these will
 * move if I ask, and who do I ask".
 *
 * WHAT THIS REFUSES TO DO
 *
 * It never estimates a saving. Whether a clearing rate or a bank fee comes
 * down depends on turnover, contract age and the counterparty's appetite —
 * none of which are visible from a line on a statement. Quoting a number here
 * would be inventing one, which is the product's first prohibition. Each
 * finding says what the cost is and which tool addresses it; the amount is
 * whatever the counterparty puts in writing.
 *
 * It also never claims a cost is *wrong*. "Worth asking about" and "you are
 * being overcharged" are different sentences, and only the first one is
 * honest from this distance.
 */

export type BusinessCostKind =
  | "clearing"
  | "bank_fee"
  | "insurance"
  | "telecom"
  | "software"
  | "utilities"
  | "leasing"
  | "unclassified";

export interface BusinessFinding {
  charge: RecurringCharge;
  kind: BusinessCostKind;
  /** Route to the tool that actually challenges this cost, or null if none exists yet. */
  href: string | null;
}

/**
 * Israeli-market patterns, in priority order — first match wins.
 *
 * Only names verifiable as real operators in this market are listed. A
 * speculative pattern that mislabels a charge sends a business to the wrong
 * tool, which costs more trust than leaving the line unclassified.
 */
const PATTERNS: Array<[BusinessCostKind, RegExp]> = [
  // Acquirers and payment gateways. First, because "ישראכרט" is also a card
  // issuer and would otherwise be read as an ordinary bank charge.
  [
    "clearing",
    /(סליקה|clearing|ישראכרט|isracard|כאל|cal ?online|מקס ?איט|max ?it|לאומי ?קארד|שב"?א|shva|טרנזילה|tranzila|פייפלוס|payplus|פלאקארד|pelecard|קארדקום|cardcom|נאייקס|nayax|sumit|סאמיט)/i,
  ],
  [
    "bank_fee",
    /(עמלת|עמלות|דמי ניהול|הפועלים|hapoalim|לאומי(?! ?קארד)|leumi|דיסקונט|discount|מזרחי|mizrahi|הבינלאומי|fibi|one ?zero|וואן ?זירו)/i,
  ],
  // Israeli accounting/invoicing and the global business SaaS an SMB actually
  // pays for monthly.
  [
    "software",
    /(חשבשבת|hashavshevet|ריווחית|rivhit|חשבונית ירוקה|green ?invoice|ezcount|priority|פריוריטי|monday|google ?workspace|microsoft ?365|office ?365|wix|shopify|quickbooks|zoom|slack|dropbox|adobe|canva|hubspot|salesforce|aws|amazon ?web|azure|vercel|godaddy)/i,
  ],
  [
    "insurance",
    /(ביטוח|הפניקס|הראל|מגדל|כלל ביטוח|מנורה|איילון|AIG|ביטוח ישיר|ליברה|wesure)/i,
  ],
  [
    "telecom",
    /(סלקום|cellcom|פרטנר|partner|פלאפון|pelephone|בזק|bezeq|הוט|hot|019|012|רמי לוי תקשורת|we4g)/i,
  ],
  [
    "utilities",
    /(חברת החשמל|חשמל|אלקטרה פאוור|electra ?power|אנרג'?י|energy|פאוור|power|נגה|מים|תאגיד המים)/i,
  ],
  [
    "leasing",
    /(ליסינג|leasing|אלבר|albar|שלמה ?סיקסט|sixt|אביס|avis|הרץ|hertz|קרסו|carasso|אופרייט)/i,
  ],
];

/** The tool that actually challenges each cost. Null where none exists yet. */
const ROUTES: Record<BusinessCostKind, string | null> = {
  clearing: "/merchant-fees",
  bank_fee: "/bank-fees",
  insurance: "/duplicate-insurance",
  telecom: "/cancel",
  software: "/cancel",
  utilities: "/electricity",
  // No vertical exists for vehicle leasing yet. Saying so beats routing a
  // business to a page that cannot help it.
  leasing: null,
  unclassified: null,
};

export function classifyBusinessCharge(merchant: string): BusinessCostKind {
  const name = merchant.trim();
  if (!name) return "unclassified";
  for (const [kind, re] of PATTERNS) {
    if (re.test(name)) return kind;
  }
  return "unclassified";
}

/**
 * Findings ordered by monthly cost, largest first — a business has limited
 * attention and should spend it on the biggest line, not the first one
 * alphabetically.
 */
export function auditBusinessExpenses(charges: RecurringCharge[]): BusinessFinding[] {
  return charges
    .map((charge) => {
      const kind = classifyBusinessCharge(charge.merchant);
      return { charge, kind, href: ROUTES[kind] };
    })
    .sort((a, b) => b.charge.monthlyAgorot - a.charge.monthlyAgorot);
}

/** Findings that have somewhere to go — the ones worth showing a CTA for. */
export function actionableFindings(findings: BusinessFinding[]): BusinessFinding[] {
  return findings.filter((f) => f.href !== null);
}

/** Total monthly cost of the charges we can route, in agorot. Never a saving. */
export function addressableMonthlyAgorot(findings: BusinessFinding[]): number {
  return actionableFindings(findings).reduce((sum, f) => sum + f.charge.monthlyAgorot, 0);
}
