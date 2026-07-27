"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { Button, Input, FieldError } from "@/components/ui";

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
}

const copy: Record<string, Record<string, string>> = {
  he: {
    approve: "אשר והמשך",
    sendCode: "שלח קוד לנייד",
    codePh: "קוד מ-6 ספרות",
    verifyCode: "אמת",
    genAuth: "צור הרשאה",
    send: "שלח לספק",
    newAmt: "סכום חדש אחרי התשובה (₪)",
    record: "רשום חיסכון",
    noChange: "לא השתנה",
    working: "רגע…",
    done: "עודכן",
    err: "משהו השתבש. נסה שוב.",
    nextHint: "השלב הבא",
  },
  en: {
    approve: "Approve & continue",
    sendCode: "Send SMS code",
    codePh: "6-digit code",
    verifyCode: "Verify",
    genAuth: "Create authorization",
    send: "Send to provider",
    newAmt: "New amount after reply (₪)",
    record: "Record saving",
    noChange: "No change",
    working: "One moment…",
    done: "Updated",
    err: "Something went wrong. Try again.",
    nextHint: "Next step",
  },
  ar: {
    approve: "موافق ومتابعة",
    sendCode: "أرسل رمز SMS",
    codePh: "رمز من 6 أرقام",
    verifyCode: "تحقق",
    genAuth: "إنشاء تفويض",
    send: "أرسل للمزوّد",
    newAmt: "المبلغ الجديد (₪)",
    record: "سجّل التوفير",
    noChange: "بدون تغيير",
    working: "لحظة…",
    done: "تم",
    err: "حدث خطأ. حاول مجدداً.",
    nextHint: "الخطوة التالية",
  },
  ru: {
    approve: "Подтвердить и продолжить",
    sendCode: "Отправить SMS-код",
    codePh: "Код из 6 цифр",
    verifyCode: "Проверить",
    genAuth: "Создать доверенность",
    send: "Отправить провайдеру",
    newAmt: "Новая сумма (₪)",
    record: "Записать экономию",
    noChange: "Без изменений",
    working: "Секунду…",
    done: "Готово",
    err: "Ошибка. Попробуйте ещё раз.",
    nextHint: "Следующий шаг",
  },
};

function t(locale: string, key: string): string {
  const table = copy[locale] || copy.he;
  return table[key] || copy.he[key] || key;
}

/**
 * In-dashboard continuation of a case so users never hit a dead-end status badge.
 * Success fee is only created when a real saving is recorded later.
 */
export function CaseNextStep({
  caseId,
  status,
  ownershipVerified,
  hasAuthorization,
  amountOriginalShekels,
}: Props) {
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [newAmt, setNewAmt] = useState("");
  const [localOwn, setLocalOwn] = useState(ownershipVerified);
  const [localAuth, setLocalAuth] = useState(hasAuthorization);

  if (status === "SAVED" || status === "NO_SAVING" || status === "REVOKED") {
    return null;
  }

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
                    const res = await fetch(`/api/cases/${caseId}/ownership/send`, {
                      method: "POST",
                    });
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
                const res = await fetch(`/api/cases/${caseId}/authorization`, {
                  method: "POST",
                });
                if (!res.ok) throw new Error("auth");
                setLocalAuth(true);
              })
            }
          >
            {busy ? t(locale, "working") : t(locale, "genAuth")}
          </Button>
        )}
        {localOwn && localAuth && (
          <Button
            disabled={busy}
            className="text-[13px] py-2 px-3 self-start"
            onClick={() =>
              run(async () => {
                const res = await fetch(`/api/cases/${caseId}/send`, { method: "POST" });
                if (!res.ok) throw new Error("send");
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
      <div className="w-full mt-2 flex flex-col gap-2">
        <div className="text-[11px] text-ink-soft">{t(locale, "nextHint")}</div>
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
