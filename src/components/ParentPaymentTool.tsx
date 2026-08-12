"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button, Input, Select, Textarea } from "@/components/ui";
import { ShareResult } from "@/components/ShareResult";
import {
  MANDATORY_PAYMENT_CIRCULAR_URL,
  isMandatoryPayment,
  buildParentPaymentLetter,
  type ParentPaymentCategory,
} from "@/lib/parentPayments";
import { MissingFields } from "@/components/MissingFields";

const CATEGORIES: ParentPaymentCategory[] = ["accident_insurance", "other"];

/**
 * "The kindergarten asked for money — is it mandatory?" Only accident
 * insurance ever is; everything else is a voluntary payment requiring real
 * consent. No fee, no Case — a fact check plus a letter the parent sends
 * themselves, same shape as complaint-escalation.
 */
export function ParentPaymentTool() {
  const t = useTranslations("parentPayments");
  const tShare = useTranslations("share");
  const [category, setCategory] = useState<ParentPaymentCategory>("other");
  const [parentName, setParentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [reason, setReason] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);

  const mandatory = isMandatoryPayment(category);
  const amount = Number(chargeAmount) || 0;

  const canGenerate =
    !mandatory &&
    parentName.trim().length > 0 &&
    studentName.trim().length > 0 &&
    institutionName.trim().length > 0 &&
    chargeDescription.trim().length > 0 &&
    amount > 0 &&
    reason.trim().length > 0;

  const letterPreview = useMemo(() => {
    if (!canGenerate) return "";
    return buildParentPaymentLetter({
      parentName: parentName.trim(),
      studentName: studentName.trim(),
      institutionName: institutionName.trim(),
      chargeDescription: chargeDescription.trim(),
      chargeAmountShekels: amount,
      reason: reason.trim(),
    });
  }, [canGenerate, parentName, studentName, institutionName, chargeDescription, amount, reason]);

  function generate() {
    if (!canGenerate) return;
    setLetter(letterPreview);
  }

  return (
    <div>
      <Card className="p-6 flex flex-col gap-4">
        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("categoryQ")}</span>
          <Select value={category} onChange={(e) => setCategory(e.target.value as ParentPaymentCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </Select>
        </label>

        <div
          className={`rounded-xl border px-4 py-3 text-[13.5px] ${
            mandatory
              ? "border-[rgba(240,138,107,0.3)] bg-[rgba(240,138,107,0.08)]"
              : "border-[rgba(63,203,155,0.25)] bg-[rgba(63,203,155,0.06)]"
          }`}
        >
          {mandatory ? t("isMandatory") : t("isVoluntary")}
          {mandatory && (
            <a
              href={MANDATORY_PAYMENT_CIRCULAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald text-[12.5px] font-bold mt-2 block"
            >
              {t("circularLink")} →
            </a>
          )}
        </div>

        {!mandatory && (
          <>
            <label className="block">
              <span className="text-body text-ink-soft block mb-1.5">{t("parentNameQ")}</span>
              <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-body text-ink-soft block mb-1.5">{t("studentNameQ")}</span>
              <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-body text-ink-soft block mb-1.5">{t("institutionQ")}</span>
              <Input value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-body text-ink-soft block mb-1.5">{t("chargeQ")}</span>
              <Input value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-body text-ink-soft block mb-1.5">{t("amountQ")}</span>
              <Input type="number" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-body text-ink-soft block mb-1.5">{t("reasonQ")}</span>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={t("reasonPlaceholder")}
              />
            </label>

            <MissingFields
              items={[
                { ok: parentName.trim().length > 0, label: t("parentNameQ") },
                { ok: studentName.trim().length > 0, label: t("studentNameQ") },
                { ok: institutionName.trim().length > 0, label: t("institutionQ") },
                { ok: chargeDescription.trim().length > 0, label: t("chargeQ") },
                { ok: amount > 0, label: t("amountQ") },
                { ok: reason.trim().length > 0, label: t("reasonQ") },
              ]}
            />
            <Button onClick={generate} disabled={!canGenerate}>
              {t("generateCta")}
            </Button>
          </>
        )}
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
            <span className="text-[12px] text-ink-soft">{t("sendHint")}</span>
          </div>
        </Card>
      )}

      {letter && <ShareResult message={tShare("msgSchoolPayment")} path="/school-payments" />}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
