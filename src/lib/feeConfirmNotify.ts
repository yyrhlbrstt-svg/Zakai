import type { Locale } from "@/i18n/config";
import { absoluteLocaleUrl, localeForCountry, localePath } from "@/lib/localePath";
import { formatAgorot } from "@/lib/money";
import { providerHebrewName } from "@/lib/providers";
import { publicSupportEmail } from "@/lib/contact";

/** Days a customer has to dispute a success-fee charge (see Trust page). */
export const FEE_DISPUTE_WINDOW_DAYS = 14;

/**
 * Settle-time fee email / push deep links.
 * `payFee=1` only when Mandate is ACTIVE and a real PSP is configured —
 * never invent auto-checkout under mock payments (dashboard already warns).
 */
export function feeConfirmAutoCheckout(opts: {
  mandateActive: boolean;
  paymentsLive: boolean;
}): boolean {
  return opts.mandateActive === true && opts.paymentsLive === true;
}

export function feeConfirmDashboardPath(
  locale: Locale,
  caseId: string,
  opts: { mandateActive: boolean; paymentsLive: boolean },
): string {
  const q = new URLSearchParams({ case: caseId });
  if (feeConfirmAutoCheckout(opts)) q.set("payFee", "1");
  return localePath(locale, `/money?${q.toString()}`);
}

export function feeConfirmAbsoluteUrl(
  baseUrl: string,
  country: string | null | undefined,
  caseId: string,
  opts: { mandateActive: boolean; paymentsLive: boolean },
): string {
  const locale = localeForCountry(country);
  const q = new URLSearchParams({ case: caseId });
  if (feeConfirmAutoCheckout(opts)) q.set("payFee", "1");
  return absoluteLocaleUrl(baseUrl, locale, `/money?${q.toString()}`);
}

export function feeConfirmationBody(p: {
  name: string;
  provider: string;
  originalAgorot: number;
  newAgorot: number;
  savingAgorot: number;
  rateBps: number;
  grossFeeAgorot: number;
  creditAgorot: number;
  netFeeAgorot: number;
  payUrl?: string;
  /** Real PSP configured — never claim "מאובטח" one-tap under mock. */
  paymentsLive?: boolean;
}): string {
  const f = (a: number) => formatAgorot(a, "he-IL");
  const pct = `${(p.rateBps / 100).toLocaleString("he-IL", { maximumFractionDigits: 2 })}%`;
  const creditLines =
    p.creditAgorot > 0
      ? `• עמלת הצלחה (${pct}): ${f(p.grossFeeAgorot)}
• זיכוי חבר מביא חבר: −${f(p.creditAgorot)}
• סה"כ לחיוב: ${f(p.netFeeAgorot)}`
      : `• עמלת הצלחה (${pct}): ${f(p.netFeeAgorot)}`;

  let payBlock = "";
  if (p.payUrl) {
    payBlock =
      p.paymentsLive === true
        ? `\nלתשלום עמלת ההצלחה (חד-פעמי, מאובטח): ${p.payUrl}\n`
        : `\nלסיום ב״הכסף שלי״ (אין גבייה חיה עדיין — לא נגבה כרטיס אמיתי): ${p.payUrl}\n`;
  }

  return `שלום ${p.name},

תיעדנו חיסכון בפנייה שביצע זכאי בשמך מול ${providerHebrewName(p.provider)}, ובהתאם למסלול שלך נגבית עמלת הצלחה של ${pct} מהחיסכון המתועד בלבד.

פירוט:
• סכום חודשי מקורי: ${f(p.originalAgorot)}
• סכום חודשי חדש: ${f(p.newAgorot)}
• חיסכון חודשי מתועד: ${f(p.savingAgorot)}
${creditLines}

ערעור על החיוב: אם לדעתך החיסכון לא מומש בפועל, יש לך ${FEE_DISPUTE_WINDOW_DAYS} ימים מתאריך הודעה זו לפנות אלינו לבדיקה, ואם יתברר שהחיסכון לא נכנס לתוקף — העמלה תבוטל או תוחזר. לפנייה: ${publicSupportEmail()}
${payBlock}
זכאי הוא שירות סוכן דיגיטלי אוטומטי הפועל מטעמך בהרשאתך. אין באמור ייעוץ משפטי, פיננסי או ביטוחי.

בברכה,
צוות זכאי`;
}
