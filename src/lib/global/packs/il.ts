/**
 * Israel — the reference jurisdiction pack.
 *
 * This is the same 60 entitlements the product ships today, restated as data.
 * The document text is not duplicated: it is pulled from
 * `src/lib/rightsActions.ts`, so there is exactly one place a letter is
 * written and one place it is maintained.
 *
 * `il.parity.test.ts` asserts this pack returns the identical set of rights as
 * the legacy `evaluateRights()` across an exhaustive profile matrix. That test
 * is the point of the exercise: it is what makes the migration to a
 * jurisdiction-agnostic engine a provable refactor rather than a rewrite that
 * quietly drops somebody's benefit.
 */

import { RECIPIENT_HE, RIGHT_ACTIONS } from "../../rightsActions";
import {
  all,
  always,
  any,
  extraIs,
  is,
  not,
  num,
  oneOf,
  type JurisdictionPack,
  type PackAction,
  type Predicate,
  type RightCategory,
  type RightDef,
} from "../types";

// --- Local shorthands, mirroring the legacy helpers exactly -----------------

/** Retirement age in Israel for this purpose; a UK pack says 66, France 62. */
const SENIOR_AGE = 67;

const senior = any(num("ageYears", { gte: SENIOR_AGE }), oneOf("employment", "retired"));
const working = oneOf("employment", "employee", "self_employed");
const employee = oneOf("employment", "employee");
const parent = num("dependents", { gte: 1 });
const largeFamily = num("dependents", { gte: 3 });
const toddlerParent = num("dependentsUnder6", { gte: 1 });
const lowIncome = oneOf("incomeBand", "low");
const renting = oneOf("housing", "renting");
const owner = oneOf("housing", "owner", "other");
const disability = is("hasDisability");
/** "New immigrant" in the sense the tax and municipal rules use: within 10 years. */
const newImmigrant = num("migrantYears", { lte: 10 });
const soldier = oneOf("employment", "military");
const student = oneOf("employment", "student");
const discharged = is("recentMilitaryDischarge");
const reservist = is("militaryReserve");

/**
 * Build a right from the compact table below, taking its fulfilment from the
 * shared action catalog.
 */
function right(
  id: string,
  category: RightCategory,
  when: Predicate,
  source: string,
  amounts: { yearlyMinor?: number; oneTimeMinor?: number } = {},
): RightDef {
  const action = RIGHT_ACTIONS[id] as PackAction | undefined;
  if (!action) throw new Error(`IL pack: no action defined for right "${id}"`);
  return { id, category, when, source, action, ...amounts };
}

