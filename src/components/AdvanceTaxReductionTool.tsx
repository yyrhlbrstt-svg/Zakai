"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Card, Button, Input, Textarea } from "@/components/ui";
import { MissingFields } from "@/components/MissingFields";
import {
  ADVANCE_TAX_FORM_URL,
  advanceTaxReductionDeadline,
  daysUntilAdvanceTaxDeadline,
  clampTaxYear,
  taxYearRange,
  canStillFileForYear,
  buildAdvanceTaxReductionLetter,
} from "@/lib/advanceTaxReduction";
import { NextStep } from "@/components/NextStep";

const CURRENT_TAX_YEAR = new Date().getFullYear();

/**
 * For the self-employed: help decide whether an advance-tax reduction
 * request (טופס 2216א׳) is still worth filing this year, and draft the
 * covering letter to the assessing office. No fee, no Case — the requested
 * rate is never computed here, it's the assessing officer's call.
 */
export function AdvanceTaxReductionTool() {
  const t = useTranslations("advanceTaxReduction");
  const router = useRouter();
  const [taxYear, setTaxYear] = useState(CURRENT_TAX_YEAR);
  const [name, setName] = useState("");
  const [taxFileNumber, setTaxFileNumber] = useState("");
  const [reason, setReason] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderAdded, setReminderAdded] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const daysLeft = useMemo(() => daysUntilAdvanceTaxDeadline(taxYear), [taxYear]);
  const stillOpen = useMemo(() => canStillFileForYear(taxYear), [taxYear]);

  const canGenerate = name.trim().length > 0 && taxFileNumber.trim().length > 0 && reason.trim().length > 0;

  function generate() {
    if (!canGenerate) return;
    setLetter(
      buildAdvanceTaxReductionLetter({
        name: name.trim(),
        taxFileNumber: taxFileNumber.trim(),
        taxYear,
        reason: reason.trim(),
      }),
    );
  }

  async function addReminder() {
    setReminderError(null);
    setReminderBusy(true);
    try {
      const res = await fetch("/api/deadlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: t("reminderLabel", { year: taxYear }),
          dueDate: advanceTaxReductionDeadline(taxYear).toISOString(),
          remindDaysBefore: 30,
        }),
      });
      if (res.status === 401) {
        router.replace("/login?return=/advance-tax");
        return;
      }
      if (!res.ok) {
        setReminderError(t("reminderError"));
        return;
      }
      setReminderAdded(true);
      setTimeout(() => setReminderAdded(false), 3000);
    } catch {
      setReminderError(t("reminderError"));
    } finally {
      setReminderBusy(false);
    }
  }

  return (
    <div>
      <Card className="p-6 flex flex-col gap-4">
        <div
          className={`rounded-xl border px-4 py-3 text-[13.5px] ${
            stillOpen
              ? "border-[rgba(63,203,155,0.25)] bg-[rgba(63,203,155,0.06)]"
              : "border-[rgba(240,138,107,0.3)] bg-[rgba(240,138,107,0.08)]"
          }`}
        >
          {stillOpen ? t("windowOpen", { days: daysLeft }) : t("windowClosed")}
        </div>

        {stillOpen && (
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" onClick={addReminder} disabled={reminderBusy}>
              {reminderBusy ? t("reminderAdding") : reminderAdded ? t("reminderAdded") : t("reminderCta")}
            </Button>
            {reminderError && <span className="text-[12.5px] text-amber">{reminderError}</span>}
          </div>
        )}

        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("yearQ")}</span>
          <Input
            type="number"
            value={taxYear}
            min={taxYearRange().min}
            max={taxYearRange().max}
            onChange={(e) => setTaxYear(clampTaxYear(Number(e.target.value)))}
          />
        </label>
        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("nameQ")}</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("fileNumberQ")}</span>
          <Input value={taxFileNumber} onChange={(e) => setTaxFileNumber(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("reasonQ")}</span>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder={t("reasonPlaceholder")}
          />
        </label>

        <MissingFields
          items={[
            { ok: name.trim().length > 0, label: t("nameQ") },
            { ok: taxFileNumber.trim().length > 0, label: t("fileNumberQ") },
            { ok: reason.trim().length > 0, label: t("reasonQ") },
          ]}
        />
        <Button onClick={generate} disabled={!canGenerate}>
          {t("generateCta")}
        </Button>
      </Card>

      {letter && (
        <Card className="mt-5 p-6">
          <textarea
            readOnly
            value={letter}
            rows={14}
            dir="rtl"
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
          </div>
        </Card>
      )}

      {/* The form link used to be a 12.5px green footnote beside the copy
          button, and the three things to do with the letter a line of grey
          under it. Both were correct and both were written as an afterthought
          to the letter, which is not the point — the letter is an attachment
          to a government form, and the form is the thing that gets the money
          back. */}
      {letter && (
        <NextStep
          steps={[t("step1"), t("step2"), t("step3")]}
          action={{ label: t("formLink"), href: ADVANCE_TAX_FORM_URL, external: true }}
        />
      )}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
