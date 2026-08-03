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
  potentialShekels: number;
  /**
   * Required, not defaulted — a number without a cadence is exactly how this
   * list ended up rendering a one-time incident payout and a dormant-account
   * count as "/month" on the dashboard and inside the assistant's own system
   * prompt (`priorityDigestHe`, in `agentPlaybook.ts`): a false recurring
   * claim an agent could then say out loud to somebody. `oneTime` renders
   * without a cadence suffix; `hidden` renders no figure at all — for
   * `dormant`, where the product's own doctrine is that the headline is a
   * count of institutions, never a sum, because there is no such thing as a
   * typical dormant account.
   */
  cadence: "monthly" | "oneTime" | "hidden";
  effort: "low" | "medium" | "high";
  /** Agent path = closed-loop Case; calculator = estimate only */
  agentic?: boolean;
};

export const CATALOG: PriorityAction[] = [
  {
    id: "money",
    href: "/money",
    titleHe: "הכסף שלי — סריקה + תיק סוכן",
    titleEn: "My money — scan + agent case",
    whyHe: "צילום מסך → הסוכן פותח תיק עם הרשאה",
    whyEn: "Screenshot → agent opens Mandate case",
    potentialShekels: 150,
    cadence: "monthly",
    effort: "low",
    agentic: true,
  },
  {
    id: "must-have",
    href: "/must-have",
    titleHe: "חבילת חובה — כלים שכולם חייבים",
    titleEn: "Must-have kit — tools everyone needs",
    whyHe: "8 דלתות ראשונות לפי מצב חיים — בלי לנחש בתפריט",
    whyEn: "Eight first doors by life situation — no menu guessing",
    potentialShekels: 140,
    cadence: "monthly",
    effort: "low",
    agentic: true,
  },
  {
    // Ranked high on potential and low on effort because the money per event is
    // an order of magnitude above anything else in this list, and the first
    // step is one tap. This fires once and pays once — cadence says so
    // explicitly now, rather than a comment nobody reads at render time.
    id: "incident",
    href: "/incident",
    titleHe: "נפצעת? כמה גורמים חייבים לך במקביל",
    titleEn: "Injured? Several payers owe you at once",
    whyHe: "פוליסות מצטברות + חלון של 12 חודשים בביטוח לאומי",
    whyEn: "Stacking policies + a 12-month National Insurance window",
    potentialShekels: 400,
    cadence: "oneTime",
    effort: "low",
    agentic: false,
  },
  {
    // hidden: no honest monthly OR one-time figure exists for a dormant
    // account — it is nine shekels or ninety thousand, and averaging across
    // "nobody's typical case" produces a number that is technically an
    // average and substantively a fabrication. The count of institutions is
    // the real headline; this entry keeps a number only to rank alongside
    // everything else, and cadence: "hidden" keeps it off every screen.
    id: "dormant",
    href: "/dormant",
    titleHe: "כסף ששכחת שהוא שלך",
    titleEn: "Money you forgot is yours",
    whyHe: "שאלה אחת → כל גוף שחייב לגלות מה יש לו על שמך",
    whyEn: "One question → every body that must disclose what it holds",
    potentialShekels: 120,
    cadence: "hidden",
    effort: "low",
    agentic: false,
  },
  {
    // The largest single preventable sum in the product — a pre-purchase
    // check, not a recovery, so "potential" here means a loss avoided, not
    // money returned. One-time by nature: nobody buys the same car twice.
    id: "vehicleCheck",
    href: "/vehicle-check",
    titleHe: "קונה רכב יד שנייה? מה שאתה רשאי לדרוש",
    titleEn: "Buying a used car? What you may demand",
    whyHe: "חובה חוקית על המוכר — כמעט אף אחד לא שואל",
    whyEn: "A statutory seller duty — almost nobody asks",
    potentialShekels: 500,
    cadence: "oneTime",
    effort: "low",
    agentic: false,
  },
  {
    id: "cancel",
    href: "/cancel",
    titleHe: "ביטול / הנחה — תיק סוכן",
    titleEn: "Cancel / discount — agent case",
    whyHe: "תיק + הרשאה + מעקב + תיעוד חיסכון",
    whyEn: "Case + Mandate + follow-up + savings proof",
    potentialShekels: 70,
    cadence: "monthly",
    effort: "low",
    agentic: true,
  },
  {
    id: "entitlements",
    href: "/entitlements",
    titleHe: "שאלון זכאות — מה מגיע לך?",
    titleEn: "Entitlements quiz — what are you owed?",
    whyHe: "מנוע הזכויות → דלת ישירה לסוכן מלא על כל התאמה",
    whyEn: "Rights engine → direct door to full agent per match",
    potentialShekels: 220,
    cadence: "oneTime",
    effort: "low",
    agentic: false,
  },
  {
    id: "student-loan-overpayment",
    href: "/student-loan-overpayment",
    titleHe: "בריטניה — החזר יתר על הלוואת סטודנטים",
    titleEn: "UK — student loan overpayment refund",
    whyHe: "מכתב SLC עם ציטוט רגולטורי — דלת גלובלית ראשונה",
    whyEn: "SLC letter with regulatory citation — first global door",
    potentialShekels: 120,
    cadence: "oneTime",
    effort: "low",
    agentic: false,
  },
  {
    id: "integrations",
    href: "/integrations",
    titleHe: "אינטגרציית Mandate למוסדות",
    titleEn: "Institution Mandate integration",
    whyHe: "30 דקות ל-verify — דלת B2B",
    whyEn: "30-minute verify path — B2B door",
    potentialShekels: 0,
    cadence: "oneTime",
    effort: "low",
    agentic: false,
  },
  {
    id: "train-delay",
    href: "/train-delay",
    titleHe: "עיכוב רכבת — מכתב",
    titleEn: "Train delay — letter",
    whyHe: "מדיניות רכבת ישראל + קישור לטיסות EU",
    whyEn: "Israel Rail policy letter + EU flight link",
    potentialShekels: 80,
    cadence: "oneTime",
    effort: "low",
    agentic: false,
  },
  {
    id: "consumer-cancel",
    href: "/consumer-cancel",
    titleHe: "מכון כושר / קורס — ביטול 14 יום",
    titleEn: "Gym / course — 14-day cancel",
    whyHe: "חוק הגנת הצרכן — מכתב מוכן",
    whyEn: "Consumer Protection Law — ready letter",
    potentialShekels: 90,
    cadence: "oneTime",
    effort: "low",
    agentic: false,
  },
  {
    id: "collection-complaint",
    href: "/collection-complaint",
    titleHe: "גובה חוב מטריד?",
    titleEn: "Debt collector harassing you?",
    whyHe: "תלונה + אימות חוב לפני תשלום",
    whyEn: "Complaint + verify before paying",
    potentialShekels: 0,
    cadence: "hidden",
    effort: "low",
    agentic: false,
  },
  {
    id: "car-insurance-refund",
    href: "/car-insurance-refund",
    titleHe: "ביטלת ביטוח רכב?",
    titleEn: "Cancelled car insurance?",
    whyHe: "החזר פרמיה יחסי — הסוכן שולח עם Mandate",
    whyEn: "Pro-rata premium — agent sends with Mandate",
    potentialShekels: 150,
    cadence: "oneTime",
    effort: "low",
    agentic: true,
  },
  {
    id: "toll-dispute",
    href: "/toll-dispute",
    titleHe: "חיוב כביש 6 שגוי",
    titleEn: "Wrong Highway 6 toll",
    whyHe: "ערעור לוועדה הסטטוטורית",
    whyEn: "Statutory toll appeal",
    potentialShekels: 40,
    cadence: "oneTime",
    effort: "low",
    agentic: false,
  },
  {
    id: "debt-collector-dispute",
    href: "/debt-collector-dispute",
    titleHe: "ארה״ב — אימות חוב FDCPA",
    titleEn: "US — FDCPA debt validation",
    whyHe: "מכתב validation — דלת גלובלית",
    whyEn: "Validation letter — global door",
    potentialShekels: 40,
    cadence: "oneTime",
    effort: "low",
    agentic: false,
  },
  {
    id: "wage-statement-audit",
    href: "/wage-statement-audit",
    titleHe: "ארה״ב — ביקורת תלוש שכר (FLSA)",
    titleEn: "US — wage statement audit (FLSA)",
    whyHe: "מכתב למעסיק עם ציטוט חוקי — דלת גלובלית",
    whyEn: "Employer letter with legal citation — global door",
    potentialShekels: 180,
    cadence: "oneTime",
    effort: "medium",
    agentic: false,
  },
  {
    // A hub whose own linked tool already says its total "mixes one-time,
    // annual and multi-year amounts" — never monthly, so this cannot claim
    // to be either without contradicting the page it points to.
    id: "what-am-i-owed",
    href: "/what-am-i-owed",
    titleHe: "מה מגיע לי?",
    titleEn: "What am I owed?",
    whyHe: "פוטנציאל → דלתות פעולה עם סוכן",
    whyEn: "Potential → agent action doors",
    potentialShekels: 90,
    cadence: "oneTime",
    effort: "low",
    agentic: true,
  },
  {
    id: "check",
    href: "/check",
    titleHe: "סלולר / אינטרנט — משא ומתן",
    titleEn: "Mobile / internet — negotiate",
    whyHe: "משא ומתן מתועד + הרשאה",
    whyEn: "Documented negotiation + Mandate",
    potentialShekels: 55,
    cadence: "monthly",
    effort: "medium",
    agentic: true,
  },
  {
    id: "bank-fees",
    href: "/bank-fees",
    titleHe: "עמלות בנק — תיק סוכן",
    titleEn: "Bank fees — agent case",
    whyHe: "תיק מלא + הרשאה + תיעוד",
    whyEn: "Full case + Mandate + proof",
    potentialShekels: 40,
    cadence: "monthly",
    effort: "low",
    agentic: true,
  },
  {
    id: "bank-loan-fee",
    href: "/bank-loan-fee",
    titleHe: "עמלת פתיחת הלוואה",
    titleEn: "Loan opening fee clawback",
    whyHe: "מכתב לבנק; אפשר להמשיך עם סוכן ב-/bank-fees",
    whyEn: "Bank letter; can escalate via /bank-fees agent",
    potentialShekels: 120,
    cadence: "oneTime",
    effort: "medium",
  },
  {
    id: "water-bill",
    href: "/water-bill",
    titleHe: "הנחה בגין נזילה סמויה",
    titleEn: "Concealed leak water credit",
    whyHe: "מכתב לתאגיד המים + אישור תיקון",
    whyEn: "Water corp letter + repair proof",
    potentialShekels: 80,
    cadence: "oneTime",
    effort: "medium",
  },
  {
    id: "vaad-bait",
    href: "/vaad-bait",
    titleHe: "ועד בית — פירוט חיובים",
    titleEn: "HOA charge transparency",
    whyHe: "מכתב לוועד לפירוט ותיקון",
    whyEn: "Letter demanding itemized charges",
    potentialShekels: 100,
    cadence: "oneTime",
    effort: "medium",
  },
  {
    id: "landlord-repairs",
    href: "/landlord-repairs",
    titleHe: "תיקון ליקוי בדירה שכורה",
    titleEn: "Rental essential repairs",
    whyHe: "מכתב דרישה לבעל הדירה",
    whyEn: "Landlord repair demand letter",
    potentialShekels: 90,
    cadence: "oneTime",
    effort: "medium",
  },
  {
    id: "duplicate-charge",
    href: "/duplicate-charge",
    titleHe: "חיוב כפול / שגוי",
    titleEn: "Duplicate or wrong charge",
    whyHe: "מכתב ערעור לספק / בנק",
    whyEn: "Dispute letter to provider",
    potentialShekels: 70,
    cadence: "oneTime",
    effort: "low",
  },
  {
    id: "telecom-exit",
    href: "/telecom-exit",
    titleHe: "ניתוק תקשורת והחזרים",
    titleEn: "Telecom exit + refunds",
    whyHe: "מכתב לפי חוק התקשורת",
    whyEn: "Disconnect letter under comms law",
    potentialShekels: 60,
    cadence: "oneTime",
    effort: "medium",
  },
  {
    id: "electricity",
    href: "/electricity",
    titleHe: "חשמל — מעבר ספק עם סוכן",
    titleEn: "Electricity — agent switches supplier",
    whyHe: "תיק + הרשאה + שליחה + חיסכון מתועד",
    whyEn: "Case + Mandate + send + documented saving",
    potentialShekels: 45,
    cadence: "monthly",
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
    potentialShekels: 40,
    cadence: "monthly",
    effort: "low",
    agentic: true,
  },
  {
    // A specific missing refund is a one-time amount by definition — it does
    // not recur every month once it lands.
    id: "refund-chase",
    href: "/refund-chase",
    titleHe: "החזר שלא הגיע",
    titleEn: "Missing refund",
    whyHe: "דרישה בכתב דרך הסוכן",
    whyEn: "Written demand via agent",
    potentialShekels: 50,
    cadence: "oneTime",
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
    potentialShekels: 120,
    cadence: "monthly",
    effort: "medium",
  },
  {
    id: "duplicate-insurance",
    href: "/duplicate-insurance",
    titleHe: "ביטוח כפול",
    titleEn: "Duplicate insurance",
    whyHe: "פרמיה מיותרת",
    whyEn: "Wasted premium",
    potentialShekels: 60,
    cadence: "monthly",
    effort: "medium",
    agentic: true,
  },
  {
    id: "arnona",
    href: "/arnona",
    titleHe: "ארנונה — הנחה או תיקון",
    titleEn: "Arnona discount / fix",
    whyHe: "תיק + שליחה לעירייה אחרי אימות (Mandate)",
    whyEn: "Case + send to municipality after verification (Mandate)",
    potentialShekels: 200,
    cadence: "monthly",
    effort: "medium",
    agentic: true,
  },
  {
    // Built (computePensionFees, /pension-fees) but was missing from this
    // catalog entirely — every other calculator ranks alongside the agent
    // paths above; this one just never got added, so it never surfaced on
    // /leaks or in the assistant's own priority digest. The deposit-fee
    // portion of a negotiated reduction is a genuinely ongoing monthly saving
    // (a lower % on every future contribution, independent of the separate
    // balance-fee compounding the tool also projects), so "monthly" is the
    // honest cadence — not the much larger decades-out retirement number the
    // full calculator shows, which stays inside that page as a projection.
    id: "pension-fees",
    href: "/pension-fees",
    titleHe: "דמי ניהול פנסיה",
    titleEn: "Pension management fees",
    whyHe: "אחוז מיותר על כל הפקדה, כל חודש",
    whyEn: "An avoidable % on every deposit, every month",
    potentialShekels: 90,
    cadence: "monthly",
    effort: "medium",
  },
  {
    // Same gap as pension-fees, times four: payslip/severance/maternity/
    // unemployment/miluim are all built, all tested, all named explicitly in
    // the assistant's own KNOWLEDGE ANCHORS (assistantSystem.ts) — and every
    // one of them was absent from this catalog, so none of them ever reached
    // /leaks, the dashboard's next-best-action cards, or priorityDigestHe(),
    // the ranked digest actually injected into the agent's prompt. Real
    // entitlements here range from small to five-figure depending on tenure
    // and salary; potentialShekels stays deliberately modest and illustrative
    // (matching "incident"/"vehicleCheck" elsewhere in this file) rather than
    // quoting a case-specific number as if it were typical.
    id: "payslip",
    href: "/payslip",
    titleHe: "בדיקת תלוש שכר",
    titleEn: "Payslip check",
    whyHe: "מינימום, פנסיה, הבראה — תיקון קדימה כל חודש",
    whyEn: "Minimum wage, pension, convalescence — corrected going forward",
    potentialShekels: 80,
    cadence: "monthly",
    effort: "medium",
  },
  {
    id: "severance",
    href: "/severance",
    titleHe: "פיצויי פיטורים",
    titleEn: "Severance pay",
    whyHe: "חודש שכר אחרון לכל שנת ותק",
    whyEn: "One last month's salary per year of tenure",
    potentialShekels: 400,
    cadence: "oneTime",
    effort: "low",
  },
  {
    id: "maternity",
    href: "/maternity",
    titleHe: "דמי לידה",
    titleEn: "Maternity allowance",
    whyHe: "בדיקת זכאות וימי תשלום מול ביטוח לאומי",
    whyEn: "Eligibility and paid days vs. National Insurance",
    potentialShekels: 350,
    cadence: "oneTime",
    effort: "low",
  },
  {
    id: "unemployment",
    href: "/unemployment",
    titleHe: "דמי אבטלה",
    titleEn: "Unemployment benefit",
    whyHe: "בדיקת שיעור וימי זכאות לפי גיל",
    whyEn: "Rate and entitlement days by age",
    potentialShekels: 300,
    cadence: "oneTime",
    effort: "low",
  },
  {
    id: "miluim",
    href: "/miluim",
    titleHe: "תגמולי מילואים",
    titleEn: "Reserve-duty pay",
    whyHe: "תוספת 20% שרוב הזכאים לא יודעים שמגיעה",
    whyEn: "The 20% supplement most claimants don't know exists",
    potentialShekels: 250,
    cadence: "oneTime",
    effort: "low",
  },
  {
    // Monthly by nature — it's an interest-rate change on the remaining
    // balance, not a one-off payout. potentialShekels mirrors the real
    // computeMortgageRefi() default illustration in mortgageRefi.ts
    // (a realistic mid-size balance, a plausible achievable rate drop), not a
    // fabricated figure — the calculator on the page itself is what gives a
    // specific number for a specific mortgage.
    id: "mortgage",
    href: "/mortgage",
    titleHe: "מיחזור משכנתא",
    titleEn: "Mortgage refinance",
    whyHe: "ריבית נמוכה יותר על היתרה = חיסכון חודשי",
    whyEn: "A lower rate on the remaining balance = monthly saving",
    potentialShekels: 350,
    cadence: "monthly",
    effort: "medium",
  },
  {
    // Guaranteed alimony (מזונות מובטחים) is a recurring monthly payment
    // National Insurance makes in place of a non-paying parent — monthly by
    // nature, not a one-off. No fabricated ceiling: the real amount depends
    // on the court judgment and an income test, so this stays deliberately
    // modest/illustrative like every other benefit entry in this file.
    id: "alimony-guarantee",
    href: "/alimony-guarantee",
    titleHe: "מזונות מובטחים",
    titleEn: "Guaranteed alimony",
    whyHe: "ההורה השני לא משלם? ביטוח לאומי יכול לשלם במקומו",
    whyEn: "Other parent not paying? National Insurance can pay instead",
    potentialShekels: 300,
    cadence: "monthly",
    effort: "medium",
  },
  {
    // Business war-damage compensation is a one-time claim per filing window
    // (a new claim opens per operation, but each is its own one-time event),
    // not a recurring monthly amount. Figure kept deliberately modest —
    // real payouts range from low four figures to the ceiling depending on
    // business size, and the page's own "₪15B paid, 525K claims" framing
    // carries the honest program-scale picture rather than a fabricated
    // per-business estimate.
    id: "business-compensation",
    href: "/business-compensation",
    titleHe: "פיצויי נזק עקיף לעסקים",
    titleEn: "Business war-damage compensation",
    whyHe: "ירידה במחזור בגלל המלחמה — רשות המסים משלמת על זה",
    whyEn: "Revenue drop from the war — the Tax Authority compensates for it",
    potentialShekels: 600,
    cadence: "oneTime",
    effort: "medium",
  },
  {
    // Disability benefit is a recurring monthly allowance once approved, not
    // a one-time payout — cadence follows the real-world benefit, not the
    // one-time effort of filing. Figure kept deliberately modest/illustrative
    // (matching payslip/severance elsewhere in this file); the page's own
    // "bigNumber" framing carries the honest wide range, this entry doesn't
    // try to restate it as a point estimate.
    id: "disability-benefits",
    href: "/disability-benefits",
    titleHe: "קצבת נכות",
    titleEn: "Disability benefits",
    whyHe: "קצבה חודשית לכל החיים — רוב הזכאים לא הגישו תביעה",
    whyEn: "A monthly allowance for life — most who qualify never filed",
    potentialShekels: 300,
    cadence: "monthly",
    effort: "medium",
  },
  {
    // A class-action settlement payout is one-time by nature. Figure kept
    // deliberately modest/illustrative — the page's own "bigNumber" framing
    // (₪50 to thousands) carries the honest range; this entry doesn't
    // restate it as a point estimate.
    id: "class-action",
    href: "/class-action",
    titleHe: "תביעה ייצוגית — אולי אתה זכאי",
    titleEn: "Class action — you may be owed",
    whyHe: "לפעמים זיכוי אוטומטי לחשבון, בלי לעשות כלום",
    whyEn: "Sometimes an automatic credit, with nothing to file",
    potentialShekels: 80,
    cadence: "oneTime",
    effort: "low",
  },
  {
    // A refund reaching back years is a one-time payment, not a recurring
    // monthly amount, however many years of tax it is computed from.
    id: "taxrefund",
    href: "/taxrefund",
    titleHe: "החזר מס",
    titleEn: "Tax refund",
    whyHe: "עד 6 שנים אחורה",
    whyEn: "Up to 6 years back",
    potentialShekels: 100,
    cadence: "oneTime",
    effort: "medium",
  },
  {
    // Compensation is per disrupted flight, not a monthly amount.
    id: "flights",
    href: "/flights",
    titleHe: "פיצוי טיסה",
    titleEn: "Flight compensation",
    whyHe: "עיכוב / ביטול → תיק סוכן",
    whyEn: "Delay / cancel → agent case",
    potentialShekels: 80,
    cadence: "oneTime",
    effort: "medium",
    agentic: true,
  },
  {
    id: "warranty",
    href: "/warranty",
    titleHe: "אחריות מוצר — תיק סוכן",
    titleEn: "Product warranty — agent case",
    whyHe: "תיקון / החלפה בחינם לפי חוק הגנת הצרכן — בכתב + Mandate",
    whyEn: "Free repair or replacement under consumer law — written + Mandate",
    potentialShekels: 400,
    cadence: "oneTime",
    effort: "low",
    agentic: true,
  },
  {
    // A real full-service vertical (RULE_PACKS "parking", agent + Mandate +
    // send) that was simply never added here — invisible to both the
    // assistant's ranked digest and the dashboard's next-best-action list,
    // despite agentPlaybook.ts's own static text already mentioning it.
    id: "parking",
    href: "/parking",
    titleHe: "ערעור על דוח חניה — תיק סוכן",
    titleEn: "Parking ticket appeal — agent case",
    whyHe: "ערעור בכתב + הרשאה דרך הסוכן, מול העירייה / רשות החניה",
    whyEn: "Written appeal + Mandate via the agent, to the municipality / parking authority",
    potentialShekels: 150,
    cadence: "oneTime",
    effort: "low",
    agentic: true,
  },
  {
    // Same gap as parking — RULE_PACKS "transport-fine" is full-service and
    // was missing from this catalog entirely.
    id: "transport-fine",
    href: "/transport-fine",
    titleHe: "ערעור קנס תחבורה ציבורית — תיק סוכן",
    titleEn: "Public-transport fine appeal — agent case",
    whyHe: "ערעור בכתב + הרשאה דרך הסוכן, מול מפעיל התחבורה",
    whyEn: "Written appeal + Mandate via the agent, to the transport operator",
    potentialShekels: 180,
    cadence: "oneTime",
    effort: "low",
    agentic: true,
  },
  {
    // Graduated to full-service (agent + Mandate + send) — a single overdue
    // invoice getting paid, not a recurring monthly amount.
    id: "late-payment",
    href: "/late-payment",
    titleHe: "לקוח לא משלם? הסוכן דורש",
    titleEn: "Client not paying? Agent demands",
    whyHe: "דרישה בכתב + הרשאה דרך הסוכן, לפי חוק מוסר תשלומים לספקים",
    whyEn: "Written demand + Mandate via the agent, under the Fair Payment Practices law",
    potentialShekels: 200,
    cadence: "oneTime",
    effort: "low",
    agentic: true,
  },
  {
    // Deliberately not agentic: chasing a current employer automatically
    // carries real retaliation risk an agent shouldn't take on for someone
    // still working there, so this stays self-help (letter only), unlike
    // late-payment's completed-transaction client. A back-pay lump sum is
    // one-time, not a recurring monthly figure.
    id: "overtime-backpay",
    href: "/overtime-backpay",
    titleHe: "שעות נוספות שלא שולמו — עד 7 שנים אחורה",
    titleEn: "Unpaid overtime — up to 7 years back",
    whyHe: "125%-150% על שעות נוספות, לפי חוק שעות עבודה ומנוחה",
    whyEn: "125%-150% on overtime hours, under the Hours of Work and Rest Law",
    potentialShekels: 400,
    cadence: "oneTime",
    effort: "medium",
    agentic: false,
  },
  {
    // Same completed-transaction shape as late-payment: the tenant already
    // vacated, so an automated demand carries none of the ongoing-relationship
    // risk overtime-backpay has. One-time by nature — a deposit is returned
    // once, not monthly.
    id: "deposit",
    href: "/deposit",
    titleHe: "המשכיר לא מחזיר פיקדון? הסוכן דורש",
    titleEn: "Landlord withholding deposit? Agent demands",
    whyHe: "דרישה בכתב + הרשאה דרך הסוכן, לפי חוק השכירות והשאילה",
    whyEn: "Written demand + Mandate via the agent, under the Rent and Loan Law",
    potentialShekels: 300,
    cadence: "oneTime",
    effort: "low",
    agentic: true,
  },
  {
    // Same "no honest figure" doctrine as dormant: a red-flag scan of an
    // arbitrary pasted contract has no defensible shekel amount, only a
    // count of clauses worth a second look. hidden keeps that off every
    // screen while still letting it rank.
    id: "contract-check",
    href: "/contract-check",
    titleHe: "בדיקת חוזה לפני שחותמים",
    titleEn: "Check a contract before signing",
    whyHe: "מדביקים כל חוזה — רואים אילו סעיפים כדאי לשים לב אליהם",
    whyEn: "Paste any contract — see which clauses are worth a second look",
    potentialShekels: 60,
    cadence: "hidden",
    effort: "low",
    agentic: false,
  },
  {
    // Protective, not a recovery tool — a scam match prevents a loss rather
    // than recovering one already lost, so there is no honest shekel figure
    // to attach to "a message that might have been a scam". Same hidden
    // doctrine as contract-check and dormant.
    id: "scam-check",
    href: "/scam-check",
    titleHe: "ההודעה הזו היא עוקץ?",
    titleEn: "Is this message a scam?",
    whyHe: "בדיקת תבניות הונאה מוכרות — חינם, בדפדפן, בלי חשבון",
    whyEn: "Check against known scam patterns — free, in your browser, no account",
    potentialShekels: 50,
    cadence: "hidden",
    effort: "low",
    agentic: false,
  },
  {
    // Also no honest figure: escalating an ignored complaint has no
    // predictable shekel outcome or timeline — this only names the right
    // regulator and drafts a letter, same hidden doctrine as scam-check.
    id: "complaint-escalation",
    href: "/complaint-escalation",
    titleHe: "התלונה לא נענתה? הנה למי פונים",
    titleEn: "Complaint ignored? Here's who to escalate to",
    whyHe: "זיהוי הגוף הרגולטורי הנכון + מכתב הסלמה מוכן",
    whyEn: "The right regulator identified + a ready escalation letter",
    potentialShekels: 40,
    cadence: "hidden",
    effort: "low",
    agentic: false,
  },
  {
    // A calendar with a nudge, not a money vertical — no honest shekel figure
    // exists for "reminded about a passport renewal on time".
    id: "deadlines",
    href: "/deadlines",
    titleHe: "לא לפספס דדליין יותר",
    titleEn: "Never miss a deadline again",
    whyHe: "תזכורת אישית לפני חידוש דרכון, טסט, דיווח שנתי",
    whyEn: "A personal reminder before a passport renewal, car test, annual filing",
    potentialShekels: 30,
    cadence: "hidden",
    effort: "low",
    agentic: false,
  },
  {
    // For the self-employed: this returns money faster, not more of it — the
    // advance is refunded eventually either way, so there's no honest "amount
    // recovered" figure, only cash freed up sooner. Same hidden doctrine as
    // contract-check/scam-check.
    id: "advance-tax",
    href: "/advance-tax",
    titleHe: "עצמאי? הקטן את מקדמות המס",
    titleEn: "Self-employed? Reduce your tax advances",
    whyHe: "ההכנסה ירדה השנה? טופס 2216א׳ לפקיד השומה",
    whyEn: "Income down this year? Form 2216א׳ to the assessing office",
    potentialShekels: 0,
    cadence: "hidden",
    effort: "low",
    agentic: false,
  },
  {
    // Only accident insurance is ever mandatory, so a specific shekel
    // "recovery" figure would depend on what the parent was actually
    // charged, which this catalog can't know in advance. Same hidden
    // doctrine as scam-check/complaint-escalation.
    id: "school-payments",
    href: "/school-payments",
    titleHe: "הגן ביקש כסף? בדוק אם זה חובה",
    titleEn: "School/kindergarten asked for money? Check if it's mandatory",
    whyHe: "רק ביטוח תאונות אישיות הוא חובה — השאר תשלום רשות",
    whyEn: "Only accident insurance is mandatory — everything else is voluntary",
    potentialShekels: 0,
    cadence: "hidden",
    effort: "low",
    agentic: false,
  },
];

