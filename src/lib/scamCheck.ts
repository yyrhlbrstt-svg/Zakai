/**
 * Scam-message pattern checker — pure text heuristics, no AI call, nothing
 * leaves the browser. Built deliberately conservative in one direction only:
 * it may say "this matches a known scam pattern" (a positive claim about
 * text that is actually there), but it must never say "this is safe" — a
 * false negative from a black-box verdict is the one failure mode that
 * actually hurts someone, so the module only ever raises flags, never clears
 * them. Every pattern here is a well-known, currently active Israeli SMS/
 * WhatsApp scam family, not a general spam filter.
 *
 * WHY DETERMINISTIC AND NOT AN LLM CALL
 * A model asked "is this a scam?" can confidently say no about a scam it
 * hasn't seen worded quite that way, and confident reassurance is worse than
 * no answer at all for exactly the audience (elderly, first-time smartphone
 * users) this protects. Regex over known, currently-circulating patterns is
 * boring, auditable, and never invents false safety.
 */

export type ScamRisk = "high" | "unclear";

export interface ScamPatternMatch {
  /** Matches a key under scamCheck.patterns.* in the message catalogue. */
  id: string;
}

export interface ScamAssessment {
  risk: ScamRisk;
  matches: ScamPatternMatch[];
}

interface PatternRule {
  /** Matches a key under scamCheck.patterns.* in the message catalogue — see ScamMessageChecker.tsx. */
  id: string;
  /** Every one of these must match for the pattern to fire — a combination, not a single keyword. */
  test: (text: string) => boolean;
}

const HAS_LINK = /(https?:\/\/|www\.|\b[\w-]+\.(co\.il|com|net|org|ly|io|gov\.il)\b)/i;
const SHORTENED_LINK = /(bit\.ly|tinyurl|t\.co|goo\.gl|is\.gd|rebrand\.ly)/i;
const ASKS_FOR_CODE = /(קוד\s*(אימות|חד[- ]פעמי)?|סיסמ[הא]|CVV|מספר\s*כרטיס|פרטי\s*כרטיס|OTP)/i;
const URGENCY = /(דחוף|תוך\s*24\s*שע|היום\s*בלבד|ייחסם|ייחסם|יחסם|תוקף\s*עוד|לפני\s*שיפוג)/i;

const RULES: PatternRule[] = [
  {
    id: "package_customs",
    test: (t) =>
      /(חבילה|משלוח|דואר\s*ישראל|מכס)/i.test(t) &&
      /(עוכב|ממתינ|התקבל|לא\s*נמסר|לתשלום)/i.test(t) &&
      HAS_LINK.test(t),
  },
  {
    id: "lottery_prize",
    test: (t) => /(זכית|זכיה|זכייה|פרס)/i.test(t) && /(₪|שקל|שח\b)/i.test(t) && HAS_LINK.test(t),
  },
  {
    id: "bank_verification",
    test: (t) => /(בנק|ביט\b|bit\b|פייבוקס|paybox|פייפאל|paypal)/i.test(t) && ASKS_FOR_CODE.test(t),
  },
  {
    id: "gov_refund",
    test: (t) =>
      /(רשות\s*המסים|ביטוח\s*לאומי|משרד\s*הפנים)/i.test(t) &&
      /(החזר|זיכוי|זכאי)/i.test(t) &&
      HAS_LINK.test(t),
  },
  {
    id: "shortened_link_urgency",
    test: (t) => SHORTENED_LINK.test(t) && URGENCY.test(t),
  },
  {
    id: "code_plus_urgency",
    test: (t) => ASKS_FOR_CODE.test(t) && URGENCY.test(t),
  },
];

/**
 * Assess pasted message text against known scam-pattern families.
 * `risk: "high"` only when at least one full pattern actually matched;
 * `"unclear"` otherwise — never "safe", regardless of how clean the text looks.
 */
export function assessMessage(text: string): ScamAssessment {
  const t = text.trim();
  const matches: ScamPatternMatch[] = [];
  for (const rule of RULES) {
    if (rule.test(t)) {
      matches.push({ id: rule.id });
    }
  }
  return { risk: matches.length > 0 ? "high" : "unclear", matches };
}
