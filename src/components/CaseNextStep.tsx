"use client";

import { useEffect, useState } from "react";
import { useRouter, Link } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { Button, Input, FieldError } from "@/components/ui";
import { REPLY_KIND_OPTIONS, type ProviderReplyKind } from "@/lib/negotiation";
import { scheduleFollowUpReminder, scheduleRecheckReminder } from "@/lib/reminders";
import { rankPriorityActions } from "@/lib/priority";
import { proBreakevenSavingAgorot } from "@/lib/plans";
import type { FeeBasis } from "@/lib/verticals/types";
import { VERTICAL_TO_CATALOG_ID } from "@/lib/priorityCatalogMap";
import { providerContactEmail, providerHebrewName } from "@/lib/providers";
import { buildShareLandingUrl } from "@/lib/shareUrl";
import { isOutreachEmailApiError } from "@/lib/outreachEmail";
import { openMailto } from "@/lib/mailto";
import { MAX_AGENT_ROUNDS } from "@/lib/services/loopLimits";
import { previewSuccessFeeShekels } from "@/lib/fee";
import { heEn } from "@/lib/heEn";
import { FeePayButton } from "@/components/FeePayButton";
import { classifyFollowUpSendError, followUpDeliveryState } from "@/lib/followUpSendUi";
import type { OutreachDelivery } from "@/lib/services/outreachDelivery";
import { pendingFeeDisplayShekels } from "@/lib/pendingSuccessFee";
import { resolvePasteRecordField } from "@/lib/services/pasteRecordField";

type Status =
  | "ANALYZED"
  | "APPROVED"
  | "VERIFIED"
  | "SENT"
  | "SAVED"
  | "NO_SAVING"
  | "REVOKED";

export interface ProposedSavingClient {
  newAmountShekels: number;
  confidence: number;
  from: string | null;
}

interface Props {
  caseId: string;
  status: Status;
  ownershipVerified: boolean;
  hasAuthorization: boolean;
  amountOriginalShekels: number;
  shareMessage?: string;
  referralCode?: string;
  proposedSaving?: ProposedSavingClient | null;
  proofsEmail?: string;
  /** Agent auto-follow-up rounds already sent (dashboard). */
  agentRound?: number;
  /** This case's vertical (Case.vertical) — excludes its own door from "what's next". */
  vertical?: string;
  /** Known provider key or label (Case.provider). */
  provider?: string;
  /** Destination inbox if captured at case open (Case.counterpartyEmail). */
  counterpartyEmail?: string | null;
  /** Lump vs monthly settlement semantics for the SENT → SAVED form. */
  feeBasis?: FeeBasis;
  /** Account's current plan — gates the Pro-upgrade nudge to Free users only. */
  currentPlan?: string;
  /** SavingsProof.savingMonthly in shekels — drives the Pro-upgrade nudge. */
  documentedSavingShekels?: number;
  /** Pending success fee in shekels — display only (may round away sub-₪1). */
  pendingFeeShekels?: number;
  /** Pending success fee in agorot — share gate (honest; sub-₪1 still blocks virality). */
  pendingFeeAgorot?: number;
  /** Estimate / self-reported SavingsProof — no virality (prove → fee → share). */
  proofSelfReported?: boolean;
  /**
   * Whether SMTP can actually authenticate (HOST+USER+PASS).
   * A case's status flips to SENT the moment the agent claims the send —
   * that's app-internal bookkeeping, not proof the provider ever saw
   * anything. Without a transport, "SENT" just means queued: the banner
   * needs to say so instead of implying an active wait for a reply.
   */
  emailConfigured?: boolean;
  /** Latest outreach Outbox truth — preferred over SMTP-env-only banner. */
  outreachDelivery?: OutreachDelivery;
  /** Outreach letter the user consents to — editable before dispatch. */
  draftMessage?: string;
  /** De-identified cohort learning for SENT coaching (never invents). */
  learningTip?: {
    winRatePct: number;
    trials: number;
    bestStanceHe?: string;
    bestStanceEn?: string;
    medianDays?: number | null;
  } | null;
  /** After SAVED — continue the highest-EV open case (habit compound). */
  nextOpenCase?: { href: string; labelHe: string; labelEn: string } | null;
  /** Account already proved email control — enables approve→send express path. */
  emailVerified?: boolean;
}

