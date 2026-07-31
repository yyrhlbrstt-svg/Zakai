/**
 * The fourth category: money that exists because something happened to you.
 *
 * WHY THIS IS STRUCTURALLY DIFFERENT FROM EVERYTHING ELSE HERE
 *
 * Rights come from who you are — your age, your children, your employment. The
 * overcharge and captive-pricing engines come from what you pay. Both are
 * standing facts, and both can be evaluated from a profile that never changes.
 *
 * An injury is none of those. It is an event, it has a date, and the date
 * starts several different clocks at once. A person who tears a cruciate
 * ligament on a Saturday is, by Monday, simultaneously a potential claimant
 * against four to seven separate payers — and will claim against one.
 *
 * THE INSIGHT THAT MAKES THIS WORTH BILLIONS AND NOT MILLIONS
 *
 * It is not that people cannot find a lawyer. It is that nobody knows what they
 * are covered by. Israeli households hold accident cover they never bought and
 * cannot name: every schoolchild is insured around the clock by law through the
 * local authority; every registered athlete is insured by the sports club;
 * every employee with a pension holds disability cover inside it; every
 * commute is a work accident; every incident involving a vehicle is
 * compensable without proving fault at all.
 *
 * None of these payers volunteers. Not one of them will write to you. And the
 * shortest clock among them is twelve months, not seven years, which is why
 * this category is not merely under-claimed but quietly expiring.
 *
 * THE PART THAT MAKES STACKING LEGITIMATE
 *
 * The distinction the public misses — already encoded in `insurance.ts` for
 * premiums, reused here for claims — is indemnity versus compensation. An
 * indemnity policy reimburses actual cost, so holding two pays you once.
 * A compensation policy pays a fixed sum on a defined event regardless of what
 * anything cost, and regardless of what any other policy paid. So the football
 * player with a torn ACL may legitimately be paid by the sports insurer AND
 * the personal-accident policy AND the pension's disability cover, while the
 * surgery itself is reimbursed exactly once.
 *
 * Telling somebody that is the single most valuable sentence in the product.
 *
 * WHAT THIS FILE REFUSES TO DO
 *
 * It states no payout. Every sum in this category depends on a disability
 * percentage set by a doctor who has not yet examined anybody, and a confident
 * shekel figure here would be the most damaging number the product could
 * print. Each source therefore carries the *basis* of payment — "75% of wage,
 * up to 91 days" — which is checkable, instead of an amount, which is not.
 *
 * It also never asserts that somebody holds a policy. It states who typically
 * holds it and why, and asks. An app that tells a person they are insured, and
 * is wrong, has done real harm.
 */

import type { PolicyKind } from "../insurance";

/** What happened. Deliberately coarse: a taxonomy nobody can answer is useless. */
export type IncidentKind =
  | "sport" // training, a match, a run, a gym
  | "work" // at the workplace, or doing the job anywhere
  | "commute" // to or from work — a work accident in Israeli law, and almost nobody knows
  | "road" // any vehicle involved, in any role
  | "school" // a pupil, during or outside school hours
  | "home" // domestic, including somebody else's home
  | "military" // regular service or reserve duty
  | "abroad" // outside the country
  | "medical"; // an illness or a procedure rather than an accident

export interface IncidentFacts {
  kind: IncidentKind;
  /** When it happened. The whole category turns on this. */
  occurredAt?: Date;
  /** Under 18 at the time — unlocks the statutory school cover and shifts limitation. */
  minor?: boolean;
  /** Employed at the time, in any form. */
  employed?: boolean;
  /** Holds a pension fund or managers' insurance — practically every employee does. */
  hasPension?: boolean;
  /** Registered with a sports club or association, as opposed to playing casually. */
  registeredAthlete?: boolean;
  /** A vehicle was involved in any way at all, including as a pedestrian. */
  vehicleInvolved?: boolean;
  /** Holds supplementary health cover through the HMO or an employer. */
  hasSupplementaryHealth?: boolean;
  /** Missed work, or expects to. Gates the disability-cover sources. */
  lostWorkDays?: boolean;
  /** Required surgery or ongoing treatment. */
  neededTreatment?: boolean;
}

