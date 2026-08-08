"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { Button, Input, FieldError } from "@/components/ui";

/**
 * The gap between "they said yes" and money.
 *
 * A case that reaches agreement had two possible endings before this and both
 * were wrong: settle it — writing a proof and a chargeable fee for money that
 * has not moved — or leave it, and let the promise be forgotten. This is the
 * third ending: hold the promise, without claiming it.
 *
 * The panel deliberately never says the credit arrived. It records what the
 * counterparty committed to, tells the person when it is time to check a
 * statement, and takes what they found — including nothing, which is the
 * finding the whole thing exists to capture.
 */

const COPY = {
  he: {
    title: "הבטיחו לך זיכוי?",
    sub: "נשמור על ההתחייבות עד שהכסף באמת יופיע בחשבון. לא נרשם חיסכון ולא נגבית עמלה עד אז.",
    amount: "סכום שהובטח (₪)",
    dueBy: "עד מתי אמרו שיופיע (לא חובה)",
    note: "מאיפה ההתחייבות? מספר אסמכתה, שם נציג, תאריך שיחה (לא חובה)",
    save: "שמור את ההתחייבות",
    saving: "שומר…",
    openTitle: "התחייבות פתוחה",
    promisedOn: "הובטח בתאריך",
    dueLabel: "אמורים לזכות עד",
    notYet: "עוד לא הגיע הזמן לבדוק — נזכיר לך.",
    timeToCheck: "הגיע הזמן לבדוק את דף החשבון.",
    checkQ: "כמה זוכה בפועל? (0 אם כלום)",
    checkCta: "רשום מה נמצא",
    checking: "בודק…",
    arrived: "הזיכוי הגיע במלואו.",
    partial: "הגיע רק חלק. עדיין חייבים לך",
    missing: "לא הגיע כלום. עדיין חייבים לך",
    pending: "עדיין בתוך הזמן שהם נתנו.",
    nextChase: "צור מכתב שמחזיק אותם להתחייבות",
    nextSettle: "הכסף הגיע — רשום את הסכום בטופס החיסכון למעלה",
    errAmount: "צריך סכום גדול מאפס",
    errGeneric: "משהו השתבש. נסה שוב.",
    errAlready: "כבר נרשמה התחייבות על התיק הזה",
  },
  en: {
    title: "Did they promise you a credit?",
    sub: "We'll hold them to it until the money actually shows up. No saving is recorded and no fee is charged until then.",
    amount: "Amount promised (₪)",
    dueBy: "By when they said it would appear (optional)",
    note: "Where did the promise come from? Reference number, agent name, call date (optional)",
    save: "Save the promise",
    saving: "Saving…",
    openTitle: "Open promise",
    promisedOn: "Promised on",
    dueLabel: "Due to be credited by",
    notYet: "Not time to check yet — we'll remind you.",
    timeToCheck: "Time to check your statement.",
    checkQ: "How much was actually credited? (0 if nothing)",
    checkCta: "Record what you found",
    checking: "Checking…",
    arrived: "The credit arrived in full.",
    partial: "Only part arrived. They still owe you",
    missing: "Nothing arrived. They still owe you",
    pending: "Still within the time they gave.",
    nextChase: "Draft a letter holding them to it",
    nextSettle: "The money arrived — record the amount in the saving form above",
    errAmount: "Amount must be more than zero",
    errGeneric: "Something went wrong. Try again.",
    errAlready: "A promise is already recorded on this case",
  },
} as const;

export interface OpenPromise {
  promisedShekels: number;
  promisedAt: string;
  dueBy: string | null;
  observedShekels: number | null;
  dueForCheck: boolean;
  state: "arrived" | "partial" | "missing" | "pending" | null;
  shortfallShekels: number | null;
}