/** Rank: agentic boost, then potential / effort. Optional catalog boosts from StrategyOutcome. */
export function rankPriorityActions(
  limit = 5,
  catalogBoosts: Record<string, number> = {},
): PriorityAction[] {
  const weight = (a: PriorityAction) => {
    const base = a.potentialShekels / (a.effort === "low" ? 1 : a.effort === "medium" ? 1.4 : 2);
    const agentic = base * (a.agentic ? 1.35 : 1);
    const boost = catalogBoosts[a.id] ?? 0;
    return agentic * (1 + boost);
  };
  return [...CATALOG].sort((a, b) => weight(b) - weight(a)).slice(0, limit);
}

/** The one place cadence turns into words — kept in one function so the
 * assistant's own system prompt and the dashboard card can never render the
 * same entry two different ways. */
export function formatPotentialHe(a: PriorityAction): string {
  if (a.cadence === "hidden") return "";
  const amount = `~₪${a.potentialShekels}`;
  return a.cadence === "monthly" ? `${amount}/ח׳` : `${amount} חד-פעמי`;
}

export function formatPotentialEn(a: PriorityAction): string {
  if (a.cadence === "hidden") return "";
  const amount = `~₪${a.potentialShekels}`;
  return a.cadence === "monthly" ? `${amount}/mo` : `${amount} one-time`;
}

export function priorityDigestHe(): string {
  return rankPriorityActions(6)
    .map((a) => {
      const potential = formatPotentialHe(a);
      return `- ${a.titleHe} (${a.href})${a.agentic ? " [AGENT]" : ""}${potential ? `: ${potential}` : ""} · ${a.whyHe}`;
    })
    .join("\n");
}
