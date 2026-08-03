/**
 * Must-have kit — tools everyone needs so leaving money on the table is the default.
 * Honest framing: no fake scarcity, no insults — concrete doors with real CTAs.
 */

export type LifeSituationId =
  | "pay_recurring"
  | "bank_card"
  | "home_energy"
  | "work_rights"
  | "family"
  | "travel"
  | "owed_state"
  | "authority";

export interface MustHaveTool {
  href: string;
  /** Catalog / nav key when available */
  toolKey?: string;
  titleHe: string;
  titleEn: string;
  /** Why skipping this leaves money or power on the table */
  costHe: string;
  costEn: string;
  agentic?: boolean;
}

export interface LifeSituation {
  id: LifeSituationId;
  titleHe: string;
  titleEn: string;
  blurbHe: string;
  blurbEn: string;
  tools: MustHaveTool[];
}

/** Core pack — first session for any adult with a bank account. */
export const STARTER_PACK: readonly MustHaveTool[] = [
  {
    href: "/money#zakai-money-scan",
    toolKey: "money",
    titleHe: "סריקת חיובים חוזרים",
    titleEn: "Scan recurring charges",
    costHe: "בלי זה — מנויים וספקים נשארים שקופים בכרטיס",
    costEn: "Without this, subscriptions stay invisible on the card",
    agentic: true,
  },
  {
    href: "/cancel/universal",
    toolKey: "universalCancel",
    titleHe: "מכתבי ביטול מוכנים",
    titleEn: "Ready cancel letters",
    costHe: "בלי זה — אתה מחכה לנציג במקום לשלוח בעצמך",
    costEn: "Without this, you wait on hold instead of sending yourself",
  },
  {
    href: "/what-am-i-owed",
    toolKey: "whatAmIOwed",
    titleHe: "מה מגיע לי מהמדינה",
    titleEn: "What am I owed",
    costHe: "בלי זה — זכויות נשארות בוויקיפדיה ולא בפעולה",
    costEn: "Without this, rights stay as blog posts, not actions",
  },
  {
    href: "/check",
    toolKey: "newCheck",
    titleHe: "תיק סוכן מול סלולר/ספק",
    titleEn: "Agent case vs mobile provider",
    costHe: "בלי Mandate — אין סמכות מאומתת מול החברה",
    costEn: "Without a Mandate, no verifiable authority with the provider",
    agentic: true,
  },
  {
    href: "/bank-fees",
    toolKey: "bankfees",
    titleHe: "עמלות בנק",
    titleEn: "Bank fees",
    costHe: "בלי זה — עמלות קטנות מצטברות שנים בלי מכתב",
    costEn: "Without this, small fees compound for years unanswered",
    agentic: true,
  },
  {
    href: "/electricity",
    toolKey: "electricity",
    titleHe: "השוואת / מעבר חשמל",
    titleEn: "Electricity compare / switch",
    costHe: "בלי זה — נשארים במסלול היקר כי «אין זמן»",
    costEn: "Without this, you stay on the expensive plan for lack of time",
    agentic: true,
  },
  {
    href: "/dormant",
    toolKey: "dormant",
    titleHe: "כסף רדום על שמך",
    titleEn: "Dormant money in your name",
    costHe: "בלי זה — גופים מחזיקים כסף ולא מבקשים אותך",
    costEn: "Without this, institutions hold money and never ask you",
  },
  {
    href: "/proofs",
    toolKey: "proofs",
    titleHe: "קיר הוכחות (אמיתי בלבד)",
    titleEn: "Proofs wall (real only)",
    costHe: "בלי שיתוף אחרי חיסכון — אין רשת שמוזילה את הבא",
    costEn: "Without sharing after a save, the next person starts from zero",
  },
] as const;

