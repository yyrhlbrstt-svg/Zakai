"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { Button, Input, FieldError } from "@/components/ui";
import { REPLY_KIND_OPTIONS, type ProviderReplyKind } from "@/lib/negotiation";
import { scheduleFollowUpReminder } from "@/lib/reminders";

type Status =
  | "ANALYZED"
  | "APPROVED"
  | "VERIFIED"
  | "SENT"
  | "SAVED"
  | "NO_SAVING"
  | "REVOKED";

interface Props {
  caseId: string;
  status: Status;
  ownershipVerified: boolean;
  hasAuthorization: boolean;
  amountOriginalShekels: number;
  shareMessage?: string;
  referralCode?: string;
}

const copy: Record<string, Record<string, string>> = {
  he: {
    approve: "אשר והמשך",
    sendCode: "שלח קוד לנייד",
    codePh: "קוד מ-6 ספרות",
    verifyCode: "אמת",
    genAuth: "צור הרשאה + Mandate",
    send: "סמן כנשלח לספק",
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
    shareTitle: "שתף את החיסכון — שיביאו עוד",
    whatsapp: "וואטסאפ",
    mandateOk: "Mandate הונפק — הספק יכול לאמת חתימה ב-JWKS",
    mandateNone: "הרשאה אנושית נוצרה (מפתחות Mandate לא הוגדרו בסביבה)",
    authCode: "קוד הרשאה",
  },
  en: {
    approve: "Approve & continue",
    sendCode: "Send SMS code",
    codePh: "6-digit code",
    verifyCode: "Verify",
    genAuth: "Create auth + Mandate",
    send: "Mark sent to provider",
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
    shareTitle: "Share the saving",
    whatsapp: "WhatsApp",
    mandateOk: "Mandate issued — provider can verify via JWKS",
    mandateNone: "Human authorization created (Mandate keys not configured)",
    authCode: "Authorization code",
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
}: Props) {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [newAmt, setNewAmt] = useState("");
  const [localOwn, setLocalOwn] = useState(ownershipVerified);
  const [localAuth, setLocalAuth] = useState(hasAuthorization);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [mandateInfo, setMandateInfo] = useState<string | null>(null);
  const [replyKind, setReplyKind] = useState<ProviderReplyKind>("delay");
  const [followBody, setFollowBody] = useState<string | null>(null);
  const [followTip, setFollowTip] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        ? "חסכתי כסף עם זכאי — בלי מוקד ובלי לחכות לאף אחד."
        : "I saved money with Zakai — no call center.");
    return (
      <div className="w-full mt-2 rounded-xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] p-3">
        <div className="text-[12.5px] font-bold mb-2">{t(locale, "shareTitle")}</div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 font-extrabold text-[13px] text-[#06121A] bg-[#25D366] border-0 cursor-pointer"
          onClick={() => {
            const origin = window.location.origin;
            const shareUrl = referralCode
              ? `${origin}/signup?ref=${encodeURIComponent(referralCode)}`
              : `${origin}/`;
            window.open(
              `https://wa.me/?text=${encodeURIComponent(`${msg}\n${shareUrl}`)}`,
              "_blank",
              "noopener,noreferrer",
            );
          }}
        >
          {t(locale, "whatsapp")}
        </button>
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
          <div className="flex flex-wrap gap-2 items-center">
            {!codeSent ? (
              <Button
                disabled={busy}
                className="text-[13px] py-2 px-3"
                onClick={() =>
                  run(async () => {
                    const res = await fetch(`/api/cases/${caseId}/ownership/send`, { method: "POST" });
                    if (!res.ok) throw new Error("send");
                    setCodeSent(true);
                  })
                }
              >
                {busy ? t(locale, "working") : t(locale, "sendCode")}
              </Button>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
        {localOwn && !localAuth && (
          <Button
            disabled={busy}
            className="text-[13px] py-2 px-3 self-start"
            onClick={() =>
              run(async () => {
                const res = await fetch(`/api/cases/${caseId}/authorization`, { method: "POST" });
                if (!res.ok) throw new Error("auth");
                const data = (await res.json()) as {
                  code?: string;
                  mandate?: { jti?: string; token?: string } | null;
                };
                if (data.code) setAuthCode(data.code);
                setMandateInfo(
                  data.mandate?.jti
                    ? `${t(locale, "mandateOk")} · jti ${data.mandate.jti.slice(0, 8)}…`
                    : t(locale, "mandateNone"),
                );
                setLocalAuth(true);
              })
            }
          >
            {busy ? t(locale, "working") : t(locale, "genAuth")}
          </Button>
        )}
        {authCode && (
          <div className="text-[12px] text-emerald font-bold">
            {t(locale, "authCode")}: {authCode}
          </div>
        )}
        {mandateInfo && <div className="text-[12px] text-ink-soft">{mandateInfo}</div>}
        {localOwn && localAuth && (
          <Button
            disabled={busy}
            className="text-[13px] py-2 px-3 self-start"
            onClick={() =>
              run(async () => {
                const res = await fetch(`/api/cases/${caseId}/send`, { method: "POST" });
                if (!res.ok) throw new Error("send");
                scheduleFollowUpReminder(caseId);
              })
            }
          >
            {busy ? t(locale, "working") : t(locale, "send")}
          </Button>
        )}
        {err && <FieldError>{err}</FieldError>}
      </div>
    );
  }

  if (status === "SENT") {
    return (
      <div className="w-full mt-2 flex flex-col gap-3">
        <div className="text-[11px] text-ink-soft">{t(locale, "nextHint")}</div>

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
          <Button
            disabled={busy}
            className="text-[13px] py-2 px-3"
            onClick={() =>
              run(async () => {
                const res = await fetch(`/api/cases/${caseId}/follow-up`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ replyKind, round: 2 }),
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
