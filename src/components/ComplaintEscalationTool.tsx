"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, Button, Input, Select, Textarea } from "@/components/ui";
import { ESCALATION_BODIES, buildEscalationLetter, type ComplaintCategory } from "@/lib/complaintEscalation";
import { MissingFields } from "@/components/MissingFields";
import { NextStep } from "@/components/NextStep";
import { OutcomeReport } from "@/components/OutcomeReport";
import { normalizeOutcomeCounterparty } from "@/lib/strategy/normalizeKeys";

const CATEGORIES: ComplaintCategory[] = ["bank", "telecom", "consumer"];

function isComplaintCategory(v: string | null): v is ComplaintCategory {
  return v === "bank" || v === "telecom" || v === "consumer";
}

/**
 * "I complained and nobody answered" — names the real regulator/public-
 * inquiries unit for the category, and drafts the escalation letter. No
 * money, no Case, no fee: purely informational + a letter the person sends
 * themselves, like contract-check and scam-check.
 *
 * `company`/`category` query params let a stuck case (its follow-up rounds
 * exhausted, see CaseNextStep's exhaustedBanner) arrive here pre-filled —
 * the exact moment this tool is useful is also the moment retyping the
 * provider name is the last thing someone wants to do.
 */
export function ComplaintEscalationTool() {
  const t = useTranslations("complaintEscalation");
  const search = useSearchParams();
  const initialCategory = search.get("category");
  const [category, setCategory] = useState<ComplaintCategory>(
    isComplaintCategory(initialCategory) ? initialCategory : "consumer",
  );
  const [name, setName] = useState("");
  const [company, setCompany] = useState(search.get("company") ?? "");
  const [summary, setSummary] = useState("");
  const [complaintDate, setComplaintDate] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);

  const body = ESCALATION_BODIES[category];

  const canGenerate = company.trim().length > 0 && summary.trim().length > 0;

  const letterPreview = useMemo(() => {
    if (!canGenerate) return "";
    return buildEscalationLetter({
      category,
      name: name.trim() || t("defaultName"),
      company: company.trim(),
      originalComplaintSummary: summary.trim(),
      originalComplaintDate: complaintDate.trim() || undefined,
    });
  }, [canGenerate, category, name, company, summary, complaintDate, t]);

  function generate() {
    if (!canGenerate) return;
    setLetter(letterPreview);
  }

  return (
    <div>
      <Card className="p-6 flex flex-col gap-4">
        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("categoryQ")}</span>
          <Select value={category} onChange={(e) => setCategory(e.target.value as ComplaintCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </Select>
        </label>

        <div className="rounded-xl border border-[rgba(63,203,155,0.25)] bg-[rgba(63,203,155,0.06)] p-4">
          <div className="font-extrabold text-[14px]">{t(`bodies.${category}.name`)}</div>
          <p className="text-ink-soft text-body mt-1.5 leading-relaxed mb-0">
            {t(`bodies.${category}.description`)}
          </p>
          {body.url && (
            <a
              href={body.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald text-[12.5px] font-bold mt-2 inline-block"
            >
              {body.url} →
            </a>
          )}
        </div>

        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("nameQ")}</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("companyQ")}</span>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("dateQ")}</span>
          <Input value={complaintDate} onChange={(e) => setComplaintDate(e.target.value)} placeholder="DD/MM/YYYY" />
        </label>
        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("summaryQ")}</span>
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} />
        </label>

        <MissingFields
          items={[
            { ok: company.trim().length > 0, label: t("companyQ") },
            { ok: summary.trim().length > 0, label: t("summaryQ") },
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
            <span className="text-[12px] text-ink-soft">{t("sendHint")}</span>
          </div>
          <OutcomeReport
            vertical="complaint_escalation"
            counterparty={normalizeOutcomeCounterparty(`${category}_${company}`)}
            variantId="standard"
          />
        </Card>
      )}

      {/* The regulator's name and address sit at the top of the page, chosen
          before the letter is written. Nothing repeated them at the end, where
          somebody is holding the letter and asking who to send it to. */}
      {letter && (
        <NextStep
          steps={[
            t("step1", { body: t(`bodies.${category}.name`) }),
            t("step2"),
            t("step3"),
          ]}
          action={
            body.url
              ? { label: t("openBody", { body: t(`bodies.${category}.name`) }), href: body.url, external: true }
              : undefined
          }
          note={body.url ? undefined : t("noLinkNote")}
        />
      )}

      <p className="mt-5 text-micro text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