export const LIFE_SITUATIONS: readonly LifeSituation[] = [
  {
    id: "pay_recurring",
    titleHe: "משלם כל חודש — ולא יודע על מה",
    titleEn: "Pay every month — unclear for what",
    blurbHe: "הדלת הראשונה. בלי סריקה — הספקים נהנים מהעיוורון שלך.",
    blurbEn: "The first door. Without a scan, opacity wins.",
    tools: [
      STARTER_PACK[0]!,
      STARTER_PACK[1]!,
      {
        href: "/leaks",
        toolKey: "leaks",
        titleHe: "מפת נזילות",
        titleEn: "Leaks map",
        costHe: "רואים איפה הכסף בורח לפני שפותחים תיק",
        costEn: "See where money leaks before opening a case",
      },
      {
        href: "/telecom-exit",
        toolKey: "telecomExit",
        titleHe: "ניתוק / יציאה מסלולר",
        titleEn: "Telecom exit",
        costHe: "יציאה בכתב עם Mandate — לא שיחה שנגמרת בשום מקום",
        costEn: "Exit in writing with Mandate — not a call that goes nowhere",
        agentic: true,
      },
    ],
  },
  {
    id: "bank_card",
    titleHe: "בנק וכרטיס אשראי",
    titleEn: "Bank & card",
    blurbHe: "עמלות, ריבית, כסף רדום — הכל דורש מכתב מתועד.",
    blurbEn: "Fees, interest, dormant funds — all need a documented letter.",
    tools: [
      STARTER_PACK[4]!,
      STARTER_PACK[6]!,
      {
        href: "/credit-card",
        toolKey: "creditcard",
        titleHe: "ריבית מתגלגלת",
        titleEn: "Revolving interest",
        costHe: "בלי בדיקה — משלמים ריבית על חוב שלא חייבים",
        costEn: "Without a check, you pay interest you may not need",
      },
      {
        href: "/bank-loan-fee",
        toolKey: "bankloanfee",
        titleHe: "עמלת פתיחת הלוואה",
        titleEn: "Loan opening fee",
        costHe: "עמלה חד־פעמית שקל לפספס בחוזה",
        costEn: "A one-time fee easy to miss in the contract",
      },
    ],
  },
  {
    id: "home_energy",
    titleHe: "בית — חשמל, מים, ארנונה",
    titleEn: "Home — power, water, arnona",
    blurbHe: "חשבונות קבועים שאפשר להוריד או לערער — בלי נציג טלפוני.",
    blurbEn: "Fixed bills you can cut or appeal — without phone hold music.",
    tools: [
      STARTER_PACK[5]!,
      {
        href: "/arnona",
        toolKey: "arnona",
        titleHe: "ערעור ארנונה",
        titleEn: "Arnona appeal",
        costHe: "הנחות שלא מבקשים — לא מקבלים",
        costEn: "Discounts you never ask for, you never get",
        agentic: true,
      },
      {
        href: "/water-bill",
        toolKey: "waterBill",
        titleHe: "נזילת מים / זיכוי",
        titleEn: "Water leak credit",
        costHe: "נזילה שקטה = חשבון מופקע בלי מכתב",
        costEn: "A quiet leak = an inflated bill with no letter",
      },
      {
        href: "/vaad-bait",
        toolKey: "vaadBait",
        titleHe: "ועד בית — שקיפות",
        titleEn: "HOA transparency",
        costHe: "בלי פירוט — משלמים בלי לדעת לאן",
        costEn: "Without a breakdown, you pay without knowing where",
      },
    ],
  },
  {
    id: "work_rights",
    titleHe: "עבודה ושכר",
    titleEn: "Work & pay",
    blurbHe: "תלוש, פיטורים, שעות נוספות — זכויות שלא מחכות לנציג.",
    blurbEn: "Payslip, severance, overtime — rights that do not wait on hold.",
    tools: [
      {
        href: "/payslip",
        toolKey: "payslip",
        titleHe: "בדיקת תלוש",
        titleEn: "Payslip check",
        costHe: "טעות קטנה בתלוש × 12 חודשים",
        costEn: "A small payslip error × 12 months",
      },
      {
        href: "/severance",
        toolKey: "severance",
        titleHe: "פיצויי פיטורים",
        titleEn: "Severance",
        costHe: "חלון זמן — מי שמחכה מפסיד",
        costEn: "Time windows — waiters lose",
      },
      {
        href: "/overtime-backpay",
        toolKey: "overtimeBackPay",
        titleHe: "שעות נוספות שלא שולמו",
        titleEn: "Unpaid overtime",
        costHe: "בלי תיעוד ומכתב — זה נעלם",
        costEn: "Without documentation and a letter, it vanishes",
      },
      {
        href: "/wage-statement-audit",
        toolKey: "wageAudit",
        titleHe: "ביקורת שכר (US)",
        titleEn: "Wage audit (US)",
        costHe: "שוק גלובלי — אותה לוגיקת מכתב",
        costEn: "Global market — same letter logic",
      },
    ],
  },
  {
    id: "family",
    titleHe: "משפחה וחיים",
    titleEn: "Family & life",
    blurbHe: "לידה, ילדים, ביטוחים כפולים — כסף שבורח בין כיסאות.",
    blurbEn: "Birth, kids, duplicate insurance — money that falls between stools.",
    tools: [
      {
        href: "/maternity",
        toolKey: "maternity",
        titleHe: "דמי לידה",
        titleEn: "Maternity pay",
        costHe: "חלון הגשה — פספוס = אובדן",
        costEn: "Filing windows — miss them and it is gone",
      },
      {
        href: "/child-savings",
        toolKey: "childsavings",
        titleHe: "חיסכון לכל ילד",
        titleEn: "Child savings",
        costHe: "כסף שיושב בלי שבודקים מסלול",
        costEn: "Money sitting unreviewed",
      },
      {
        href: "/duplicate-insurance",
        toolKey: "dupinsurance",
        titleHe: "כפל ביטוחי",
        titleEn: "Duplicate insurance",
        costHe: "שתי פרמיות על אותו סיכון",
        costEn: "Two premiums for the same risk",
        agentic: true,
      },
      {
        href: "/school-payments",
        toolKey: "schoolPayments",
        titleHe: "תשלומי הורים",
        titleEn: "School payments",
        costHe: "תשלומים שלא חובה — בלי בדיקה משלמים",
        costEn: "Optional fees — unchecked, you just pay",
      },
    ],
  },
  {
    id: "travel",
    titleHe: "טיסות ונסיעות",
    titleEn: "Flights & travel",
    blurbHe: "עיכוב, כבודה, קנס נסיעה — פיצוי בכתב, לא «נדבר בוואטסאפ».",
    blurbEn: "Delay, baggage, fines — written recovery, not a WhatsApp maybe.",
    tools: [
      {
        href: "/flights",
        toolKey: "flights",
        titleHe: "פיצוי טיסה",
        titleEn: "Flight compensation",
        costHe: "חלון קצר — בלי מכתב מפסידים",
        costEn: "Short windows — no letter, no claim",
        agentic: true,
      },
      {
        href: "/baggage",
        toolKey: "baggage",
        titleHe: "כבודה",
        titleEn: "Baggage",
        costHe: "תיעוד בזמן אמת או אובדן זכות",
        costEn: "Document in time or lose the right",
      },
      {
        href: "/transport-fine",
        toolKey: "transportFine",
        titleHe: "ערעור קנס נסיעה",
        titleEn: "Transit fine appeal",
        costHe: "תשלום אוטומטי = ויתור שקט",
        costEn: "Auto-pay is a quiet surrender",
        agentic: true,
      },
      {
        href: "/parking",
        toolKey: "parking",
        titleHe: "ערעור חניה",
        titleEn: "Parking appeal",
        costHe: "בלי ערעור מסודר — הקנס נשאר",
        costEn: "No structured appeal — the fine sticks",
        agentic: true,
      },
    ],
  },
  {
    id: "owed_state",
    titleHe: "מה המדינה / גופים חייבים",
    titleEn: "What the state / bodies owe",
    blurbHe: "מס, אבטלה, מילואים, נכות — זכויות כנתונים + צעד הבא.",
    blurbEn: "Tax, unemployment, reserves, disability — rights as data + next step.",
    tools: [
      STARTER_PACK[2]!,
      {
        href: "/taxrefund",
        toolKey: "taxrefund",
        titleHe: "החזר מס",
        titleEn: "Tax refund",
        costHe: "מי שלא בודק משאיר כסף ברשות המסים",
        costEn: "Unchecked money sits with the tax authority",
      },
      {
        href: "/miluim",
        toolKey: "miluim",
        titleHe: "מילואים",
        titleEn: "Reserve duty",
        costHe: "תשלומים והטבות — בלי בדיקה נעלמים",
        costEn: "Pay and benefits vanish if unchecked",
      },
      {
        href: "/unemployment",
        toolKey: "unemployment",
        titleHe: "דמי אבטלה",
        titleEn: "Unemployment",
        costHe: "רישום מאוחר = הפסד ימים",
        costEn: "Late registration = lost days",
      },
    ],
  },
  {
    id: "authority",
    titleHe: "סמכות דיגיטלית (למה זכאי ולא עוד בוט)",
    titleEn: "Digital authority (why Zakai, not another bot)",
    blurbHe: "Mandate + פרוטוקול — בלי זה סוכן AI הוא רק טקסט.",
    blurbEn: "Mandate + protocol — without it an AI agent is just text.",
    tools: [
      {
        href: "/protocol",
        toolKey: "protocolPage",
        titleHe: "פרוטוקול זכאי",
        titleEn: "Zakai protocol",
        costHe: "בלי תקן — כל אפליקציה ממציאה ייפוי כוח מחדש",
        costEn: "Without a standard, every app invents power-of-attorney again",
      },
      {
        href: "/companies",
        toolKey: "companiesFairness",
        titleHe: "ציון הוגנות ספקים",
        titleEn: "Provider fairness scores",
        costHe: "בלי נתונים — בוחרים ספק לפי פרסומת",
        costEn: "Without data, you pick providers by ads",
      },
      {
        href: "/institutions",
        toolKey: "integrations",
        titleHe: "למוסדות — אימות Mandate",
        titleEn: "Institutions — Mandate verify",
        costHe: "בלי אימות — הלחץ על הספקים לא מצטבר",
        costEn: "Without verify, pressure on providers never compounds",
      },
      {
        href: "/assistant",
        toolKey: "assistant",
        titleHe: "הסוכן שלי",
        titleEn: "My agent",
        costHe: "שאלות → דלת פעולה, לא צ׳אט ריק",
        costEn: "Questions → an action door, not empty chat",
      },
    ],
  },
] as const;

