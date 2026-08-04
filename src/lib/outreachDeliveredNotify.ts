import { AGENT_SUBJECT_PREFIX } from "@/lib/services/loopLimits";

/**
 * When OUTBOX_ASYNC drains a provider letter QUEUED → SENT, the consumer still
 * thinks the outreach is "בתור שליחה" (initial) or heard nothing (follow-up).
 * Classify Outbox subjects that deserve an upgrade notify — never user-facing
 * status mail ("זכאי — נשלח ל-…").
 */

export type OutreachDeliveredKind =
  | { kind: "initial" }
  | { kind: "followup"; round: number };

export function classifyProviderOutreachForNotify(
  subject: string | null | undefined,
): OutreachDeliveredKind | null {
  if (!subject) return null;
  if (subject.startsWith(AGENT_SUBJECT_PREFIX)) {
    const m = new RegExp(`^${escapeRegExp(AGENT_SUBJECT_PREFIX)}\\s+(\\d+)`).exec(subject);
    const round = m ? Number(m[1]) : 1;
    return { kind: "followup", round: Number.isFinite(round) && round > 0 ? round : 1 };
  }
  // Initial outreach subjects always embed the authorization code.
  if (/הרשאה\s+ZK-[A-Z0-9]/i.test(subject)) {
    return { kind: "initial" };
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function outreachDeliveredUserSubject(
  kind: OutreachDeliveredKind,
  provider: string,
): string {
  if (kind.kind === "followup") {
    return `זכאי — הסוכן שלח פנייה חוזרת ל-${provider} (סיבוב ${kind.round})`;
  }
  return `זכאי — נשלח ל-${provider} | מה הלאה`;
}

export function outreachDeliveredUserBody(p: {
  kind: OutreachDeliveredKind;
  name: string;
  provider: string;
  proofsAddr: string;
  moneyUrl?: string;
}): string {
  if (p.kind.kind === "followup") {
    return `שלום ${p.name},

הסוכן שלח בשמך פנייה חוזרת בכתב ל-${p.provider} (סיבוב ${p.kind.round}), עם מסמך ההרשאה הפעיל מצורף.

מה אפשר לעשות עכשיו:
• אם ענו — העבירו את המייל שלהם אל ${p.proofsAddr} (או הזינו סכום חדש ב״הכסף שלי״).
• אם רוצים לעצור — בטלו את ההרשאה במסמך האימות.

הכול בתוך זכאי. עמלה רק על חיסכון מתועד.

זכאי — הסוכן שלך.`;
  }

  const moneyLine = p.moneyUrl ? `\nהכסף שלי: ${p.moneyUrl}\n` : "\n";
  return `שלום ${p.name},

הסוכן שלח בשמך פנייה בכתב ל-${p.provider}, עם מסמך ההרשאה (ייפוי כוח) מצורף.

מה אפשר לעשות עכשיו:
• אם ענו — העבירו את המייל שלהם אל ${p.proofsAddr}
  (הסוכן יזהה סכום ויציע רישום חיסכון בלחיצה אחת ב״הכסף שלי״).
• אם לא ענו תוך כמה ימים — הסוכן ישלח סיבוב 2 אוטומטית.
• לעצירה — בטלו את ההרשאה במסמך האימות.
${moneyLine}
הכול בתוך זכאי. עמלה רק על חיסכון מתועד.

זכאי — הסוכן שלך.`;
}

export function outreachDeliveredPush(p: {
  kind: OutreachDeliveredKind;
  provider: string;
  proofsAddr: string;
  caseId: string;
}): { title: string; body: string; url: string; tag: string } {
  if (p.kind.kind === "followup") {
    return {
      title: "זכאי — הסוכן פעל",
      body: `סיבוב ${p.kind.round}: נשלחה פנייה ל-${p.provider}. פתחו את ״הכסף שלי״ אם ענו.`,
      url: `/money?case=${p.caseId}`,
      tag: `followup-${p.caseId}-r${p.kind.round}`,
    };
  }
  return {
    title: "זכאי — נשלח לספק",
    body: `פנייה ל-${p.provider} יצאה. העבירו תשובה ל-${p.proofsAddr}`,
    url: `/money?case=${p.caseId}`,
    tag: `sent-${p.caseId}`,
  };
}
