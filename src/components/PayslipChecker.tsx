"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Input } from "@/components/ui";
import { auditPayslip, type Finding, type FindingStatus } from "@/lib/payslip";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";

/**
 * Payslip audit — pure client-side (nothing leaves the browser), same pattern
 * as the electricity / miluim / flights checkers. Live-computes the three
 * common shortfalls as the user fills the fields.
 */
export function PayslipChecker({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("payslip");
  const [fullTime, setFullTime] = useState(true);
  const [scopePct, setScopePct] = useState(100);
  const [base, setBase] = useState(""); // ₪ base salary
  const [pensionShown, setPensionShown] = useState(true);
  const [employerPension, setEmployerPension] = useState(""); // ₪
  const [seniority, setSeniority] = useState(2);
  const [havraaPaid, setHavraaPaid] = useState(true);
  const [havraaAmount, setHavraaAmount] = useState(""); // ₪

  const baseNum = Number(base) || 0;
  const scope = fullTime ? 1 : Math.min(1, Math.max(0, scopePct / 100));

  const audit = useMemo(
    () =>
      auditPayslip({
        scope,
        monthlyBaseAgorot: shekelsToAgorot(baseNum),
        pensionShown,
        employerPensionAgorot: shekelsToAgorot(Number(employerPension) || 0),
        seniorityYears: seniority,
        havraaPaid,
        havraaPaidAgorot: shekelsToAgorot(Number(havraaAmount) || 0),
      }),
    [scope, baseNum, pensionShown, employerPension, seniority, havraaPaid, havraaAmount],
  );

  const money = (a: number) => formatAgorot(a, bcp47);
  const ready = baseNum > 0;

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-[13px] font-bold cursor-pointer border transition-colors duration-200 ${
      active
        ? "bg-[rgba(63,203,155,0.14)] border-[rgba(63,203,155,0.5)] text-emerald"
        : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(255,255,255,0.2)]"
    }`;

  return (
    <div>
      <Card className="p-6 flex flex-col gap-5">
        {/* Scope */}
        <div>
          <span className="text-[13.5px] text-ink-soft block mb-2">{t("scopeQ")}</span>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("scopeQ")}>
            <button type="button" role="radio" aria-checked={fullTime} onClick={() => setFullTime(true)} className={chip(fullTime)}>
              {t("fullTime")}
            </button>
            <button type="button" role="radio" aria-checked={!fullTime} onClick={() => setFullTime(false)} className={chip(!fullTime)}>
              {t("partTime")}
            </button>
          </div>
          {!fullTime && (
            <label className="block mt-3">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-[13px] text-ink-soft">{t("scopePctQ")}</span>
                <span className="font-display text-[15px]">{scopePct}%</span>
              </div>
              <input type="range" min={10} max={100} step={5} value={scopePct} onChange={(e) => setScopePct(Number(e.target.value))} aria-label={t("scopePctQ")} />
            </label>
          )}
        </div>

        {/* Base salary */}
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("baseQ")}</span>
          <Input type="number" inputMode="numeric" min={0} value={base} onChange={(e) => setBase(e.target.value)} placeholder="₪ 6,443" />
        </label>

        {/* Pension */}
        <div>
          <span className="text-[13.5px] text-ink-soft block mb-2">{t("pensionQ")}</span>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("pensionQ")}>
            <button type="button" role="radio" aria-checked={pensionShown} onClick={() => setPensionShown(true)} className={chip(pensionShown)}>
              {t("yes")}
            </button>
            <button type="button" role="radio" aria-checked={!pensionShown} onClick={() => setPensionShown(false)} className={chip(!pensionShown)}>
              {t("no")}
            </button>
          </div>
          {pensionShown && (
            <label className="block mt-3">
              <span className="text-[13px] text-ink-soft block mb-1.5">{t("employerPensionQ")}</span>
              <Input type="number" inputMode="numeric" min={0} value={employerPension} onChange={(e) => setEmployerPension(e.target.value)} placeholder="₪" />
            </label>
          )}
        </div>

        {/* Seniority */}
        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">{t("seniorityQ")}</span>
            <span className="font-display text-[15px]">{seniority}</span>
          </div>
          <input type="range" min={0} max={30} step={1} value={seniority} onChange={(e) => setSeniority(Number(e.target.value))} aria-label={t("seniorityQ")} />
        </label>

        {/* Havraa */}
        <div>
          <span className="text-[13.5px] text-ink-soft block mb-2">{t("havraaQ")}</span>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("havraaQ")}>
            <button type="button" role="radio" aria-checked={havraaPaid} onClick={() => setHavraaPaid(true)} className={chip(havraaPaid)}>
              {t("yes")}
            </button>
            <button type="button" role="radio" aria-checked={!havraaPaid} onClick={() => setHavraaPaid(false)} className={chip(!havraaPaid)}>
              {t("no")}
            </button>
          </div>
          {havraaPaid && (
            <label className="block mt-3">
              <span className="text-[13px] text-ink-soft block mb-1.5">{t("havraaAmountQ")}</span>
              <Input type="number" inputMode="numeric" min={0} value={havraaAmount} onChange={(e) => setHavraaAmount(e.target.value)} placeholder="₪" />
            </label>
          )}
        </div>
      </Card>

      {/* Result */}
      {ready ? (
        <>
          <Card className="mt-5 p-6 text-center">
            {audit.flagged > 0 ? (
              <>
                <div className="text-[13px] text-ink-soft font-bold">{t("gapTitle")}</div>
                <div className="font-display grad-text text-4xl mt-1.5" aria-live="polite">
                  {money(audit.annualGapAgorot)}
                </div>
                <div className="text-[12.5px] text-ink-soft mt-1.5">
                  {t("gapSub", { count: audit.flagged })}
                </div>
              </>
            ) : (
              <>
                <div className="text-[26px]" aria-hidden>✅</div>
                <div className="font-display text-2xl mt-1">{t("allOk")}</div>
                <div className="text-[12.5px] text-ink-soft mt-1.5">{t("allOkSub")}</div>
              </>
            )}
          </Card>

          <div className="mt-4 flex flex-col gap-2.5">
            {audit.findings.map((f) => (
              <FindingRow key={f.id} f={f} t={t} money={money} />
            ))}
          </div>

          <Card className="mt-5 p-6">
            <div className="font-extrabold text-[15px] mb-3">{t("howTitle")}</div>
            <ul className="m-0 p-0 ps-4 list-disc flex flex-col gap-2 text-[13.5px] text-ink-soft leading-relaxed">
              {(t.raw("howSteps") as string[]).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <p className="mt-5 text-[13px] text-ink-soft text-center">{t("enterBase")}</p>
      )}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}

function FindingRow({
  f,
  t,
  money,
}: {
  f: Finding;
  t: ReturnType<typeof useTranslations>;
  money: (a: number) => string;
}) {
  const tone: Record<FindingStatus, string> = {
    ok: "border-[rgba(63,203,155,0.35)]",
    shortfall: "border-[rgba(240,180,92,0.4)]",
    missing: "border-[rgba(240,180,92,0.4)]",
    unknown: "border-[rgba(255,255,255,0.1)]",
  };
  const icon: Record<FindingStatus, string> = { ok: "✓", shortfall: "⚠", missing: "⚠", unknown: "•" };
  const gap = f.monthlyAgorot ?? f.annualAgorot ?? 0;
  const gapLabel = f.monthlyAgorot ? t("perMonth") : t("perYear");

  return (
    <div className={`rounded-xl border ${tone[f.status]} bg-[rgba(255,255,255,0.025)] p-3.5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-extrabold text-[14px]">
          <span className="text-emerald me-1.5" aria-hidden>{icon[f.status]}</span>
          {t(`items.${f.id}.title`)}
        </span>
        <span className="text-[11px] font-bold text-ink-soft shrink-0">{t(`status.${f.status}`)}</span>
      </div>
      <p className="text-ink-soft text-[12px] leading-relaxed mt-1 mb-0">
        {t(`items.${f.id}.desc`)}
      </p>
      {gap > 0 && (f.status === "shortfall" || f.status === "missing") && (
        <div className="text-[12.5px] mt-1.5">
          <span className="text-ink-soft">{t("estimatedGap")}: </span>
          <b className="text-amber">{money(gap)}</b> <span className="text-ink-soft">{gapLabel}</span>
        </div>
      )}
    </div>
  );
}