export function PromisedCreditPanel({
  caseId,
  locale,
  promise,
  onWantsChaseLetter,
}: {
  caseId: string;
  locale: string;
  promise: OpenPromise | null;
  /** Selects the broken-promise reply kind in the follow-up form above. */
  onWantsChaseLetter?: () => void;
}) {
  const router = useRouter();
  const rtl = locale === "he" || locale === "ar";
  const c = rtl ? COPY.he : COPY.en;

  const [amount, setAmount] = useState("");
  const [dueBy, setDueBy] = useState("");
  const [note, setNote] = useState("");
  const [observed, setObserved] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function recordPromise() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setErr(c.errAmount);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/cases/${caseId}/promised-credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promisedShekels: value,
          dueBy: dueBy || undefined,
          evidenceNote: note || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error === "ALREADY_PROMISED" ? c.errAlready : c.errGeneric);
        return;
      }
      router.refresh();
    } catch {
      setErr(c.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function recordCheck() {
    const value = Number(observed);
    // Zero is the whole point of this field, so it is validated as a number
    // rather than as a truthy value.
    if (!Number.isFinite(value) || value < 0) {
      setErr(c.errAmount);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/cases/${caseId}/promised-credit/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observedShekels: value }),
      });
      if (!res.ok) {
        setErr(c.errGeneric);
        return;
      }
      router.refresh();
    } catch {
      setErr(c.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  const shell =
    "w-full rounded-xl border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.07)] p-3.5 flex flex-col gap-2.5";

  if (!promise) {
    return (
      <div className={shell}>
        <div className="text-body font-extrabold">{c.title}</div>
        <div className="text-micro opacity-80 leading-relaxed">{c.sub}</div>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={c.amount}
          aria-label={c.amount}
        />
        <Input
          type="date"
          value={dueBy}
          onChange={(e) => setDueBy(e.target.value)}
          aria-label={c.dueBy}
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={c.note}
          aria-label={c.note}
          maxLength={500}
        />
        {err && <FieldError>{err}</FieldError>}
        <Button disabled={busy} onClick={recordPromise} className="w-full sm:w-auto">
          {busy ? c.saving : c.save}
        </Button>
      </div>
    );
  }

  const promisedOn = promise.promisedAt.slice(0, 10);
  const due = promise.dueBy?.slice(0, 10) ?? null;

  return (
    <div className={shell}>
      <div className="text-body font-extrabold">{c.openTitle}: ₪{promise.promisedShekels}</div>
      <div className="text-micro opacity-80">
        {c.promisedOn} {promisedOn}
        {due ? ` · ${c.dueLabel} ${due}` : ""}
      </div>

      {promise.state === null && (
        <>
          <div className="text-micro font-bold">
            {promise.dueForCheck ? c.timeToCheck : c.notYet}
          </div>
          {promise.dueForCheck && (
            <>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={observed}
                onChange={(e) => setObserved(e.target.value)}
                placeholder={c.checkQ}
                aria-label={c.checkQ}
              />
              {err && <FieldError>{err}</FieldError>}
              <Button disabled={busy} onClick={recordCheck} className="w-full sm:w-auto">
                {busy ? c.checking : c.checkCta}
              </Button>
            </>
          )}
        </>
      )}

      {promise.state === "arrived" && (
        <>
          <div className="text-micro font-bold text-emerald">{c.arrived}</div>
          <div className="text-micro opacity-80">{c.nextSettle}</div>
        </>
      )}

      {(promise.state === "missing" || promise.state === "partial") && (
        <>
          <div className="text-micro font-bold text-[#f08a6b]">
            {promise.state === "partial" ? c.partial : c.missing} ₪{promise.shortfallShekels}
          </div>
          {onWantsChaseLetter && (
            <Button onClick={onWantsChaseLetter} className="w-full sm:w-auto">
              {c.nextChase}
            </Button>
          )}
        </>
      )}

      {promise.state === "pending" && <div className="text-micro opacity-80">{c.pending}</div>}
    </div>
  );
}
