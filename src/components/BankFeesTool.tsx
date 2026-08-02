"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Card, Button, Input, Select } from "@/components/ui";
import { buildBankFeeLetter, type BankFeeKind } from "@/lib/bankFeeLetter";
import {
  IL_BANK_OPTIONS,
  type BankProviderKey,
  bankOptionLabel,
  feeKindLabel,
  BANK_FEE_KINDS,
} from "@/lib/normalizeBankProvider";
import { withFooter } from "@/lib/letterFooter";

export function BankFeesTool() {
  const locale = useLocale();
  const footerLocale = locale === "he" || locale === "ar" ? "he" : "en";
  const t = useTranslations("inline_components_BankFeesTool");
  const router = useRouter();

  const [name, setName] = useState("");
  const [bankKey, setBankKey] = useState<BankProviderKey>("leumi");
  const [bankCustom, setBankCustom] = useState("");
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

  const bankLabel =
    bankKey === "other" ? bankCustom.trim() : bankOptionLabel(bankKey, locale);
  const bankReady = bankKey !== "other" ? true : bankCustom.trim().length > 1;

  function letterInput() {
    return {
      customerName: name,
      bank: bankLabel || bankOptionLabel("leumi", locale),
      accountLast4: accountLast4 || undefined,
      feeKind,
      feeDescription: feeDescription || undefined,
      amountShekels: amount ? Number(amount) : undefined,
      chargeDate: chargeDate || undefined,
    };
  }

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/bank-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          bankKey,
          bank: bankLabel,
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
        setError(res.status === 403 && data.error === "caseLimit" ? t("errorCaseLimit") : t("errorGeneric"));
        return;
      }
      const letter = buildBankFeeLetter(letterInput());
      setOut({
        subject: letter.subject,
        body: withFooter(letter.body, footerLocale),
      });
      setCaseId(data.caseId);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 flex flex-col gap-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("t_ebd6b437")} />
        <label className="text-[12px] text-ink-soft font-bold">{t("bankLabel")}</label>
        <Select value={bankKey} onChange={(e) => setBankKey(e.target.value as BankProviderKey)}>
          {IL_BANK_OPTIONS.map((b) => (
            <option key={b.key} value={b.key}>
              {bankOptionLabel(b.key, locale)}
            </option>
          ))}
        </Select>
        {bankKey === "other" && (
          <Input
            value={bankCustom}
            onChange={(e) => setBankCustom(e.target.value)}
            placeholder={t("t_e5cbb043")}
          />
        )}
        <Input
          value={accountLast4}
          onChange={(e) => setAccountLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder={t("t_832f0010")}
        />
        <Select value={feeKind} onChange={(e) => setFeeKind(e.target.value as BankFeeKind)}>
          {BANK_FEE_KINDS.map((k) => (
            <option key={k} value={k}>
              {feeKindLabel(k, locale)}
            </option>
          ))}
        </Select>
        <Input
          value={feeDescription}
          onChange={(e) => setFeeDescription(e.target.value)}
          placeholder={t("t_b3bac430")}
        />
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("t_71dfcc71")}
        />
        <Input
          value={chargeDate}
          onChange={(e) => setChargeDate(e.target.value)}
          placeholder={t("t_7f6ed090")}
        />

        <div className="flex flex-col gap-2 mt-1">
          <Button onClick={sendWithAgent} disabled={!bankReady || busy} className="w-full">
            {busy ? t("agentOpening") : t("agentSend")}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-[13px]"
            disabled={!bankReady || busy}
            onClick={() => {
              const letter = buildBankFeeLetter(letterInput());
              setOut({
                subject: letter.subject,
                body: withFooter(letter.body, footerLocale),
              });
            }}
          >
            {t("t_b4c9b341")}
          </Button>
        </div>
        {error && <p className="text-[13px] text-amber mt-1 mb-0">{error}</p>}
      </Card>

      {caseId && (
        <Card className="p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
          <div className="text-emerald font-extrabold text-[15px]">{t("t_360e126e")}</div>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">{t("t_5a0296a5")}</p>
          <Link href={`/dashboard?case=${caseId}`}>
            <Button className="w-full">{t("t_8ae29d51")}</Button>
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
            {copied ? t("copied") : t("copy")}
          </Button>
        </Card>
      )}
    </div>
  );
}