const rights: RightDef[] = [
  // ---- Tax -----------------------------------------------------------------
  right("tax_refund", "tax", working, "פקודת מס הכנסה [נוסח חדש], סעיף 160"),
  right(
    "work_grant",
    "tax",
    all(working, lowIncome),
    "חוק להגדלת שיעור ההשתתפות בכוח העבודה ולצמצום פערים חברתיים (מס הכנסה שלילי), התשס״ח-2007",
  ),
  right("credit_children", "tax", all(working, parent), "פקודת מס הכנסה, סעיפים 36א ו-40"),
  right(
    "credit_degree",
    "tax",
    all(working, num("ageYears", { lte: SENIOR_AGE - 1 })),
    "פקודת מס הכנסה, סעיף 40ג",
  ),
  right("credit_oleh", "tax", all(newImmigrant, working), "פקודת מס הכנסה, סעיף 35"),
  right("credit_discharged", "tax", all(discharged, working), "פקודת מס הכנסה, סעיף 40ה"),
  right("credit_donations", "tax", working, "פקודת מס הכנסה, סעיף 46"),
  right("credit_pension_deposit", "tax", working, "פקודת מס הכנסה, סעיפים 45א ו-47"),
  right("tax_disability_exemption", "tax", disability, "פקודת מס הכנסה, סעיף 9(5)"),
  right(
    "credit_life_insurance",
    "tax",
    any(working, extraIs("hasMortgage", true)),
    "פקודת מס הכנסה, סעיף 45א",
    { yearlyMinor: 40_000 },
  ),
  right(
    "credit_special_needs_child",
    "tax",
    all(parent, extraIs("specialNeedsChild", true)),
    "פקודת מס הכנסה, סעיף 45",
    { yearlyMinor: 400_000 },
  ),
  right(
    "provident_withdrawal_refund",
    "tax",
    extraIs("withdrewProvidentFund", true),
    "פקודת מס הכנסה, סעיף 87 ותקנות ניכוי מס במקור ממשיכה מקופת גמל",
    { oneTimeMinor: 300_000 },
  ),
  right(
    "betterment_tax_refund",
    "tax",
    extraIs("soldProperty", true),
    "חוק מיסוי מקרקעין (שבח ורכישה), התשכ״ג-1963",
  ),
  right(
    "eligible_settlement_credit",
    "tax",
    all(extraIs("livesInEligibleTown", true), working),
    "פקודת מס הכנסה, סעיף 11 והתוספת הראשונה",
    { yearlyMinor: 300_000 },
  ),

  // ---- Social security -----------------------------------------------------
  right("child_allowance", "social_security", parent, "חוק הביטוח הלאומי [נוסח משולב], התשנ״ה-1995, פרק ד'"),
  right("maternity_grant", "social_security", toddlerParent, "חוק הביטוח הלאומי, פרק ג' סימן ב'"),
  right(
    "unemployment_benefit",
    "social_security",
    oneOf("employment", "unemployed"),
    "חוק הביטוח הלאומי, פרק ז'",
  ),
  right("income_support", "social_security", all(lowIncome, not(working)), "חוק הבטחת הכנסה, התשמ״א-1980"),
  right("old_age_pension", "social_security", senior, "חוק הביטוח הלאומי, פרק י״א"),
  right("miluim_pay", "social_security", reservist, "חוק הביטוח הלאומי, פרק י״ב"),
  right("disability_allowance", "social_security", disability, "חוק הביטוח הלאומי, פרק ט'"),
  right("mobility_allowance", "social_security", disability, "הסכם הניידות בין המדינה למוסד לביטוח לאומי"),

  // ---- Municipal -----------------------------------------------------------
  right("arnona_income", "municipal", lowIncome, "תקנות הסדרים במשק המדינה (הנחה מארנונה), התשנ״ג-1993"),
  right("arnona_oleh", "municipal", newImmigrant, "תקנות הסדרים במשק המדינה (הנחה מארנונה), התשנ״ג-1993, תקנה 2(א)(5)"),
  right("arnona_senior", "municipal", senior, "תקנות הסדרים במשק המדינה (הנחה מארנונה), התשנ״ג-1993, תקנה 2(א)(8)"),
  right("arnona_disability", "municipal", disability, "תקנות הסדרים במשק המדינה (הנחה מארנונה), התשנ״ג-1993, תקנה 2(א)(3)"),
  right("arnona_soldier", "municipal", soldier, "תקנות הסדרים במשק המדינה (הנחה מארנונה), התשנ״ג-1993, תקנה 2(א)(1)"),
  right("arnona_large_family", "municipal", largeFamily, "תקנות הסדרים במשק המדינה (הנחה מארנונה), התשנ״ג-1993"),
  right("water_disability", "municipal", disability, "כללי תאגידי מים וביוב (חישוב עלות שירותי מים) — הקצאה לצריכה רפואית"),
  right("arnona_area_correction", "municipal", always, "חוק הרשויות המקומיות (ערר על קביעת ארנונה כללית), התשל״ו-1976"),
  right("water_leak_credit", "municipal", always, "כללי תאגידי מים וביוב (תעריפים לשירותי מים וביוב), התש״ע-2009 — הנחה בגין נזילה סמויה"),

  // ---- Banking -------------------------------------------------------------
  right("bank_basic_track", "banking", always, "כללי הבנקאות (שירות ללקוח)(עמלות), התשס״ח-2008", {
    yearlyMinor: 15_000,
  }),
  right("bank_senior_track", "banking", any(senior, disability), "הוראות המפקח על הבנקים — הטבות בעמלות לאזרחים ותיקים ולבעלי מוגבלות"),
  right("bank_soldier_student", "banking", any(soldier, student), "כללי הבנקאות (שירות ללקוח)(עמלות) — פטורים לחיילים ולסטודנטים"),
  right("credit_report_free", "banking", always, "חוק נתוני אשראי, התשע״ו-2016"),
  right("dormant_money", "banking", always, "הוראות ניהול בנקאי תקין — חשבונות ללא תנועה"),

  // ---- Consumer ------------------------------------------------------------
  right("mobile_check", "consumer", always, "חוק התקשורת (בזק ושידורים), התשמ״ב-1982"),
  right("electricity_switch", "energy", always, "אמות מידה של רשות החשמל — מעבר בין ספקים"),
  right("electricity_social", "energy", any(lowIncome, disability, senior), "אמות מידה של רשות החשמל — הנחה בתעריף לזכאים"),
  right("flight_comp", "consumer", always, "חוק שירותי תעופה (פיצוי וסיוע בשל ביטול טיסה או שינוי בתנאיה), התשע״ב-2012"),
  right("subscription_audit", "consumer", always, "חוק הגנת הצרכן, התשמ״א-1981, סעיף 13ד"),
  right("insurance_duplicates", "consumer", always, "חוזר ביטוח — כפל ביטוח בביטוחי בריאות ונסיעות"),
  right("pension_fees", "consumer", working, "חוק הפיקוח על שירותים פיננסיים (קופות גמל), התשס״ה-2005"),
  // Deliberately cites the general unjust-enrichment principle rather than a
  // specific Consumer Protection Law section number: "charged twice for the
  // same purchase" isn't a named statutory violation the way the 14-day
  // cancellation right is, and guessing a section number here would be
  // exactly the kind of unverified citation this file exists to avoid.
  right("duplicate_charge_dispute", "consumer", always, "חוק עשיית עושר ולא במשפט, התשל״ט-1979"),
  right("consumer_cancel14", "consumer", always, "חוק הגנת הצרכן, התשמ״א-1981, סעיף 14ג"),
  right("consumer_telecom_exit", "consumer", always, "חוק התקשורת (בזק ושידורים), התשמ״ב-1982, סעיף 13ג"),

  // ---- Health --------------------------------------------------------------
  right("health_dental_kids", "health", parent, "חוק ביטוח בריאות ממלכתי, התשנ״ד-1994 — סל שירותי בריאות השן לילדים"),
  right("health_glasses_kids", "health", parent, "תוכניות השירותים הנוספים (שב״ן) של קופות החולים"),
  right("health_er_exemption", "health", always, "תקנות ביטוח בריאות ממלכתי (השתתפות עצמית) — עילות פטור בחדר מיון"),

  // ---- Work ----------------------------------------------------------------
  right("work_havraa", "work", employee, "צו הרחבה בדבר השתתפות המעביד בהוצאות הבראה ונופש"),
  right("work_pension_mandatory", "work", employee, "צו הרחבה לביטוח פנסיוני מקיף במשק"),
  right("work_travel", "work", employee, "צו הרחבה בדבר השתתפות המעביד בהוצאות נסיעה לעבודה וממנה"),
  right("work_overtime", "work", employee, "חוק שעות עבודה ומנוחה, התשי״א-1951"),
  right("work_sick", "work", employee, "חוק דמי מחלה, התשל״ו-1976"),

  // ---- Transport -----------------------------------------------------------
  right(
    "transport_youth",
    "transport",
    any(num("ageYears", { gte: 18, lte: 24 }), student, soldier),
    "צו פיקוח על מחירי מצרכים ושירותים (מחירי נסיעה בקווי שירות באוטובוסים)",
  ),

  // ---- Education -----------------------------------------------------------
  right("student_scholarships", "education", student, "מסלולי המלגות של משרד העלייה והקליטה ומשרד החינוך"),

  // ---- Military ------------------------------------------------------------
  right("discharged_deposit", "military", discharged, "חוק קליטת חיילים משוחררים, התשנ״ד-1994"),
  right("reservist_benefits", "military", reservist, "חוק שירות המילואים, התשס״ח-2008"),

  // ---- Family --------------------------------------------------------------
  right("daycare_subsidy", "family", all(toddlerParent, working), "מבחני הזכאות לסבסוד מעונות יום ומשפחתונים, משרד העבודה"),
  right("child_savings", "family", parent, "חוק הביטוח הלאומי, סעיף 74 — חיסכון לכל ילד"),

  // ---- Seniors -------------------------------------------------------------
  right("senior_card", "senior", senior, "חוק האזרחים הוותיקים, התש״ן-1989"),
  right("heating_grant", "senior", all(senior, lowIncome), "חוק הביטוח הלאומי — מענק חימום לזכאי השלמת הכנסה"),

  // ---- Housing -------------------------------------------------------------
  right("rent_assistance", "housing", all(renting, lowIncome), "נהלי הסיוע בשכר דירה, משרד הבינוי והשיכון"),
  right("mortgage_refinance", "housing", owner, "חוק הבנקאות (שירות ללקוח), התשמ״א-1981 — גילוי נאות ופירעון מוקדם"),
];

export const IL_PACK: JurisdictionPack = {
  market: "IL",
  version: "2026.07.1",
  reviewed: "2026-07-26",
  docLocale: "he-IL",
  currency: "ILS",
  minorUnits: 100,
  recipients: RECIPIENT_HE,
  rights,
};
