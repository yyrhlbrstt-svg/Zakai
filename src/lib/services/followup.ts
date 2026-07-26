import "server-only";
import { prisma } from "@/lib/prisma";
import { aiAvailable } from "@/lib/ai";
import { CaseError, recordSaving } from "./cases";
import { sendEmail } from "@/lib/messaging";
import { providerHebrewName, providerContactEmail } from "@/lib/providers";

export class FollowUpError extends Error {}

export interface ParsedProviderReply {
  /** What the provider actually did in the reply. */
  outcome: "saving_accepted" | "rejected" | "needs_info" | "unclear" | "no_reply_needed";
  /** New monthly amount the provider agreed to, if any. */
  newAmountShekels?: number;
  /** Free-text summary of the reply in Hebrew. */
  summaryHe: string;
  /** Suggested next action for Zakai to take. */
  suggestedAction: "record_saving" | "send_followup" | "ask_user" | "wait";
  /** If the provider asked for something, this is what they need. */
  missingInfo?: string;
}

interface AnalyzeReplyInput {
  caseId: string;
  userId: string;
  /** The raw text of the provider reply (extracted from email or typed by user). */
  replyText: string;
}

/**
 * Analyze a provider reply and decide what to do next.
 * This is the autonomous half of the trust loop: instead of waiting for the
 * user to read the reply and update the case, the agent reads it and acts.
 */
export async function analyzeProviderReply(input: AnalyzeReplyInput): Promise<ParsedProviderReply> {
  const kase = await prisma.case.findUnique({
    where: { id: input.caseId },
    include: { authorization: true },
  });
  if (!kase || kase.userId !== input.userId) throw new FollowUpError("NOT_FOUND");

  if (kase.status !== "SENT") {
    throw new FollowUpError("CASE_NOT_SENT");
  }

  const parsed = await parseReplyWithAi(input.replyText);

  // Audit trail: every reply is recorded.
  await prisma.outbox.create({
    data: {
      caseId: input.caseId,
      channel: "EMAIL",
      toAddress: "inbound@zakai.example",
      subject: `תשובת ספק — ${providerHebrewName(kase.provider)}`,
      body: `Parsed outcome: ${parsed.outcome}\nSummary: ${parsed.summaryHe}\nSuggested action: ${parsed.suggestedAction}\n\n---\n${input.replyText}`,
      status: "SENT",
      providerMessageId: "agent:inbound",
      sentAt: new Date(),
    },
  });

  return parsed;
}

async function parseReplyWithAi(replyText: string): Promise<ParsedProviderReply> {
  if (!aiAvailable()) {
    return deterministicParse(replyText);
  }

  const prompt = `אתה סוכן AI של זכאי שקורא תשובה של ספק ישראלי (סלולר, חשמל, ביטוח וכו') לבקשת התאמת מחיר. הנח את התשובה וחזור JSON בלבד:
{
  "outcome": "saving_accepted" | "rejected" | "needs_info" | "unclear" | "no_reply_needed",
  "newAmountShekels": number או null,
  "summaryHe": "סיכום קצר בעברית",
  "suggestedAction": "record_saving" | "send_followup" | "ask_user" | "wait",
  "missingInfo": "מה הספק ביקש, אם ביקש"
}

כללי:
- saving_accepted רק אם הספק אישר הפחתת מחיר או מסלול זול יותר וניתן לחלץ סכום חודשי חדש.
- rejected אם הספק סירב בהחלט או כתב שאין זכאות.
- needs_info אם הספק ביקש פרטים/מסמכים נוספים.
- unclear אם לא ברור מה קרה.
- no_reply_needed אם זו הודעת אישור קבלה או תודה בלבד.

תשובת הספק:
${replyText}`;

  try {
    const { generateText } = await import("@/lib/ai");
    const text = await generateText(prompt, { maxTokens: 600, temperature: 0.2 });
    const json = extractJson(text);
    const outcome = normalizeOutcome(json.outcome);
    const suggestedAction = normalizeAction(json.suggestedAction, outcome);
    return {
      outcome,
      newAmountShekels: typeof json.newAmountShekels === "number" ? json.newAmountShekels : undefined,
      summaryHe: String(json.summaryHe || ""),
      suggestedAction,
      missingInfo: json.missingInfo ? String(json.missingInfo) : undefined,
    };
  } catch {
    return deterministicParse(replyText);
  }
}