export interface CoverSource {
  id: string;
  /**
   * Indemnity pays actual cost and cannot be claimed twice; compensation pays a
   * defined sum and legitimately stacks. Reused from the premium engine so the
   * two halves of the product cannot drift apart on the same legal distinction.
   */
  kind: PolicyKind;
  /** Who pays. Not the same as who caused it. */
  payer:
    | "national_insurance"
    | "insurer"
    | "pension_fund"
    | "hmo"
    | "local_authority"
    | "sports_association"
    | "defence_ministry";
  /** Months from the incident in which to claim. Null where the period is uncertain. */
  claimWindowMonths: number | null;
  /** The statute or regulation the window comes from. Never a guess. */
  statute: string;
  /**
   * How the payment is calculated. Present *instead of* an amount, because the
   * amount depends on a medical determination nobody has made yet.
   */
  basis: string;
  /** Why we believe this person plausibly holds it. Shown, never hidden. */
  whoHasIt: string;
  /** What they need in hand. Short, or it reads as a refusal. */
  needs: string[];
  /** Does this source apply to the facts we were given? */
  applies: (f: IncidentFacts) => boolean;
}

const yes = (v: boolean | undefined) => v === true;

/**
 * Israel. Ordered by how much money each typically carries and how fast its
 * clock runs — the twelve-month one leads because it is the one that is
 * actually being lost.
 */