export function mustHavePageCopy(locale: string) {
  const he = locale === "he" || locale === "ar";
  return {
    kicker: he ? "חבילת חובה" : "Must-have kit",
    title: he ? "כלים שכולם חייבים — אחרת משאירים כסף על השולחן" : "Tools everyone needs — or money stays on the table",
    sub: he
      ? "לא פחד מזויף. דלתות אמיתיות: סריקה, מכתב, Mandate, הוכחה. מי שלא בודק — משלם על העיוורון."
      : "Not fake fear. Real doors: scan, letter, Mandate, proof. Skip the check — you pay for blindness.",
    starterTitle: he ? "8 דקות ראשונות — לכל מבוגר עם חשבון" : "First 8 minutes — every adult with an account",
    situationsTitle: he ? "לפי מצב חיים" : "By life situation",
    agentBadge: he ? "סוכן" : "Agent",
    ctaMoney: he ? "התחילו בסריקה" : "Start with a scan",
    ctaTools: he ? "כל הכלים" : "All tools",
    installHint: he
      ? "אפשר להתקין למסך הבית (PWA) — הכסף שלכם תמיד בלחיצה."
      : "Install to home screen (PWA) — your money path one tap away.",
    progressTitle: (n: string, total: number) =>
      he ? `התקדמות חבילת החובה · ${n}/${total}` : `Must-have progress · ${n}/${total}`,
    progressSub: he
      ? "סמנו מה כבר עשיתם — נשמר במכשיר בלבד. המטרה: לסגור את כל שמונה הדלתות."
      : "Tick what you finished — stored on this device only. Goal: close all eight doors.",
    progressDone: he
      ? "סגרתם את החבילה — עכשיו שתפו / הוכיחו חיסכון כשיש."
      : "Kit complete — share / prove a saving when you have one.",
  };
}

export function mustHaveToolTitle(tool: MustHaveTool, locale: string): string {
  return locale === "he" || locale === "ar" ? tool.titleHe : tool.titleEn;
}

export function mustHaveToolCost(tool: MustHaveTool, locale: string): string {
  return locale === "he" || locale === "ar" ? tool.costHe : tool.costEn;
}

export function mustHaveSituationTitle(sit: LifeSituation, locale: string): string {
  return locale === "he" || locale === "ar" ? sit.titleHe : sit.titleEn;
}

export function mustHaveSituationBlurb(sit: LifeSituation, locale: string): string {
  return locale === "he" || locale === "ar" ? sit.blurbHe : sit.blurbEn;
}
