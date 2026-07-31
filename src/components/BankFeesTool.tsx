"use client";

import { useState } from "react";
import { useLocale , useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Card, Button, Input, Select } from "@/components/ui";
import { buildBankFeeLetter, type BankFeeKind } from "@/lib/bankFeeLetter";

const KINDS: { value: BankFeeKind; he: string; en: string }[] = [
  { value: "account_mgmt", he: "ניהול חשבון / פעולות", en: "Account / activity fee" },
  { value: "atm", he: "כספומט / משיכה", en: "ATM / cash withdrawal" },
  { value: "foreign_fx", he: "המרה / חו״ל", en: "FX / foreign transaction" },
  { value: "check", he: "שיק", en: "Check fee" },
  { value: "rejected", he: "החזרת הוראה", en: "Rejected order / NSF" },
  { value: "other", he: "אחר", en: "Other" },
];

export function BankFeesTool() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const tIcomponents_BankFeesTool = useTranslations("inline_components_BankFeesTool");
  const router = useRouter();

  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [accountLast4, setAccountLast4] = useState("");
  const [feeKind, setFeeKind] = useState<BankFeeKind>("account_mgmt");
  const [feeDescription, setFeeDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [chargeDate, setChargeDate] = useState("");
  const [out, setOut] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/bank-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          bank,
          accountLast4: accountLast4 || undefined,
          feeKind,
          feeDescription: feeDescription || undefined,
          amountShekels: amount ? Number(amount) : undefined,
          chargeDate: chargeDate || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/bank-fees`);
        return;
      }
      if (!res.ok) {
        setError(
          data.error === "caseLimit"
            ? he
              ? "הגעת למגבלת התיקים. שדרג או סגור תיק קיים."
              : "Case limit reached."
            : he
              ? "משהו השתבש. נסה שוב."
              : "Something went wrong.",
        );
        return;
      }
      setOut({ subject: data.subject, body: data.body });
      setCaseId(data.caseId);
    } catch {
      setError(he ? "משהו השתבש. נסה שוב." : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 flex flex-col gap-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tIcomponents_BankFeesTool("t_ebd6b437")} />
        <Input
          value={bank}
          onChange={(e) => setBank(e.target.value)}
          placeholder={tIcomponents_BankFeesTool("t_e5cbb043")}
        />
        <Input
          value={accountLast4}
          onChange={(e) => setAccountLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder={tIcomponents_BankFeesTool("t_832f0010")}
        />
        <Select value={feeKind} onChange={(e) => setFeeKind(e.target.value as BankFeeKind)}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {he ? k.he : k.en}
            </option>
          ))}
        </Select>
        <Input
          value={feeDescription}
          onChange={(e) => setFeeDescription(e.target.value)}
          placeholder={tIcomponents_BankFeesTool("t_b3bac430")}
        />
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={tIcomponents_BankFeesTool("t_71dfcc71")}
        />
        <Input
          value={chargeDate}
          onChange={(e) => setChargeDate(e.target.value)}
          placeholder={tIcomponents_BankFeesTool("t_7f6ed090")}
        />

        <div className="flex flex-col gap-2 mt-1">
          <Button onClick={sendWithAgent} disabled={!bank.trim() || busy} className="w-full">
            {busy
              ? he
                ? "הסוכן פותח תיק…"
                : "Agent opening case…"
              : he
                ? "הסוכן שולח ומעקוב עכשיו"
                : "Agent sends & tracks now"}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-[13px]"
            disabled={!bank.trim() || busy}
            onClick={() =>
              setOut(
                buildBankFeeLetter({
                  customerName: name,
                  bank,
                  accountLast4: accountLast4 || undefined,
                  feeKind,
                  feeDescription: feeDescription || undefined,
                  amountShekels: amount ? Number(amount) : undefined,
                  chargeDate: chargeDate || undefined,
                }),
              )
            }
          >
            {tIcomponents_BankFeesTool("t_b4c9b341")}
          </Button>
        </div>
        {error && <p className="text-[13px] text-amber mt-1 mb-0">{error}</p>}
      </Card>

      {caseId && (
        <Card className="p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
          <div className="text-emerald font-extrabold text-[15px]">
            {tIcomponents_BankFeesTool("t_360e126e")}
          </div>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">
            {tIcomponents_BankFeesTool("t_5a0296a5")}
          </p>
          <Link href="/dashboard">
            <Button className="w-full">
              {tIcomponents_BankFeesTool("t_8ae29d51")}
            </Button>
          </Link>
        </Card>
      )}

      {out && (
        <Card className="p-5">
          <div className="font-extrabold">{out.subject}</div>
          <pre className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed bg-[#060b12] rounded-xl p-4 border border-[rgba(255,255,255,0.08)]">
            {out.body}
          </pre>
          <Button
            className="mt-3"
            variant="ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${out.subject}\n\n${out.body}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* ignore */
              }
            }}
          >
            {copied ? (he ? "הועתק" : "Copied") : he ? "העתק" : "Copy"}
          </Button>
        </Card>
      )}
    </div>
  );
}
