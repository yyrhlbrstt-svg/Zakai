"use client";

import { useState } from "react";
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
  /** Pending success fee in shekels — primary CTA on SAVED before share. */
  pendingFeeShekels?: number;
  /**
   * Whether this environment can actually deliver email (SMTP_HOST set).
   * A case's status flips to SENT the moment the agent claims the send —
   * that's app-internal bookkeeping, not proof the provider ever saw
   * anything. Without a transport, "SENT" just means queued: the banner
   * needs to say so instead of implying an active wait for a reply.
   */
  emailConfigured?: boolean;
  /** Outreach letter the user consents to — editable before dispatch. */
  draftMessage?: string;
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
    sendCode: "שלח קוד / קישור למייל",
    codePh: "קוד מ-6 ספרות",
    verifyCode: "אמת",
    magicHint: "נשלח גם קישור למייל — לחיצה אחת בלי SMS.",
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
    competitorName: "שם המתחרה",
    competitorPrice: "מחיר המתחרה ₪",
    proposedTitle: "הסוכן זיהה מהמייל",
    proposedTitleLump: "הסוכן זיהה מהמייל — נותר לשלם",
    proposedConf: "ביטחון",
    proposedOneTap: "רשום חיסכון בלחיצה אחת",
    proposedFrom: "מ־",
    saveBlockTitle: "קיבלתם תוצאה? רשמו חיסכון עכשיו",
    saveBlockSub: "בלי רישום אין עמלה ואין הוכחה. זה השלב שסוגר את הכסף.",
    quickCancel: "בוטל לגמרי (₪0)",
    quickOff20: "הנחה ~20% (הערכה — בלי עמלה)",
    quickOff50: "הנחה ~50% (הערכה — בלי עמלה)",
    estimateHints: "קיצורי הערכה — לא תיעוד מספק. לא נגבית עמלה על הערכה.",
    payFeeNow: "שלמו את עמלת ההצלחה",
    savedPayFirst: "קודם העמלה על התוצאה המתועדת — אחר כך שיתוף.",
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
    errAlreadySent: "כבר נשלח — רעננו את הדשבורד.",
    outreachEmailPh: "אימייל לשליחה (ספק / עירייה / חנות)",
  },
  en: {
    approve: "Approve & continue",
    approveSend: "Approve & send with Mandate now",
    sentShareTitle: "Share — every Mandate through you grows the pipe",
    sentShareDefault:
      "I sent my provider a Zakai Mandate request — signed written authority, no call center. See what you're owed:",
    mailtoFallback: "SMTP off here — open your mail and send the letter",
    mailtoOpened: "Mail opened — send from there",
    sendCode: "Send code / email link",
    codePh: "6-digit code",
    verifyCode: "Verify",
    magicHint: "Also sent an email magic link — one tap, no SMS needed.",
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
    competitorName: "Competitor name",
    competitorPrice: "Competitor price ₪",
    proposedTitle: "Agent spotted from email",
    proposedTitleLump: "From email — remaining owed",
    proposedConf: "Confidence",
    proposedOneTap: "One-tap record saving",
    proposedFrom: "from",
    saveBlockTitle: "Got a result? Record the saving now",
    saveBlockSub: "No record → no fee and no proof. This is the step that closes the money.",
    quickCancel: "Fully cancelled (₪0)",
    quickOff20: "~20% off (estimate — no fee)",
    quickOff50: "~50% off (estimate — no fee)",
    estimateHints: "Estimate shortcuts — not provider documentation. No success fee on estimates.",
    payFeeNow: "Pay the success fee",
    savedPayFirst: "Pay the documented-outcome fee first — then share.",
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
    errAlreadySent: "Already sent — refresh the dashboard.",
    outreachEmailPh: "Send-to email (provider / municipality / merchant)",
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
  proofsEmail,
  agentRound = 0,
  emailConfigured = true,
  vertical,
  provider,
  counterpartyEmail: counterpartyEmailProp,
  feeBasis = "monthly",
  currentPlan,
  documentedSavingShekels,
  draftMessage: draftMessageProp = "",
  emailVerified = false,
}: Props) {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mailtoOpened, setMailtoOpened] = useState(false);
  const [draftEdit, setDraftEdit] = useState(draftMessageProp);
  const [followSentOk, setFollowSentOk] = useState(false);
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

  function finishSaving(opts?: { checkoutUrl?: string | null; chargeable?: boolean }) {
    scheduleRecheckReminder(caseId);
    navigatedAfterSave = true;
    // Prove → fee in one gesture when checkout is ready (same as CheckFlow).
    if (opts?.checkoutUrl) {
      window.location.href = opts.checkoutUrl;
      return;
    }
    if (opts?.chargeable) {
      router.push(`/dashboard?saved=1&case=${caseId}&payFee=1`);
      return;
    }
    router.push(`/dashboard?saved=1&case=${caseId}`);
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
    if (!res.ok) throw new Error("save");
    const data = (await res.json().catch(() => ({}))) as {
      checkoutUrl?: string;
      chargeable?: boolean;
    };
    finishSaving({ checkoutUrl: data.checkoutUrl, chargeable: data.chargeable === true });
  }

  async function proposeFromPaste() {
    setPasteTip(null);
    const res = await fetch(`/api/cases/${caseId}/propose-saving`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: pasteText }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      proposed?: { newAmountShekels: number; confidence: number } | null;
      extract?: { found?: boolean; newAmountShekels?: number | null };
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || "paste");
    if (data.proposed?.newAmountShekels != null) {
      setNewAmt(String(data.proposed.newAmountShekels));
      setPasteText("");
      setPasteTip(null);
      return;
    }
    if (data.extract?.newAmountShekels != null) {
      setNewAmt(String(data.extract.newAmountShekels));
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

  if (status === "REVOKED" || status === "NO_SAVING") return null;

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

    // Ranked, not a static shortlist — the same CATALOG ranking that feeds
    // /leaks and the assistant's own prompt, so this list grows automatically
    // as new verticals land in priority.ts. Excludes the vertical this case
    // itself just closed.
    const excludeId = vertical ? VERTICAL_TO_CATALOG_ID[vertical] : undefined;
    const doors = rankPriorityActions(8)
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
        {pendingFeeShekels != null && pendingFeeShekels > 0 ? (
          <div className="mb-3 rounded-lg border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.12)] px-3 py-2.5">
            <p className="text-[12.5px] text-ink-soft m-0 mb-2 leading-snug">{t(locale, "savedPayFirst")}</p>
            <Link href={`/dashboard?saved=1&case=${caseId}&payFee=1`} className="no-underline">
              <Button className="!text-[13px] w-full sm:w-auto">
                {t(locale, "payFeeNow")} · ₪{pendingFeeShekels}
              </Button>
            </Link>
          </div>
        ) : null}
        {/* Prove → fee → share: no virality / next doors while success fee is unpaid. */}
        {!(pendingFeeShekels != null && pendingFeeShekels > 0) ? (
          <>
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
        {showUpgradeNudge && (
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
        {draftEdit ? (
          <>
            <div className="text-[12px] font-bold">{t(locale, "draftTitle")}</div>
            <textarea
              value={draftEdit}
              onChange={(e) => setDraftEdit(e.target.value)}
              rows={8}
              className="w-full rounded-lg bg-[#0a1119] border border-[rgba(255,255,255,0.12)] text-ink text-[12.5px] leading-relaxed px-3 py-2 font-mono"
              dir="auto"
            />
          </>
        ) : null}
        <Button
          disabled={busy}
          className="text-[13px] py-2 px-3 self-start"
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
            })
          }
        >
          {busy ? t(locale, "working") : t(locale, "approve")}
        </Button>
        {emailVerified && (
          <Button
            disabled={busy || (needsOutreachInput && !/@/.test(outreachEmail.trim()))}
            className="text-[13px] py-2.5 px-4 self-start"
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
                  throw new Error("dispatch");
                }
                const data = await res.json().catch(() => ({}));
                if (data.authCode) setAuthCode(data.authCode);
                if (data.mandateJti) setMandateInfo(t(locale, "mandateOk"));
                setLocalAuth(true);
              })
            }
          >
            {busy ? t(locale, "working") : t(locale, "approveSend")}
          </Button>
        )}
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
            {!codeSent ? (
              <Button
                disabled={busy}
                className="text-[13px] py-2 px-3 self-start"
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
                {magicSent && (
                  <p className="text-[12px] text-emerald font-bold m-0">{t(locale, "magicHint")}</p>
                )}
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
              {t(locale, ownViaEmail ? "ownDoneEmail" : "ownDone")}
            </p>
            {draftEdit ? (
              <div className="flex flex-col gap-1.5 w-full">
                <div className="text-[12px] font-bold">{t(locale, "draftTitle")}</div>
                <textarea
                  value={draftEdit}
                  onChange={(e) => setDraftEdit(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg bg-[#0a1119] border border-[rgba(255,255,255,0.12)] text-ink text-[12.5px] leading-relaxed px-3 py-2 font-mono"
                  dir="auto"
                />
              </div>
            ) : null}
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
            <Button
              disabled={busy || (needsOutreachInput && !/@/.test(outreachEmail.trim()))}
              className="text-[13px] py-2.5 px-4 self-start"
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
                })
              }
            >
              {busy ? t(locale, "working") : t(locale, "dispatch")}
            </Button>
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
    const proposed = proposedSaving;
    const roundHint =
      emailConfigured && agentRound > 0
        ? he
          ? `הסוכן כבר שלח ${agentRound} סיבוב${agentRound > 1 ? "ים" : ""} אוטומטי${agentRound > 1 ? "ים" : ""}.`
          : `Agent already sent ${agentRound} auto round${agentRound > 1 ? "s" : ""}.`
        : null;

    return (
      <div className="w-full mt-2 flex flex-col gap-3">
        <div className="rounded-xl border border-[rgba(240,180,92,0.35)] bg-[rgba(240,180,92,0.08)] px-3 py-2.5 text-[12.5px] font-bold">
          {emailConfigured ? t(locale, "sentBanner") : t(locale, "notDeliveredBanner")}
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

        {/* SavingsProof first — fee and gravity only compound after this. */}
        {proposed && (
          <div className="rounded-xl border border-[rgba(63,203,155,0.55)] bg-[rgba(63,203,155,0.14)] p-3.5">
            <div className="text-[13.5px] font-extrabold text-emerald">
              {t(locale, feeBasis === "lump" ? "proposedTitleLump" : "proposedTitle")}: ₪
              {proposed.newAmountShekels}
            </div>
            <p className="text-[12px] text-ink-soft mt-1 mb-2.5">
              {t(locale, "proposedConf")} {(proposed.confidence * 100).toFixed(0)}%
              {proposed.from ? ` · ${t(locale, "proposedFrom")} ${proposed.from}` : ""}
            </p>
            <Button
              disabled={busy}
              className="text-[13px] py-2.5 px-4 w-full sm:w-auto"
              onClick={() =>
                run(() =>
                  recordAndFinish(proposed.newAmountShekels, { source: "inbound" }),
                )
              }
            >
              {busy ? t(locale, "working") : t(locale, "proposedOneTap")}
            </Button>
          </div>
        )}

        {!proposed && (
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
              className="text-[13px] py-2 px-3"
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

        {agentRound < MAX_AGENT_ROUNDS && localAuth ? (
        <div className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
          <div className="text-[12.5px] font-bold mb-2">{t(locale, "followTitle")}</div>
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
            {emailConfigured && !followSentOk ? (
              <Button
                disabled={busy || (needsOutreachInput && !/@/.test(outreachEmail.trim()))}
                className="text-[13px] py-2 px-3"
                onClick={() =>
                  run(async () => {
                    setFollowSentOk(false);
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
                    if (!res.ok) {
                      if (data.error === "NEEDS_OUTREACH_EMAIL") {
                        setErr(t(locale, "errNeedsEmail"));
                        return;
                      }
                      if (data.error === "NO_ACTIVE_MANDATE") {
                        setLocalAuth(false);
                        setErr(t(locale, "mandateInactiveBanner"));
                        return;
                      }
                      if (data.error === "NO_TRANSPORT") {
                        setErr(t(locale, "errDelivery"));
                        if (data.body) setFollowBody(data.body);
                        return;
                      }
                      if (data.body) setFollowBody(data.body);
                      throw new Error("follow-send");
                    }
                    setFollowBody(data.body || "");
                    setFollowTip(data.tip || null);
                    // Async QUEUED is ok (worker delivers); only claim UI success when not explicitly undelivered.
                    setFollowSentOk(data.delivered !== false || data.sent === true);
                    router.refresh();
                  })
                }
              >
                {busy ? t(locale, "working") : t(locale, "followSendAndDraft")}
              </Button>
            ) : null}
            {!followSentOk ? (
              <Button
                variant={emailConfigured ? "ghost" : undefined}
                disabled={busy}
                className="text-[13px] py-2 px-3"
                onClick={() =>
                  run(async () => {
                    setFollowSentOk(false);
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
            {followBody && emailConfigured && !followSentOk ? (
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
                    if (!res.ok) {
                      if (data.error === "NEEDS_OUTREACH_EMAIL") {
                        setErr(t(locale, "errNeedsEmail"));
                        return;
                      }
                      if (data.error === "NO_ACTIVE_MANDATE") {
                        setLocalAuth(false);
                        setErr(t(locale, "mandateInactiveBanner"));
                        return;
                      }
                      if (data.error === "NO_TRANSPORT") {
                        setErr(t(locale, "errDelivery"));
                        if (data.body) setFollowBody(data.body);
                        return;
                      }
                      if (data.body) setFollowBody(data.body);
                      throw new Error("follow-send");
                    }
                    setFollowBody(data.body || followBody);
                    setFollowTip(data.tip || followTip);
                    setFollowSentOk(data.delivered !== false || data.sent === true);
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

        {/* Share only after SAVED + fee settled — virality before proof dilutes gravity. */}

        {err && <FieldError>{err}</FieldError>}
      </div>
    );
  }

  return null;
}