function deterministicParse(replyText: string): ParsedProviderReply {
  const t = replyText.toLowerCase();
  const amount = extractAmount(replyText);

  if (/מסכים|אושר|הופחת|הוזל|מחיר חדש|סכום חדש|תשלום חדש|מבצע|הנחה/.test(t)) {
    return {
      outcome: "saving_accepted",
      newAmountShekels: amount ?? undefined,
      summaryHe: "הספק אישר הנחה או מחיר חדש.",
      suggestedAction: "record_saving",
    };
  }

  if (/סורר|לא אפשרי|לא ניתן|אינך זכאי|הבקשה נדחתה|לא נוכל|איננו יכולים|הצעתך לא/.test(t)) {
    return {
      outcome: "rejected",
      summaryHe: "הספק סירב לבקשה.",
      suggestedAction: "send_followup",
    };
  }

  if (/פרטים|מסמך|אישור|צריך|נדרש|בבקשה תשלח|תמונה|העתק|קובץ/.test(t)) {
    return {
      outcome: "needs_info",
      summaryHe: "הספק ביקש פרטים או מסמכים נוספים.",
      suggestedAction: "ask_user",
      missingInfo: "פרטים נוספים נדרשים מהספק.",
    };
  }

  if (/התקבלה|נקלטה|תודה|נבדוק|נחזור|בטיפול/.test(t)) {
    return {
      outcome: "no_reply_needed",
      summaryHe: "תשובת אישור קבלה או בטיפול.",
      suggestedAction: "wait",
    };
  }

  return {
    outcome: "unclear",
    summaryHe: "לא ברור מה תשובת הספק.",
    suggestedAction: "ask_user",
  };
}

