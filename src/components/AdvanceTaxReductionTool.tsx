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
  canStillFileForYear,
  buildAdvanceTaxReductionLetter,
} from "@/lib/advanceTaxReduction";

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
            onChange={(e) => setTaxYear(Number(e.target.value) || CURRENT_TAX_YEAR)}
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
            <a
              href={ADVANCE_TAX_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald text-[12.5px] font-bold"
            >
              {t("formLink")} →
            </a>
          </div>
          <p className="text-[12px] text-ink-soft mt-3 mb-0">{t("sendHint")}</p>
        </Card>
      )}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
