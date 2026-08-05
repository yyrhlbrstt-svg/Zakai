"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button, Input, Textarea } from "@/components/ui";
import { buildFdcpaValidationLetter } from "@/lib/fdcpaValidationLetter";

export function FdcpaValidationTool() {
  const t = useTranslations("debtCollectorDispute.tool");
  const [name, setName] = useState("");
  const [collectorName, setCollectorName] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [details, setDetails] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);

  const canGenerate = collectorName.trim().length > 0;

  const letterPreview = useMemo(() => {
    if (!canGenerate) return "";
    return buildFdcpaValidationLetter({
      customerName: name,
      collectorName,
      referenceNumber,
      details,
    }).body;
  }, [canGenerate, name, collectorName, referenceNumber, details]);

  return (
    <div className="mt-8">
      <h2 className="font-display text-2xl mb-2">{t("title")}</h2>
      <p className="text-ink-soft text-[14px] mb-5 leading-relaxed">{t("sub")}</p>
      <Card className="p-6 flex flex-col gap-4">
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("nameQ")}</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("collectorQ")}</span>
          <Input value={collectorName} onChange={(e) => setCollectorName(e.target.value)} maxLength={120} />
        </label>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("referenceQ")}</span>
          <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} maxLength={60} />
        </label>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("detailsQ")}</span>
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={500} />
        </label>
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
        </Card>
      )}
    </div>
  );
}
