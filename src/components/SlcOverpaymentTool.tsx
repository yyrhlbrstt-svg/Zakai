"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button, Input, Textarea } from "@/components/ui";
import { buildSlcOverpaymentLetter } from "@/lib/slcOverpaymentLetter";
import { MissingFields } from "@/components/MissingFields";

export function SlcOverpaymentTool() {
  const t = useTranslations("studentLoanOverpayment.tool");
  const [name, setName] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [accountDetails, setAccountDetails] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);

  const canGenerate = accountDetails.trim().length > 0;

  const letterPreview = useMemo(() => {
    if (!canGenerate) return "";
    return buildSlcOverpaymentLetter({
      customerName: name,
      customerReference,
      accountDetails,
    }).body;
  }, [canGenerate, name, customerReference, accountDetails]);

  return (
    <div className="mt-8">
      <h2 className="font-display text-2xl mb-2">{t("title")}</h2>
      <p className="text-ink-soft text-[14px] mb-5 leading-relaxed">{t("sub")}</p>
      <Card className="p-6 flex flex-col gap-4">
        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("nameQ")}</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("referenceQ")}</span>
          <Input value={customerReference} onChange={(e) => setCustomerReference(e.target.value)} maxLength={60} />
        </label>
        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("detailsQ")}</span>
          <Textarea value={accountDetails} onChange={(e) => setAccountDetails(e.target.value)} rows={3} maxLength={500} />
        </label>
        <MissingFields items={[{ ok: accountDetails.trim().length > 0, label: t("detailsQ") }]} />
        <Button onClick={() => setLetter(letterPreview)} disabled={!canGenerate}>
          {t("generateCta")}
        </Button>
      </Card>

      {letter && (
        <Card className="mt-5 p-6">
          <textarea
            readOnly
            value={letter}
            rows={14}
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.05)] text-body leading-relaxed text-ink box-border"
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
        </Card>
      )}
    </div>
  );
}
