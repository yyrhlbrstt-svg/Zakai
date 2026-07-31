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

const CATALOG: PriorityAction[] = [
  {
    id: "money",
    href: "/money",
    titleHe: "הכסף שלי — סריקה + תיק סוכן",
    titleEn: "My money — scan + agent case",
    whyHe: "צילום מסך → הסוכן פותח תיק עם Mandate",
    whyEn: "Screenshot → agent opens Mandate case",
    potentialShekels: 150,
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
    titleHe: "ביטול / הנחה — הסוכן שולח",
    titleEn: "Cancel / discount — agent sends",
    whyHe: "תיק + Mandate + מעקב + תיעוד חיסכון",
    whyEn: "Case + Mandate + follow-up + savings proof",
    potentialShekels: 70,
    cadence: "monthly",
    effort: "low",
    agentic: true,
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
    whyHe: "משא ומתן מתועד + Mandate",
    whyEn: "Documented negotiation + Mandate",
    potentialShekels: 55,
    cadence: "monthly",
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
    potentialShekels: 40,
    cadence: "monthly",
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
    // A real full-service vertical (RULE_PACKS "parking", agent + Mandate +
    // send) that was simply never added here — invisible to both the
    // assistant's ranked digest and the dashboard's next-best-action list,
    // despite agentPlaybook.ts's own static text already mentioning it.
    id: "parking",
    href: "/parking",
    titleHe: "ערעור על דוח חניה — הסוכן שולח",
    titleEn: "Parking ticket appeal — agent sends",
    whyHe: "ערעור בכתב + Mandate דרך הסוכן, מול העירייה / רשות החניה",
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
    titleHe: "ערעור קנס תחבורה ציבורית — הסוכן שולח",
    titleEn: "Public-transport fine appeal — agent sends",
    whyHe: "ערעור בכתב + Mandate דרך הסוכן, מול מפעיל התחבורה",
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
    whyHe: "דרישה בכתב + Mandate דרך הסוכן, לפי חוק מוסר תשלומים לספקים",
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
    whyHe: "דרישה בכתב + Mandate דרך הסוכן, לפי חוק השכירות והשאילה",
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
];

/** Rank: agentic boost, then potential / effort. Cadence never affects ranking, only display. */
export function rankPriorityActions(limit = 5): PriorityAction[] {
  const weight = (a: PriorityAction) => {
    const base = a.potentialShekels / (a.effort === "low" ? 1 : a.effort === "medium" ? 1.4 : 2);
    return base * (a.agentic ? 1.35 : 1);
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