const copy: Record<string, Record<string, string>> = {
  he: {
    approve: "אשר והמשך",
    approveSend: "אשר ושלח עם Mandate עכשיו",
    sentShareTitle: "שתפו — כל Mandate שמגיע דרככם מגדיל את הצינור",
    sentShareDefault:
      "שלחתי לספק בקשה עם Mandate של זכאי — הרשאה חתומה בכתב, בלי מוקד. בדקו מה מגיע לכם:",
    mailtoFallback: "SMTP לא פעיל כאן — פתח במייל שלך ושלח את המכתב",
    mailtoOpened: "נפתח המייל — שלחו משם",
    sendCode: "שלח קישור למייל / קוד לאימות בעלות",
    codePh: "קוד מ-6 ספרות (אם אין קישור)",
    verifyCode: "אמת קוד",
    magicHint: "בדקו את המייל — קישור קסם מאמת בעלות בלחיצה. הקוד למטה רק אם הקישור לא הגיע.",
    ownStartHint: "לפני שליחת Mandate — אימות בעלות בקישור מייל (מועדף) או בקוד.",
    dispatch: "שלח לספק (Mandate)",
    openDoc: "פתח מסמך הרשאה (הדפסה / PDF)",
    newAmt: "סכום חדש אחרי התשובה (₪)",
    newAmtLump: "נותר לשלם / בחוב (₪) — 0 אם התקבל במלואו",
    record: "רשום חיסכון",
    recordLump: "רשום החזר מתועד",
    noChange: "לא השתנה",
    fullRecovery: "התקבל במלואו (₪0 נותר)",
    working: "רגע…",
    err: "משהו השתבש. נסה שוב.",
    nextHint: "השלב הבא",
    followTitle: "מה ענו? — הסוכן מכין תשובה",
    followGen: "הכן טיוטה בלבד",
    followSendAndDraft: "הכן ושלח המשך (Mandate)",
    followSend: "שלח דרך זכאי (Mandate)",
    followSent: "נשלח לספק",
    followQueued: "בתור לשליחה — ה-worker ישלח כשהמייל מוגדר",
    draftTitle: "מכתב לשליחה — בדקו לפני שליחה",
    draftSave: "שמור טיוטה",
    copyMsg: "העתק הודעה",
    copied: "הועתק",
    whatsapp: "וואטסאפ",
    nativeShare: "שתף",
    mandateOk: "Mandate הונפק — הספק יכול לאמת חתימה ב-JWKS",
    authCode: "קוד הרשאה",
    savedTitle: "✓ חיסכון מתועד",
    savedSub:
      "הסוכן סיים. שתף — כל חבר שמגיע דרכך מקבל קרדיט, ואתה גם. בעוד ~6 חודשים נזכיר לבדוק אם המחיר זחל חזרה.",
    savedShareDefault:
      "חסכתי כסף עם זכאי — סוכן דיגיטלי שפעל בשמי מול הספק, בלי מוקד ובלי לחכות לאף אחד.",
    perMonthSuffix: "/ח׳",
    documentedSuffix: " מתועד",
    copyLink: "העתק קישור הפניה",
    linkCopied: "הקישור הועתק",
    sentBanner:
      "הסוכן שלח. אם ענו — הדביקו את התשובה למטה, העבירו מייל לכתובת ההוכחות, או הזינו סכום. אם לא — אחרי כמה ימים, כל עוד ה-Mandate פעיל, הסוכן עשוי לשלוח סיבוב המשך (עד 4 סיבובים).",
    notDeliveredBanner:
      "שליחת מייל עדיין לא מוגדרת בסביבה הזו — הפנייה מוכנה אבל עוד לא יצאה בפועל לספק.",
    queuedBanner:
      "הפנייה בתור לשליחה — הספק עדיין לא קיבל. רעננו בעוד רגע או שלחו ידנית מהטיוטה.",
    failedBanner:
      "שליחת המייל נכשלה — נסו שוב מהמעקב למטה, או העתיקו ושלחו ידנית. אל תניחו שהספק ראה משהו.",
    competitorName: "שם המתחרה",
    competitorPrice: "מחיר המתחרה ₪",
    proposedTitle: "הסוכן זיהה מהמייל",
    proposedTitleLump: "הסוכן זיהה מהמייל — נותר לשלם",
    proposedConf: "ביטחון",
    proposedOneTap: "רשום חיסכון בלחיצה אחת",
    proposedFrom: "מ־",
    saveBlockTitle: "סגירת הלופ — רשמו SavingsProof",
    saveBlockSub: "זו המטרה של התיק. בלי רישום אין עמלה, אין הוכחה, ואין Gravity. הזינו סכום או הדביקו תשובה למעלה.",
    quickCancel: "בוטל לגמרי (₪0)",
    quickOff20: "הנחה ~20% (הערכה — בלי עמלה)",
    quickOff50: "הנחה ~50% (הערכה — בלי עמלה)",
    estimateHints: "קיצורי הערכה — לא תיעוד מספק. לא נגבית עמלה על הערכה.",
    payFeeNow: "שלמו את עמלת ההצלחה",
    savedPayFirst: "קודם העמלה על התוצאה המתועדת — אחר כך שיתוף.",
    estimateNoShare:
      "זו הערכה עצמית — בלי תיעוד מספק אין שיתוף ויראלי. הדביקו תשובה בכתב בתיק הבא לחיסכון מתועד.",
    exhaustedBanner:
      "סיבובי המעקב בכתב מוצו. אל תשלחו עוד תזכורת — רשמו סכום מתשובה בכתב, סמנו שלא השתנה, או עברו לנתיב אחר (ביטול / מתחרה).",
    mandateInactiveBanner:
      "אין Mandate פעיל על התיק — הסוכן לא יכול לשלוח המשך לספק עד שתאשרו הרשאה מחדש.",
    mandateReissue: "הנפק Mandate מחדש",
    mandateReissued: "Mandate פעיל שוב",
    proofsLabel: "העבירו תשובת ספק לכאן",
    proofsCopy: "העתק כתובת",
    proofsCopied: "הועתק",
    proofsHint: "Forward Email / העברת מייל — הסוכן מזהה סכום ומציע רישום בלחיצה אחת.",
    pasteLabel: "או הדביקו כאן את תשובת הספק",
    pasteHint: "העתקה מהמייל / וואטסאפ / צילום מסך כטקסט — הסוכן מציע רישום בלחיצה אחת.",
    pastePh: "הדביקו את גוף התשובה…",
    pasteCta: "זהה סכום מהתשובה",
    pasteNoAmount: "לא זוהה סכום ברור — הזינו ידנית למטה או נסו טקסט מלא יותר.",
    pastePartial: "זוהה סכום חלקי — בדקו למטה ואשרו רישום.",
    ownDone: "בעלות אומתה — לחיצה אחת לשליחה לספק עם Mandate.",
    ownDoneEmail:
      "המייל בחשבון כבר מאומת — הבעלות נרשמה. לחיצה אחת שולחת עם Mandate.",
    agentRoundLabel: "סיבוב סוכן",
    nextDoors: "מה עוד?",
    recheckCta: "בדוק שוב אם המבצע נגמר",
    upgradeNudge: "בקצב החיסכון הזה, Pro (עמלה 9% במקום 18%) יחסוך לך יותר ממה שהוא עולה",
    upgradeCta: "לפרטי המסלולים",
    errNeedsEmail:
      "חסר אימייל לספק — הזינו כתובת ביטולים/שירות לקוחות ונסו שוב.",
    errDelivery: "שליחת המייל נכשלה — נסו שוב בעוד רגע.",
    errAlreadySent: "כבר נשלח — רעננו את «כסף שלי».",
    outreachEmailPh: "אימייל לשליחה (ספק / עירייה / חנות)",
    noSavingTitle: "אין חיסכון מתועד בתיק הזה",
    noSavingSub:
      "סגרתם בלי SavingsProof — אפשר להתחיל סריקה חדשה או לפתוח תיק אחר. בלי תיעוד אין עמלה ואין שיתוף.",
    noSavingCta: "חזרה לכסף שלי",
    revokedTitle: "ההרשאה בוטלה",
    revokedSub: "התיק לא פעיל. אפשר להתחיל מחדש ב«כסף שלי».",
  },
  en: {
    approve: "Approve & continue",
    approveSend: "Approve & send with Mandate now",
    sentShareTitle: "Share — every Mandate through you grows the pipe",
    sentShareDefault:
      "I sent my provider a Zakai Mandate request — signed written authority, no call center. See what you're owed:",
    mailtoFallback: "SMTP off here — open your mail and send the letter",
    mailtoOpened: "Mail opened — send from there",
    sendCode: "Send email magic link / ownership code",
    codePh: "6-digit code (if no link)",
    verifyCode: "Verify code",
    magicHint: "Check email — magic link verifies ownership in one tap. Code below only if the link did not arrive.",
    ownStartHint: "Before Mandate send — verify ownership via email link (preferred) or code.",
    dispatch: "Send to provider (Mandate)",
    openDoc: "Open authorization (print / PDF)",
    newAmt: "New amount after reply (₪)",
    newAmtLump: "Still owed (₪) — enter 0 if paid in full",
    record: "Record saving",
    recordLump: "Record documented recovery",
    noChange: "No change",
    fullRecovery: "Paid in full (₪0 left)",
    working: "One moment…",
    err: "Something went wrong.",
    nextHint: "Next step",
    followTitle: "What did they say? — agent drafts reply",
    followGen: "Draft only",
    followSendAndDraft: "Draft & send follow-up (Mandate)",
    followSend: "Send via Zakai (Mandate)",
    followSent: "Sent to provider",
    followQueued: "Queued — worker will send once mail transport is live",
    draftTitle: "Letter to send — review before dispatch",
    draftSave: "Save draft",
    copyMsg: "Copy message",
    copied: "Copied",
    whatsapp: "WhatsApp",
    nativeShare: "Share",
    mandateOk: "Mandate issued — provider can verify via JWKS",
    authCode: "Authorization code",
    savedTitle: "✓ Saving documented",
    savedSub:
      "Agent done. Share — friends who join via you get credit, and so do you. In ~6 months we'll remind you to re-check if the price crept back.",
    savedShareDefault:
      "I saved money with Zakai — a digital agent acted for me, no call center.",
    perMonthSuffix: "/mo",
    documentedSuffix: " documented",
    copyLink: "Copy referral link",
    linkCopied: "Link copied",
    sentBanner:
      "Agent sent. If they replied — paste the reply below, forward to the proofs address, or enter an amount. If not — after several days, while your Mandate is active, the agent may send a follow-up round (up to 4 total).",
    notDeliveredBanner:
      "Email delivery isn't configured in this environment yet — the request is ready but hasn't actually reached the provider.",
    queuedBanner:
      "Request is queued for delivery — the provider has not received it yet. Refresh shortly or send the draft manually.",
    failedBanner:
      "Email delivery failed — retry follow-up below, or copy and send manually. Do not assume the provider saw anything.",
    competitorName: "Competitor name",
    competitorPrice: "Competitor price ₪",
    proposedTitle: "Agent spotted from email",
    proposedTitleLump: "From email — remaining owed",
    proposedConf: "Confidence",
    proposedOneTap: "One-tap record saving",
    proposedFrom: "from",
    saveBlockTitle: "Close the loop — record SavingsProof",
    saveBlockSub: "This is the point of the case. No record → no fee, no proof, no Gravity. Enter an amount or paste a reply above.",
    quickCancel: "Fully cancelled (₪0)",
    quickOff20: "~20% off (estimate — no fee)",
    quickOff50: "~50% off (estimate — no fee)",
    estimateHints: "Estimate shortcuts — not provider documentation. No success fee on estimates.",
    payFeeNow: "Pay the success fee",
    savedPayFirst: "Pay the documented-outcome fee first — then share.",
    estimateNoShare:
      "This is a self-reported estimate — no viral share without provider documentation. Paste a written reply on the next case for a documented saving.",
    exhaustedBanner:
      "Written follow-up rounds are exhausted. Do not send another reminder — record an amount from a written reply, mark no change, or pivot (cancel / competitor).",
    mandateInactiveBanner:
      "No ACTIVE Mandate on this case — the agent cannot send a follow-up until you re-issue authorization.",
    mandateReissue: "Re-issue Mandate",
    mandateReissued: "Mandate active again",
    proofsLabel: "Forward provider reply here",
    proofsCopy: "Copy address",
    proofsCopied: "Copied",
    proofsHint: "Forward Email — agent extracts the amount and offers one-tap record.",
    pasteLabel: "Or paste the provider reply here",
    pasteHint: "Copy from email / WhatsApp / OCR text — agent offers one-tap record.",
    pastePh: "Paste the reply body…",
    pasteCta: "Extract amount from reply",
    pasteNoAmount: "No clear amount found — enter manually below or paste fuller text.",
    pastePartial: "Partial amount spotted — check below and confirm record.",
    ownDone: "Ownership verified — one tap to send to the provider with Mandate.",
    ownDoneEmail:
      "Email already verified on your account — ownership stamped. One tap sends with Mandate.",
    agentRoundLabel: "Agent round",
    nextDoors: "What's next?",
    recheckCta: "Re-check if the promo ended",
    upgradeNudge: "At this saving rate, Pro (9% fee instead of 18%) would save you more than it costs",
    upgradeCta: "See plans",
    errNeedsEmail:
      "Missing provider email — enter billing / support address and try again.",
    errDelivery: "Email delivery failed — try again in a moment.",
    errAlreadySent: "Already sent — refresh My money.",
    outreachEmailPh: "Send-to email (provider / municipality / merchant)",
    noSavingTitle: "No documented saving on this case",
    noSavingSub:
      "You closed without a SavingsProof — start a new scan or another case. No proof means no fee and no share.",
    noSavingCta: "Back to My money",
    revokedTitle: "Mandate revoked",
    revokedSub: "This case is inactive. Start again in My money.",
  },
};