function extractAmount(text: string): number | null {
  // Match patterns like "₪99", "99 ₪", "99.90", "99.9" near currency context.
  const patterns = [
    /(?:סכום|מחיר|תשלום|חשבון).*?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(?:₪|ש"ח|שקל)/,
    /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(?:₪|ש"ח|שקל)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = Number(m[1].replace(/,/g, ""));
      if (!isNaN(n) && n >= 0 && n < 100000) return n;
    }
  }
  return null;
}

function normalizeOutcome(v: unknown): ParsedProviderReply["outcome"] {
  if (
    v === "saving_accepted" ||
    v === "rejected" ||
    v === "needs_info" ||
    v === "unclear" ||
    v === "no_reply_needed"
  ) {
    return v;
  }
  return "unclear";
}

function normalizeAction(
  v: unknown,
  outcome: ParsedProviderReply["outcome"],
): ParsedProviderReply["suggestedAction"] {
  if (v === "record_saving" || v === "send_followup" || v === "ask_user" || v === "wait") return v;
  if (outcome === "saving_accepted") return "record_saving";
  if (outcome === "rejected") return "send_followup";
  if (outcome === "needs_info") return "ask_user";
  if (outcome === "no_reply_needed") return "wait";
  return "ask_user";
}

function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

interface ExecuteReplyInput {
  caseId: string;
  userId: string;
  parsed: ParsedProviderReply;
}

/**
 * Execute the next step after parsing a provider reply, autonomously when safe.
 * - saving_accepted with amount → record saving and notify user.
 * - rejected → send a polite follow-up email pushing back.
 * - needs_info → notify user what is missing.
 * - unclear / wait → store and wait.
 */
export async function executeReplyAction(input: ExecuteReplyInput) {
  const { caseId, userId, parsed } = input;

  if (parsed.outcome === "saving_accepted" && typeof parsed.newAmountShekels === "number") {
    try {
      const result = await recordSaving(caseId, userId, parsed.newAmountShekels, "ai_verified");
      await notifyUser(caseId, userId, "saved", parsed.summaryHe);
      return { action: "recorded_saving", result };
    } catch (err) {
      if (err instanceof CaseError && err.message === "ALREADY_SETTLED") {
        return { action: "already_settled" };
      }
      throw err;
    }
  }

  if (parsed.outcome === "rejected") {
    const sent = await sendPoliteFollowUp(caseId, userId);
    await notifyUser(caseId, userId, "followup_sent", parsed.summaryHe);
    return { action: "followup_sent", sent };
  }

  if (parsed.outcome === "needs_info") {
    await notifyUser(caseId, userId, "needs_info", parsed.summaryHe, parsed.missingInfo);
    return { action: "user_notified_needs_info" };
  }

  await notifyUser(caseId, userId, "update", parsed.summaryHe);
  return { action: "user_notified_update" };
}

async function sendPoliteFollowUp(caseId: string, userId: string) {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { authorization: true },
  });
  if (!kase || kase.userId !== userId) throw new FollowUpError("NOT_FOUND");
  if (!kase.authorization) throw new FollowUpError("AUTHORIZATION_REQUIRED");

  const body = `שלום,

לאחרונה פנינו מטעם ${kase.authorization.principalName} בבקשה להתאמת מסלול/מחיר. בחנו את התשובה שקיבלנו, ואנחנו מבקשים שתבדקו שוב את האפשרות להציע מחיר תחרותי או הנחת נאמנות.

הלקוח/ה שלנו הינו/ה לקוח/ה פעיל/ה, ואנו מאמינים שיש מקום להקלת עלות השירות.

מסמך ההרשאה שלנו עדיין בתוקף: ${kase.authorization.code}.

בברכה,
זכאי — סוכן דיגיטלי הפועל מטעם ${kase.authorization.principalName}`;

  return sendEmail({
    to: providerContactEmail(kase.provider),
    subject: `מעקב על בקשת התאמת מחיר — ${kase.authorization.principalName}`,
    body,
    caseId,
  });
}

async function notifyUser(
  caseId: string,
  userId: string,
  kind: "saved" | "followup_sent" | "needs_info" | "update",
  summary: string,
  missingInfo?: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) return;

  const kase = await prisma.case.findUnique({ where: { id: caseId }, select: { provider: true } });
  const provider = providerHebrewName(kase?.provider || "other");

  const subjects: Record<typeof kind, string> = {
    saved: `זכאי — תיעדנו חיסכון מול ${provider}`,
    followup_sent: `זכאי — שלחנו מעקב מול ${provider}`,
    needs_info: `זכאי — ${provider} ביקש/ה פרטים נוספים`,
    update: `זכאי — עדכון סטטוס מול ${provider}`,
  };

  const bodies: Record<typeof kind, string> = {
    saved: `שלום ${user.name},

תיעדנו חיסכון בפנייה מול ${provider}. פרטי החיסכון מופיעים בדשבורד שלך.

סיכום: ${summary}`,
    followup_sent: `שלום ${user.name},

${provider} סירב/ה להצעה הראשונית. שלחנו מעקב מנומס כדי לבקש בדיקה נוספת.

סיכום: ${summary}`,
    needs_info: `שלום ${user.name},

${provider} ביקש/ה פרטים נוספים כדי להמשיך לטפל בבקשה.

סיכום: ${summary}
נדרש: ${missingInfo || "פרטים נוספים"}

אנא העלה/י את הפרטים באפליקציה.`,
    update: `שלום ${user.name},

יש עדכון בפנייה מול ${provider}.

סיכום: ${summary}`,
  };

  await sendEmail({ to: user.email, subject: subjects[kind], body: bodies[kind], caseId });
}
