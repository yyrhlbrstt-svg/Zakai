"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Card, Button, Input } from "@/components/ui";
import { OutcomeReport } from "@/components/OutcomeReport";
import {
  assessLatePayment,
  buildLatePaymentDemandLetter,
  DEFAULT_PAYMENT_TERM_DAYS,
} from "@/lib/latePaymentClaim";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";

/**
 * Late-invoice demand letter for a freelancer/small supplier — the one tool
 * in this app aimed at a business's own receivables rather than a consumer
 * bill. Pure client-side, same posture as every other calculator here, plus
 * an optional full-service path: give the client's email and let the Mandate
 * agent send + track the collection (fee only on documented payment).
 */
export function LatePaymentClaim({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("latePayment");
  const router = useRouter();
  const [invoiceDate, setInvoiceDate] = useState("");
  const [agreedTermDays, setAgreedTermDays] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState(5000);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  const status = useMemo(() => {
    if (!invoiceDate) return null;
    const parsedTerm = agreedTermDays.trim() ? Number(agreedTermDays) : undefined;
    return assessLatePayment({
      invoiceDate,
      agreedTermDays: parsedTerm && parsedTerm > 0 ? parsedTerm : undefined,
    });
  }, [invoiceDate, agreedTermDays]);

  const money = (a: number) => formatAgorot(a, bcp47);

  function generateLetter() {
    if (!status) return;
    setLetter(
      buildLatePaymentDemandLetter({
        supplierName: supplierName.trim() || t("defaultSupplier"),
        clientName: clientName.trim() || t("defaultClient"),
        invoiceNumber: invoiceNumber.trim() || "—",
        invoiceAmountAgorot: shekelsToAgorot(invoiceAmount),
        status,
      }),
    );
  }

  const canSendWithAgent = !!status?.isLate && clientName.trim().length > 0 && clientEmail.trim().length > 0;

  async function sendWithAgent() {
    if (!canSendWithAgent) return;
    setAgentError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/late-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: supplierName.trim(),
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          invoiceNumber: invoiceNumber.trim(),
          invoiceDate,
          agreedTermDays: agreedTermDays.trim() ? Number(agreedTermDays) : undefined,
          invoiceAmountShekels: invoiceAmount,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/late-payment`);
        return;
      }
      if (!res.ok) {
        setAgentError(
          data.error === "caseLimit"
            ? t("caseLimitError")
            : data.error === "notLateYet"
              ? t("notLateYetError")
              : t("genericError"),
        );
        return;
      }
      setCaseId(data.caseId);
    } catch {
      setAgentError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Card className="p-6 flex flex-col gap-4">
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("invoiceDateQ")}</span>
          <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </label>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">{t("amountQ")}</span>
            <span className="font-display text-[15px]">{money(shekelsToAgorot(invoiceAmount))}</span>
          </div>
          <input
            type="range"
            min={100}
            max={100000}
            step={100}
            value={invoiceAmount}
            onChange={(e) => setInvoiceAmount(Number(e.target.value))}
            aria-label={t("amountQ")}
          />
        </label>

        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("termQ")}</span>
          <Input
            type="number"
            min={1}
            placeholder={String(DEFAULT_PAYMENT_TERM_DAYS)}
            value={agreedTermDays}
            onChange={(e) => setAgreedTermDays(e.target.value)}
          />
        </label>
      </Card>

      {status && (
        <Card className="mt-5 p-6 text-center">
          <div className="text-[13px] text-ink-soft font-bold">
            {status.isLate ? t("statusLate") : t("statusNotYet")}
          </div>
          <div className="font-display grad-text text-4xl mt-1.5" aria-live="polite">
            {status.isLate
              ? t("daysLate", { count: status.daysLate })
              : status.dueDate.toLocaleDateString("he-IL")}
          </div>
          {status.interestApplies && (
            <p className="text-[12px] text-ink-soft mt-3 leading-relaxed">{t("interestNote")}</p>
          )}
        </Card>
      )}

      <Card className="mt-5 p-6 flex flex-col gap-3">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("supplierQ")}</span>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("clientQ")}</span>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("clientEmailQ")}</span>
            <Input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("invoiceNumberQ")}</span>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={sendWithAgent} disabled={!canSendWithAgent || busy}>
            {busy ? t("agentBusy") : t("agentSendCta")}
          </Button>
          <Button variant="ghost" onClick={generateLetter} disabled={!status}>
            {t("generateCta")}
          </Button>
        </div>
        {!status?.isLate && clientName.trim() && clientEmail.trim() && (
          <p className="text-[12px] text-ink-soft">{t("agentNeedsLate")}</p>
        )}
        {agentError && <p className="text-[13px] text-amber">{agentError}</p>}
      </Card>

      {caseId && (
        <Card className="mt-5 p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
          <div className="text-emerald font-extrabold text-[15px]">{t("caseOpenedTitle")}</div>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">
            {t("caseOpenedBody")}
          </p>
          <Link href="/dashboard">
            <Button className="w-full">{t("goToDashboard")}</Button>
          </Link>
        </Card>
      )}

      {letter && (
        <Card className="mt-5 p-6">
          <textarea
            readOnly
            value={letter}
            rows={14}
            dir="rtl"
            className="w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.05)] text-[13px] leading-relaxed text-ink outline-none box-border"
          />
          <div className="flex gap-3 mt-3 flex-wrap items-center">
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(letter);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* selectable */
                }
              }}
            >
              {copied ? t("copied") : t("copy")}
            </Button>
            <span className="text-[12px] text-ink-soft">{t("sendHint")}</span>
          </div>
          <OutcomeReport vertical="late_payment" counterparty="client" variantId="standard" />
        </Card>
      )}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