function t(locale: string, key: string): string {
  const table = copy[locale] || copy.he;
  return table[key] || copy.he[key] || key;
}

export function CaseNextStep({
  caseId,
  status,
  ownershipVerified,
  hasAuthorization,
  amountOriginalShekels,
  shareMessage,
  referralCode,
  proposedSaving,
  pendingFeeShekels,
  pendingFeeAgorot,
  proofsEmail,
  agentRound = 0,
  emailConfigured = true,
  outreachDelivery = "none",
  vertical,
  provider,
  counterpartyEmail: counterpartyEmailProp,
  feeBasis = "monthly",
  currentPlan,
  documentedSavingShekels,
  proofSelfReported = false,
  draftMessage: draftMessageProp = "",
  emailVerified = false,
  learningTip = null,
  nextOpenCase = null,
}: Props) {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mailtoOpened, setMailtoOpened] = useState(false);
  const [draftEdit, setDraftEdit] = useState(draftMessageProp);
  const [followSentOk, setFollowSentOk] = useState(false);
  const [followQueuedOk, setFollowQueuedOk] = useState(false);
  const nextFollowRound = Math.min(4, Math.max(2, agentRound + 2));
  const resolvedOutreach =
    counterpartyEmailProp?.trim() ||
    (provider ? providerContactEmail(provider, vertical).trim() : "");
  const needsOutreachInput = !resolvedOutreach || !/@/.test(resolvedOutreach);
  const [outreachEmail, setOutreachEmail] = useState(counterpartyEmailProp?.trim() ?? "");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [newAmt, setNewAmt] = useState(
    proposedSaving?.newAmountShekels != null ? String(proposedSaving.newAmountShekels) : "",
  );
  /** Paste extract that qualifies for the same one-tap SavingsProof card as inbound. */
  const [pasteProposed, setPasteProposed] = useState<{
    newAmountShekels: number;
    confidence: number;
  } | null>(null);
  const [localOwn, setLocalOwn] = useState(ownershipVerified);
  const [localAuth, setLocalAuth] = useState(hasAuthorization);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [mandateInfo, setMandateInfo] = useState<string | null>(null);
  const [replyKind, setReplyKind] = useState<ProviderReplyKind>("delay");
  const [competitorName, setCompetitorName] = useState("");
  const [competitorPrice, setCompetitorPrice] = useState("");
  const [followBody, setFollowBody] = useState<string | null>(null);
  const [followTip, setFollowTip] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [proofsCopied, setProofsCopied] = useState(false);
  const [ownViaEmail, setOwnViaEmail] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteTip, setPasteTip] = useState<string | null>(null);
  let navigatedAfterSave = false;

  const proofsAddr =
    proofsEmail ||
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PROOFS_EMAIL) ||
    "proofs@zakai.app";

  // Keep local flags in sync after router.refresh() from parent.
  useEffect(() => {
    setLocalOwn(ownershipVerified);
    setLocalAuth(hasAuthorization);
  }, [ownershipVerified, hasAuthorization]);

  // Unverified: auto-send ownership magic link once so users are not stuck
  // behind a "send code" click before Mandate dispatch.
  useEffect(() => {
    if (emailVerified) return;
    if (localOwn) return;
    if (status !== "APPROVED" && status !== "VERIFIED") return;
    if (codeSent) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/cases/${caseId}/ownership/send`, { method: "POST" });
      if (cancelled || !res.ok) return;
      const data = await res.json().catch(() => ({}));
      setCodeSent(true);
      setMagicSent(Boolean(data.magicSent));
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [emailVerified, localOwn, status, caseId, codeSent]);

  // Verified-email users should not redo SMS ownership — prime on mount.
  useEffect(() => {
    if (!emailVerified) return;
    if (localOwn) return;
    if (status !== "APPROVED" && status !== "VERIFIED" && status !== "ANALYZED") return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/cases/${caseId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok || cancelled) return;
      const data = await res.json().catch(() => ({}));
      if (data.ownershipViaEmail) {
        setLocalOwn(true);
        setOwnViaEmail(true);
        router.refresh();
      }
    })().catch(() => null);
    return () => {
      cancelled = true;
    };
    // Intentionally once per case mount for this status band.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, emailVerified, status]);

  function finishSaving(opts?: { checkoutUrl?: string | null; chargeable?: boolean }) {
    scheduleRecheckReminder(caseId);
    navigatedAfterSave = true;
    // Prove → fee in one gesture when checkout is ready (same as CheckFlow).
    if (opts?.checkoutUrl) {
      window.location.href = opts.checkoutUrl;
      return;
    }
    if (opts?.chargeable) {
      router.push(`/money?case=${caseId}&payFee=1`);
      return;
    }
    router.push(`/money?case=${caseId}`);
  }

  async function recordAndFinish(
    newAmountShekels: number,
    opts?: { source?: "manual" | "inbound" | "estimate"; selfReported?: boolean },
  ) {
    const res = await fetch(`/api/cases/${caseId}/record-saving`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newAmountShekels,
        locale,
        source: opts?.source,
        selfReported: opts?.selfReported,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      checkoutUrl?: string;
      chargeable?: boolean;
      error?: string;
    };
    if (!res.ok) {
      // Double-tap / slow network after settle — land on SAVED → fee, don't generic-fail.
      if (data.error === "ALREADY_SETTLED") {
        router.refresh();
        router.push(`/money?case=${caseId}&payFee=1`);
        return;
      }
      throw new Error("save");
    }
    finishSaving({ checkoutUrl: data.checkoutUrl, chargeable: data.chargeable === true });
  }

  /** Shared SENT follow-up send error + delivery UI (4 buttons share this). */
  function applyFollowUpSendResult(
    resOk: boolean,
    data: {
      error?: unknown;
      body?: string;
      tip?: string | null;
      sent?: boolean;
      delivered?: boolean;
      reason?: string;
    },
  ): boolean {
    if (!resOk) {
      const block = classifyFollowUpSendError(data.error);
      if (block === "NEEDS_OUTREACH_EMAIL") {
        setErr(t(locale, "errNeedsEmail"));
        return false;
      }
      if (block === "NO_ACTIVE_MANDATE") {
        setLocalAuth(false);
        setErr(t(locale, "mandateInactiveBanner"));
        return false;
      }
      if (block === "NO_TRANSPORT" || block === "OUTREACH_DELIVERY_FAILED") {
        setErr(t(locale, "errDelivery"));
        if (data.body) setFollowBody(data.body);
        return false;
      }
      if (block === "MAX_ROUNDS") {
        setErr(t(locale, "exhaustedBanner"));
        router.refresh();
        return false;
      }
      if (data.body) setFollowBody(data.body);
      throw new Error("follow-send");
    }
    if (data.body) setFollowBody(data.body);
    if (data.tip !== undefined) setFollowTip(data.tip || null);
    const delivery = followUpDeliveryState(data);
    setFollowSentOk(delivery === "delivered");
    setFollowQueuedOk(delivery === "queued");
    return true;
  }

  async function proposeFromPaste() {
    setPasteTip(null);
    setPasteProposed(null);
    const res = await fetch(`/api/cases/${caseId}/propose-saving`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: pasteText }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      proposed?: { newAmountShekels: number; confidence: number } | null;
      recordAmountShekels?: number | null;
      extract?: { found?: boolean; newAmountShekels?: number | null };
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || "paste");
    const decision = resolvePasteRecordField(data);
    if (decision.kind === "proposed") {
      setNewAmt(String(decision.newAmountShekels));
      setPasteProposed({
        newAmountShekels: decision.newAmountShekels,
        confidence: decision.confidence,
      });
      setPasteText("");
      setPasteTip(null);
      return;
    }
    if (decision.kind === "mapped") {
      setNewAmt(String(decision.newAmountShekels));
      setPasteTip(t(locale, "pastePartial"));
      return;
    }
    setPasteTip(t(locale, "pasteNoAmount"));
  }

  async function run(fn: () => Promise<void>) {
    setErr(null);
    setBusy(true);
    navigatedAfterSave = false;
    try {
      await fn();
      if (!navigatedAfterSave) router.refresh();
    } catch {
      setErr(t(locale, "err"));
    } finally {
      setBusy(false);
    }
  }

  if (status === "NO_SAVING" || status === "REVOKED") {
    const closed = status === "NO_SAVING";
    const doors = nextOpenCase
      ? [{ href: nextOpenCase.href, he: nextOpenCase.labelHe, en: nextOpenCase.labelEn }]
      : rankPriorityActions(8)
          .slice(0, 4)
          .map((a) => ({ href: a.href, he: a.titleHe, en: a.titleEn }));
    return (
      <div className="w-full mt-2 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] p-4">
        <div className="text-[15px] font-extrabold">
          {t(locale, closed ? "noSavingTitle" : "revokedTitle")}
        </div>
        <p className="text-[13px] text-ink-soft mt-1.5 mb-3 leading-relaxed">
          {t(locale, closed ? "noSavingSub" : "revokedSub")}
        </p>
        <Link href="/money" className="no-underline">
          <Button className="!text-[13px] w-full sm:w-auto">{t(locale, "noSavingCta")}</Button>
        </Link>
        {doors.length > 0 ? (
          <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.08)]">
            <div className="text-[12px] font-extrabold text-ink-soft mb-2">{t(locale, "nextDoors")}</div>
            <div className="flex flex-wrap gap-2">
              {doors.map((d) => (
                <Link key={d.href} href={d.href}>
                  <Button variant="ghost" className="!text-[12.5px] !py-1.5 !px-3">
                    {heEn(he, d.he, d.en)} →
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (status === "SAVED") {
    const msg = shareMessage || t(locale, "savedShareDefault");
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://zakai-3uxj.vercel.app";
    const perMonthSuffix = t(locale, "perMonthSuffix");
    const documentedSuffix = t(locale, "documentedSuffix");
    const amountLabelForShare =
      documentedSavingShekels != null && documentedSavingShekels > 0
        ? feeBasis === "monthly"
          ? `₪${documentedSavingShekels}${perMonthSuffix}`
          : `₪${documentedSavingShekels}${documentedSuffix}`
        : undefined;
    const shareKicker =
      provider && provider.trim()
        ? he
          ? providerHebrewName(provider)
          : provider
        : "Zakai";
    const shareUrl = buildShareLandingUrl({
      origin,
      locale,
      amountLabel: amountLabelForShare,
      kicker: shareKicker,
      referralCode,
    });
    const fullText = `${msg}\n${shareUrl}`;

    // Prefer finishing another open Case (habit) over opening new verticals.
    const excludeId = vertical ? VERTICAL_TO_CATALOG_ID[vertical] : undefined;
    const doors = nextOpenCase
      ? [{ href: nextOpenCase.href, he: nextOpenCase.labelHe, en: nextOpenCase.labelEn }]
      : rankPriorityActions(8)
          .filter((a) => a.id !== excludeId)
          .slice(0, 5)
          .map((a) => ({ href: a.href, he: a.titleHe, en: a.titleEn }));

    const showUpgradeNudge =
      currentPlan === "FREE" &&
      documentedSavingShekels != null &&
      documentedSavingShekels * 100 >= proBreakevenSavingAgorot();

    return (
      <div className="w-full mt-2 rounded-xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.1)] p-4">
        <div className="text-[15px] font-extrabold text-emerald">{t(locale, "savedTitle")}</div>
        {documentedSavingShekels != null && documentedSavingShekels > 0 ? (
          <div className="text-[26px] font-display font-black grad-text mt-2 mb-1">
            ₪{documentedSavingShekels}
            {feeBasis === "monthly" ? perMonthSuffix : documentedSuffix}
          </div>
        ) : null}
        <p className="text-[13px] text-ink-soft mt-1.5 mb-3 leading-relaxed">{t(locale, "savedSub")}</p>
        {(() => {
          const feePending =
            (pendingFeeAgorot != null && pendingFeeAgorot > 0) ||
            (pendingFeeAgorot == null &&
              pendingFeeShekels != null &&
              pendingFeeShekels > 0);
          const feeLabel =
            pendingFeeAgorot != null && pendingFeeAgorot > 0
              ? pendingFeeDisplayShekels(pendingFeeAgorot)
              : pendingFeeShekels != null && pendingFeeShekels > 0
                ? String(pendingFeeShekels)
                : null;
          return feePending ? (
          <div className="mb-3 rounded-lg border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.12)] px-3 py-2.5">
            <p className="text-[12.5px] text-ink-soft m-0 mb-2 leading-snug">{t(locale, "savedPayFirst")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-extrabold text-emerald">
                {t(locale, "payFeeNow")} · ₪{feeLabel}
              </span>
              <FeePayButton caseId={caseId} />
            </div>
          </div>
          ) : null;
        })()}
        {/* Prove → fee → share: unpaid fee (agorot) and self-reported estimates never unlock virality. */}
        {!((pendingFeeAgorot != null && pendingFeeAgorot > 0) ||
          (pendingFeeAgorot == null &&
            pendingFeeShekels != null &&
            pendingFeeShekels > 0)) ? (
          <>
        {proofSelfReported ? (
          <p className="text-[13px] text-ink-soft mb-3 leading-relaxed m-0">
            {t(locale, "estimateNoShare")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-extrabold text-[13px] text-[#06121A] bg-[#25D366] border-0 cursor-pointer"
              onClick={() => {
                window.open(
                  `https://wa.me/?text=${encodeURIComponent(fullText)}`,
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
            >
              {t(locale, "whatsapp")}
            </button>
            {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
              <Button
                variant="ghost"
                className="!text-[13px] !py-2"
                onClick={async () => {
                  try {
                    await navigator.share({ title: "Zakai", text: msg, url: shareUrl });
                  } catch {
                    /* cancelled */
                  }
                }}
              >
                {t(locale, "nativeShare")}
              </Button>
            )}
            <Button
              variant="ghost"
              className="!text-[13px] !py-2"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                } catch {
                  /* ignore */
                }
              }}
            >
              {linkCopied ? t(locale, "linkCopied") : t(locale, "copyLink")}
            </Button>
          </div>
        )}
        {!proofSelfReported && showUpgradeNudge && (
          <div className="mt-3.5 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[12.5px] text-ink-soft m-0 leading-snug">{t(locale, "upgradeNudge")}</p>
            <Link href="/pricing">
              <Button variant="ghost" className="!text-[12px] !py-1.5 !px-3 shrink-0">
                {t(locale, "upgradeCta")}
              </Button>
            </Link>
          </div>
        )}
        <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.08)]">
          <div className="text-[12px] font-extrabold text-ink-soft mb-2">{t(locale, "nextDoors")}</div>
          <div className="flex flex-wrap gap-2">
            {doors.map((d) => (
              <Link key={d.href} href={d.href}>
                <Button variant="ghost" className="!text-[12.5px] !py-1.5 !px-3">
                  {he ? d.he : d.en} →
                </Button>
              </Link>
            ))}
          </div>
        </div>
          </>
        ) : null}
      </div>
    );
  }

  if (status === "ANALYZED") {
    return (
      <div className="w-full mt-2 flex flex-col gap-2">
        <div className="text-[11px] text-ink-soft">{t(locale, "nextHint")}</div>
        {emailVerified && needsOutreachInput && (
          <Input
            type="email"
            value={outreachEmail}
            onChange={(e) => setOutreachEmail(e.target.value)}
            placeholder={t(locale, "outreachEmailPh")}
            dir="ltr"
            className="text-[13px] max-w-md"
          />
        )}
        {/* Send first when email is verified — draft review is optional. */}
        {emailVerified ? (
          <Button
            disabled={busy || (needsOutreachInput && !/@/.test(outreachEmail.trim()))}
            className="text-[14px] py-3 px-5 self-start font-extrabold"
            onClick={() =>
              run(async () => {
                const approveRes = await fetch(`/api/cases/${caseId}/approve`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    editedMessage: draftEdit.trim() || undefined,
                    counterpartyEmail: needsOutreachInput
                      ? outreachEmail.trim()
                      : undefined,
                  }),
                });
                if (!approveRes.ok) throw new Error("approve");
                const approveData = await approveRes.json().catch(() => ({}));
                if (approveData.ownershipViaEmail) {
                  setLocalOwn(true);
                  setOwnViaEmail(true);
                }
                const res = await fetch(`/api/cases/${caseId}/dispatch`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    counterpartyEmail: needsOutreachInput
                      ? outreachEmail.trim()
                      : undefined,
                  }),
                });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  if (isOutreachEmailApiError(data.error)) {
                    setErr(t(locale, "errNeedsEmail"));
                    return;
                  }
                  if (data.error === "OUTREACH_DELIVERY_FAILED") {
                    setErr(t(locale, "errDelivery"));
                    return;
                  }
                  if (data.error === "ALREADY_SENT") {
                    setErr(t(locale, "errAlreadySent"));
                    router.refresh();
                    return;
                  }
                  throw new Error("dispatch");
                }
                const data = await res.json().catch(() => ({}));
                if (data.authCode) setAuthCode(data.authCode);
                if (data.mandateJti) setMandateInfo(t(locale, "mandateOk"));
                setLocalAuth(true);
                scheduleFollowUpReminder(caseId);
                // Flip UI to SENT → SavingsProof path (completion rate).
                router.refresh();
              })
            }
          >
            {busy ? t(locale, "working") : t(locale, "approveSend")}
          </Button>
        ) : (
          <Button
            disabled={busy}
            className="text-[14px] py-3 px-5 self-start font-extrabold"
            onClick={() =>
              run(async () => {
                const res = await fetch(`/api/cases/${caseId}/approve`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    editedMessage: draftEdit.trim() || undefined,
                  }),
                });
                if (!res.ok) throw new Error("approve");
                const data = await res.json().catch(() => ({}));
                if (data.ownershipViaEmail) {
                  setLocalOwn(true);
                  setOwnViaEmail(true);
                }
                router.refresh();
              })
            }
          >
            {busy ? t(locale, "working") : t(locale, "approve")}
          </Button>
        )}
        {draftEdit ? (
          <details className="w-full">
            <summary className="text-[12px] text-ink-soft cursor-pointer select-none font-bold">
              {t(locale, "draftTitle")}
            </summary>
            <textarea
              value={draftEdit}
              onChange={(e) => setDraftEdit(e.target.value)}
              rows={6}
              className="mt-2 w-full rounded-lg bg-[#0a1119] border border-[rgba(255,255,255,0.12)] text-ink text-[12.5px] leading-relaxed px-3 py-2 font-mono"
              dir="auto"
            />
          </details>
        ) : null}
        {err && <FieldError>{err}</FieldError>}
      </div>
    );
  }

  if (status === "APPROVED" || status === "VERIFIED") {
    return (
      <div className="w-full mt-2 flex flex-col gap-2">
        <div className="text-[11px] text-ink-soft">{t(locale, "nextHint")}</div>
        {!localOwn && (
          <div className="flex flex-col gap-2">
            <p className="text-[12.5px] text-ink-soft m-0 font-bold">{t(locale, "ownStartHint")}</p>
            {!codeSent ? (
              <Button
                disabled={busy}
                className="text-[14px] py-3 px-5 self-start font-extrabold"
                onClick={() =>
                  run(async () => {
                    const res = await fetch(`/api/cases/${caseId}/ownership/send`, { method: "POST" });
                    if (!res.ok) throw new Error("send");
                    const data = await res.json().catch(() => ({}));
                    setCodeSent(true);
                    setMagicSent(Boolean(data.magicSent));
                  })
                }
              >
                {busy ? t(locale, "working") : t(locale, "sendCode")}
              </Button>
            ) : (
              <>
                <p className="text-[12.5px] text-emerald font-bold m-0">
                  {magicSent ? t(locale, "magicHint") : t(locale, "ownStartHint")}
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder={t(locale, "codePh")}
                    className="max-w-[140px] text-[13px]"
                    inputMode="numeric"
                  />
                  <Button
                    disabled={busy || code.length < 6}
                    className="text-[13px] py-2 px-3"
                    onClick={() =>
                      run(async () => {
                        const res = await fetch(`/api/cases/${caseId}/ownership/verify`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ code }),
                        });
                        if (!res.ok) throw new Error("verify");
                        setLocalOwn(true);
                        router.refresh();
                      })
                    }
                  >
                    {t(locale, "verifyCode")}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {localOwn && (
          <>
            <p className="text-[12.5px] text-emerald font-bold m-0">
              {t(locale, ownViaEmail || emailVerified ? "ownDoneEmail" : "ownDone")}
            </p>
            {needsOutreachInput && (
              <div className="flex flex-col gap-1.5 w-full max-w-md">
                <Input
                  type="email"
                  value={outreachEmail}
                  onChange={(e) => setOutreachEmail(e.target.value)}
                  placeholder={t(locale, "outreachEmailPh")}
                  dir="ltr"
                  className="text-[13px]"
                />
              </div>
            )}
            {/* Dispatch first — draft review is optional, not a wall before send. */}
            <Button
              disabled={busy || (needsOutreachInput && !/@/.test(outreachEmail.trim()))}
              className="text-[14px] py-3 px-5 self-start font-extrabold"
              onClick={() =>
                run(async () => {
                  if (draftEdit.trim()) {
                    const save = await fetch(`/api/cases/${caseId}/approve`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        editedMessage: draftEdit.trim(),
                        counterpartyEmail: needsOutreachInput
                          ? outreachEmail.trim()
                          : undefined,
                      }),
                    });
                    if (!save.ok) {
                      const saveData = await save.json().catch(() => ({}));
                      if (saveData.error !== "ALREADY_SENT") throw new Error("approve");
                    }
                  }
                  const res = await fetch(`/api/cases/${caseId}/dispatch`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      counterpartyEmail: needsOutreachInput
                        ? outreachEmail.trim()
                        : undefined,
                    }),
                  });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    if (isOutreachEmailApiError(data.error)) {
                      setErr(t(locale, "errNeedsEmail"));
                      return;
                    }
                    if (data.error === "OUTREACH_DELIVERY_FAILED") {
                      setErr(t(locale, "errDelivery"));
                      return;
                    }
                    if (data.error === "ALREADY_SENT") {
                      setErr(t(locale, "errAlreadySent"));
                      router.refresh();
                      return;
                    }
                    throw new Error("dispatch");
                  }
                  const data = await res.json().catch(() => ({}));
                  if (data.authCode) setAuthCode(data.authCode);
                  if (data.mandateJti) {
                    setMandateInfo(
                      `${t(locale, "mandateOk")} · jti ${String(data.mandateJti).slice(0, 8)}…`,
                    );
                  }
                  setLocalAuth(true);
                  scheduleFollowUpReminder(caseId);
                  // Flip UI to SENT → SavingsProof path (completion rate).
                  router.refresh();
                })
              }
            >
              {busy ? t(locale, "working") : t(locale, "dispatch")}
            </Button>
            {draftEdit ? (
              <details className="w-full">
                <summary className="text-[12px] text-ink-soft cursor-pointer select-none font-bold">
                  {t(locale, "draftTitle")}
                </summary>
                <textarea
                  value={draftEdit}
                  onChange={(e) => setDraftEdit(e.target.value)}
                  rows={6}
                  className="mt-2 w-full rounded-lg bg-[#0a1119] border border-[rgba(255,255,255,0.12)] text-ink text-[12.5px] leading-relaxed px-3 py-2 font-mono"
                  dir="auto"
                />
              </details>
            ) : null}
            {!emailConfigured && draftEdit.trim() && (
              <Button
                variant="ghost"
                className="text-[13px] py-2 px-3 self-start"
                disabled={
                  !(
                    (outreachEmail.trim() || resolvedOutreach) &&
                    /@/.test(outreachEmail.trim() || resolvedOutreach)
                  )
                }
                onClick={() => {
                  const to = (outreachEmail.trim() || resolvedOutreach).toLowerCase();
                  const subject = he
                    ? `פנייה באמצעות זכאי — ${providerHebrewName(provider || "")}`
                    : `Zakai Mandate request — ${provider || "provider"}`;
                  if (openMailto(to, subject, draftEdit)) {
                    setMailtoOpened(true);
                    setTimeout(() => setMailtoOpened(false), 2500);
                  }
                }}
              >
                {mailtoOpened ? t(locale, "mailtoOpened") : t(locale, "mailtoFallback")}
              </Button>
            )}
            {authCode && (
              <div className="flex flex-col gap-1">
                <div className="text-[12px] text-emerald font-bold">
                  {t(locale, "authCode")}: {authCode}
                </div>
                <a
                  href={`/${locale}/authorization/${authCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-[#3EC6FF] font-bold no-underline"
                >
                  {t(locale, "openDoc")} →
                </a>
              </div>
            )}
            {mandateInfo && <div className="text-[12px] text-ink-soft">{mandateInfo}</div>}
          </>
        )}
        {err && <FieldError>{err}</FieldError>}
      </div>
    );
  }

  if (status === "SENT") {
    const proposed = proposedSaving ?? pasteProposed;
    const proposedSource: "inbound" | "manual" = proposedSaving ? "inbound" : "manual";
    const previewAmt =
      proposed?.newAmountShekels != null
        ? proposed.newAmountShekels
        : newAmt !== "" && Number(newAmt) >= 0
          ? Number(newAmt)
          : null;
    const feePreview =
      previewAmt != null && amountOriginalShekels != null
        ? previewSuccessFeeShekels(amountOriginalShekels, previewAmt, feeBasis)
        : null;
    const feePreviewLine =
      feePreview && feePreview.chargeable
        ? he
          ? `חיסכון מתועד ≈ ₪${feePreview.savingShekels} · עמלת הצלחה ${feePreview.ratePct}% ≈ ₪${feePreview.feeShekels} (רק אחרי תיעוד)`
          : `Documented saving ≈ ₪${feePreview.savingShekels} · success fee ${feePreview.ratePct}% ≈ ₪${feePreview.feeShekels} (only after proof)`
        : feePreview && feePreview.savingShekels <= 0
          ? he
            ? "אין חיסכון מתועד בסכום זה — אין עמלה"
            : "No documented saving at this amount — no fee"
          : null;
    const roundHint =
      emailConfigured && agentRound > 0
        ? he
          ? `הסוכן כבר שלח ${agentRound} סיבוב${agentRound > 1 ? "ים" : ""} אוטומטי${agentRound > 1 ? "ים" : ""}.`
          : `Agent already sent ${agentRound} auto round${agentRound > 1 ? "s" : ""}.`
        : null;

    return (
      <div className="w-full mt-2 flex flex-col gap-3">
        <div className="rounded-xl border border-[rgba(240,180,92,0.35)] bg-[rgba(240,180,92,0.08)] px-3 py-2.5 text-[12.5px] font-bold">
          {outreachDelivery === "delivered"
            ? t(locale, "sentBanner")
            : outreachDelivery === "queued"
              ? t(locale, "queuedBanner")
              : outreachDelivery === "failed"
                ? t(locale, "failedBanner")
                : emailConfigured
                  ? t(locale, "sentBanner")
                  : t(locale, "notDeliveredBanner")}
          {roundHint && (
            <span className="block mt-1 text-emerald">
              {t(locale, "agentRoundLabel")}: {agentRound} · {roundHint}
            </span>
          )}
        </div>

        {agentRound >= MAX_AGENT_ROUNDS && !proposed && (
          <div className="rounded-xl border border-[rgba(240,138,107,0.5)] bg-[rgba(240,138,107,0.12)] px-3 py-2.5 text-[12.5px] font-extrabold text-[#f08a6b] leading-relaxed">
            {t(locale, "exhaustedBanner")}
          </div>
        )}

        {!localAuth && (
          <div className="rounded-xl border border-[rgba(240,138,107,0.5)] bg-[rgba(240,138,107,0.12)] p-3.5">
            <div className="text-[12.5px] font-extrabold text-[#f08a6b] leading-relaxed mb-2.5">
              {t(locale, "mandateInactiveBanner")}
            </div>
            <Button
              disabled={busy}
              className="text-[13px] py-2.5 px-4 w-full sm:w-auto"
              onClick={() =>
                run(async () => {
                  const res = await fetch(`/api/cases/${caseId}/authorization`, {
                    method: "POST",
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error("reissue");
                  if (data.code) setAuthCode(data.code);
                  if (data.mandate?.jti) {
                    setMandateInfo(
                      `${t(locale, "mandateOk")} · jti ${String(data.mandate.jti).slice(0, 8)}…`,
                    );
                  } else {
                    setMandateInfo(t(locale, "mandateReissued"));
                  }
                  setLocalAuth(true);
                  router.refresh();
                })
              }
            >
              {busy ? t(locale, "working") : t(locale, "mandateReissue")}
            </Button>
            {authCode && (
              <a
                href={`/${locale}/authorization/${authCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2 text-[12px] text-[#3EC6FF] font-bold no-underline"
              >
                {t(locale, "openDoc")} →
              </a>
            )}
            {mandateInfo && <div className="text-[12px] text-ink-soft mt-2">{mandateInfo}</div>}
          </div>
        )}

        {!emailConfigured && draftEdit.trim() && (
          <Button
            className="text-[13px] py-2.5 px-4 w-full sm:w-auto"
            disabled={
              !(
                (outreachEmail.trim() || resolvedOutreach) &&
                /@/.test(outreachEmail.trim() || resolvedOutreach)
              )
            }
            onClick={() => {
              const to = (outreachEmail.trim() || resolvedOutreach).toLowerCase();
              const subject = he
                ? `פנייה באמצעות זכאי — ${providerHebrewName(provider || "")}`
                : `Zakai Mandate request — ${provider || "provider"}`;
              if (openMailto(to, subject, draftEdit)) {
                setMailtoOpened(true);
                setTimeout(() => setMailtoOpened(false), 2500);
              }
            }}
          >
            {mailtoOpened ? t(locale, "mailtoOpened") : t(locale, "mailtoFallback")}
          </Button>
        )}

        {learningTip && learningTip.trials >= 5 ? (
          <div className="rounded-xl border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.08)] px-3 py-2.5 text-[12.5px] leading-relaxed">
            <span className="font-extrabold text-[#3EC6FF]">
              {heEn(he, "ממה שלמדנו על ספק זה", "What worked on this provider")}
            </span>
            <span className="text-ink-soft">
              {he
                ? ` — ${(learningTip.winRatePct).toFixed(0)}% הצלחה מתועדת ב־${learningTip.trials} תיקים`
                : ` — ${learningTip.winRatePct.toFixed(0)}% documented wins over ${learningTip.trials} cases`}
              {learningTip.bestStanceHe || learningTip.bestStanceEn
                ? he
                  ? ` · סגנון מוביל: ${learningTip.bestStanceHe}`
                  : ` · leading stance: ${learningTip.bestStanceEn}`
                : ""}
              {learningTip.medianDays != null
                ? he
                  ? ` · חציון ימים עד תוצאה: ${learningTip.medianDays}`
                  : ` · median days to outcome: ${learningTip.medianDays}`
                : ""}
              {he
                ? ". רק מענה בכתב נספר ל־SavingsProof."
                : ". Only written replies become SavingsProof."}
            </span>
          </div>
        ) : null}

        {/*
          When silent / missing outreach: surface follow-up ABOVE paste/manual.
          A collapsed details at the bottom is how SENT cases stall.
        */}
        {agentRound < MAX_AGENT_ROUNDS && localAuth && (!proposed || needsOutreachInput) ? (
          <div className="rounded-xl border border-[rgba(240,180,92,0.45)] bg-[rgba(240,180,92,0.1)] p-3.5">
            <div className="text-[13px] font-extrabold text-[#F0B45C] mb-2">
              {t(locale, "followTitle")}
            </div>
            {needsOutreachInput && (
              <div className="flex flex-col gap-1.5 w-full max-w-md mb-2">
                <Input
                  type="email"
                  value={outreachEmail}
                  onChange={(e) => setOutreachEmail(e.target.value)}
                  placeholder={t(locale, "outreachEmailPh")}
                  dir="ltr"
                  className="text-[13px]"
                />
              </div>
            )}
            <select
              value={replyKind}
              onChange={(e) => setReplyKind(e.target.value as ProviderReplyKind)}
              className="w-full rounded-lg bg-[#0a1119] border border-[rgba(255,255,255,0.12)] text-ink text-[13px] px-3 py-2 mb-2"
            >
              {REPLY_KIND_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {heEn(he, o.he, o.en)}
                </option>
              ))}
            </select>
            {replyKind === "competitor" && (
              <div className="flex flex-wrap gap-2 mb-2">
                <Input
                  value={competitorName}
                  onChange={(e) => setCompetitorName(e.target.value)}
                  placeholder={t(locale, "competitorName")}
                  className="flex-1 min-w-[140px] text-[13px]"
                />
                <Input
                  type="number"
                  value={competitorPrice}
                  onChange={(e) => setCompetitorPrice(e.target.value)}
                  placeholder={t(locale, "competitorPrice")}
                  className="max-w-[140px] text-[13px]"
                />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {emailConfigured && !followSentOk && !followQueuedOk ? (
                <Button
                  disabled={busy || (needsOutreachInput && !/@/.test(outreachEmail.trim()))}
                  className="text-[13px] py-2 px-3"
                  onClick={() =>
                    run(async () => {
                      setFollowSentOk(false);
                    setFollowQueuedOk(false);
                      const res = await fetch(`/api/cases/${caseId}/follow-up`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          replyKind,
                          round: nextFollowRound,
                          send: true,
                          competitorName: competitorName || undefined,
                          competitorPriceShekels: competitorPrice
                            ? Number(competitorPrice)
                            : undefined,
                          counterpartyEmail: needsOutreachInput
                            ? outreachEmail.trim()
                            : undefined,
                        }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!applyFollowUpSendResult(res.ok, data)) return;
                      router.refresh();
                    })
                  }
                >
                  {busy ? t(locale, "working") : t(locale, "followSendAndDraft")}
                </Button>
              ) : null}
              {!(followSentOk || followQueuedOk) ? (
                <Button
                  variant={emailConfigured ? "ghost" : undefined}
                  disabled={busy}
                  className="text-[13px] py-2 px-3"
                  onClick={() =>
                    run(async () => {
                      setFollowSentOk(false);
                    setFollowQueuedOk(false);
                      const res = await fetch(`/api/cases/${caseId}/follow-up`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          replyKind,
                          round: nextFollowRound,
                          competitorName: competitorName || undefined,
                          competitorPriceShekels: competitorPrice
                            ? Number(competitorPrice)
                            : undefined,
                        }),
                      });
                      if (!res.ok) throw new Error("follow");
                      const data = await res.json();
                      setFollowBody(data.body || "");
                      setFollowTip(data.tip || null);
                    })
                  }
                >
                  {busy ? t(locale, "working") : t(locale, "followGen")}
                </Button>
              ) : null}
              {followBody && emailConfigured && !followSentOk && !followQueuedOk ? (
                <Button
                  variant="ghost"
                  disabled={busy || (needsOutreachInput && !/@/.test(outreachEmail.trim()))}
                  className="text-[13px] py-2 px-3"
                  onClick={() =>
                    run(async () => {
                      const res = await fetch(`/api/cases/${caseId}/follow-up`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          replyKind,
                          round: nextFollowRound,
                          send: true,
                          competitorName: competitorName || undefined,
                          competitorPriceShekels: competitorPrice
                            ? Number(competitorPrice)
                            : undefined,
                          counterpartyEmail: needsOutreachInput
                            ? outreachEmail.trim()
                            : undefined,
                        }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!applyFollowUpSendResult(res.ok, data)) return;
                      router.refresh();
                    })
                  }
                >
                  {busy ? t(locale, "working") : t(locale, "followSend")}
                </Button>
              ) : null}
              {followSentOk ? (
                <span className="text-[13px] font-bold text-emerald self-center">
                  {t(locale, "followSent")}
                </span>
              ) : null}
              {followQueuedOk && !followSentOk ? (
                <span className="text-[13px] font-bold text-[#3EC6FF] self-center">
                  {t(locale, "followQueued")}
                </span>
              ) : null}
            </div>
            {followTip && <p className="text-[12px] text-ink-soft mt-2 mb-0">{followTip}</p>}
            {followBody && (
              <div className="mt-2">
                <pre className="whitespace-pre-wrap text-[12px] leading-relaxed bg-[#060b12] rounded-lg p-3 border border-[rgba(255,255,255,0.08)] max-h-48 overflow-y-auto">
                  {followBody}
                </pre>
                <Button
                  variant="ghost"
                  className="text-[13px] py-2 px-3 mt-2"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(followBody);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  {copied ? t(locale, "copied") : t(locale, "copyMsg")}
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {/* SavingsProof first — fee and gravity only compound after this. */}
        {proposed && (
          <div className="rounded-xl border border-[rgba(63,203,155,0.55)] bg-[rgba(63,203,155,0.14)] p-3.5">
            <div className="text-[13.5px] font-extrabold text-emerald">
              {t(locale, feeBasis === "lump" ? "proposedTitleLump" : "proposedTitle")}: ₪
              {proposed.newAmountShekels}
            </div>
            <p className="text-[12px] text-ink-soft mt-1 mb-2.5">
              {t(locale, "proposedConf")} {(proposed.confidence * 100).toFixed(0)}%
              {"from" in proposed && proposed.from
                ? ` · ${t(locale, "proposedFrom")} ${proposed.from}`
                : ""}
            </p>
            {feePreviewLine ? (
              <p className="text-[12px] font-bold text-emerald mb-2.5 leading-relaxed">
                {feePreviewLine}
              </p>
            ) : null}
            <Button
              disabled={busy}
              className="text-[14px] py-3 px-5 w-full sm:w-auto font-extrabold"
              onClick={() =>
                run(() =>
                  recordAndFinish(proposed.newAmountShekels, { source: proposedSource }),
                )
              }
            >
              {busy ? t(locale, "working") : t(locale, "proposedOneTap")}
            </Button>
          </div>
        )}

        {!proposedSaving && (
          <div className="rounded-xl border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.08)] p-3.5">
            <div className="text-[13px] font-extrabold text-[#3EC6FF]">{t(locale, "pasteLabel")}</div>
            <p className="text-[12px] text-ink-soft mt-1 mb-2.5 leading-relaxed">
              {t(locale, "pasteHint")}
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={t(locale, "pastePh")}
              rows={4}
              className="w-full rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#060b12] px-3 py-2 text-[13px] text-ink placeholder:text-ink-soft/70 resize-y min-h-[88px]"
            />
            <Button
              disabled={busy || pasteText.trim().length < 8}
              className="text-[13px] py-2.5 px-4 w-full sm:w-auto mt-2.5"
              onClick={() => run(() => proposeFromPaste())}
            >
              {busy ? t(locale, "working") : t(locale, "pasteCta")}
            </Button>
            {pasteTip && (
              <p className="text-[12px] text-ink-soft mt-2 leading-relaxed">{pasteTip}</p>
            )}
          </div>
        )}

        <div className="rounded-xl border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)] p-3.5">
          <div className="text-[13.5px] font-extrabold text-emerald">{t(locale, "saveBlockTitle")}</div>
          <p className="text-[12px] text-ink-soft mt-1 mb-3 leading-relaxed">{t(locale, "saveBlockSub")}</p>
          {feePreviewLine && !proposed ? (
            <p className="text-[12px] font-bold text-emerald mb-2.5 leading-relaxed">
              {feePreviewLine}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <Input
              type="number"
              value={newAmt}
              onChange={(e) => setNewAmt(e.target.value)}
              placeholder={t(locale, feeBasis === "lump" ? "newAmtLump" : "newAmt")}
              className="max-w-[180px] text-[13px]"
            />
            <Button
              disabled={busy || newAmt === "" || Number(newAmt) < 0}
              className="text-[14px] py-2.5 px-4 font-extrabold"
              onClick={() => run(() => recordAndFinish(Number(newAmt), { source: "manual" }))}
            >
              {busy ? t(locale, "working") : t(locale, feeBasis === "lump" ? "recordLump" : "record")}
            </Button>
            {feeBasis === "lump" ? (
              <Button
                variant="ghost"
                disabled={busy}
                className="text-[13px] py-2 px-3"
                onClick={() => run(() => recordAndFinish(0, { source: "manual" }))}
              >
                {t(locale, "fullRecovery")}
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  disabled={busy}
                  className="text-[13px] py-2 px-3"
                  onClick={() => run(() => recordAndFinish(0, { source: "manual" }))}
                >
                  {t(locale, "quickCancel")}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  className="text-[13px] py-2 px-3"
                  onClick={() =>
                    run(() => recordAndFinish(amountOriginalShekels, { source: "manual" }))
                  }
                >
                  {t(locale, "noChange")}
                </Button>
              </>
            )}
          </div>
          {feeBasis !== "lump" ? (
            <details className="mt-2">
              <summary className="text-[12px] text-ink-soft cursor-pointer select-none">
                {t(locale, "estimateHints")}
              </summary>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  variant="ghost"
                  disabled={busy || amountOriginalShekels <= 0}
                  className="text-[12.5px] py-1.5 px-2.5"
                  onClick={() =>
                    run(() =>
                      recordAndFinish(Math.round(amountOriginalShekels * 0.8), {
                        source: "estimate",
                        selfReported: true,
                      }),
                    )
                  }
                >
                  {t(locale, "quickOff20")}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || amountOriginalShekels <= 0}
                  className="text-[12.5px] py-1.5 px-2.5"
                  onClick={() =>
                    run(() =>
                      recordAndFinish(Math.round(amountOriginalShekels * 0.5), {
                        source: "estimate",
                        selfReported: true,
                      }),
                    )
                  }
                >
                  {t(locale, "quickOff50")}
                </Button>
              </div>
            </details>
          ) : null}
        </div>

        <div className="rounded-xl border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.08)] p-3.5">
          <div className="text-[13px] font-extrabold text-[#3EC6FF]">{t(locale, "proofsLabel")}</div>
          <p className="text-[12px] text-ink-soft mt-1 mb-2.5 leading-relaxed">{t(locale, "proofsHint")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-[13.5px] font-extrabold tracking-wide bg-[#060b12] border border-[rgba(255,255,255,0.12)] rounded-lg px-3 py-2 select-all">
              {proofsAddr}
            </code>
            <Button
              variant="ghost"
              className="!text-[13px] !py-2"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(proofsAddr);
                  setProofsCopied(true);
                  setTimeout(() => setProofsCopied(false), 2000);
                } catch {
                  /* ignore */
                }
              }}
            >
              {proofsCopied ? t(locale, "proofsCopied") : t(locale, "proofsCopy")}
            </Button>
          </div>
        </div>

        {/* Secondary: follow-up stays available when a proposed saving already leads. */}
        {agentRound < MAX_AGENT_ROUNDS && localAuth && proposed && !needsOutreachInput ? (
        <details className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
          <summary className="text-[12.5px] font-bold cursor-pointer select-none">
            {t(locale, "followTitle")}
          </summary>
          <div className="mt-2">
          {needsOutreachInput && (
            <div className="flex flex-col gap-1.5 w-full max-w-md mb-2">
              <Input
                type="email"
                value={outreachEmail}
                onChange={(e) => setOutreachEmail(e.target.value)}
                placeholder={t(locale, "outreachEmailPh")}
                dir="ltr"
                className="text-[13px]"
              />
            </div>
          )}
          <select
            value={replyKind}
            onChange={(e) => setReplyKind(e.target.value as ProviderReplyKind)}
            className="w-full rounded-lg bg-[#0a1119] border border-[rgba(255,255,255,0.12)] text-ink text-[13px] px-3 py-2 mb-2"
          >
            {REPLY_KIND_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {he ? o.he : o.en}
              </option>
            ))}
          </select>
          {replyKind === "competitor" && (
            <div className="flex flex-wrap gap-2 mb-2">
              <Input
                value={competitorName}
                onChange={(e) => setCompetitorName(e.target.value)}
                placeholder={t(locale, "competitorName")}
                className="flex-1 min-w-[140px] text-[13px]"
              />
              <Input
                type="number"
                value={competitorPrice}
                onChange={(e) => setCompetitorPrice(e.target.value)}
                placeholder={t(locale, "competitorPrice")}
                className="max-w-[140px] text-[13px]"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {emailConfigured && !followSentOk && !followQueuedOk ? (
              <Button
                disabled={busy || (needsOutreachInput && !/@/.test(outreachEmail.trim()))}
                className="text-[13px] py-2 px-3"
                onClick={() =>
                  run(async () => {
                    setFollowSentOk(false);
                    setFollowQueuedOk(false);
                    const res = await fetch(`/api/cases/${caseId}/follow-up`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        replyKind,
                        round: nextFollowRound,
                        send: true,
                        competitorName: competitorName || undefined,
                        competitorPriceShekels: competitorPrice
                          ? Number(competitorPrice)
                          : undefined,
                        counterpartyEmail: needsOutreachInput
                          ? outreachEmail.trim()
                          : undefined,
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!applyFollowUpSendResult(res.ok, data)) return;
                    router.refresh();
                  })
                }
              >
                {busy ? t(locale, "working") : t(locale, "followSendAndDraft")}
              </Button>
            ) : null}
            {!(followSentOk || followQueuedOk) ? (
              <Button
                variant={emailConfigured ? "ghost" : undefined}
                disabled={busy}
                className="text-[13px] py-2 px-3"
                onClick={() =>
                  run(async () => {
                    setFollowSentOk(false);
                    setFollowQueuedOk(false);
                    const res = await fetch(`/api/cases/${caseId}/follow-up`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        replyKind,
                        round: nextFollowRound,
                        competitorName: competitorName || undefined,
                        competitorPriceShekels: competitorPrice
                          ? Number(competitorPrice)
                          : undefined,
                      }),
                    });
                    if (!res.ok) throw new Error("follow");
                    const data = await res.json();
                    setFollowBody(data.body || "");
                    setFollowTip(data.tip || null);
                  })
                }
              >
                {busy ? t(locale, "working") : t(locale, "followGen")}
              </Button>
            ) : null}
            {followBody && emailConfigured && !followSentOk && !followQueuedOk ? (
              <Button
                variant="ghost"
                disabled={busy || (needsOutreachInput && !/@/.test(outreachEmail.trim()))}
                className="text-[13px] py-2 px-3"
                onClick={() =>
                  run(async () => {
                    const res = await fetch(`/api/cases/${caseId}/follow-up`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        replyKind,
                        round: nextFollowRound,
                        send: true,
                        competitorName: competitorName || undefined,
                        competitorPriceShekels: competitorPrice
                          ? Number(competitorPrice)
                          : undefined,
                        counterpartyEmail: needsOutreachInput
                          ? outreachEmail.trim()
                          : undefined,
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!applyFollowUpSendResult(res.ok, data)) return;
                    router.refresh();
                  })
                }
              >
                {busy ? t(locale, "working") : t(locale, "followSend")}
              </Button>
            ) : null}
            {followSentOk ? (
              <span className="text-[13px] font-bold text-emerald self-center">
                {t(locale, "followSent")}
              </span>
            ) : null}
            {followQueuedOk && !followSentOk ? (
              <span className="text-[13px] font-bold text-[#3EC6FF] self-center">
                {t(locale, "followQueued")}
              </span>
            ) : null}
          </div>
          {followTip && <p className="text-[12px] text-ink-soft mt-2 mb-0">{followTip}</p>}
          {followBody && (
            <div className="mt-2">
              <pre className="whitespace-pre-wrap text-[12px] leading-relaxed bg-[#060b12] rounded-lg p-3 border border-[rgba(255,255,255,0.08)] max-h-48 overflow-y-auto">
                {followBody}
              </pre>
              <Button
                variant="ghost"
                className="text-[13px] py-2 px-3 mt-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(followBody);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {copied ? t(locale, "copied") : t(locale, "copyMsg")}
              </Button>
            </div>
          )}
          </div>
        </details>
        ) : null}

        {/* Share only after SAVED + fee settled — virality before proof dilutes gravity. */}

        {err && <FieldError>{err}</FieldError>}
      </div>
    );
  }

  return null;
}