export const IL_COVER_SOURCES: readonly CoverSource[] = [
  {
    id: "ni_work_injury",
    kind: "compensation",
    payer: "national_insurance",
    // Twelve months, and it is the single most valuable fact in this file: the
    // largest payer in the category has the shortest clock, and a commute
    // counts. People who would never describe themselves as injured at work
    // are inside this and lose it silently.
    claimWindowMonths: 12,
    statute: "חוק הביטוח הלאומי [נוסח משולב], התשנ״ה-1995, פרק ה' וסעיף 296",
    basis: "דמי פגיעה בשיעור 75% מהשכר, עד 91 ימים; לאחר מכן נכות מעבודה לפי דרגה שנקבעת בוועדה",
    whoHasIt: "כל שכיר ועצמאי מבוטח. תאונה בדרך לעבודה או ממנה נחשבת תאונת עבודה לכל דבר",
    needs: ["טופס בל/250 מהמעסיק", "אישור רפואי ראשוני", "תאריך ושעת האירוע"],
    applies: (f) =>
      (f.kind === "work" || f.kind === "commute") && (yes(f.employed) || f.kind === "commute"),
  },
  {
    id: "pltd_road",
    kind: "compensation",
    payer: "insurer",
    // Absolute liability: no fault to prove, no argument to win. It covers the
    // driver who caused it, the passenger, the cyclist and the pedestrian
    // alike — which is why "it was my fault" is not a reason to skip it, and
    // why so many people skip it.
    claimWindowMonths: 84,
    statute: "חוק פיצויים לנפגעי תאונות דרכים, התשל״ה-1975",
    basis: "אחריות מוחלטת ללא הוכחת אשם — הפסדי שכר, הוצאות רפואיות, כאב וסבל לפי דרגת נכות",
    whoHasIt: "כל מי שנפגע בתאונה שמעורב בה כלי רכב — נהג, נוסע, הולך רגל או רוכב אופניים",
    needs: ["פרטי הרכב המעורב", "אישור משטרה או דיווח", "תיעוד רפואי"],
    applies: (f) => f.kind === "road" || yes(f.vehicleInvolved),
  },
  {
    id: "pension_disability",
    kind: "compensation",
    payer: "pension_fund",
    claimWindowMonths: 36,
    statute: "חוק חוזה הביטוח, התשמ״א-1981, סעיף 31 (התיישנות תביעת תגמולי ביטוח)",
    basis: "קצבת נכות בשיעור של עד 75% מהשכר המבוטח, לפי דרגת אי-הכושר ותקופת המתנה בפוליסה",
    whoHasIt: "כל מי שמפריש לקרן פנסיה או לביטוח מנהלים — הכיסוי כלול, גם אם מעולם לא נבחר במפורש",
    needs: ["דוח פנסיוני אחרון", "אישורי מחלה ותקופת היעדרות", "סיכום רפואי"],
    applies: (f) => yes(f.hasPension) && yes(f.lostWorkDays),
  },
  {
    id: "school_accident",
    kind: "compensation",
    payer: "local_authority",
    // Statutory, universal, paid for out of tuition fees, and claimed by
    // almost nobody. It runs around the clock — a fall at home on a Sunday is
    // covered exactly like a fall in the playground.
    claimWindowMonths: 36,
    statute: "חוק לימוד חובה, התש״ט-1949 — ביטוח תאונות אישיות לתלמידים",
    basis: "תגמול לפי אחוזי נכות שנקבעים על ידי רופא המבטח, ללא תלות באשם ובכיסויים אחרים",
    whoHasIt: "כל תלמיד במערכת החינוך מבוטח בביטוח תאונות אישיות 24 שעות ביממה, כל ימות השנה",
    needs: ["אישור לימודים", "תיעוד רפואי מיום האירוע", "תיאור נסיבות"],
    applies: (f) => yes(f.minor),
  },
  {
    id: "sports_insurance",
    kind: "compensation",
    payer: "sports_association",
    claimWindowMonths: 36,
    statute: "חוק הספורט, התשמ״ח-1988, סעיף 7 — חובת ביטוח ספורטאים",
    basis: "תגמול לפי אחוזי נכות והוצאות רפואיות, בהתאם לפוליסת האגודה",
    whoHasIt: "כל ספורטאי הרשום באגודת ספורט חייב להיות מבוטח על ידה — כולל אימונים ומשחקים",
    needs: ["אישור רישום באגודה", "דיווח על האירוע לאגודה", "תיעוד רפואי"],
    applies: (f) => yes(f.registeredAthlete),
  },
  {
    id: "personal_accident_policy",
    kind: "compensation",
    payer: "insurer",
    claimWindowMonths: 36,
    statute: "חוק חוזה הביטוח, התשמ״א-1981, סעיף 31",
    basis: "סכום קבוע לפי אחוזי נכות שנקבעו בפוליסה — משולם בנוסף לכל כיסוי אחר",
    whoHasIt: "פוליסת תאונות אישיות פרטית, או כיסוי נלווה שנמכר עם כרטיס אשראי או חשבון בנק",
    needs: ["הפוליסה או דף פרטי ביטוח", "תיעוד רפואי"],
    applies: () => true,
  },
  {
    id: "supplementary_health",
    kind: "indemnity",
    payer: "hmo",
    claimWindowMonths: 36,
    statute: "חוק ביטוח בריאות ממלכתי, התשנ״ד-1994 — תוכניות שירותים נוספים (שב״ן)",
    basis: "החזר הוצאות בפועל — ניתוח פרטי, בחירת מנתח, פיזיותרפיה, ייעוץ וחוות דעת שנייה",
    whoHasIt: "רוב תושבי ישראל מחזיקים בשב״ן של קופת החולים, ורבים גם בביטוח בריאות פרטי במקביל",
    needs: ["קבלות והפניות", "סיכום ניתוח או טיפול"],
    applies: (f) => yes(f.neededTreatment) || yes(f.hasSupplementaryHealth),
  },
  {
    id: "defence_disability",
    kind: "compensation",
    payer: "defence_ministry",
    claimWindowMonths: null,
    statute: "חוק הנכים (תגמולים ושיקום), התשי״ט-1959",
    basis: "תגמול חודשי ושיקום לפי דרגת נכות שנקבעת בוועדה רפואית",
    whoHasIt: "מי שנפגע בשירות סדיר, בקבע או במילואים — לרבות פגיעה בדרך לשירות",
    needs: ["אישור על השירות", "תיעוד רפואי מתקופת השירות"],
    applies: (f) => f.kind === "military",
  },
  {
    id: "travel_policy",
    kind: "indemnity",
    payer: "insurer",
    claimWindowMonths: 36,
    statute: "חוק חוזה הביטוח, התשמ״א-1981, סעיף 31",
    basis: "החזר הוצאות רפואיות בחו״ל, פינוי רפואי והוצאות נלוות בפועל",
    whoHasIt: "פוליסת נסיעות שנרכשה לנסיעה, או כיסוי נסיעות הכלול בכרטיס האשראי",
    needs: ["הפוליסה או פרטי הכרטיס", "קבלות רפואיות מחו״ל"],
    applies: (f) => f.kind === "abroad",
  },
  {
    id: "ni_general_disability",
    kind: "compensation",
    payer: "national_insurance",
    // Deliberately last: it applies only where something did not heal, and
    // raising it early would frame a recoverable injury as a permanent one.
    claimWindowMonths: 12,
    statute: "חוק הביטוח הלאומי [נוסח משולב], התשנ״ה-1995, פרק ט'",
    basis: "קצבת נכות כללית לפי דרגת אי-כושר השתכרות שנקבעת בוועדה רפואית",
    whoHasIt: "מי שנותרה לו ירידה מתמשכת בכושר ההשתכרות, ללא קשר לנסיבות הפגיעה",
    needs: ["מסמכים רפואיים מצטברים", "אישורי הכנסה"],
    applies: (f) => yes(f.lostWorkDays),
  },
];

export function sourceById(id: string): CoverSource | undefined {
  return IL_COVER_SOURCES.find((s) => s.id === id);
}
