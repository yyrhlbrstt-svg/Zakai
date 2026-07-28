"use client";

import { useState } from "react";
import { useRouter, Link } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { Button, Input, FieldError } from "@/components/ui";
import { REPLY_KIND_OPTIONS, type ProviderReplyKind } from "@/lib/negotiation";
import { scheduleFollowUpReminder, scheduleRecheckReminder } from "@/lib/reminders";

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
}

const copy: Record<string, Record<string, string>> = {
  he: {
    approve: "אשר והמשך",
    sendCode: "שלח קוד / קישור למייל",
    codePh: "קוד מ-6 ספרות",
    verifyCode: "אמת",
    magicHint: "נשלח גם קישור למייל — לחיצה אחת בלי SMS.",
    dispatch: "הסוכן שולח עכשיו (Mandate + שליחה)",
    openDoc: "פתח מסמך הרשאה (הדפסה / PDF)",
    newAmt: "סכום חדש אחרי התשובה (₪)",
    record: "רשום חיסכון",
    noChange: "לא השתנה",
    working: "רגע…",
    err: "משהו השתבש. נסה שוב.",
    nextHint: "השלב הבא",
    followTitle: "מה ענו? — הסוכן מכין תשובה",
    followGen: "הכן הודעת המשך",
    copyMsg: "העתק הודעה",
    copied: "הועתק",
    whatsapp: "וואטסאפ",
    nativeShare: "שתף",
    mandateOk: "Mandate הונפק — הספק יכול לאמת חתימה ב-JWKS",
    authCode: "קוד הרשאה",
    savedTitle: "✓ חיסכון מתועד",
    savedSub:
      "הסוכן סיים. שתף — כל חבר שמגיע דרכך מקבל קרדיט, ואתה גם. בעוד ~6 חודשים נזכיר לבדוק אם המחיר זחל חזרה.",
    copyLink: "העתק קישור הפניה",
    linkCopied: "הקישור הועתק",
    sentBanner:
      "הסוכן שלח. אם ענו — העבירו את המייל שלהם לכתובת למטה (או הזינו סכום). אם לא — הסוכן ישלח סיבוב 2 לבד.",
    competitorName: "שם המתחרה",
    competitorPrice: "מחיר המתחרה ₪",
    proposedTitle: "הסוכן זיהה מהמייל",
    proposedConf: "ביטחון",
    proposedOneTap: "רשום חיסכון בלחיצה אחת",
    proposedFrom: "מ־",
    proofsLabel: "העבירו תשובת ספק לכאן",
    proofsCopy: "העתק כתובת",
    proofsCopied: "הועתק",
    proofsHint: "Forward Email / העברת מייל — הסוכן מזהה סכום ומציע רישום בלחיצה אחת.",
    ownDone: "בעלות אומתה — לחיצה אחת והסוכן שולח לספק עם Mandate.",
    agentRoundLabel: "סיבוב סוכן",
    nextDoors: "מה עוד?",
    recheckCta: "בדוק שוב אם המבצע נגמר",
  },
  en: {
    approve: "Approve & continue",
    sendCode: "Send code / email link",
    codePh: "6-digit code",
    verifyCode: "Verify",
    magicHint: "Also sent an email magic link — one tap, no SMS needed.",
    dispatch: "Agent sends now (Mandate + dispatch)",
    openDoc: "Open authorization (print / PDF)",
    newAmt: "New amount after reply (₪)",
    record: "Record saving",
    noChange: "No change",
    working: "One moment…",
    err: "Something went wrong.",
    nextHint: "Next step",
    followTitle: "What did they say? — agent drafts reply",
    followGen: "Draft follow-up",
    copyMsg: "Copy message",
    copied: "Copied",
    whatsapp: "WhatsApp",
    nativeShare: "Share",
    mandateOk: "Mandate issued — provider can verify via JWKS",
    authCode: "Authorization code",
    savedTitle: "✓ Saving documented",
    savedSub:
      "Agent done. Share — friends who join via you get credit, and so do you. In ~6 months we'll remind you to re-check if the price crept back.",
    copyLink: "Copy referral link",
    linkCopied: "Link copied",
    sentBanner:
      "Agent sent. If they replied — forward their email below (or enter amount). If not — agent auto-sends round 2.",
    competitorName: "Competitor name",
    competitorPrice: "Competitor price ₪",
    proposedTitle: "Agent spotted from email",
    proposedConf: "Confidence",
    proposedOneTap: "One-tap record saving",
    proposedFrom: "from",
    proofsLabel: "Forward provider reply here",
    proofsCopy: "Copy address",
    proofsCopied: "Copied",
    proofsHint: "Forward Email — agent extracts the amount and offers one-tap record.",
    ownDone: "Ownership verified — one tap and the agent sends with Mandate.",
    agentRoundLabel: "Agent round",
    nextDoors: "What's next?",
    recheckCta: "Re-check if the promo ended",
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
  proofsEmail,
  agentRound = 0,
}: Props) {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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

  const proofsAddr =
    proofsEmail ||
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PROOFS_EMAIL) ||
    "proofs@zakai.app";

  async function run(fn: () => Promise<void>) {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch {
      setErr(t(locale, "err"));
    } finally {
      setBusy(false);
    }
  }

  if (status === "REVOKED" || status === "NO_SAVING") return null;

  if (status === "SAVED") {
    const msg =
      shareMessage ||
      (he
        ? "חסכתי כסף עם זכאי — סוכן דיגיטלי שפעל בשמי מול הספק, בלי מוקד ובלי לחכות לאף אחד."
        : "I saved money with Zakai — a digital agent acted for me, no call center.");
    const origin = typeof window !== "undefined" ? window.location.origin : "https://zakai.app";
    const shareUrl = referralCode
      ? `${origin}/signup?ref=${encodeURIComponent(referralCode)}`
      : `${origin}/`;
    const fullText = `${msg}\n${shareUrl}`;

    const doors = [
      { href: "/money", he: "בדוק שוב אם המבצע נגמר", en: "Re-check if promo ended" },
      { href: "/electricity", he: "חשמל — מעבר ספק", en: "Electricity switch" },
      { href: "/bank-fees", he: "עמלות בנק", en: "Bank fees" },
      { href: "/cancel", he: "ביטול מנוי", en: "Cancel a sub" },
      { href: "/what-am-i-owed", he: "מה מגיע לי", en: "What am I owed" },
    ];

    return (
      <div className="w-full mt-2 rounded-xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.1)] p-4">
        <div className="text-[15px] font-extrabold text-emerald">{t(locale, "savedTitle")}</div>
        <p className="text-[13px] text-ink-soft mt-1.5 mb-3 leading-relaxed">{t(locale, "savedSub")}</p>
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
      </div>
    );
  }

  if (status === "ANALYZED") {
    return (
      <div className="w-full mt-2">
        <div className="text-[11px] text-ink-soft mb-1.5">{t(locale, "nextHint")}</div>
        <Button
          disabled={busy}
          className="text-[13px] py-2 px-3"
          onClick={() =>
            run(async () => {
              const res = await fetch(`/api/cases/${caseId}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              });
              if (!res.ok) throw new Error("approve");
            })
          }
        >
          {busy ? t(locale, "working") : t(locale, "approve")}
        </Button>
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
            <p className="text-[12.5px] text-emerald font-bold m-0">{t(locale, "ownDone")}</p>
            <Button
              disabled={busy}
              className="text-[13px] py-2.5 px-4 self-start"
              onClick={() =>
                run(async () => {
                  const res = await fetch(`/api/cases/${caseId}/dispatch`, { method: "POST" });
                  if (!res.ok) throw new Error("dispatch");
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
      agentRound > 0
        ? he
          ? `הסוכן כבר שלח ${agentRound} סיבוב${agentRound > 1 ? "ים" : ""} אוטומטי${agentRound > 1 ? "ים" : ""}.`
          : `Agent already sent ${agentRound} auto round${agentRound > 1 ? "s" : ""}.`
        : null;

    return (
      <div className="w-full mt-2 flex flex-col gap-3">
        <div className="rounded-xl border border-[rgba(240,180,92,0.35)] bg-[rgba(240,180,92,0.08)] px-3 py-2.5 text-[12.5px] font-bold">
          {t(locale, "sentBanner")}
          {roundHint && (
            <span className="block mt-1 text-emerald">
              {t(locale, "agentRoundLabel")}: {agentRound} · {roundHint}
            </span>
          )}
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

        {proposed && (
          <div className="rounded-xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.12)] p-3.5">
            <div className="text-[13.5px] font-extrabold text-emerald">
              {t(locale, "proposedTitle")}: ₪{proposed.newAmountShekels}
            </div>
            <p className="text-[12px] text-ink-soft mt-1 mb-2.5">
              {t(locale, "proposedConf")} {(proposed.confidence * 100).toFixed(0)}%
              {proposed.from ? ` · ${t(locale, "proposedFrom")} ${proposed.from}` : ""}
            </p>
            <Button
              disabled={busy}
              className="text-[13px] py-2.5 px-4 w-full sm:w-auto"
              onClick={() =>
                run(async () => {
                  const res = await fetch(`/api/cases/${caseId}/record-saving`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ newAmountShekels: proposed.newAmountShekels }),
                  });
                  if (!res.ok) throw new Error("save");
                  scheduleRecheckReminder(caseId);
                })
              }
            >
              {busy ? t(locale, "working") : t(locale, "proposedOneTap")}
            </Button>
          </div>
        )}

        <div className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
          <div className="text-[12.5px] font-bold mb-2">{t(locale, "followTitle")}</div>
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
          <Button
            disabled={busy}
            className="text-[13px] py-2 px-3"
            onClick={() =>
              run(async () => {
                const res = await fetch(`/api/cases/${caseId}/follow-up`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    replyKind,
                    round: 2,
                    competitorName: competitorName || undefined,
                    competitorPriceShekels: competitorPrice ? Number(competitorPrice) : undefined,
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

        <div className="flex flex-wrap gap-2 items-center">
          <Input
            type="number"
            value={newAmt}
            onChange={(e) => setNewAmt(e.target.value)}
            placeholder={t(locale, "newAmt")}
            className="max-w-[180px] text-[13px]"
          />
          <Button
            disabled={busy || newAmt === "" || Number(newAmt) < 0}
            className="text-[13px] py-2 px-3"
            onClick={() =>
              run(async () => {
                const res = await fetch(`/api/cases/${caseId}/record-saving`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ newAmountShekels: Number(newAmt) }),
                });
                if (!res.ok) throw new Error("save");
                scheduleRecheckReminder(caseId);
              })
            }
          >
            {busy ? t(locale, "working") : t(locale, "record")}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            className="text-[13px] py-2 px-3"
            onClick={() =>
              run(async () => {
                const res = await fetch(`/api/cases/${caseId}/record-saving`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ newAmountShekels: amountOriginalShekels }),
                });
                if (!res.ok) throw new Error("save");
              })
            }
          >
            {t(locale, "noChange")}
          </Button>
        </div>
        {err && <FieldError>{err}</FieldError>}
      </div>
    );
  }

  return null;
}
